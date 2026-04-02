'use client';

import React from 'react';
import { StepSnapshot } from '@/lib/ukkonen';

interface Props {
  currentIndex: number;
  totalSteps: number;
  step: StepSnapshot;
  onPrev: () => void;
  onNext: () => void;
  onPrevPhase: () => void;
  onNextPhase: () => void;
  onReset: () => void;
  onGoToEnd: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

function RuleBadge({ rule }: { rule: string }) {
  const map: Record<string, { label: string; color: string }> = {
    rule1: { label: 'Rule 1 — Leaf Extension', color: 'bg-blue-500/20 text-blue-300 ring-blue-500/30' },
    rule2case1: { label: 'Rule 2, Case 1 (Alternate) — New Leaf', color: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30' },
    rule2case2: { label: 'Rule 2, Case 2 (Regular) — Split Edge', color: 'bg-purple-500/20 text-purple-300 ring-purple-500/30' },
    rule3: { label: 'Rule 3 — Showstopper', color: 'bg-rose-500/20 text-rose-300 ring-rose-500/30' },
    skipcount: { label: 'Skip / Count', color: 'bg-slate-500/20 text-slate-300 ring-slate-500/30' },
    suffixlink: { label: 'Follow Suffix Link', color: 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30' },
    rootadjust: { label: 'Root Adjustment', color: 'bg-orange-500/20 text-orange-300 ring-orange-500/30' },
  };
  const info = map[rule] || { label: rule, color: 'bg-slate-700 text-slate-300' };

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ring-1 ${info.color}`}
    >
      {info.label}
    </span>
  );
}

export default function StepControls({
  currentIndex,
  totalSteps,
  step,
  onPrev,
  onNext,
  onPrevPhase,
  onNextPhase,
  onReset,
  onGoToEnd,
  isPlaying,
  onTogglePlay,
  speed,
  onSpeedChange,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Phase / Extension header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-slate-800 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-500">Phase </span>
          <span className="text-sm font-bold text-amber-400">{step.phase + 1}</span>
          <span className="text-xs text-slate-600"> / {step.txt.length}</span>
        </div>
        <div className="bg-slate-800 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-500">Extension </span>
          <span className="text-sm font-bold text-emerald-400">
            {step.extension >= 0 ? step.extension : '—'}
          </span>
        </div>
        <RuleBadge rule={step.rule} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onReset}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
        >
          Reset
        </button>
        <button
          onClick={onPrevPhase}
          disabled={currentIndex === 0}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs font-medium transition-colors"
        >
          Prev Phase
        </button>
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs font-medium transition-colors"
        >
          Prev
        </button>
        <button
          onClick={onTogglePlay}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            isPlaying
              ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
              : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
          }`}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={onNext}
          disabled={currentIndex >= totalSteps - 1}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs font-medium transition-colors"
        >
          Next
        </button>
        <button
          onClick={onNextPhase}
          disabled={currentIndex >= totalSteps - 1}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs font-medium transition-colors"
        >
          Next Phase
        </button>
        <button
          onClick={onGoToEnd}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
        >
          End
        </button>
      </div>

      {/* Speed + progress */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Speed</span>
          <input
            type="range"
            min={200}
            max={3000}
            step={100}
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="w-24 accent-amber-500"
          />
          <span className="text-xs text-slate-400 font-mono w-12">
            {(speed / 1000).toFixed(1)}s
          </span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Step {currentIndex + 1} / {totalSteps}
            </span>
            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500/60 rounded-full transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / totalSteps) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
