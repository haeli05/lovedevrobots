'use client';

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

export interface ActuatorInfo {
  name: string;
  lo: number;
  hi: number;
}

let mujocoPromise: Promise<MujocoModule> | null = null;
async function getMujoco(): Promise<MujocoModule> {
  if (!mujocoPromise) {
    mujocoPromise = (async () => {
      const { default: loadMujoco } = await import('@mujoco/mujoco');
      return loadMujoco({ locateFile: (f: string) => (f.endsWith('.wasm') ? '/mujoco.wasm' : f) });
    })();
  }
  return mujocoPromise;
}

function getMJGeomType(mujoco: MujocoModule, name: string): number {
  const v = mujoco.mjtGeom?.[name];
  return typeof v === 'object' && v !== null && 'value' in v ? v.value : (v as number);
}

function readName(names: Uint8Array, adr: number): string {
  let end = adr;
  while (end < names.length && names[end] !== 0) end++;
  return new TextDecoder().decode(names.subarray(adr, end));
}

interface Props {
  robot: MenagerieRobot;
  paused: boolean;
  ctrlRef: React.MutableRefObject<Float64Array | null>;
  onStatusChange?: (s: 'loading' | 'ready' | 'error', msg?: string) => void;
  onReady?: (actuators: ActuatorInfo[]) => void;
  onReset?: (fn: () => void) => void;
}

