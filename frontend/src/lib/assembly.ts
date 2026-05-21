import type { Assembly, AssemblyNode, Part } from './types';
import { getCataloguePart } from './catalogue';

export function newAssembly(): Assembly {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled robot',
    root_instance_id: null,
    nodes: {},
    connections: [],
    description: '',
  };
}

export function addPartToAssembly(
  assembly: Assembly,
  sku: string,
  parentInstanceId: string | null,
  parentMount: string | null,
  childMount: string | null,
): { assembly: Assembly; instanceId: string } {
  const count = Object.keys(assembly.nodes).filter((id) => id.startsWith(sku)).length;
  const instanceId = count === 0 ? sku : `${sku}_${count}`;

  const node: AssemblyNode = {
    instance_id: instanceId,
    sku,
    world_position: [0, 0, 0],
    world_orientation: [0, 0, 0, 1],
  };

  const newNodes = { ...assembly.nodes, [instanceId]: node };
  const newConnections = [...assembly.connections];

  let rootInstanceId = assembly.root_instance_id;
  if (!parentInstanceId) {
    rootInstanceId = instanceId;
  } else if (parentMount && childMount) {
    const parentNode = assembly.nodes[parentInstanceId];
    if (parentNode) {
      newConnections.push({
        parent_instance_id: parentInstanceId,
        parent_sku: parentNode.sku,
        parent_mount: parentMount,
        child_sku: sku,
        child_mount: childMount,
        child_instance_id: instanceId,
      });
    }
  }

  return {
    assembly: { ...assembly, root_instance_id: rootInstanceId, nodes: newNodes, connections: newConnections },
    instanceId,
  };
}

export interface AssemblyStats {
  partCount: number;
  totalWeight_g: number;
  totalPrice_usd: number;
  dofCount: number;
  hasController: boolean;
  hasPower: boolean;
}

