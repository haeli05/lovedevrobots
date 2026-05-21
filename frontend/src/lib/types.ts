// Mirrors backend/app/models/part.py.
// If you change one, change the other. Consider codegen later.

import { z } from "zod";

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export const QuaternionSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const MountPointSchema = z.object({
  id: z.string(),
  position: Vec3Schema,
  orientation: QuaternionSchema.default([0, 0, 0, 1]),
  connector: z.string(),
  is_joint: z.boolean().default(false),
  joint_axis: Vec3Schema.nullable().optional(),
  joint_limits_deg: z.tuple([z.number(), z.number()]).nullable().optional(),
});

export const PartCategorySchema = z.enum([
  "servo",
  "bracket",
  "frame",
  "controller",
  "gripper",
  "sensor",
  "wheel",
  "motor",
  "battery",
  "misc",
]);

export const PartSpecsSchema = z
  .object({
    weight_g: z.number(),
  })
  .passthrough();

export const PartSchema = z.object({
  sku: z.string(),
  name: z.string(),
  category: PartCategorySchema,
  mount_points: z.array(MountPointSchema),
  specs: PartSpecsSchema,
  mesh_url: z.string(),
  cad_url: z.string().nullable(),
  supplier: z.string(),
  price_usd: z.number(),
  lead_time_days: z.number(),
  tags: z.array(z.string()),
  description: z.string(),
});

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Quaternion = z.infer<typeof QuaternionSchema>;
export type MountPoint = z.infer<typeof MountPointSchema>;
export type Part = z.infer<typeof PartSchema>;
export type PartCategory = z.infer<typeof PartCategorySchema>;

export const AssemblyNodeSchema = z.object({
  instance_id: z.string(),
  sku: z.string(),
  world_position: Vec3Schema,
  world_orientation: QuaternionSchema,
});

export const ConnectionSchema = z.object({
  parent_instance_id: z.string().optional(),
  parent_sku: z.string(),
  parent_mount: z.string(),
  child_sku: z.string(),
  child_mount: z.string(),
  child_instance_id: z.string(),
});

export const AssemblySchema = z.object({
  id: z.string(),
  name: z.string(),
  root_instance_id: z.string().nullable(),
  nodes: z.record(z.string(), AssemblyNodeSchema),
  connections: z.array(ConnectionSchema),
  description: z.string(),
});

export type AssemblyNode = z.infer<typeof AssemblyNodeSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type Assembly = z.infer<typeof AssemblySchema>;
