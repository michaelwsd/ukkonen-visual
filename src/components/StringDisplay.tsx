'use client';

import React from 'react';
import { StepSnapshot } from '@/lib/types';

interface Props {
  step: StepSnapshot;
}

export default function StringDisplay({ step }: Props) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {step.txt.split('').map((ch, idx) => {
        const isPhaseChar = idx === step.phase;
        const isProcessed = idx < step.phase;
        const isInCurrentSuffix =
          step.extension >= 0 && idx >= step.extension && idx <= step.phase;

        let bg = 'bg-slate-800';
        let text = 'text-slate-500';
        let ring = '';

        if (isInCurrentSuffix) {
          bg = 'bg-emerald-900/50';
          text = 'text-emerald-300';
        }
        if (isPhaseChar) {
          bg = 'bg-amber-900/60';
          text = 'text-amber-300';
          ring = 'ring-1 ring-amber-500/60';
        }
        if (isProcessed && !isInCurrentSuffix) {
          bg = 'bg-slate-800/80';
          text = 'text-slate-400';
        }

        return (
          <div key={idx} className="flex flex-col items-center">
            <span
              className={`w-8 h-8 flex items-center justify-center rounded font-mono text-sm font-bold ${bg} ${text} ${ring} transition-all duration-300`}
            >
              {ch}
            </span>
            <span className="text-[10px] text-slate-600 mt-0.5 font-mono">
              {idx}
            </span>
          </div>
        );
      })}
    </div>
  );
}
