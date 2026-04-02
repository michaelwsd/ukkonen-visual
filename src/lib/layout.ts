// Tree layout computation — runs client-side (no algorithm implementation)

import { TreeNode } from './types';

export interface LayoutNode {
  id: number;
  x: number;
  y: number;
  label: string;
  isLeaf: boolean;
  isRoot: boolean;
  suffixIndex: number;
}

export interface LayoutEdge {
  from: number;
  to: number;
  label: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface LayoutSuffixLink {
  from: number;
  to: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  suffixLinks: LayoutSuffixLink[];
  width: number;
  height: number;
}

export function computeLayout(
  treeNodes: TreeNode[],
  txt: string,
  leafEnd: number
): TreeLayout {
  if (treeNodes.length === 0) return { nodes: [], edges: [], suffixLinks: [], width: 0, height: 0 };

  const root = treeNodes[0];
  const layoutNodes: LayoutNode[] = [];
  const layoutEdges: LayoutEdge[] = [];
  const layoutSuffixLinks: LayoutSuffixLink[] = [];

  const CHAR_WIDTH = 7.5;
  const MIN_H_GAP = 60;
  const NODE_V_GAP = 100;
  const nodeById = new Map<number, TreeNode>();
  for (const n of treeNodes) nodeById.set(n.id, n);

  const getEndVal = (n: TreeNode) => (n.end === 'leaf' ? leafEnd : n.end);

  function edgeLabel(childId: number): string {
    const child = nodeById.get(childId)!;
    return txt.slice(child.start, getEndVal(child) + 1);
  }

  const subtreeWidthCache = new Map<number, number>();
  function subtreeWidth(nodeId: number): number {
    if (subtreeWidthCache.has(nodeId)) return subtreeWidthCache.get(nodeId)!;
    const node = nodeById.get(nodeId)!;
    const kids = node.children.filter((c) => c !== null) as number[];
    if (kids.length === 0) {
      subtreeWidthCache.set(nodeId, MIN_H_GAP);
      return MIN_H_GAP;
    }
    let totalWidth = 0;
    for (const kidId of kids) {
      const label = edgeLabel(kidId);
      const labelWidth = label.length * CHAR_WIDTH + 30;
      const childWidth = subtreeWidth(kidId);
      totalWidth += Math.max(labelWidth, childWidth);
    }
    totalWidth += (kids.length - 1) * 10;
    subtreeWidthCache.set(nodeId, totalWidth);
    return totalWidth;
  }
  subtreeWidth(root.id);

  const posMap = new Map<number, { x: number; y: number }>();

  function assignPositions(nodeId: number, depth: number, leftX: number, availableWidth: number) {
    const node = nodeById.get(nodeId)!;
    const kids = node.children.filter((c) => c !== null) as number[];

    if (kids.length === 0) {
      posMap.set(nodeId, { x: leftX + availableWidth / 2, y: depth * NODE_V_GAP });
      return;
    }

    const totalNeeded = subtreeWidth(nodeId);
    let curX = leftX;
    for (const kidId of kids) {
      const label = edgeLabel(kidId);
      const labelWidth = label.length * CHAR_WIDTH + 30;
      const childNeeded = Math.max(labelWidth, subtreeWidth(kidId));
      const childSlot = (childNeeded / totalNeeded) * availableWidth;
      assignPositions(kidId, depth + 1, curX, childSlot);
      curX += childSlot;
    }

    const childPositions = kids.map((k) => posMap.get(k)!.x);
    const minCX = Math.min(...childPositions);
    const maxCX = Math.max(...childPositions);
    posMap.set(nodeId, { x: (minCX + maxCX) / 2, y: depth * NODE_V_GAP });
  }

  const totalW = Math.max(subtreeWidth(root.id), 200);
  assignPositions(root.id, 0, 0, totalW);

  for (const node of treeNodes) {
    const pos = posMap.get(node.id);
    if (!pos) continue;

    const isRoot = node.id === root.id;

    layoutNodes.push({
      id: node.id,
      x: pos.x,
      y: pos.y,
      label: isRoot ? 'root' : node.isLeaf ? `L${node.suffixIndex}` : `N${node.id}`,
      isLeaf: node.isLeaf,
      isRoot,
      suffixIndex: node.suffixIndex,
    });

    const kids = node.children.filter((c) => c !== null) as number[];
    for (const kidId of kids) {
      const kidPos = posMap.get(kidId);
      if (!kidPos) continue;

      const label = edgeLabel(kidId);
      layoutEdges.push({
        from: node.id,
        to: kidId,
        label,
        fromX: pos.x,
        fromY: pos.y,
        toX: kidPos.x,
        toY: kidPos.y,
      });
    }

    if (
      !node.isLeaf &&
      node.suffixLink !== null
    ) {
      const targetPos = posMap.get(node.suffixLink);
      if (targetPos) {
        layoutSuffixLinks.push({
          from: node.id,
          to: node.suffixLink,
          fromX: pos.x,
          fromY: pos.y,
          toX: targetPos.x,
          toY: targetPos.y,
        });
      }
    }
  }

  const allX = layoutNodes.map((n) => n.x);
  const allY = layoutNodes.map((n) => n.y);
  const PADDING = 60;
  const width = Math.max(...allX) - Math.min(...allX) + PADDING * 2;
  const height = Math.max(...allY) + NODE_V_GAP;

  const minX = Math.min(...allX);
  for (const n of layoutNodes) n.x -= minX - PADDING;
  for (const e of layoutEdges) {
    e.fromX -= minX - PADDING;
    e.toX -= minX - PADDING;
  }
  for (const s of layoutSuffixLinks) {
    s.fromX -= minX - PADDING;
    s.toX -= minX - PADDING;
  }

  return { nodes: layoutNodes, edges: layoutEdges, suffixLinks: layoutSuffixLinks, width, height };
}