export function getAssemblyStats(assembly: Assembly): AssemblyStats {
  const parts = Object.values(assembly.nodes).map((n) => getCataloguePart(n.sku));
  const valid = parts.filter((p): p is Part => p !== null);

  const dofCount = assembly.connections.filter((c) => {
    const part = getCataloguePart(c.child_sku);
    if (!part) return false;
    const mount = part.mount_points.find((m) => m.id === c.child_mount);
    return mount?.is_joint ?? false;
  }).length;

  return {
    partCount: Object.keys(assembly.nodes).length,
    totalWeight_g: valid.reduce((s, p) => s + p.specs.weight_g, 0),
    totalPrice_usd: valid.reduce((s, p) => s + p.price_usd, 0),
    dofCount,
    hasController: valid.some((p) => p.category === 'controller'),
    hasPower: valid.some((p) => p.category === 'battery'),
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAssembly(assembly: Assembly): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (Object.keys(assembly.nodes).length === 0) {
    errors.push('Assembly is empty — add at least one part.');
    return { ok: false, errors, warnings };
  }

  const stats = getAssemblyStats(assembly);

  if (!stats.hasController) {
    errors.push('No controller found. Every robot needs a controller (ESP32, Raspberry Pi, etc.).');
  }
  if (!stats.hasPower) {
    errors.push('No power source found. Add a battery or note an external power supply.');
  }

  // Check connection compatibility
  for (const conn of assembly.connections) {
    const parentPart = getCataloguePart(conn.parent_sku);
    const childPart = getCataloguePart(conn.child_sku);
    if (!parentPart) { errors.push(`Unknown SKU in connection: ${conn.parent_sku}`); continue; }
    if (!childPart) { errors.push(`Unknown SKU in connection: ${conn.child_sku}`); continue; }
    const mountA = parentPart.mount_points.find((m) => m.id === conn.parent_mount);
    const mountB = childPart.mount_points.find((m) => m.id === conn.child_mount);
    if (!mountA) { errors.push(`Mount '${conn.parent_mount}' not found on ${conn.parent_sku}`); continue; }
    if (!mountB) { errors.push(`Mount '${conn.child_mount}' not found on ${conn.child_sku}`); continue; }
    if (mountA.connector !== mountB.connector) {
      errors.push(
        `Connector mismatch: ${conn.parent_sku}.${conn.parent_mount} (${mountA.connector}) ↔ ${conn.child_sku}.${conn.child_mount} (${mountB.connector})`,
      );
    }
  }

  if (stats.dofCount === 0 && Object.keys(assembly.nodes).length > 1) {
    warnings.push('No actuated joints found. Did you mean to add servos?');
  }

  if (stats.totalPrice_usd > 400) {
    warnings.push(`BOM total $${stats.totalPrice_usd.toFixed(2)} exceeds $400 budget.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Simple layout: stack parts along Z-axis for 3D viewer (until Week 2 assembler). */
export interface LayoutNode {
  instanceId: string;
  sku: string;
  position: [number, number, number];
  dims: [number, number, number];
  category: string;
  mesh_url: string | null;
}

export function computeSimpleLayout(assembly: Assembly): LayoutNode[] {
  const nodes = Object.values(assembly.nodes);
  if (nodes.length === 0) return [];

  const layout: LayoutNode[] = [];
  let zOffset = 0;

  for (const node of nodes) {
    const part = getCataloguePart(node.sku);
    const dims = (part?.specs.dims_mm as [number, number, number] | undefined) ?? [40, 20, 40];
    const height = dims[2] ?? 40;

    const rawUrl = part?.mesh_url ?? null;
    const mesh_url = rawUrl && !rawUrl.startsWith('/') ? `/${rawUrl}` : rawUrl;

    layout.push({
      instanceId: node.instance_id,
      sku: node.sku,
      position: [0, 0, zOffset + height / 2],
      dims,
      category: part?.category ?? 'misc',
      mesh_url,
    });

    zOffset += height + 10; // 10mm gap between parts
  }

  return layout;
}

// ── Tree layout (v2 viewer: hierarchical with joint animation) ─────────────────

export interface TreeNode {
  instanceId: string;
  sku: string;
  category: string;
  dims: [number, number, number]; // mm
  mesh_url: string | null;
  parentInstanceId: string | null;
  childInstanceIds: string[];
  /** Offset from parent center in assembly frame (Z-up, mm). Root = world position. */
  localOffset: [number, number, number];
  isJoint: boolean;
  jointAxis: [number, number, number] | null;
  jointLimitsDeg: [number, number] | null;
}

export function computeTreeLayout(assembly: Assembly): Record<string, TreeNode> {
  const instanceIds = Object.keys(assembly.nodes);
  if (instanceIds.length === 0) return {};

  const result: Record<string, TreeNode> = {};

  for (const instanceId of instanceIds) {
    const asmNode = assembly.nodes[instanceId]!;
    const part = getCataloguePart(asmNode.sku);
    const dims = (part?.specs.dims_mm as [number, number, number] | undefined) ?? [40, 20, 40];
    const rawUrl = part?.mesh_url ?? null;
    const mesh_url = rawUrl && !rawUrl.startsWith('/') ? `/${rawUrl}` : rawUrl;

    result[instanceId] = {
      instanceId,
      sku: asmNode.sku,
      category: part?.category ?? 'misc',
      dims,
      mesh_url,
      parentInstanceId: null,
      childInstanceIds: [],
      localOffset: [0, 0, 0],
      isJoint: false,
      jointAxis: null,
      jointLimitsDeg: null,
    };
  }

  // Wire connections
  for (const conn of assembly.connections) {
    const childId = conn.child_instance_id;

    // Resolve parent instance: prefer explicit parent_instance_id, fall back to SKU lookup
    const parentId =
      conn.parent_instance_id ??
      instanceIds.find(
        (id) =>
          assembly.nodes[id]?.sku === conn.parent_sku &&
          !assembly.connections.some((c) => c.child_instance_id === id),
      ) ??
      instanceIds.find((id) => assembly.nodes[id]?.sku === conn.parent_sku);

    if (!parentId || !result[parentId] || !result[childId]) continue;

    result[parentId]!.childInstanceIds.push(childId);
    result[childId]!.parentInstanceId = parentId;

    // Propagate joint info from child mount
    const childPart = getCataloguePart(conn.child_sku);
    const childMount = childPart?.mount_points.find((m) => m.id === conn.child_mount);
    if (childMount?.is_joint) {
      result[childId]!.isJoint = true;
      result[childId]!.jointAxis = childMount.joint_axis ?? [0, 0, 1];
      result[childId]!.jointLimitsDeg = childMount.joint_limits_deg ?? [-90, 90];
    }
  }

  // Compute local offsets via BFS from root
  const rootId = assembly.root_instance_id ?? instanceIds[0];
  const visited = new Set<string>();

  if (rootId && result[rootId]) {
    // Root sits on the ground: center lifted by half its height
    result[rootId]!.localOffset = [0, 0, result[rootId]!.dims[2] / 2];

    const queue = [rootId];
    while (queue.length > 0) {
      const curId = queue.shift()!;
      if (visited.has(curId)) continue;
      visited.add(curId);

      const cur = result[curId]!;
      const siblings = cur.childInstanceIds.length;

      cur.childInstanceIds.forEach((childId, idx) => {
        const child = result[childId];
        if (!child) return;

        // Stack above parent, spread siblings horizontally in X
        const zOffset = cur.dims[2] / 2 + 12 + child.dims[2] / 2;
        const xSpread =
          siblings > 1
            ? (idx - (siblings - 1) / 2) * (Math.max(cur.dims[0], child.dims[0]) + 15)
            : 0;

        child.localOffset = [xSpread, 0, zOffset];
        queue.push(childId);
      });
    }
  }

  // Place orphaned nodes (not yet in tree) in a row to the side
  let orphanX = 80;
  for (const instanceId of instanceIds) {
    if (visited.has(instanceId) || instanceId === rootId) continue;
    const node = result[instanceId];
    if (!node) continue;
    node.localOffset = [orphanX, 0, node.dims[2] / 2];
    orphanX += node.dims[0] + 15;
  }

  return result;
}
