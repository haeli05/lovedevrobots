'use client';

import { X, ExternalLink, MapPin } from 'lucide-react';
import { getRobotSuppliers } from '@/lib/suppliers';

interface Props {
  robotId: string;
  robotName: string;
  onClose: () => void;
}

const REGION_BADGE: Record<string, string> = {
  CN: 'bg-red-500/20 text-red-400',
  US: 'bg-blue-500/20 text-blue-400',
  'KR/US': 'bg-purple-500/20 text-purple-400',
  'DK/US': 'bg-blue-500/20 text-blue-400',
  'DE/US': 'bg-yellow-500/20 text-yellow-400',
  DE: 'bg-yellow-500/20 text-yellow-400',
  'CA/US': 'bg-green-500/20 text-green-400',
  'US/EU': 'bg-indigo-500/20 text-indigo-400',
  DIY: 'bg-neutral-500/20 text-neutral-400',
};

function regionBadge(region: string) {
  return REGION_BADGE[region] ?? 'bg-neutral-500/20 text-neutral-400';
}

export function SuppliersModal({ robotId, robotName, onClose }: Props) {
  const entries = getRobotSuppliers(robotId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">{robotName}</h2>
            <p className="text-xs text-neutral-500">Compare suppliers &amp; prices</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {entries.length === 0 ? (
            <p className="text-center text-sm text-neutral-600 py-8">
              No supplier data available for this robot yet.
            </p>
          ) : (
            entries.map((entry) => (
              <div key={entry.component}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    {entry.component}
                  </h3>
                  {entry.qty > 1 && (
                    <span className="text-[10px] text-neutral-600">×{entry.qty}</span>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border border-neutral-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/60">
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Supplier</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Region</th>
                        <th className="px-3 py-2 text-right font-medium text-neutral-500">
                          Price {entry.qty > 1 ? `(×${entry.qty})` : ''}
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Notes</th>
                        <th className="w-8 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {entry.suppliers
                        .slice()
                        .sort((a, b) => a.price_usd - b.price_usd)
                        .map((s, i) => (
                          <tr
                            key={i}
                            className={`border-b border-neutral-800/60 last:border-0 ${
                              i === 0 ? 'bg-green-500/5' : 'bg-transparent'
                            } hover:bg-neutral-900/60 transition-colors`}
                          >
                            <td className="px-3 py-2.5 font-medium text-neutral-200">
                              {i === 0 && (
                                <span className="mr-1.5 rounded bg-green-500/20 px-1 py-0.5 text-[9px] font-medium text-green-400">
                                  BEST
                                </span>
                              )}
                              {s.name}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`flex items-center gap-1 w-fit rounded px-1.5 py-0.5 text-[9px] font-medium ${regionBadge(s.region)}`}>
                                <MapPin className="h-2.5 w-2.5" />
                                {s.region}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-neutral-100">
                              ${(s.price_usd * entry.qty).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-neutral-500">{s.note}</td>
                            <td className="px-2 py-2.5">
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center rounded p-1 text-neutral-600 hover:text-orange-400 transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-800 px-5 py-3">
          <p className="text-[10px] text-neutral-600">
            Prices are estimates and may vary. Always verify before ordering.
          </p>
        </div>
      </div>
    </div>
  );
}
