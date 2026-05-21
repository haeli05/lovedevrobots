'use client';

/**
 * MenagerieScene — loads a robot from MuJoCo Menagerie and simulates it in R3F.
 * Coordinate mapping: MuJoCo Z-up → Three.js Y-up via root group rotation.
 */

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { loadMenagerieRobot } from '@/lib/menagerie-loader';
import type { MenagerieRobot } from '@/lib/menagerie';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MujocoModule = any;

interface Sim {
  mujoco: MujocoModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  nbody: number;
  nu: number;
}

// Singleton WASM loader shared with PhysicsScene
let mujocoPromise: Promise<MujocoModule> | null = null;
async function getMujoco(): Promise<MujocoModule> {
  if (!mujocoPromise) {
    mujocoPromise = (async () => {
      const { default: loadMujoco } = await import('@mujoco/mujoco');
      return loadMujoco({
        locateFile: (f: string) => (f.endsWith('.wasm') ? '/mujoco.wasm' : f),
      });
    })();
  }
  return mujocoPromise;
}

function getMJGeomType(mujoco: MujocoModule, name: string): number {
  const v = mujoco.mjtGeom?.[name];
  return typeof v === 'object' && v !== null && 'value' in v ? v.value : v;
}

interface Props {
  robot: MenagerieRobot;
  onStatusChange?: (s: 'loading' | 'ready' | 'error', msg?: string) => void;
}

export function MenagerieScene({ robot, onStatusChange }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const simRef = useRef<Sim | null>(null);
  const bodiesRef = useRef<THREE.Group[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      onStatusChange?.('loading', `Loading ${robot.name}…`);

      try {
        const mujoco = await getMujoco();
        if (cancelled) return;

        onStatusChange?.('loading', `Fetching ${robot.name} assets…`);
        await loadMenagerieRobot(mujoco, robot.id, robot.sceneFile ?? 'scene.xml', (msg) => {
          if (!cancelled) onStatusChange?.('loading', msg);
        });
        if (cancelled) return;

        const model = mujoco.MjModel.mj_loadXML('/working/scene.xml');
        const data = new mujoco.MjData(model);
        mujoco.mj_forward(model, data);
        if (cancelled) { model.delete(); data.delete(); return; }

        simRef.current = { mujoco, model, data, nbody: model.nbody, nu: model.nu };

        // Build body groups + geom meshes
        if (groupRef.current) {
          bodiesRef.current.forEach((b) => groupRef.current!.remove(b));
          bodiesRef.current = [];

          for (let i = 0; i < model.nbody; i++) {
            const bg = new THREE.Group();
            bodiesRef.current.push(bg);
            groupRef.current.add(bg);
          }

          const mjgtBox      = getMJGeomType(mujoco, 'mjGEOM_BOX');
          const mjgtPlane    = getMJGeomType(mujoco, 'mjGEOM_PLANE');
          const mjgtCapsule  = getMJGeomType(mujoco, 'mjGEOM_CAPSULE');
          const mjgtCylinder = getMJGeomType(mujoco, 'mjGEOM_CYLINDER');
          const mjgtSphere   = getMJGeomType(mujoco, 'mjGEOM_SPHERE');
          const mjgtMesh     = getMJGeomType(mujoco, 'mjGEOM_MESH');

          for (let g = 0; g < model.ngeom; g++) {
            const gtype  = model.geom_type[g];
            const bodyId = model.geom_bodyid[g];
            const bg     = bodiesRef.current[bodyId];
            if (!bg) continue;

            const size    = model.geom_size.subarray(g * 3, g * 3 + 3);
            const geomPos = model.geom_pos.subarray(g * 3, g * 3 + 3);
            const geomQuat= model.geom_quat.subarray(g * 4, g * 4 + 4);

            let geo: THREE.BufferGeometry | null = null;

            if (gtype === mjgtPlane) {
              geo = new THREE.PlaneGeometry(8, 8);
            } else if (gtype === mjgtBox) {
              geo = new THREE.BoxGeometry(size[0] * 2, size[1] * 2, size[2] * 2);
            } else if (gtype === mjgtSphere) {
              geo = new THREE.SphereGeometry(size[0], 16, 12);
            } else if (gtype === mjgtCylinder) {
              geo = new THREE.CylinderGeometry(size[0], size[0], size[1] * 2, 16);
              geo.rotateX(Math.PI / 2);
            } else if (gtype === mjgtCapsule) {
              geo = new THREE.CapsuleGeometry(size[0], size[1] * 2, 6, 14);
              geo.rotateX(Math.PI / 2);
            } else if (gtype === mjgtMesh) {
              const mId  = model.geom_dataid[g];
              const vAdr = model.mesh_vertadr[mId];
              const vNum = model.mesh_vertnum[mId];
              const fAdr = model.mesh_faceadr[mId];
              const fNum = model.mesh_facenum[mId];
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

            const isGround = gtype === mjgtPlane;
            const mat = new THREE.MeshStandardMaterial({
              color: isGround ? 0x303030 : 0xc0c0c8,
              roughness: isGround ? 0.9 : 0.45,
              metalness: isGround ? 0 : 0.4,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = !isGround;
            mesh.receiveShadow = true;
            mesh.position.set(geomPos[0], geomPos[1], geomPos[2]);
            mesh.quaternion.set(geomQuat[1], geomQuat[2], geomQuat[3], geomQuat[0]);
            bg.add(mesh);
          }
        }

        setReady(true);
        onStatusChange?.('ready');
      } catch (e) {
        if (!cancelled) {
          console.error('MenagerieScene init error:', e);
          onStatusChange?.('error', String(e));
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      const sim = simRef.current;
      if (sim) {
        simRef.current = null;
        setReady(false);
        try { sim.data.delete(); } catch { /* ignore */ }
        try { sim.model.delete(); } catch { /* ignore */ }
      }
      if (groupRef.current) {
        bodiesRef.current.forEach((b) => groupRef.current!.remove(b));
        bodiesRef.current = [];
      }
    };
  }, [robot.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const sim = simRef.current;
    if (!sim || !ready) return;
    const { mujoco, model, data } = sim;

    // Passive sine-wave actuation so the robot moves
    const t = performance.now() / 1000;
    for (let i = 0; i < sim.nu; i++) {
      const lo: number = model.actuator_ctrlrange[i * 2];
      const hi: number = model.actuator_ctrlrange[i * 2 + 1];
      const mid = (lo + hi) / 2;
      const amp = ((hi - lo) / 2) * 0.4;
      (data.ctrl as Float64Array)[i] = mid + amp * Math.sin(t * 0.4 + (i * Math.PI) / 4);
    }

    const dt = 1 / 60;
    const start: number = data.time;
    while (data.time - start < dt) mujoco.mj_step(model, data);

    const xpos: Float64Array  = data.xpos;
    const xquat: Float64Array = data.xquat;

    for (let i = 0; i < sim.nbody; i++) {
      const bg = bodiesRef.current[i];
      if (!bg) continue;
      bg.position.set(xpos[i * 3], xpos[i * 3 + 1], xpos[i * 3 + 2]);
      bg.quaternion.set(xquat[i * 4 + 1], xquat[i * 4 + 2], xquat[i * 4 + 3], xquat[i * 4]);
    }
  });

  return <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]} />;
}
