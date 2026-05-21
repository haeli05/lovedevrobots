import { deepseek } from '@ai-sdk/deepseek';
import { createDataStreamResponse, streamText, tool } from 'ai';
import { z } from 'zod';

import {
  addPartToAssembly,
  getAssemblyStats,
  newAssembly,
  validateAssembly,
} from '@/lib/assembly';
import { getCataloguePart, searchCatalogue } from '@/lib/catalogue';
import type { Assembly } from '@/lib/types';

const PART_CATEGORY = z.enum([
  'servo', 'bracket', 'frame', 'controller', 'gripper',
  'sensor', 'wheel', 'motor', 'battery', 'misc',
]);

const SYSTEM_PROMPT = `You are the assembly agent for lovedevrobots — an AI-powered robot builder.

Your job: given a user's description of a robot they want, build a valid assembly from the parts catalogue.

Workflow:
1. Clarify requirements if critical info is missing (DOF, payload, reach, budget, power source).
2. Use search_parts to find candidate components.
3. Use get_part_details to inspect mount points before connecting.
4. Use check_compatibility before every add_part call that has a parent.
5. Build the assembly incrementally; call get_assembly_state often to track weight and cost.
6. Call validate_assembly before finalizing — fix any errors it reports.
7. Call finalize_assembly only after validation passes.

Hard rules:
- Never connect parts with mismatched connector types. The validator will reject it.
- Every robot needs a controller and a power source. Check before finalizing.
- Stay within the user's stated budget. If you can't, surface the tradeoff explicitly.
- Prefer fewer parts. A 4-DOF arm with 4 servos is better than 6 servos when the user wants simple.
- Use Z-up, X-forward, mm, kg conventions in all reasoning.

Always explain your reasoning step-by-step as you build. Mention which parts you're picking and why.`;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: { role: string; content: string }[];
    assembly?: Assembly | null;
  };
  const { messages } = body;

  // Assembly state for this streaming request. Mutated by tool calls.
  let assembly: Assembly = body.assembly ?? newAssembly();

  return createDataStreamResponse({
    execute: async (dataStream) => {
      const result = streamText({
        model: deepseek('deepseek-chat'),
        system: SYSTEM_PROMPT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        maxSteps: 20,

        tools: {
          search_parts: tool({
            description:
              'Search the parts catalogue. Returns SKU, name, category, price, weight, and connector summary. Use to find candidate parts for a given role.',
            parameters: z.object({
              query: z.string().describe('Free-text search query'),
              category: PART_CATEGORY.optional().describe('Filter by category'),
              max_results: z.number().int().min(1).max(20).default(10),
            }),
            execute: async ({ query, category, max_results }) => {
              const parts = searchCatalogue(query, category ?? null, max_results);
              return parts.map((p) => ({
                sku: p.sku,
                name: p.name,
                category: p.category,
                price_usd: p.price_usd,
                weight_g: p.specs.weight_g,
                description: p.description,
                connectors: p.mount_points.map((m) => `${m.id}(${m.connector})`).join(', '),
              }));
            },
          }),

          get_part_details: tool({
            description:
              'Get the full part record by SKU, including all mount points, specs, and connector types.',
            parameters: z.object({
              sku: z.string(),
            }),
            execute: async ({ sku }) => {
              const part = getCataloguePart(sku);
              if (!part) return { error: `Part not found: ${sku}` };
              return part;
            },
          }),

          check_compatibility: tool({
            description:
              "Check whether two parts can connect via specific mount points. Returns compatible: bool and reason. Always call this before add_part when there's a parent.",
            parameters: z.object({
              part_a_sku: z.string(),
              mount_a_id: z.string(),
              part_b_sku: z.string(),
              mount_b_id: z.string(),
            }),
            execute: async ({ part_a_sku, mount_a_id, part_b_sku, mount_b_id }) => {
              const partA = getCataloguePart(part_a_sku);
              const partB = getCataloguePart(part_b_sku);
              if (!partA) return { compatible: false, reason: `Unknown SKU: ${part_a_sku}` };
              if (!partB) return { compatible: false, reason: `Unknown SKU: ${part_b_sku}` };
              const mountA = partA.mount_points.find((m) => m.id === mount_a_id);
              const mountB = partB.mount_points.find((m) => m.id === mount_b_id);
              if (!mountA)
                return { compatible: false, reason: `Mount '${mount_a_id}' not found on ${part_a_sku}` };
              if (!mountB)
                return { compatible: false, reason: `Mount '${mount_b_id}' not found on ${part_b_sku}` };
              if (mountA.connector !== mountB.connector) {
                return {
                  compatible: false,
                  reason: `Connector mismatch: ${mountA.connector} ≠ ${mountB.connector}`,
                };
              }
              return { compatible: true, reason: 'ok', connector: mountA.connector };
            },
          }),

          add_part: tool({
            description:
              'Add a part to the current assembly. If parent_instance_id is omitted, the part becomes the root. Otherwise attaches to the parent via specified mount points.',
            parameters: z.object({
              sku: z.string(),
              parent_instance_id: z.string().optional().describe('Instance ID of the parent part'),
              parent_mount: z.string().optional().describe('Mount ID on the parent to attach to'),
              child_mount: z.string().optional().describe('Mount ID on the child to connect'),
            }),
            execute: async ({ sku, parent_instance_id, parent_mount, child_mount }) => {
              const part = getCataloguePart(sku);
              if (!part) return { ok: false, error: `Unknown SKU: ${sku}` };

              const { assembly: updated, instanceId } = addPartToAssembly(
                assembly,
                sku,
                parent_instance_id ?? null,
                parent_mount ?? null,
                child_mount ?? null,
              );
              assembly = updated;

              dataStream.writeData({ type: 'assembly_update', assembly });

              const stats = getAssemblyStats(assembly);
              return {
                ok: true,
                instance_id: instanceId,
                part_name: part.name,
                stats: {
                  parts: stats.partCount,
                  weight_g: stats.totalWeight_g,
                  price_usd: Number(stats.totalPrice_usd.toFixed(2)),
                  dof: stats.dofCount,
                },
              };
            },
          }),

          get_assembly_state: tool({
            description:
              'Get current assembly: list of parts, connections, total weight, total cost, DOF count.',
            parameters: z.object({}),
            execute: async () => {
              const stats = getAssemblyStats(assembly);
              return {
                parts: Object.values(assembly.nodes).map((n) => ({
                  instance_id: n.instance_id,
                  sku: n.sku,
                  name: getCataloguePart(n.sku)?.name ?? n.sku,
                  price_usd: getCataloguePart(n.sku)?.price_usd ?? 0,
                })),
                connections: assembly.connections.map((c) => ({
                  parent: `${c.parent_sku}.${c.parent_mount}`,
                  child: `${c.child_sku}.${c.child_mount}`,
                })),
                stats: {
                  parts: stats.partCount,
                  weight_g: stats.totalWeight_g,
                  price_usd: Number(stats.totalPrice_usd.toFixed(2)),
                  dof: stats.dofCount,
                  has_controller: stats.hasController,
                  has_power: stats.hasPower,
                },
              };
            },
          }),

          validate_assembly: tool({
            description:
              'Run feasibility checks: connector compatibility, required components (controller, power). Must be called before finalize_assembly.',
            parameters: z.object({}),
            execute: async () => {
              const result = validateAssembly(assembly);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dataStream.writeData({ type: 'validation', result: result as any });
              return result;
            },
          }),

          finalize_assembly: tool({
            description:
              'Lock the assembly and generate exports. Only call after validate_assembly returns ok:true.',
            parameters: z.object({
              name: z.string().describe('Human-readable name for the robot'),
            }),
            execute: async ({ name }) => {
              assembly = { ...assembly, name };
              dataStream.writeData({ type: 'assembly_update', assembly });
              dataStream.writeData({ type: 'finalized', name });
              const stats = getAssemblyStats(assembly);
              return {
                ok: true,
                name,
                stats: {
                  parts: stats.partCount,
                  weight_g: stats.totalWeight_g,
                  price_usd: Number(stats.totalPrice_usd.toFixed(2)),
                  dof: stats.dofCount,
                },
                message:
                  'Assembly finalized. Download STEP, URDF, STL, or BOM CSV from the assembly panel.',
              };
            },
          }),
        },
      });

      result.mergeIntoDataStream(dataStream);
    },

    onError: (error) => {
      console.error('Agent error:', error);
      return error instanceof Error ? error.message : String(error);
    },
  });
}
