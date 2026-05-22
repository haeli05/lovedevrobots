'use client';

import { useState } from 'react';
import { track } from '@vercel/analytics';
import { Download, FileText, Package, Zap, Weight, DollarSign, Activity, Bot, ExternalLink, ShoppingCart, GitCompare } from 'lucide-react';
import { getCataloguePart } from '@/lib/catalogue';
import { getAssemblyStats } from '@/lib/assembly';
import type { Assembly } from '@/lib/types';
import type { MenagerieRobot } from '@/lib/menagerie';
import { CATEGORY_LABELS } from '@/lib/menagerie';
import { getRobotSuppliers } from '@/lib/suppliers';
import { SuppliersModal } from './SuppliersModal';

interface AssemblyPanelProps {
  assembly: Assembly | null;
  isFinalized: boolean;
  menagerieRobot?: MenagerieRobot | null;
}

const CATEGORY_BADGE: Record<string, string> = {
  servo: 'bg-orange-500/20 text-orange-400',
  bracket: 'bg-slate-500/20 text-slate-400',
  frame: 'bg-blue-500/20 text-blue-400',
  controller: 'bg-green-500/20 text-green-400',
  gripper: 'bg-purple-500/20 text-purple-400',
  battery: 'bg-yellow-500/20 text-yellow-400',
  motor: 'bg-red-500/20 text-red-400',
  sensor: 'bg-cyan-500/20 text-cyan-400',
  wheel: 'bg-stone-500/20 text-stone-400',
  misc: 'bg-neutral-500/20 text-neutral-400',
};

