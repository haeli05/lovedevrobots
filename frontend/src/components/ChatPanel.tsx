'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef } from 'react';
import { Bot, Send, User } from 'lucide-react';

import type { Assembly } from '@/lib/types';
import { newAssembly } from '@/lib/assembly';

interface ChatPanelProps {
  assembly: Assembly | null;
  onAssemblyUpdate: (a: Assembly) => void;
  onFinalized: (name: string) => void;
}

const SUGGESTIONS = [
  'Build a 4-DOF arm with a gripper under $200',
  'Make a simple 2-DOF pan-tilt head',
  'Build a 6-DOF arm under $400 BOM',
  'Make the cheapest possible 3-DOF arm',
];

type StreamDataItem = Record<string, unknown>;

export function ChatPanel({ assembly, onAssemblyUpdate, onFinalized }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const assemblyRef = useRef<Assembly | null>(assembly);

  useEffect(() => {
    assemblyRef.current = assembly;
  }, [assembly]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, data, append } = useChat({
    api: '/api/chat',
  });

  // Parse assembly updates from the data stream
  useEffect(() => {
    if (!data || data.length === 0) return;
    for (let i = data.length - 1; i >= 0; i--) {
      const d = data[i] as StreamDataItem | null;
      if (d?.type === 'assembly_update') {
        onAssemblyUpdate(d.assembly as Assembly);
        break;
      }
    }
    for (const raw of data) {
      const d = raw as StreamDataItem | null;
      if (d?.type === 'finalized') {
        onFinalized(d.name as string);
      }
    }
  }, [data, onAssemblyUpdate, onFinalized]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const getBody = () => ({ assembly: assemblyRef.current ?? newAssembly() });

  const submit = (e: React.FormEvent) => {
    handleSubmit(e, { body: getBody() });
  };

  const sendSuggestion = (text: string) => {
    void append({ role: 'user', content: text }, { body: getBody() });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-medium text-neutral-200">Robot Agent</span>
          <span className="ml-auto rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
            DeepSeek V4
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Describe the robot you want to build. The agent will pick parts from the catalogue,
              check compatibility, and assemble it for you.
            </p>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendSuggestion(s)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs text-neutral-400 hover:border-neutral-700 hover:text-neutral-200 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const textContent =
            typeof m.content === 'string'
              ? m.content
              : (m.content as { type: string; text?: string }[])
                  .filter((c) => c.type === 'text')
                  .map((c) => c.text ?? '')
                  .join('');

          if (!textContent && m.role !== 'user') return null;

          return (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role !== 'user' && (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20">
                  <Bot className="h-3 w-3 text-orange-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-orange-500 text-white'
                    : 'bg-neutral-800 text-neutral-200'
                }`}
              >
                {textContent}
              </div>
              {m.role === 'user' && (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-700">
                  <User className="h-3 w-3 text-neutral-300" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20">
              <Bot className="h-3 w-3 text-orange-400" />
            </div>
            <div className="flex gap-1 rounded-2xl bg-neutral-800 px-3 py-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={submit} className="border-t border-neutral-800 p-3 flex gap-2">
        <input
          id="chat-input"
          value={input}
          onChange={handleInputChange}
          placeholder="Describe your robot…"
          disabled={isLoading}
          className="flex-1 rounded-xl bg-neutral-800 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus:ring-1 focus:ring-orange-500/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
