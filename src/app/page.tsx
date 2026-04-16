'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StepSnapshot } from '@/lib/types';
import TreeVisualization from '@/components/TreeVisualization';
import VariablePanel from '@/components/VariablePanel';
import StringDisplay from '@/components/StringDisplay';
import StepControls from '@/components/StepControls';

export default function Home() {
  const [inputText, setInputText] = useState('abcabc$');
  const [text, setText] = useState('abcabc$');
  const [steps, setSteps] = useState<StepSnapshot[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch steps from server API
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/build-steps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txt: text }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setSteps(data.steps);
          setStepIndex(0);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [text]);

  const step: StepSnapshot | null = steps[stepIndex] ?? null;
  const prevStep: StepSnapshot | null = stepIndex > 0 ? steps[stepIndex - 1] : null;

  const goTo = useCallback(
    (idx: number) => setStepIndex(Math.max(0, Math.min(steps.length - 1, idx))),
    [steps.length]
  );

  const nextStep = useCallback(() => {
    setStepIndex((prev) => {
      if (prev >= steps.length - 1) {
        setIsPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length]);

  const prevStepFn = useCallback(() => goTo(stepIndex - 1), [goTo, stepIndex]);

  const nextPhase = useCallback(() => {
    const currentPhase = step?.phase ?? 0;
    const idx = steps.findIndex((s, i) => i > stepIndex && s.phase > currentPhase);
    goTo(idx >= 0 ? idx : steps.length - 1);
  }, [step, stepIndex, steps, goTo]);

  const prevPhase = useCallback(() => {
    const currentPhase = step?.phase ?? 0;
    const targetPhase = currentPhase - 1;
    if (targetPhase < 0) {
      goTo(0);
      return;
    }
    const idx = steps.findIndex((s) => s.phase === targetPhase);
    goTo(idx >= 0 ? idx : 0);
  }, [step, steps, goTo]);

  // Autoplay
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isPlaying) {
      timerRef.current = setInterval(nextStep, speed);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, nextStep]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight' || e.key === 'l') nextStep();
      else if (e.key === 'ArrowLeft' || e.key === 'h') prevStepFn();
      else if (e.key === 'ArrowUp' || e.key === 'k') prevPhase();
      else if (e.key === 'ArrowDown' || e.key === 'j') nextPhase();
      else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nextStep, prevStepFn, nextPhase, prevPhase]);

  const handleSubmit = () => {
    const val = inputText.trim();
    if (val.length > 0) {
      setText(val);
      setStepIndex(0);
      setIsPlaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Building suffix tree...</p>
      </div>
    );
  }

  if (!step) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-400 mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-slate-100">
              Ukkonen&apos;s Suffix Tree — Step-by-Step Visualizer
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Arrow keys to navigate, Space to play/pause <span className="text-slate-600 ml-2">by mw</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Enter string (e.g. abcabc$)"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-200 w-52 focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-slate-600"
              maxLength={20}
            />
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-sm font-bold transition-colors"
            >
              Build
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Tree + controls */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* String display */}
          <div className="px-6 py-3 border-b border-slate-800/50">
            <StringDisplay step={step} />
          </div>

          {/* Tree */}
          <div className="flex-1 min-h-75">
            <TreeVisualization step={step} prevStep={prevStep} />
          </div>

          {/* Controls */}
          <div className="px-6 py-4 border-t border-slate-800">
            <StepControls
              currentIndex={stepIndex}
              totalSteps={steps.length}
              step={step}
              onPrev={prevStepFn}
              onNext={nextStep}
              onPrevPhase={prevPhase}
              onNextPhase={nextPhase}
              onReset={() => {
                goTo(0);
                setIsPlaying(false);
              }}
              onGoToEnd={() => {
                goTo(steps.length - 1);
                setIsPlaying(false);
              }}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              speed={speed}
              onSpeedChange={setSpeed}
            />
          </div>
        </div>

        {/* Right: Variable panel + explanation */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col">
          <div className="p-5 flex-1 overflow-y-auto space-y-6">
            <VariablePanel step={step} prevStep={prevStep} />

            {/* Explanation */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Explanation
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {step.explanation}
              </p>
            </div>

            {/* Legend */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Legend
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500/40 ring-1 ring-amber-500" />
                  <span className="text-slate-400">Active Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500/40 ring-1 ring-emerald-500" />
                  <span className="text-slate-400">Newly Created Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-violet-500/40 ring-1 ring-violet-500" />
                  <span className="text-slate-400">Last New Internal Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-0.5 border-t-2 border-dashed border-blue-400" />
                  <span className="text-slate-400">Suffix Link</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
