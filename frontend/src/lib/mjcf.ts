import type { TreeNode } from './assembly';

const CATEGORY_COLORS: Record<string, string> = {
  servo:      '0.7 0.15 0.1 1',
  bracket:    '0.75 0.75 0.8 1',
  frame:      '0.5 0.5 0.55 1',
  controller: '0.1 0.45 0.2 1',
  gripper:    '0.8 0.8 0.8 1',
  sensor:     '0.2 0.3 0.8 1',
  wheel:      '0.15 0.15 0.15 1',
  motor:      '0.6 0.4 0.1 1',
  battery:    '0.2 0.6 0.2 1',
  misc:       '0.5 0.5 0.5 1',
};

function bodyColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.misc;
}

/** Derive a stable mesh asset name from a mesh URL. */
export function meshNameFromUrl(url: string): string {
  return (url.split('/').pop() ?? url).replace(/\.(stl|STL)$/, '');
}

/** Collect unique mesh URLs that appear in the nodeMap. */
export function collectMeshUrls(nodeMap: Record<string, TreeNode>): string[] {
  const seen = new Set<string>();
  for (const node of Object.values(nodeMap)) {
    if (node.mesh_url) seen.add(node.mesh_url);
  }
  return Array.from(seen);
}

function buildBodyXml(
  nodeId: string,
  nodeMap: Record<string, TreeNode>,
  availableMeshNames: Set<string>,
  depth = 0,
): string {
  const node = nodeMap[nodeId];
  if (!node) return '';

  const indent = '  '.repeat(depth + 2);
  const [ox, oy, oz] = node.localOffset.map((v) => (v / 1000).toFixed(4));
  const [hx, hy, hz] = node.dims.map((v) => Math.max(v / 2000, 0.005).toFixed(4));

  const jointXml = (() => {
    if (!node.isJoint || !node.jointAxis) return '';
    const [ax, ay, az] = node.jointAxis;
    const [lo, hi] = node.jointLimitsDeg ?? [-90, 90];
    return `\n${indent}  <joint type="hinge" name="jnt_${node.instanceId}" axis="${ax} ${ay} ${az}" limited="true" range="${lo} ${hi}" damping="0.5" armature="0.01"/>`;
  })();

  // Use real mesh if available, otherwise fall back to box approximation
  const meshName = node.mesh_url ? meshNameFromUrl(node.mesh_url) : null;
  const geomXml = meshName && availableMeshNames.has(meshName)
    ? `<geom type="mesh" mesh="${meshName}" rgba="${bodyColor(node.category)}" condim="3"/>`
    : `<geom type="box" size="${hx} ${hy} ${hz}" rgba="${bodyColor(node.category)}" condim="3"/>`;

  const children = node.childInstanceIds
    .map((cid) => buildBodyXml(cid, nodeMap, availableMeshNames, depth + 1))
    .join('');

  return `
${indent}<body name="${node.instanceId}" pos="${ox} ${oy} ${oz}">
${indent}  <inertial mass="${Math.max(0.05, node.dims.reduce((a,v) => a + v, 0) / 30 * 0.1).toFixed(3)}" pos="0 0 0" diaginertia="${boxInertia(node.dims)}"/>
${indent}  ${geomXml}${jointXml}
${children}${indent}</body>`;
}

/** Rough box inertia string: I = m/12 * (a² + b²) for each axis pair, with m estimated from dims. */
function boxInertia(dims_mm: [number, number, number]): string {
  const [a, b, c] = dims_mm.map((v) => v / 1000); // meters
  const m = Math.max(0.05, (a * b * c) * 1200); // rough density 1200 kg/m³
  const ixx = (m / 12) * (b * b + c * c);
  const iyy = (m / 12) * (a * a + c * c);
  const izz = (m / 12) * (a * a + b * b);
  const fmt = (v: number) => Math.max(v, 1e-6).toExponential(3);
  return `${fmt(ixx)} ${fmt(iyy)} ${fmt(izz)}`;
}

/**
 * Generate MJCF XML.
 * `availableMeshNames` should contain mesh names (from meshNameFromUrl) that
 * have already been written to the VFS at /working/meshes/<name>.stl.
 * If null, all mesh_url references are treated as unavailable (box fallback).
 */
export function generateMJCF(
  nodeMap: Record<string, TreeNode>,
  availableMeshNames: Set<string> | null = null,
): string {
  const roots = Object.values(nodeMap).filter((n) => n.parentInstanceId === null);
  if (roots.length === 0) return '';

  const meshSet = availableMeshNames ?? new Set<string>();

  // Asset section: one <mesh> per unique STL
  const meshAssets = collectMeshUrls(nodeMap)
    .map((url) => {
      const name = meshNameFromUrl(url);
      const fname = url.split('/').pop() ?? url;
      // scale="0.001 0.001 0.001" converts STL mm → MuJoCo meters
      return `    <mesh name="${name}" file="meshes/${fname}" scale="0.001 0.001 0.001"/>`;
    })
    .join('\n');

  const bodiesXml = roots.map((r) => buildBodyXml(r.instanceId, nodeMap, meshSet)).join('');

  const jointNodes = Object.values(nodeMap).filter((n) => n.isJoint);
  const actuatorsXml = jointNodes
    .map((n) => {
      const [lo, hi] = n.jointLimitsDeg ?? [-90, 90];
      const loR = ((lo * Math.PI) / 180).toFixed(4);
      const hiR = ((hi * Math.PI) / 180).toFixed(4);
      return `    <position name="act_${n.instanceId}" joint="jnt_${n.instanceId}" kp="10" ctrlrange="${loR} ${hiR}" forcelimited="true" forcerange="-20 20"/>`;
    })
    .join('\n');

  return `<mujoco model="robot">
  <option timestep="0.002" gravity="0 0 -9.81" integrator="RK4"/>
  <compiler meshdir="/working/meshes" autolimits="true"/>
  <default>
    <geom friction="0.8 0.005 0.001" condim="3"/>
  </default>
  <asset>
${meshAssets}
  </asset>
  <worldbody>
    <light name="main" directional="true" pos="0 0 3" dir="0 0 -1" diffuse="0.8 0.8 0.8" specular="0.2 0.2 0.2"/>
    <light name="fill" directional="true" pos="-1 -1 2" dir="1 1 -1" diffuse="0.4 0.4 0.4"/>
    <geom name="floor" type="plane" size="2 2 0.1" rgba="0.4 0.4 0.4 1"/>
    ${bodiesXml}
  </worldbody>
  <actuator>
${actuatorsXml}
  </actuator>
</mujoco>`;
}

/** Returns the list of joint actuator names in ctrl[] order. */
export function getJointActuatorNames(nodeMap: Record<string, TreeNode>): string[] {
  return Object.values(nodeMap)
    .filter((n) => n.isJoint)
    .map((n) => `act_${n.instanceId}`);
}
