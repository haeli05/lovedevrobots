'use client';

/**
 * PhysicsScene — integrates @mujoco/mujoco WASM into an R3F canvas.
 *
 * Coordinate mapping: MuJoCo is Z-up (meters), Three.js is Y-up (meters).
 * We wrap all physics bodies in a root group rotated -90° around X, so
 * MuJoCo Z becomes Three.js Y. Body positions/quats from xpos/xquat are
 * set in the group's local (Z-up) frame — no per-body conversion needed.
 */

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TreeNode } from '@/lib/assembly';
import { generateMJCF, collectMeshUrls, meshNameFromUrl } from '@/lib/mjcf';

// ── Types ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MujocoModule = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MjModel = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MjData = any;

interface PhysicsSim {
  mujoco: MujocoModule;
  model: MjModel;
  data: MjData;
  nbody: number;
}

// ── Load mujoco_wasm (singleton) ───────────────────────────────────────────────

let mujocoPromise: Promise<MujocoModule> | null = null;

async function getMujoco(): Promise<MujocoModule> {
  if (!mujocoPromise) {
    mujocoPromise = (async () => {
      const { default: loadMujoco } = await import('@mujoco/mujoco');
      return loadMujoco({
        // locateFile tells Emscripten where to fetch the .wasm binary
        locateFile: (file: string) => {
          if (file.endsWith('.wasm')) return '/mujoco.wasm';
          return file;
        },
      });
    })();
  }
  return mujocoPromise;
}

// ── Category → THREE color ─────────────────────────────────────────────────────

const CATEGORY_THREE_COLOR: Record<string, number> = {
  servo:      0xb02519,
  bracket:    0xbcbccc,
  frame:      0x808090,
  controller: '#1a7233' as unknown as number,
  gripper:    0xcccccc,
  sensor:     0x334dcc,
  wheel:      0x252525,
  motor:      0x997a1a,
  battery:    0x339933,
  misc:       0x808080,
};

function catColor(category: string): THREE.Color {
  const hex = CATEGORY_THREE_COLOR[category] ?? 0x808080;
  return new THREE.Color(hex);
}

// ── PhysicsScene ───────────────────────────────────────────────────────────────

interface Props {
  nodeMap: Record<string, TreeNode>;
  onStatusChange?: (status: 'loading' | 'ready' | 'error') => void;
}

