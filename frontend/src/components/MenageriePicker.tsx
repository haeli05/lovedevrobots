'use client';

import { useState } from 'react';
import { ROBOTS, CATEGORY_LABELS, type MenagerieRobot } from '@/lib/menagerie';

interface Props {
  onSelect: (robot: MenagerieRobot) => void;
}

const CATEGORY_ORDER: MenagerieRobot['category'][] = [
  'arm', 'bimanual', 'humanoid', 'quadruped', 'hand',
];

export function MenageriePicker({ onSelect }: Props) {
  const [activeCategory, setActiveCategory] = useState<MenagerieRobot['category']>('arm');

  const filtered = ROBOTS.filter((r) => r.category === activeCategory);

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      {/* Category tabs */}
      <div className="flex gap-1 border-b border-neutral-800 px-3 pt-3 pb-0">
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Robot cards */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid gap-2">
          {filtered.map((robot) => (
            <button
              key={robot.id}
              onClick={() => onSelect(robot)}
              className="group flex flex-col gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-left transition-colors hover:border-orange-500/50 hover:bg-neutral-800"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-neutral-100 group-hover:text-orange-400">
                  {robot.name}
                </span>
                <span className="shrink-0 text-xs text-neutral-600">{robot.dof} DOF</span>
              </div>
              <span className="text-xs text-neutral-500">{robot.maker}</span>
              <p className="text-xs leading-relaxed text-neutral-400">{robot.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
