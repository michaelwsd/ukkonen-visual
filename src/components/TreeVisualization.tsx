'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { StepSnapshot } from '@/lib/types';
import { computeLayout } from '@/lib/layout';

interface Props {
  step: StepSnapshot;
  prevStep: StepSnapshot | null;
}

const NODE_RADIUS = 18;

export default function TreeVisualization({ step }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const layout = useMemo(
    () => computeLayout(step.nodes, step.txt, step.leafEnd),
    [step.nodes, step.txt, step.leafEnd]
  );

  // Fit the tree into the viewport
  const fitToView = useCallback(() => {
    if (!containerRef.current || layout.nodes.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 40;
    const scaleX = (rect.width - padding * 2) / Math.max(layout.width, 1);
    const scaleY = (rect.height - padding * 2) / Math.max(layout.height, 1);
    // On mobile (<640px), allow larger scale so nodes aren't tiny
    const maxScale = rect.width < 640 ? 2.5 : 1.5;
    const scale = Math.min(scaleX, scaleY, maxScale);
    const finalScale = Math.max(scale, 0.5);
    const contentW = layout.width * finalScale;
    const contentH = layout.height * finalScale;
    setTransform({
      x: (rect.width - contentW) / 2,
      y: (rect.height - contentH) / 2 + 10,
      scale: finalScale,
    });
  }, [layout]);

  // Auto-fit on layout change
  useEffect(() => { fitToView(); }, [fitToView]);

  // Mouse pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setTransform((t) => ({
      ...t,
      x: panStart.current.tx + (e.clientX - panStart.current.x),
      y: panStart.current.ty + (e.clientY - panStart.current.y),
    }));
  };
  const handleMouseUp = () => setIsPanning(false);
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.2, Math.min(3, t.scale * delta)),
    }));
  };

  // Touch pan + pinch zoom
  const touchRef = useRef<{ startDist: number; startScale: number; startX: number; startY: number; tx: number; ty: number; fingers: number }>({
    startDist: 0, startScale: 1, startX: 0, startY: 0, tx: 0, ty: 0, fingers: 0
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchRef.current = {
        ...touchRef.current,
        fingers: 1,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        tx: transform.x,
        ty: transform.y,
      };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = {
        ...touchRef.current,
        fingers: 2,
        startDist: Math.sqrt(dx * dx + dy * dy),
        startScale: transform.scale,
        startX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        startY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        tx: transform.x,
        ty: transform.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && touchRef.current.fingers === 1) {
      const dx = e.touches[0].clientX - touchRef.current.startX;
      const dy = e.touches[0].clientY - touchRef.current.startY;
      setTransform((t) => ({ ...t, x: touchRef.current.tx + dx, y: touchRef.current.ty + dy }));
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / (touchRef.current.startDist || 1);
      const newScale = Math.max(0.2, Math.min(3, touchRef.current.startScale * ratio));
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setTransform({
        x: touchRef.current.tx + (midX - touchRef.current.startX),
        y: touchRef.current.ty + (midY - touchRef.current.startY),
        scale: newScale,
      });
    }
  };

  // Zoom controls
  const zoomIn = () => setTransform((t) => ({ ...t, scale: Math.min(3, t.scale * 1.3) }));
  const zoomOut = () => setTransform((t) => ({ ...t, scale: Math.max(0.2, t.scale / 1.3) }));

  const newNodeSet = new Set(step.newNodeIds);

  const activeNodeLayoutNode = layout.nodes.find(
    (n) => n.id === step.activeNodeId
  );

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full bg-slate-950 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <svg width="100%" height="100%" className="block">
          <defs>
            <marker
              id="arrowhead-suffix"
              markerWidth="10"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon points="0 0, 10 4, 0 8" fill="#60a5fa" />
            </marker>
            <filter id="glow-green">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-amber">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g
            transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
            style={{ transition: isPanning ? 'none' : 'transform 0.3s ease' }}
          >
            {/* Suffix links */}
            {layout.suffixLinks.map((sl, idx) => {
              if (sl.from === sl.to) {
                const loopR = 22;
                const cx = sl.fromX + NODE_RADIUS + loopR + 4;
                const cy = sl.fromY;
                const sx = sl.fromX + NODE_RADIUS + 2;
                const sy = sl.fromY - 5;
                const ex = sl.fromX + NODE_RADIUS + 2;
                const ey = sl.fromY + 5;
                return (
                  <path
                    key={`sl-${idx}`}
                    d={`M ${sx} ${sy} C ${cx} ${cy - loopR * 1.4} ${cx} ${cy + loopR * 1.4} ${ex} ${ey}`}
                    stroke="#60a5fa"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    fill="none"
                    opacity={0.6}
                    markerEnd="url(#arrowhead-suffix)"
                    className="transition-all duration-500"
                  />
                );
              }

              const dx = sl.toX - sl.fromX;
              const dy = sl.toY - sl.fromY;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const horizontalDist = Math.abs(dx);
              const swingAmount = Math.max(60, dist * 0.4);
              const midX = (sl.fromX + sl.toX) / 2;
              const midY = (sl.fromY + sl.toY) / 2;
              const cmx = midX + (horizontalDist < 40 ? swingAmount : swingAmount * 0.5);
              const cmy = midY - swingAmount * 0.3;

              const startTx = cmx - sl.fromX;
              const startTy = cmy - sl.fromY;
              const startTLen = Math.sqrt(startTx * startTx + startTy * startTy) || 1;
              const x1 = sl.fromX + (startTx / startTLen) * (NODE_RADIUS + 3);
              const y1 = sl.fromY + (startTy / startTLen) * (NODE_RADIUS + 3);

              const endTx = sl.toX - cmx;
              const endTy = sl.toY - cmy;
              const endTLen = Math.sqrt(endTx * endTx + endTy * endTy) || 1;
              const arrowTipGap = NODE_RADIUS + 3;
              const x2 = sl.toX - (endTx / endTLen) * arrowTipGap;
              const y2 = sl.toY - (endTy / endTLen) * arrowTipGap;

              return (
                <path
                  key={`sl-${idx}`}
                  d={`M ${x1} ${y1} Q ${cmx} ${cmy} ${x2} ${y2}`}
                  stroke="#60a5fa"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  fill="none"
                  opacity={0.6}
                  markerEnd="url(#arrowhead-suffix)"
                  className="transition-all duration-500"
                />
              );
            })}

            {/* Edges */}
            {layout.edges.map((edge) => {
              const isHighlighted =
                step.highlightEdge &&
                step.highlightEdge[0] === edge.from &&
                step.highlightEdge[1] === edge.to;
              const isNew =
                newNodeSet.has(edge.to) || newNodeSet.has(edge.from);

              const x1 = edge.fromX;
              const y1 = edge.fromY + NODE_RADIUS;
              const x2 = edge.toX;
              const y2 = edge.toY - NODE_RADIUS;

              const t = 0.7;
              const labelX = x1 + (x2 - x1) * t;
              const labelY = y1 + (y2 - y1) * t;

              const labelColor = isHighlighted ? '#fbbf24' : isNew ? '#4ade80' : '#cbd5e1';
              const charWidth = 7.5;
              const textWidth = edge.label.length * charWidth + 8;
              const textHeight = 16;

              return (
                <g key={`e-${edge.from}-${edge.to}`}>
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={isHighlighted ? '#fbbf24' : isNew ? '#4ade80' : '#475569'}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    className="transition-all duration-500"
                  />
                  <rect
                    x={labelX - textWidth / 2} y={labelY - textHeight / 2}
                    width={textWidth} height={textHeight} rx={3}
                    fill="#0f172a" stroke="#1e293b" strokeWidth={0.5}
                  />
                  <text
                    x={labelX} y={labelY}
                    textAnchor="middle" dominantBaseline="central"
                    fill={labelColor} fontSize={11} fontFamily="monospace"
                    fontWeight={isHighlighted ? 700 : 500}
                    className="transition-all duration-500"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {layout.nodes.map((node) => {
              const isActive = node.id === step.activeNodeId;
              const isNew = newNodeSet.has(node.id);
              const isLastNewNode = node.id === step.lastNewNodeId;

              let fillColor = '#1e293b';
              let strokeColor = '#475569';
              let strokeWidth = 1.5;
              let filter = '';

              if (isNew) {
                fillColor = '#064e3b';
                strokeColor = '#4ade80';
                strokeWidth = 2.5;
                filter = 'url(#glow-green)';
              }
              if (isActive) {
                fillColor = '#78350f';
                strokeColor = '#fbbf24';
                strokeWidth = 2.5;
                filter = 'url(#glow-amber)';
              }
              if (isLastNewNode && !isNew) {
                strokeColor = '#a78bfa';
                strokeWidth = 2;
              }

              return (
                <g key={`n-${node.id}`} className="transition-all duration-500">
                  {node.isRoot ? (
                    <rect
                      x={node.x - NODE_RADIUS} y={node.y - NODE_RADIUS}
                      width={NODE_RADIUS * 2} height={NODE_RADIUS * 2} rx={4}
                      fill={fillColor} stroke={strokeColor}
                      strokeWidth={strokeWidth} filter={filter}
                    />
                  ) : (
                    <circle
                      cx={node.x} cy={node.y} r={NODE_RADIUS}
                      fill={fillColor} stroke={strokeColor}
                      strokeWidth={strokeWidth} filter={filter}
                    />
                  )}
                  <text
                    x={node.x} y={node.y + 4}
                    textAnchor="middle"
                    fill={isActive ? '#fbbf24' : isNew ? '#4ade80' : '#e2e8f0'}
                    fontSize={node.isRoot ? 11 : 10}
                    fontFamily="monospace" fontWeight={600}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}

            {/* Active node indicator */}
            {activeNodeLayoutNode && (
              <text
                x={activeNodeLayoutNode.x}
                y={activeNodeLayoutNode.y - NODE_RADIUS - 6}
                textAnchor="middle" fill="#fbbf24"
                fontSize={10} fontWeight={700} fontFamily="monospace"
              >
                ACTIVE
              </text>
            )}
          </g>
        </svg>
      </div>

      {/* Zoom controls — bottom-right corner */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          onClick={zoomIn}
          className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-lg font-bold flex items-center justify-center backdrop-blur-sm transition-colors"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-lg font-bold flex items-center justify-center backdrop-blur-sm transition-colors"
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <button
          onClick={fitToView}
          className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 text-xs font-bold flex items-center justify-center backdrop-blur-sm transition-colors"
          aria-label="Fit to view"
          title="Center & fit"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="3" width="10" height="10" rx="1" />
            <path d="M1 5V2a1 1 0 011-1h3M11 1h3a1 1 0 011 1v3M15 11v3a1 1 0 01-1 1h-3M5 15H2a1 1 0 01-1-1v-3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
