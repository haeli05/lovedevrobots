'use client';

import { useState, useCallback } from 'react';
import { Bot } from 'lucide-react';

import { ChatPanel } from '@/components/ChatPanel';
import { AssemblyPanel } from '@/components/AssemblyPanel';
import { RobotViewer } from '@/components/RobotViewer';
import { MenageriePicker } from '@/components/MenageriePicker';
import type { Assembly } from '@/lib/types';
import { type MenagerieRobot, ROBOTS } from '@/lib/menagerie';

type LeftTab = 'chat' | 'library';

export default function Home() {
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>('library');
  const [menagerieRobot, setMenagerieRobot] = useState<MenagerieRobot | null>(
    () => ROBOTS.find(r => r.category === 'arm') ?? null
  );

  const handleAssemblyUpdate = useCallback((a: Assembly) => {
    setAssembly(a);
    setIsFinalized(false);
  }, []);

  const handleFinalized = useCallback((_name: string) => {
    setIsFinalized(true);
  }, []);

  const handleRobotSelect = useCallback((r: MenagerieRobot) => {
    setMenagerieRobot(r);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-neutral-100">lovedevrobots</span>
        </div>
        <span className="text-xs text-neutral-600">·</span>
        <span className="text-xs text-neutral-500">AI-powered robot builder</span>
        <span className="ml-auto text-xs font-mono text-neutral-600">v0.9</span>
        {assembly && Object.keys(assembly.nodes).length > 0 && (
          <>
            <span className="text-xs text-neutral-600">·</span>
            <span className="text-xs text-neutral-400">{assembly.name}</span>
          </>
        )}
      </header>

      {/* 3-column layout */}
      <main className="flex flex-1 overflow-hidden">

        {/* Left column — Chat + Library tabs */}
        <aside className="flex w-[380px] shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
          {/* Tab bar */}
          <div className="flex shrink-0 border-b border-neutral-800">
            {(['chat', 'library'] as LeftTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors font-mono border-b-2 ${
                  leftTab === tab
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-neutral-600 hover:text-neutral-400'
                }`}
              >
                {tab === 'chat' ? 'Chat' : 'Robot Library'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {leftTab === 'chat' ? (
              <ChatPanel
                assembly={assembly}
                onAssemblyUpdate={handleAssemblyUpdate}
                onFinalized={handleFinalized}
              />
            ) : (
              <MenageriePicker
                onSelect={handleRobotSelect}
                selectedId={menagerieRobot?.id ?? null}
              />
            )}
          </div>
        </aside>

        {/* 3D Viewer — center */}
        <div className="flex-1 bg-neutral-900">
          <RobotViewer
            assembly={assembly}
            menagerieRobot={leftTab === 'library' ? menagerieRobot : null}
          />
        </div>

        {/* Assembly / BOM — right */}
        <aside className="w-[280px] shrink-0 border-l border-neutral-800 bg-neutral-950">
          <AssemblyPanel
            assembly={assembly}
            isFinalized={isFinalized}
            menagerieRobot={leftTab === 'library' ? menagerieRobot : null}
          />
        </aside>

      </main>
    </div>
  );
}