function downloadBOM(assembly: Assembly) {
  const rows = ['SKU,Name,Category,Qty,Price (USD),Weight (g),Supplier,Lead Time (days)'];
  const counts = new Map<string, number>();
  for (const node of Object.values(assembly.nodes)) {
    counts.set(node.sku, (counts.get(node.sku) ?? 0) + 1);
  }
  for (const [sku, qty] of counts.entries()) {
    const part = getCataloguePart(sku);
    if (!part) continue;
    rows.push(
      [
        part.sku,
        `"${part.name}"`,
        part.category,
        qty,
        (part.price_usd * qty).toFixed(2),
        (part.specs.weight_g * qty).toFixed(0),
        `"${part.supplier}"`,
        part.lead_time_days,
      ].join(','),
    );
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${assembly.name.replace(/\s+/g, '_').toLowerCase()}_bom.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportButton({
  icon,
  label,
  ext,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  ext: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400 hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-500">
        .{ext}
      </span>
    </button>
  );
}

export function AssemblyPanel({ assembly, isFinalized, menagerieRobot }: AssemblyPanelProps) {
  if (menagerieRobot) return <MenagerieInfoPanel robot={menagerieRobot} />;

  const hasAssembly = assembly && Object.keys(assembly.nodes).length > 0;
  const stats = hasAssembly ? getAssemblyStats(assembly) : null;

  if (!hasAssembly) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-200">Assembly</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-neutral-600 leading-relaxed">
            Parts appear here as the agent builds your robot.
          </p>
        </div>
      </div>
    );
  }

  const nodes = Object.values(assembly.nodes);
  const partCounts = new Map<string, number>();
  for (const n of nodes) {
    partCounts.set(n.sku, (partCounts.get(n.sku) ?? 0) + 1);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-medium text-neutral-200">
            {assembly.name || 'Untitled robot'}
          </span>
          {isFinalized && (
            <span className="ml-auto rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
              Finalized
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 border-b border-neutral-800 p-3">
        <Stat icon={<DollarSign className="h-3 w-3" />} label="BOM Cost" value={`$${stats!.totalPrice_usd.toFixed(2)}`} />
        <Stat icon={<Weight className="h-3 w-3" />} label="Weight" value={`${stats!.totalWeight_g}g`} />
        <Stat icon={<Activity className="h-3 w-3" />} label="DOF" value={String(stats!.dofCount)} />
        <Stat icon={<Package className="h-3 w-3" />} label="Parts" value={String(stats!.partCount)} />
      </div>

      {/* BOM */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
          Bill of Materials
        </p>
        {Array.from(partCounts.entries()).map(([sku, qty]) => {
          const part = getCataloguePart(sku);
          if (!part) return null;
          const badgeClass = CATEGORY_BADGE[part.category] ?? CATEGORY_BADGE.misc;
          return (
            <div
              key={sku}
              className="flex items-start gap-2 rounded-lg bg-neutral-900 px-2.5 py-2"
            >
              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${badgeClass}`}>
                {part.category}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-neutral-200">{part.name}</p>
                <p className="text-[10px] text-neutral-500">
                  {qty > 1 ? `×${qty} · ` : ''}${(part.price_usd * qty).toFixed(2)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Validation */}
      {stats && (!stats.hasController || !stats.hasPower) && (
        <div className="mx-3 mb-1 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-2.5 py-2 text-[10px] text-yellow-400">
          {!stats.hasController && <p>⚠ No controller</p>}
          {!stats.hasPower && <p>⚠ No power source</p>}
        </div>
      )}

      {/* Exports */}
      <div className="border-t border-neutral-800 p-3 space-y-1.5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
          Export
        </p>
        <ExportButton
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Bill of Materials"
          ext="csv"
          onClick={() => assembly && downloadBOM(assembly)}
        />
        <ExportButton
          icon={<Download className="h-3.5 w-3.5" />}
          label="CAD Assembly"
          ext="step"
          onClick={() => alert('STEP export coming in Week 2')}
          disabled={!isFinalized}
        />
        <ExportButton
          icon={<Download className="h-3.5 w-3.5" />}
          label="Robot Description"
          ext="urdf"
          onClick={() => alert('URDF export coming in Week 2')}
          disabled={!isFinalized}
        />
        <ExportButton
          icon={<Zap className="h-3.5 w-3.5" />}
          label="3D Print Meshes"
          ext="stl"
          onClick={() => alert('STL export coming in Week 2')}
          disabled={!isFinalized}
        />
      </div>
    </div>
  );
}

function MenagerieInfoPanel({ robot }: { robot: MenagerieRobot }) {
  const [showSuppliers, setShowSuppliers] = useState(false);
  const menagerieUrl = `https://github.com/google-deepmind/mujoco_menagerie/tree/main/${robot.id}`;

  const supplierEntries = getRobotSuppliers(robot.id);
  const hasSuppliers = supplierEntries.length > 0;



  const specs: { label: string; value: string }[] = [
    { label: 'Maker',    value: robot.maker },
    { label: 'Category', value: CATEGORY_LABELS[robot.category] },
    { label: 'DOF',      value: String(robot.dof) },
    ...(robot.est_cost_usd != null ? [{ label: 'Est. Cost', value: robot.est_cost_usd >= 1000 ? `$${(robot.est_cost_usd/1000).toFixed(0)}k` : `$${robot.est_cost_usd}` }] : []),
    ...(robot.est_weight_kg != null ? [{ label: 'Weight', value: `${robot.est_weight_kg} kg` }] : []),
    ...(robot.payload_kg != null ? [{ label: 'Payload', value: `${robot.payload_kg} kg` }] : []),
    ...(robot.reach_mm != null ? [{ label: 'Reach', value: `${robot.reach_mm} mm` }] : []),
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-medium text-neutral-200">{robot.name}</span>
        </div>
      </div>

      {/* Scrollable middle */}
      <div className="flex-1 overflow-y-auto">
        {/* Specs grid */}
        <div className="border-b border-neutral-800 p-3">
          <div className="grid grid-cols-2 gap-2">
            {specs.map(({ label, value }) => (
              <div key={label} className="flex flex-col rounded-lg bg-neutral-900 px-2.5 py-2">
                <span className="text-[10px] text-neutral-500">{label}</span>
                <span className="text-sm font-semibold text-neutral-100">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="p-3 border-b border-neutral-800">
          <p className="text-xs leading-relaxed text-neutral-400">{robot.description}</p>
        </div>

        {/* Source link */}
        <div className="p-3">
          <a
            href={menagerieUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400 hover:border-neutral-700 hover:text-neutral-200 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">View in MuJoCo Menagerie</span>
          </a>
        </div>

        <div className="mx-3 mb-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2.5">
          <p className="text-[10px] leading-relaxed text-neutral-500">
            Live physics via MuJoCo WASM. Assets from Google DeepMind&apos;s open-source menagerie.
          </p>
        </div>
      </div>

      {/* Action buttons — pinned to bottom */}
      <div className="border-t border-neutral-800 p-3 space-y-2">
        <button
          onClick={() => track('buy_now_click', { robotId: robot.id, robotName: robot.name })}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 active:bg-orange-600 transition-colors"
        >
          <ShoppingCart className="h-4 w-4" />
          Buy This Robot
        </button>
        {hasSuppliers && (
          <button
            onClick={() => { track('compare_suppliers_click', { robotId: robot.id, robotName: robot.name }); setShowSuppliers(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800 transition-colors"
          >
            <GitCompare className="h-4 w-4" />
            Compare Suppliers
          </button>
        )}
      </div>

      {showSuppliers && (
        <SuppliersModal
          robotId={robot.id}
          robotName={robot.name}
          onClose={() => setShowSuppliers(false)}
        />
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col rounded-lg bg-neutral-900 px-2.5 py-2">
      <div className="mb-0.5 flex items-center gap-1 text-neutral-500">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <span className="text-sm font-semibold text-neutral-100">{value}</span>
    </div>
  );
}