export function MenagerieScene({ robot, paused, ctrlRef, onStatusChange, onReady, onReset }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const simRef = useRef<Sim | null>(null);
  const bodiesRef = useRef<THREE.Group[]>([]);
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      onStatusChange?.('loading', `Loading ${robot.name}…`);
      try {
        const mujoco = await getMujoco();
        if (cancelled) return;

        onStatusChange?.('loading', `Fetching assets…`);
        await loadMenagerieRobot(mujoco, robot.id, robot.sceneFile ?? 'scene.xml', (msg) => {
          if (!cancelled) onStatusChange?.('loading', msg);
        });
        if (cancelled) return;

        const model = mujoco.MjModel.mj_loadXML('/working/scene.xml');
        const data = new mujoco.MjData(model);

        // Start from keyframe 0 if available (robot's designed home pose)
        if (model.nkey > 0) {
          mujoco.mj_resetDataKeyframe(model, data, 0);
        }
        mujoco.mj_forward(model, data);
        if (cancelled) { model.delete(); data.delete(); return; }

        const sim: Sim = { mujoco, model, data, nbody: model.nbody, nu: model.nu };
        simRef.current = sim;

        // Wire up reset callback
        onReset?.(() => {
          if (!simRef.current) return;
          const { mujoco: mj, model: m, data: d } = simRef.current;
          if (m.nkey > 0) mj.mj_resetDataKeyframe(m, d, 0);
          else mj.mj_resetData(m, d);
          mj.mj_forward(m, d);
          // Also reset ctrl override
          if (ctrlRef.current) {
            for (let i = 0; i < m.nu; i++) {
              ctrlRef.current[i] = (m.actuator_ctrlrange[i * 2] + m.actuator_ctrlrange[i * 2 + 1]) / 2;
            }
          }
        });

        // Build geometry
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
            const bodyId: number = model.geom_bodyid[g];
            const bg = bodiesRef.current[bodyId];
            if (!bg) continue;

            const sz  = model.geom_size.subarray(g * 3, g * 3 + 3);
            const gp  = model.geom_pos.subarray(g * 3, g * 3 + 3);
            const gq  = model.geom_quat.subarray(g * 4, g * 4 + 4);

            let geo: THREE.BufferGeometry | null = null;
            if (gtype === mjgtPlane)    geo = new THREE.PlaneGeometry(8, 8);
            else if (gtype === mjgtBox) geo = new THREE.BoxGeometry(sz[0]*2, sz[1]*2, sz[2]*2);
            else if (gtype === mjgtSphere) geo = new THREE.SphereGeometry(sz[0], 16, 12);
            else if (gtype === mjgtCylinder) {
              geo = new THREE.CylinderGeometry(sz[0], sz[0], sz[1]*2, 16);
              geo.rotateX(Math.PI / 2);
            } else if (gtype === mjgtCapsule) {
              geo = new THREE.CapsuleGeometry(sz[0], sz[1]*2, 6, 14);
              geo.rotateX(Math.PI / 2);
            } else if (gtype === mjgtMesh) {
              const mId  = model.geom_dataid[g];
              const vAdr = model.mesh_vertadr[mId];
              const vNum = model.mesh_vertnum[mId];
              const fAdr = model.mesh_faceadr[mId];
              const fNum = model.mesh_facenum[mId];
              geo = new THREE.BufferGeometry();
              geo.setAttribute('position', new THREE.Float32BufferAttribute(
                Float32Array.from(model.mesh_vert.subarray(vAdr*3, (vAdr+vNum)*3)), 3));
              geo.setIndex(Array.from(model.mesh_face.subarray(fAdr*3, (fAdr+fNum)*3) as Int32Array));
              geo.computeVertexNormals();
            }
            if (!geo) continue;

            const isGround = gtype === mjgtPlane;
            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
              color: isGround ? 0x303030 : 0xc0c0c8,
              roughness: isGround ? 0.9 : 0.45,
              metalness: isGround ? 0 : 0.4,
            }));
            mesh.castShadow = !isGround;
            mesh.receiveShadow = true;
            mesh.position.set(gp[0], gp[1], gp[2]);
            mesh.quaternion.set(gq[1], gq[2], gq[3], gq[0]);
            bg.add(mesh);
          }
        }

        // Collect actuator info and initialise ctrlRef
        const actuators: ActuatorInfo[] = [];
        const names: Uint8Array = model.names;
        const initCtrl = new Float64Array(model.nu);
        for (let i = 0; i < model.nu; i++) {
          const lo: number = model.actuator_ctrlrange[i * 2];
          const hi: number = model.actuator_ctrlrange[i * 2 + 1];
          const nameAdr: number = model.name_actuatoradr[i];
          actuators.push({ name: readName(names, nameAdr) || `joint_${i}`, lo, hi });
          // Init ctrl to current qpos-driven position
          initCtrl[i] = (data.ctrl as Float64Array)[i];
        }
        ctrlRef.current = initCtrl;
        readyRef.current = true;
        onReady?.(actuators);
        onStatusChange?.('ready');
      } catch (e) {
        if (!cancelled) {
          console.error('MenagerieScene error:', e);
          onStatusChange?.('error', String(e));
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
      readyRef.current = false;
      const sim = simRef.current;
      if (sim) {
        simRef.current = null;
        try { sim.data.delete(); } catch { /* */ }
        try { sim.model.delete(); } catch { /* */ }
      }
      if (groupRef.current) {
        bodiesRef.current.forEach((b) => groupRef.current!.remove(b));
        bodiesRef.current = [];
      }
    };
  }, [robot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const sim = simRef.current;
    if (!sim || !readyRef.current) return;
    const { mujoco, model, data } = sim;

    // Apply ctrl from sliders (or leave as-is if paused)
    if (ctrlRef.current) {
      const ctrl = data.ctrl as Float64Array;
      for (let i = 0; i < sim.nu; i++) ctrl[i] = ctrlRef.current[i];
    }

    if (!paused) {
      const dt = 1 / 60;
      const start: number = data.time;
      while (data.time - start < dt) mujoco.mj_step(model, data);
    }

    const xpos: Float64Array  = data.xpos;
    const xquat: Float64Array = data.xquat;
    for (let i = 0; i < sim.nbody; i++) {
      const bg = bodiesRef.current[i];
      if (!bg) continue;
      bg.position.set(xpos[i*3], xpos[i*3+1], xpos[i*3+2]);
      bg.quaternion.set(xquat[i*4+1], xquat[i*4+2], xquat[i*4+3], xquat[i*4]);
    }
  });

  return <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]} />;
}
