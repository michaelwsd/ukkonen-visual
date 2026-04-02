'use client';

import React from 'react';
import { StepSnapshot } from '@/lib/ukkonen';

interface Props {
  step: StepSnapshot;
  prevStep: StepSnapshot | null;
}

function Var({
  label,
  value,
  changed,
  color = 'text-slate-200',
}: {
  label: string;
  value: string | number;
  changed: boolean;
  color?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-500 ${
        changed ? 'bg-amber-500/15 ring-1 ring-amber-500/40' : 'bg-slate-800/60'
      }`}
    >
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        {label}
      </span>
      <span
        className={`font-mono text-sm font-semibold ${
          changed ? 'text-amber-400' : color
        } transition-colors duration-500`}
      >
        {value}
      </span>
    </div>
  );
}

export default function VariablePanel({ step, prevStep }: Props) {
  const p = prevStep;

  const activeEdgeDisplay =
    step.activeEdge >= 0 && step.activeEdge < step.txt.length
      ? `'${step.txt[step.activeEdge]}' (idx ${step.activeEdge})`
      : '-1';

  const prevActiveEdgeDisplay =
    p && p.activeEdge >= 0 && p.activeEdge < p.txt.length
      ? `'${p.txt[p.activeEdge]}' (idx ${p.activeEdge})`
      : '-1';

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        Algorithm State
      </h3>
      <Var
        label="Active Node"
        value={step.activeNodeId === 0 ? 'root' : `Node ${step.activeNodeId}`}
        changed={!!p && step.activeNodeId !== p.activeNodeId}
        color="text-amber-300"
      />
      <Var
        label="Active Edge"
        value={activeEdgeDisplay}
        changed={!!p && activeEdgeDisplay !== prevActiveEdgeDisplay}
        color="text-blue-300"
      />
      <Var
        label="Active Length"
        value={step.activeLength}
        changed={!!p && step.activeLength !== p.activeLength}
        color="text-emerald-300"
      />
      <Var
        label="Last j"
        value={step.lastj}
        changed={!!p && step.lastj !== p.lastj}
        color="text-purple-300"
      />
      <Var
        label="Leaf End"
        value={step.leafEnd}
        changed={!!p && step.leafEnd !== p.leafEnd}
        color="text-rose-300"
      />
      <Var
        label="Last New Node"
        value={step.lastNewNodeId !== null ? `Node ${step.lastNewNodeId}` : 'None'}
        changed={!!p && step.lastNewNodeId !== p.lastNewNodeId}
        color="text-violet-300"
      />
    </div>
  );
}