export function PhysicsScene({ nodeMap, onStatusChange }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const simRef = useRef<PhysicsSim | null>(null);
  const bodiesRef = useRef<THREE.Group[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const updateStatus = (s: 'loading' | 'ready' | 'error') => {
    setStatus(s);
    onStatusChange?.(s);
  };

  // Build sim whenever nodeMap changes
  useEffect(() => {
    if (Object.keys(nodeMap).length === 0) return;

    let cancelled = false;

    const init = async () => {
      try {
        updateStatus('loading');

        const mujoco = await getMujoco();
        if (cancelled) return;

        // ── Write STL meshes to MuJoCo VFS ──────────────────────────────────
        const meshUrls = collectMeshUrls(nodeMap);
        const availableMeshNames = new Set<string>();

        // Set up VFS directories
        try { mujoco.FS.mkdir('/working'); } catch { /* exists */ }
        try { mujoco.FS.mkdir('/working/meshes'); } catch { /* exists */ }

        // Fetch all STLs in parallel and write to VFS
        await Promise.all(
          meshUrls.map(async (url) => {
            try {
              const res = await fetch(url);
              if (!res.ok) return;
              const buf = new Uint8Array(await res.arrayBuffer());
              const fname = url.split('/').pop()!;
              mujoco.FS.writeFile(`/working/meshes/${fname}`, buf);
              availableMeshNames.add(meshNameFromUrl(url));
            } catch {
              // mesh unavailable — will fall back to box geom
            }
          }),
        );

        if (cancelled) return;

        // ── Generate and load MJCF ───────────────────────────────────────────
        const mjcfXml = generateMJCF(nodeMap, availableMeshNames);
        if (!mjcfXml) { updateStatus('error'); return; }

        // Write scene XML to VFS so mj_loadXML can resolve mesh paths
        mujoco.FS.writeFile('/working/scene.xml', mjcfXml);

        const model: MjModel = mujoco.MjModel.mj_loadXML('/working/scene.xml');
        const data: MjData = new mujoco.MjData(model);
        mujoco.mj_forward(model, data);

        if (cancelled) { model.delete(); data.delete(); return; }

        simRef.current = { mujoco, model, data, nbody: (model.nbody as number) };

        // Rebuild body group hierarchy
        if (groupRef.current) {
          // Remove old body groups
          bodiesRef.current.forEach((b) => {
            if (groupRef.current) groupRef.current.remove(b);
          });
          bodiesRef.current = [];

          // One group per MuJoCo body (body 0 = world, skip)
          for (let i = 0; i < model.nbody; i++) {
            const bg = new THREE.Group();
            bg.userData.bodyIdx = i;
            bodiesRef.current.push(bg);
            groupRef.current.add(bg);
          }

          // Add geom meshes to their owner body group
          for (let g = 0; g < model.ngeom; g++) {
            const gtype = model.geom_type[g];
            const bodyId: number = model.geom_bodyid[g];
            const bg = bodiesRef.current[bodyId];
            if (!bg) continue;

            const size = model.geom_size.subarray(g * 3, g * 3 + 3);
            const geomPos = model.geom_pos.subarray(g * 3, g * 3 + 3);
            const geomQuat = model.geom_quat.subarray(g * 4, g * 4 + 4);

            // Determine MuJoCo geom type enum values (lazy, reuse across loop)
            const mjgtBox = getMJGeomType(mujoco, 'mjGEOM_BOX');
            const mjgtPlane = getMJGeomType(mujoco, 'mjGEOM_PLANE');
            const mjgtCapsule = getMJGeomType(mujoco, 'mjGEOM_CAPSULE');
            const mjgtCylinder = getMJGeomType(mujoco, 'mjGEOM_CYLINDER');
            const mjgtSphere = getMJGeomType(mujoco, 'mjGEOM_SPHERE');
            const mjgtMesh = getMJGeomType(mujoco, 'mjGEOM_MESH');

            let geo: THREE.BufferGeometry | null = null;

            if (gtype === mjgtPlane) {
              geo = new THREE.PlaneGeometry(4, 4);
            } else if (gtype === mjgtBox) {
              geo = new THREE.BoxGeometry(size[0] * 2, size[1] * 2, size[2] * 2);
            } else if (gtype === mjgtSphere) {
              geo = new THREE.SphereGeometry(size[0], 16, 16);
            } else if (gtype === mjgtCylinder) {
              geo = new THREE.CylinderGeometry(size[0], size[0], size[1] * 2, 16);
              geo.rotateX(Math.PI / 2);
            } else if (gtype === mjgtCapsule) {
              geo = new THREE.CapsuleGeometry(size[0], size[1] * 2, 8, 16);
              geo.rotateX(Math.PI / 2);
            } else if (gtype === mjgtMesh) {
              // Read vertex + face data directly from MuJoCo's WASM memory
              const mId: number = model.geom_dataid[g];
              const vAdr: number = model.mesh_vertadr[mId];
              const vNum: number = model.mesh_vertnum[mId];
              const fAdr: number = model.mesh_faceadr[mId];
              const fNum: number = model.mesh_facenum[mId];
              geo = new THREE.BufferGeometry();
              geo.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(
                  Float32Array.from(model.mesh_vert.subarray(vAdr * 3, (vAdr + vNum) * 3)),
                  3,
                ),
              );
              geo.setIndex(
                Array.from(model.mesh_face.subarray(fAdr * 3, (fAdr + fNum) * 3) as Int32Array),
              );
              geo.computeVertexNormals();
            }

            if (!geo) continue;

            // Look up body name to find its category
            const category = getBodyCategory(nodeMap, bodyId, model);
            const mat = new THREE.MeshStandardMaterial({
              color: gtype === mjgtPlane ? new THREE.Color(0x404040) : catColor(category),
              roughness: 0.55,
              metalness: gtype === mjgtPlane ? 0 : 0.35,
              envMapIntensity: 1.2,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Local offset within body
            mesh.position.set(geomPos[0], geomPos[1], geomPos[2]);
            // MuJoCo quat: [w,x,y,z] → Three.js: [x,y,z,w]
            mesh.quaternion.set(geomQuat[1], geomQuat[2], geomQuat[3], geomQuat[0]);

            bg.add(mesh);
          }

          updateStatus('ready');
        }
      } catch (e) {
        if (!cancelled) {
          console.error('MuJoCo init error:', e);
          updateStatus('error');
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      const oldSim = simRef.current;
      if (oldSim) {
        simRef.current = null;
        oldSim.data.delete();
        oldSim.model.delete();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Object.keys(nodeMap).sort())]);

  // Physics + render loop
  useFrame(({ clock }) => {
    const sim = simRef.current;
    if (!sim || status !== 'ready') return;
    const { mujoco, model, data } = sim;

    // Drive joints with sine wave (same phasors as DOF preview)
    const jointNodes = Object.values(nodeMap).filter((n) => n.isJoint);
    const t = clock.getElapsedTime();
    for (let i = 0; i < Math.min(jointNodes.length, model.nu); i++) {
      const node = jointNodes[i];
      const [lo, hi] = node.jointLimitsDeg ?? [-90, 90];
      const mid = ((lo + hi) / 2) * (Math.PI / 180);
      const amp = ((hi - lo) / 2) * 0.65 * (Math.PI / 180);
      const phase = (i * Math.PI) / 3;
      const target = mid + amp * Math.sin(t * 0.55 + phase);
      // data.ctrl is a live Float64Array view into WASM memory
      (data.ctrl as Float64Array)[i] = target;
    }

    // Step physics (multiple sub-steps to fill ~16ms frame)
    const startTime: number = data.time;
    while (data.time - startTime < 1.0 / 60.0) {
      mujoco.mj_step(model, data);
    }

    // Sync Three.js body groups from MuJoCo world positions
    const xpos: Float64Array = data.xpos;
    const xquat: Float64Array = data.xquat;

    for (let i = 0; i < sim.nbody; i++) {
      const bg = bodiesRef.current[i];
      if (!bg) continue;
      bg.position.set(xpos[i * 3], xpos[i * 3 + 1], xpos[i * 3 + 2]);
      // MuJoCo quat [w,x,y,z] → THREE [x,y,z,w]
      bg.quaternion.set(xquat[i * 4 + 1], xquat[i * 4 + 2], xquat[i * 4 + 3], xquat[i * 4]);
    }
  });

  return (
    <>
      {/* Rotate the entire physics scene from MuJoCo Z-up to Three.js Y-up */}
      <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]} />

      {/* Loading overlay via HTML (outside physics group) */}
      {status === 'loading' && (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.01, 0.01, 0.01]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getMJGeomType(mujoco: MujocoModule, name: string): number {
  const v = mujoco.mjtGeom?.[name];
  return (typeof v === 'object' && v !== null && 'value' in v) ? (v as { value: number }).value : (v as number);
}

function getBodyCategory(
  nodeMap: Record<string, TreeNode>,
  bodyIdx: number,
  model: MjModel,
): string {
  // Body 0 = worldbody, no category
  if (bodyIdx === 0) return 'misc';
  try {
    // Read body name from MuJoCo model
    const nameAdr: number = model.name_bodyadr[bodyIdx];
    // Extract null-terminated string from names buffer
    const names: Uint8Array = model.names;
    let end = nameAdr;
    while (end < names.length && names[end] !== 0) end++;
    const name = new TextDecoder().decode(names.subarray(nameAdr, end));
    const node = nodeMap[name];
    return node?.category ?? 'misc';
  } catch {
    return 'misc';
  }
}
