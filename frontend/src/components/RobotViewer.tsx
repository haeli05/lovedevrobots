'use client';

import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html, ContactShadows } from '@react-three/drei';
import { Suspense, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

import type { Assembly } from '@/lib/types';
import { computeTreeLayout, getAssemblyStats, type TreeNode } from '@/lib/assembly';
import { getCataloguePart } from '@/lib/catalogue';
import { PhysicsScene } from './PhysicsScene';

interface RobotViewerProps {
  assembly: Assembly | null;
}

// ── Mesh components ────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  servo: '#c04010', bracket: '#b8c4d4', frame: '#a8b8c8',
  controller: '#1a3a1a', gripper: '#808080', battery: '#0a0a18',
  motor: '#c04010', sensor: '#1a1a1a', wheel: '#2a2a2a', misc: '#606060',
};

function STLMesh({ url, category }: { url: string; category: string }) {
  const rawGeo = useLoader(STLLoader, url);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().copy(rawGeo);
    geo.scale(0.001, 0.001, 0.001);
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    geo.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
    geo.computeVertexNormals();
    return geo;
  }, [rawGeo]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={CAT_COLOR[category] ?? '#606060'} roughness={0.45} metalness={0.55} envMapIntensity={1.8} />
    </mesh>
  );
}

// Servo / Motor — ABS plastic body + machined aluminum horn
function ServoMesh({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      {/* body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#c03a12" roughness={0.65} metalness={0.0} />
      </mesh>
      {/* horn shaft */}
      <mesh castShadow position={[0, h * 0.5 + d * 0.06, 0]}>
        <cylinderGeometry args={[w * 0.26, w * 0.28, d * 0.14, 24]} />
        <meshStandardMaterial color="#d0d0d0" roughness={0.1} metalness={0.92} envMapIntensity={2.5} />
      </mesh>
      {/* horn spline tip */}
      <mesh position={[0, h * 0.5 + d * 0.145, 0]}>
        <cylinderGeometry args={[w * 0.09, w * 0.11, d * 0.06, 12]} />
        <meshStandardMaterial color="#b0b0b0" roughness={0.12} metalness={0.95} />
      </mesh>
      {/* cable connector at back */}
      <mesh castShadow position={[0, -h * 0.12, -d * 0.52]}>
        <boxGeometry args={[w * 0.28, h * 0.28, d * 0.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* side flanges */}
      {([-1, 1] as const).map((s, i) => (
        <mesh key={i} castShadow position={[s * (w * 0.5 + w * 0.1), 0, 0]}>
          <boxGeometry args={[w * 0.2, h * 0.6, d * 0.82]} />
          <meshStandardMaterial color="#a83010" roughness={0.6} metalness={0.0} />
        </mesh>
      ))}
      {/* mounting hole indicators */}
      {([[-1, -1], [-1, 1], [1, -1], [1, 1]] as const).map(([sx, sz], i) => (
        <mesh key={i} position={[sx * w * 0.32, -h * 0.5, sz * d * 0.32]}>
          <cylinderGeometry args={[w * 0.06, w * 0.06, h * 0.06, 8]} />
          <meshStandardMaterial color="#2a1808" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Bracket — polished anodized aluminum
function BracketMesh({ w, d, h }: { w: number; d: number; h: number }) {
  const t = Math.min(w, d) * 0.11;
  return (
    <group>
      {/* base plate */}
      <mesh castShadow receiveShadow position={[0, -h * 0.5 + t * 0.5, 0]}>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial color="#c0c8d8" roughness={0.08} metalness={0.9} envMapIntensity={2.8} />
      </mesh>
      {/* side walls */}
      {([-1, 1] as const).map((s, i) => (
        <mesh key={i} castShadow position={[s * (w * 0.5 - t * 0.5), 0, 0]}>
          <boxGeometry args={[t, h, d]} />
          <meshStandardMaterial color="#c0c8d8" roughness={0.08} metalness={0.9} envMapIntensity={2.8} />
        </mesh>
      ))}
      {/* M3 mounting holes on base */}
      {([[-1, -1], [-1, 1], [1, -1], [1, 1]] as const).map(([sx, sz], i) => (
        <mesh key={i} position={[sx * w * 0.34, -h * 0.5 + t * 0.5, sz * d * 0.34]}>
          <cylinderGeometry args={[t * 0.18, t * 0.18, t * 1.1, 8]} />
          <meshStandardMaterial color="#404850" roughness={0.9} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function LBracketMesh({ w, d, h }: { w: number; d: number; h: number }) {
  const t = Math.min(w, d) * 0.13;
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, -h * 0.5 + t * 0.5, 0]}>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial color="#c0c8d8" roughness={0.08} metalness={0.9} envMapIntensity={2.5} />
      </mesh>
      <mesh castShadow position={[-w * 0.5 + t * 0.5, 0, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color="#c0c8d8" roughness={0.08} metalness={0.9} envMapIntensity={2.5} />
      </mesh>
    </group>
  );
}

// Frame / extrusion — anodized 2020 V-slot profile look
function FrameMesh({ w, d, h }: { w: number; d: number; h: number }) {
  const slotDepth = Math.min(w, d) * 0.12;
  return (
    <group>
      {/* main body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#b4bcc8" roughness={0.15} metalness={0.88} envMapIntensity={2.2} />
      </mesh>
      {/* corner columns (darker) */}
      {([[-1, -1], [-1, 1], [1, -1], [1, 1]] as const).map(([sx, sz], i) => (
        <mesh key={i} position={[sx * w * 0.37, 0, sz * d * 0.37]}>
          <boxGeometry args={[w * 0.09, h * 1.005, d * 0.09]} />
          <meshStandardMaterial color="#7888a0" roughness={0.2} metalness={0.85} />
        </mesh>
      ))}
      {/* V-slot channel grooves on each face */}
      {([0, Math.PI / 2] as const).map((rot, i) => (
        <mesh key={i} position={[0, 0, 0]} rotation={[0, rot, 0]}>
          <boxGeometry args={[slotDepth, h * 1.005, slotDepth * 0.6]} />
          <meshStandardMaterial color="#606878" roughness={0.3} metalness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// Controller — PCB with components
function ControllerMesh({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      {/* PCB board */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#163816" roughness={0.78} metalness={0.04} />
      </mesh>
      {/* main IC */}
      <mesh position={[0, h * 0.52, 0]}>
        <boxGeometry args={[w * 0.28, h * 0.06, d * 0.22]} />
        <meshStandardMaterial color="#080808" roughness={0.85} metalness={0.0} />
      </mesh>
      {/* pin headers */}
      {([-1, 1] as const).map((s, i) => (
        <mesh key={i} position={[s * w * 0.42, h * 0.52, 0]}>
          <boxGeometry args={[w * 0.05, h * 0.55, d * 0.82]} />
          <meshStandardMaterial color="#101010" roughness={0.9} metalness={0.0} />
        </mesh>
      ))}
      {/* USB port */}
      <mesh position={[0, h * 0.51, d * 0.52]}>
        <boxGeometry args={[w * 0.18, h * 0.22, d * 0.07]} />
        <meshStandardMaterial color="#909090" roughness={0.2} metalness={0.85} />
      </mesh>
      {/* indicator LED */}
      <mesh position={[w * 0.35, h * 0.52, -d * 0.3]}>
        <sphereGeometry args={[w * 0.04, 8, 8]} />
        <meshStandardMaterial color="#00ff44" roughness={0.1} emissive="#00ff44" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

// Battery — LiPo pack
function BatteryMesh({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      {/* shrink-wrap body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#08081a" roughness={0.72} metalness={0.0} />
      </mesh>
      {/* cell division seam */}
      <mesh position={[0, h * 0.505, 0]}>
        <boxGeometry args={[w * 0.85, h * 0.015, d * 0.85]} />
        <meshStandardMaterial color="#c8d0ff" roughness={0.6} metalness={0.0} />
      </mesh>
      {/* balance plug */}
      <mesh position={[-w * 0.3, h * 0.515, d * 0.52]}>
        <boxGeometry args={[w * 0.18, h * 0.12, d * 0.07]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0.0} />
      </mesh>
      {/* main discharge connector */}
      <mesh position={[0, 0, d * 0.52]}>
        <boxGeometry args={[w * 0.24, h * 0.55, d * 0.09]} />
        <meshStandardMaterial color="#cc2010" roughness={0.35} metalness={0.4} />
      </mesh>
    </group>
  );
}

// Gripper — machined aluminum fingers
function GripperMesh({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      {/* body */}
      <mesh castShadow receiveShadow position={[0, -h * 0.2, 0]}>
        <boxGeometry args={[w, h * 0.55, d]} />
        <meshStandardMaterial color="#888888" roughness={0.18} metalness={0.88} envMapIntensity={2.0} />
      </mesh>
      {/* fingers */}
      {([-1, 1] as const).map((s, i) => (
        <mesh key={i} castShadow position={[s * w * 0.27, h * 0.22, 0]}>
          <boxGeometry args={[w * 0.17, h * 0.52, d * 0.33]} />
          <meshStandardMaterial color="#a0a0a0" roughness={0.22} metalness={0.82} envMapIntensity={1.8} />
        </mesh>
      ))}
      {/* fingertip pads */}
      {([-1, 1] as const).map((s, i) => (
        <mesh key={i} castShadow position={[s * w * 0.27, h * 0.46, 0]}>
          <boxGeometry args={[w * 0.17, h * 0.06, d * 0.33]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} metalness={0.0} />
        </mesh>
      ))}
    </group>
  );
}

// Sensor — housing with lens
function SensorMesh({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#141414" roughness={0.65} metalness={0.12} />
      </mesh>
      {/* lens */}
      <mesh position={[0, h * 0.52, 0]}>
        <cylinderGeometry args={[Math.min(w, d) * 0.24, Math.min(w, d) * 0.24, h * 0.07, 20]} />
        <meshStandardMaterial color="#1a6090" roughness={0.05} metalness={0.1} transparent opacity={0.7} envMapIntensity={3.0} />
      </mesh>
      {/* LED ring */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh key={i} position={[Math.sin(angle) * Math.min(w, d) * 0.35, h * 0.52, Math.cos(angle) * Math.min(w, d) * 0.35]}>
          <sphereGeometry args={[w * 0.025, 6, 6]} />
          <meshStandardMaterial color="#ff4400" roughness={0.1} emissive="#ff2200" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// Wheel — rubber tire + aluminum hub
function WheelMesh({ w, d, h }: { w: number; d: number; h: number }) {
  const r = Math.max(w, d) * 0.5;
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {/* tire */}
      <mesh castShadow receiveShadow>
        <torusGeometry args={[r * 0.74, r * 0.26, 18, 36]} />
        <meshStandardMaterial color="#1e1e1e" roughness={0.92} metalness={0.0} />
      </mesh>
      {/* hub */}
      <mesh>
        <cylinderGeometry args={[r * 0.35, r * 0.35, h * 0.7, 6]} />
        <meshStandardMaterial color="#6a6a6a" roughness={0.28} metalness={0.78} envMapIntensity={1.5} />
      </mesh>
      {/* spokes */}
      {[0, Math.PI / 3, (Math.PI * 2) / 3].map((angle, i) => (
        <mesh key={i} rotation={[0, angle, 0]}>
          <boxGeometry args={[r * 0.08, h * 0.65, r * 0.75]} />
          <meshStandardMaterial color="#585858" roughness={0.35} metalness={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function ProceduralMesh({ category, dims }: { category: string; dims: [number, number, number] }) {
  const [rawW, rawD, rawH] = dims;
  const w = rawW / 1000, d = rawD / 1000, h = rawH / 1000;
  const p = { w, d, h };
  const isLBracket = category === 'bracket' && rawW <= 45 && rawH <= 30;
  switch (category) {
    case 'servo': case 'motor': return <ServoMesh {...p} />;
    case 'bracket': return isLBracket ? <LBracketMesh {...p} /> : <BracketMesh {...p} />;
    case 'frame':      return <FrameMesh {...p} />;
    case 'controller': return <ControllerMesh {...p} />;
    case 'battery':    return <BatteryMesh {...p} />;
    case 'gripper':    return <GripperMesh {...p} />;
    case 'sensor':     return <SensorMesh {...p} />;
    case 'wheel':      return <WheelMesh {...p} />;
    default:
      return (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#505050" roughness={0.6} metalness={0.3} />
        </mesh>
      );
  }
}

// ── Selection outline ──────────────────────────────────────────────────────────

function SelectionBox({ dims, color }: { dims: [number, number, number]; color: string }) {
  const [w, d, h] = [dims[0] / 1000, dims[1] / 1000, dims[2] / 1000];
  const geo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 1.1, h * 1.1, d * 1.1)),
    [w, h, d],
  );
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={0.9} />
    </lineSegments>
  );
}

// ── Label callout ──────────────────────────────────────────────────────────────

function LabelRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 9, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 9, color: '#d1d5db', fontFamily: 'ui-monospace, monospace' }}>{value}</span>
    </div>
  );
}

const CAT_ACCENT: Record<string, string> = {
  servo: '#f97316', bracket: '#94a3b8', frame: '#60a5fa',
  controller: '#4ade80', gripper: '#c084fc', battery: '#facc15',
  motor: '#f87171', sensor: '#22d3ee', wheel: '#64748b', misc: '#e5e7eb',
};

function PartLabel({ node, selected, hovered }: { node: TreeNode; selected: boolean; hovered: boolean }) {
  const part = getCataloguePart(node.sku);
  const color = CAT_ACCENT[node.category] ?? '#e5e7eb';
  const active = selected || hovered;
  const halfW = node.dims[0] / 2000 + 0.018;

  return (
    <Html position={[halfW, 0, 0]} style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <div style={{ transform: 'translateY(-50%)', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
        <div style={{
          width: active ? 6 : 4, height: active ? 6 : 4, borderRadius: '50%',
          background: active ? color : '#374151', flexShrink: 0, marginTop: active ? 6 : 5,
          boxShadow: selected ? `0 0 8px ${color}` : 'none',
        }} />
        <div style={{
          background: active ? 'rgba(9,9,11,0.93)' : 'transparent',
          border: active ? `1px solid ${selected ? color : 'rgba(255,255,255,0.12)'}` : 'none',
          borderRadius: 7, padding: active ? '5px 9px' : 0,
          boxShadow: selected ? `0 0 20px ${color}28, 0 2px 12px rgba(0,0,0,0.5)` : 'none',
          minWidth: active ? 140 : 0,
        }}>
          <div style={{ fontSize: active ? 10 : 9, color: active ? '#f5f5f5' : '#52525b', fontFamily: 'ui-monospace, monospace', fontWeight: active ? 600 : 400 }}>
            {node.sku.replace(/_/g, ' ')}
          </div>
          {active && (
            <div style={{ fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2, opacity: 0.85 }}>
              {node.isJoint ? `⟳ ${node.category}` : node.category}
            </div>
          )}
          {selected && part && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 5, paddingTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <LabelRow label="Price" value={`$${part.price_usd.toFixed(2)}`} />
              <LabelRow label="Weight" value={`${part.specs.weight_g} g`} />
              {typeof (part.specs as Record<string, unknown>).torque_nm === 'number' && (
                <LabelRow label="Torque" value={`${(part.specs as Record<string, unknown>).torque_nm} Nm`} />
              )}
              {typeof (part.specs as Record<string, unknown>).voltage_v === 'number' && (
                <LabelRow label="Voltage" value={`${(part.specs as Record<string, unknown>).voltage_v} V`} />
              )}
              {node.isJoint && node.jointLimitsDeg && (
                <LabelRow label="Range" value={`${node.jointLimitsDeg[0]}° → ${node.jointLimitsDeg[1]}°`} />
              )}
              <LabelRow label="Mounts" value={part.mount_points.map((m) => m.id).join(', ')} />
            </div>
          )}
        </div>
      </div>
    </Html>
  );
}

// ── Hierarchical part node with DOF animation ──────────────────────────────────

function PartTreeNode({
  instanceId,
  nodeMap,
  selectedId,
  hoveredId,
  onSelect,
  onHoverChange,
}: {
  instanceId: string;
  nodeMap: Record<string, TreeNode>;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHoverChange: (id: string | null) => void;
}) {
  const node = nodeMap[instanceId];
  const groupRef = useRef<THREE.Group>(null!);

  // Stable per-joint phase from instanceId character codes
  const phase = useMemo(
    () => instanceId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 0.47,
    [instanceId],
  );

  useFrame(({ clock }) => {
    if (!node?.isJoint || !node.jointAxis || !groupRef.current) return;
    const t = clock.getElapsedTime();
    const [lo, hi] = node.jointLimitsDeg ?? [-90, 90];
    const mid = ((lo + hi) / 2) * (Math.PI / 180);
    const amp = ((hi - lo) / 2) * 0.65 * (Math.PI / 180);
    const angle = mid + amp * Math.sin(t * 0.55 + phase);
    // Assembly frame [ax, ay, az] → three.js [ax, az, ay]
    const [ax, ay, az] = node.jointAxis;
    groupRef.current.setRotationFromAxisAngle(
      new THREE.Vector3(ax, az, ay).normalize(),
      angle,
    );
  });

  if (!node) return null;

  // Assembly frame (Z-up, mm) → three.js (Y-up, m)
  const [lx, ly, lz] = node.localOffset;
  const threePos: [number, number, number] = [lx / 1000, lz / 1000, ly / 1000];

  const isSelected = selectedId === instanceId;
  const isHovered = hoveredId === instanceId;

  return (
    <group
      ref={groupRef}
      position={threePos}
      onClick={(e) => { e.stopPropagation(); onSelect(instanceId); }}
      onPointerOver={(e) => { e.stopPropagation(); onHoverChange(instanceId); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { onHoverChange(null); document.body.style.cursor = 'default'; }}
    >
      {/* Part mesh */}
      {node.mesh_url ? (
        <Suspense fallback={<ProceduralMesh category={node.category} dims={node.dims} />}>
          <STLMesh url={node.mesh_url} category={node.category} />
        </Suspense>
      ) : (
        <ProceduralMesh category={node.category} dims={node.dims} />
      )}

      {isHovered && !isSelected && <SelectionBox dims={node.dims} color="#ffffff" />}
      {isSelected && <SelectionBox dims={node.dims} color="#f97316" />}

      <PartLabel node={node} selected={isSelected} hovered={isHovered} />

      {/* Children — rendered in this group so they inherit joint rotation */}
      {node.childInstanceIds.map((childId) => (
        <PartTreeNode
          key={childId}
          instanceId={childId}
          nodeMap={nodeMap}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onHoverChange={onHoverChange}
        />
      ))}
    </group>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyScene() {
  return (
    <Html center style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <div style={{ textAlign: 'center', color: '#3f3f46', fontSize: 12, lineHeight: 1.7, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        Start chatting to<br />build your robot
      </div>
    </Html>
  );
}

// ── Main viewer ────────────────────────────────────────────────────────────────

export function RobotViewer({ assembly }: RobotViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [physicsMode, setPhysicsMode] = useState(false);
  const [physicsStatus, setPhysicsStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const nodeMap = useMemo(() => (assembly ? computeTreeLayout(assembly) : {}), [assembly]);
  const rootIds = useMemo(
    () => Object.values(nodeMap).filter((n) => !n.parentInstanceId).map((n) => n.instanceId),
    [nodeMap],
  );
  const hasNodes = rootIds.length > 0;
  const stats = assembly && hasNodes ? getAssemblyStats(assembly) : null;

  // Camera distance based on tallest stack
  const tallestMm = useMemo(() => {
    if (!hasNodes) return 0;
    let max = 0;
    for (const n of Object.values(nodeMap)) {
      const top = n.localOffset[2] + n.dims[2] / 2;
      if (top > max) max = top;
    }
    return max;
  }, [nodeMap, hasNodes]);
  const camDist = Math.max(0.55, (tallestMm / 1000) * 2.8 + 0.4);

  const HUD = stats
    ? [
        { label: 'parts', value: String(stats.partCount) },
        { label: 'weight', value: `${stats.totalWeight_g}g` },
        { label: 'cost', value: `$${stats.totalPrice_usd.toFixed(0)}` },
        { label: 'DOF', value: String(stats.dofCount) },
      ]
    : [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [camDist, camDist * 0.9, camDist], fov: 45, up: [0, 1, 0] }}
        shadows
        onClick={() => setSelectedId(null)}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <hemisphereLight args={['#b4d4ff', '#402010', 0.4]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[2, 3.5, 2]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
          <directionalLight position={[-1.5, 1, -1]} intensity={0.35} color="#8090c0" />
          {/* Rim light from behind */}
          <directionalLight position={[0, 0.5, -3]} intensity={0.25} color="#ffffff" />

          <Environment preset="warehouse" />

          <Grid args={[3, 3]} cellSize={0.05} cellThickness={0.3} sectionSize={0.25}
            sectionThickness={0.8} fadeDistance={4} receiveShadow cellColor="#1a1a1a" sectionColor="#2a2a2a" />

          <ContactShadows position={[0, -0.001, 0]} opacity={0.55} blur={3} far={4} resolution={512} />

          {physicsMode && hasNodes
            ? <PhysicsScene nodeMap={nodeMap} onStatusChange={setPhysicsStatus} />
            : hasNodes
              ? rootIds.map((id) => (
                  <PartTreeNode
                    key={id}
                    instanceId={id}
                    nodeMap={nodeMap}
                    selectedId={selectedId}
                    hoveredId={hoveredId}
                    onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
                    onHoverChange={setHoveredId}
                  />
                ))
              : <EmptyScene />}

          <OrbitControls makeDefault enableDamping dampingFactor={0.06} />
        </Suspense>
      </Canvas>

      {/* Assembly HUD */}
      {HUD.length > 0 && (
        <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 5, pointerEvents: 'none' }}>
          {HUD.map(({ label, value }) => (
            <div key={label} style={{
              background: 'rgba(9,9,11,0.78)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6, padding: '4px 9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f5f5f5', fontFamily: 'ui-monospace, monospace', lineHeight: 1 }}>{value}</span>
              <span style={{ fontSize: 8, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Physics toggle */}
      {hasNodes && (
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <button
            onClick={() => {
              setPhysicsMode((p) => !p);
              setPhysicsStatus('loading');
            }}
            style={{
              background: physicsMode ? 'rgba(249,115,22,0.9)' : 'rgba(9,9,11,0.75)',
              border: physicsMode ? '1px solid rgba(249,115,22,0.5)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              padding: '4px 9px',
              fontSize: 9,
              fontWeight: 700,
              color: physicsMode ? '#fff' : '#a1a1aa',
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span style={{ fontSize: 10 }}>⚛</span>
            Physics
          </button>
          {physicsMode && physicsStatus === 'loading' && (
            <div style={{ fontSize: 8, color: '#f97316', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em', animation: 'pulse 1.2s ease-in-out infinite' }}>
              loading WASM…
            </div>
          )}
          {physicsMode && physicsStatus === 'error' && (
            <div style={{ fontSize: 8, color: '#ef4444', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}>
              load failed
            </div>
          )}
        </div>
      )}

      {hasNodes && !selectedId && !physicsMode && (
        <div style={{ position: 'absolute', bottom: 14, right: 12, fontSize: 9, color: '#3f3f46', pointerEvents: 'none', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.03em' }}>
          click part to inspect
        </div>
      )}
    </div>
  );
}
