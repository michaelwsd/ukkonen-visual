// Ukkonen's suffix tree algorithm ported from Python, instrumented for visualization

export interface TreeNode {
  id: number;
  children: (number | null)[]; // indices into node array
  start: number;
  end: number | 'leaf'; // 'leaf' means use global leafEnd
  isLeaf: boolean;
  suffixIndex: number;
  suffixLink: number | null; // index into node array
}

export type RuleApplied =
  | 'rule1'
  | 'rule2case1'
  | 'rule2case2'
  | 'rule3'
  | 'skipcount'
  | 'suffixlink'
  | 'rootadjust';

export interface StepSnapshot {
  phase: number;          // i (0-based)
  extension: number;      // j (lastj value at this step)
  txt: string;
  leafEnd: number;
  activeNodeId: number;
  activeEdge: number;
  activeLength: number;
  lastj: number;
  lastNewNodeId: number | null;
  rule: RuleApplied;
  explanation: string;
  nodes: TreeNode[];
  newNodeIds: number[];       // nodes created in this step
  highlightEdge: [number, number] | null; // [parentId, childId] of the edge acted on
  suffixLinkFrom: number | null;
  suffixLinkTo: number | null;
}

function cloneNodes(nodes: InternalNode[]): TreeNode[] {
  return nodes.map((n) => ({
    id: n.id,
    children: [...n.children],
    start: n.start,
    end: n.end === null ? 'leaf' : n.end,
    isLeaf: n.isLeaf,
    suffixIndex: n.suffixIndex,
    suffixLink: n.suffixLink,
  }));
}

interface InternalNode {
  id: number;
  children: (number | null)[];
  start: number;
  end: number | null; // null means leaf (uses global leafEnd)
  isLeaf: boolean;
  suffixIndex: number;
  suffixLink: number | null;
}

export function buildSteps(txt: string): StepSnapshot[] {
  const steps: StepSnapshot[] = [];
  const nodes: InternalNode[] = [];
  let nextId = 0;
  let leafEnd = -1;

  function makeNode(
    start: number,
    end: number | null,
    suffixIndex: number,
    isLeaf: boolean
  ): InternalNode {
    const node: InternalNode = {
      id: nextId++,
      children: new Array(128).fill(null),
      start,
      end,
      isLeaf,
      suffixIndex,
      suffixLink: null,
    };
    nodes.push(node);
    return node;
  }

  function getEnd(node: InternalNode): number {
    return node.end === null ? leafEnd : node.end;
  }

  function getLength(node: InternalNode): number {
    return getEnd(node) - node.start + 1;
  }

  // Create root
  const root = makeNode(-1, -1, -1, false);
  root.suffixLink = root.id;

  let activeNode = root.id;
  let activeEdge = -1;
  let activeLength = 0;
  let lastj = 0;

  // Helper: describe remainder as a string range
  function remStr(edge: number, len: number): string {
    if (len <= 0 || edge < 0 || edge >= txt.length) return 'none';
    const end = Math.min(edge + len - 1, txt.length - 1);
    return `"${txt.slice(edge, end + 1)}" [${edge}, ${end}]`;
  }

  function nodeLabel(id: number): string {
    if (id === root.id) return 'root';
    const node = nodes[id];
    if (node.isLeaf) return `L${node.suffixIndex}`;
    return `N${id}`;
  }

  function snap(
    phase: number,
    extension: number,
    rule: RuleApplied,
    explanation: string,
    newNodeIds: number[] = [],
    highlightEdge: [number, number] | null = null,
    slFrom: number | null = null,
    slTo: number | null = null,
  ) {
    steps.push({
      phase,
      extension,
      txt,
      leafEnd,
      activeNodeId: activeNode,
      activeEdge,
      activeLength,
      lastj,
      lastNewNodeId: lastNewNode,
      rule,
      explanation,
      nodes: cloneNodes(nodes),
      newNodeIds,
      highlightEdge,
      suffixLinkFrom: slFrom,
      suffixLinkTo: slTo,
    });
  }

  let lastNewNode: number | null = null;

  for (let i = 0; i < txt.length; i++) {
    // Rule 1: extend all leaves
    const prevLeafEnd = leafEnd;
    leafEnd++;

    lastNewNode = null;

    snap(i, -1, 'rule1',
      `Phase ${i + 1}: Processing character '${txt[i]}' (index ${i}). ` +
      `Leaf end incremented from ${prevLeafEnd} to ${leafEnd} — all existing leaf edges now include '${txt[i]}'. ` +
      `Remainder is ${remStr(activeEdge, activeLength)}. ` +
      `Extensions ${0}..${lastj - 1} are handled by Rule 1 (leaf extension). ` +
      `We need to explicitly process extensions ${lastj}..${i}.`
    );

    while (lastj <= i) {
      const edgeChar =
        activeLength === 0 ? txt.charCodeAt(i) : txt.charCodeAt(activeEdge);
      const edgeNodeId = nodes[activeNode].children[edgeChar];

      // Save pre-step state for change descriptions
      const prevActiveNode = activeNode;
      const prevActiveEdge = activeEdge;
      const prevActiveLength = activeLength;
      const prevLastj = lastj;

      if (edgeNodeId === null) {
        // Rule 2 Case 1: no outgoing edge — create new leaf
        const newLeaf = makeNode(i, null, lastj, true);
        nodes[activeNode].children[edgeChar] = newLeaf.id;

        const slFrom = lastNewNode;
        if (lastNewNode !== null) {
          nodes[lastNewNode].suffixLink = activeNode;
        }
        const prevLastNewNode = lastNewNode;
        lastNewNode = null;

        const lookupChar = String.fromCharCode(edgeChar);
        snap(i, lastj, 'rule2case1',
          `Extension ${lastj}: Trying to insert suffix "${txt.slice(lastj, i + 1)}" (indices [${lastj}, ${i}]). ` +
          `Active node is ${nodeLabel(activeNode)}, remainder is ${remStr(activeEdge, activeLength)}. ` +
          `No outgoing edge starting with '${lookupChar}' from ${nodeLabel(activeNode)}. ` +
          `Created new leaf L${lastj} with edge label starting at index ${i}. ` +
          `Rule 2, Case 1 (Alternate) applied.` +
          (prevLastNewNode !== null ? ` Suffix link set: ${nodeLabel(prevLastNewNode)} → ${nodeLabel(activeNode)}.` : ''),
          [newLeaf.id],
          [activeNode, newLeaf.id],
          slFrom,
          slFrom !== null ? activeNode : null,
        );
      } else {
        const edgeNode = nodes[edgeNodeId];
        const edgeLength = getLength(edgeNode);

        // Skip/count
        if (activeLength >= edgeLength) {
          const prevAN = activeNode;
          const prevAE = activeEdge;
          const prevAL = activeLength;
          activeNode = edgeNodeId;
          activeEdge += edgeLength;
          activeLength -= edgeLength;

          const edgeLabelStr = txt.slice(edgeNode.start, getEnd(edgeNode) + 1);
          snap(i, lastj, 'skipcount',
            `Extension ${lastj}: Walking down the tree (Skip/Count). ` +
            `Remainder ${remStr(prevAE, prevAL)} is longer than edge "${edgeLabelStr}" (length ${edgeLength}). ` +
            `Moved active node from ${nodeLabel(prevAN)} to ${nodeLabel(activeNode)}. ` +
            `Remainder updated: ${remStr(prevAE, prevAL)} → ${remStr(activeEdge, activeLength)}. ` +
            `Continuing to walk down from the new active node.`
          );
          continue;
        }

        // Rule 3: character already exists
        if (txt[i] === txt[edgeNode.start + activeLength]) {
          const slFrom = lastNewNode;
          const slTo = lastNewNode !== null ? activeNode : null;
          if (lastNewNode !== null) {
            nodes[lastNewNode].suffixLink = activeNode;
          }
          const prevLastNewNode = lastNewNode;
          lastNewNode = null;

          const prevAL = activeLength;
          activeLength++;
          activeEdge = edgeNode.start;

          snap(i, lastj, 'rule3',
            `Extension ${lastj}: Character '${txt[i]}' (index ${i}) already exists on the edge to ${nodeLabel(edgeNodeId)} ` +
            `at position ${edgeNode.start + prevAL}. Showstopper — Rule 3 applied. ` +
            `Remainder grows: ${remStr(activeEdge, prevAL)} → ${remStr(activeEdge, activeLength)}. ` +
            `All remaining extensions ${lastj + 1}..${i} are implicit (already in the tree). ` +
            `Phase ${i + 1} ends here.` +
            (prevLastNewNode !== null ? ` Suffix link set: ${nodeLabel(prevLastNewNode)} → ${nodeLabel(activeNode)}.` : ''),
            [],
            [activeNode, edgeNodeId],
            slFrom,
            slTo,
          );
          break;
        }

        // Rule 2 Case 2: split edge, create internal node + new leaf
        const start = edgeNode.start;
        const splitLabel = txt.slice(start, start + activeLength);
        const remainingLabel = txt.slice(start + activeLength, getEnd(edgeNode) + 1);
        edgeNode.start += activeLength;

        const newInternal = makeNode(start, start + activeLength - 1, -1, false);
        newInternal.suffixLink = root.id;

        const newLeaf = makeNode(i, null, lastj, true);

        newInternal.children[txt.charCodeAt(i)] = newLeaf.id;
        newInternal.children[txt.charCodeAt(edgeNode.start)] = edgeNodeId;
        nodes[activeNode].children[txt.charCodeAt(start)] = newInternal.id;

        let slFrom: number | null = null;
        let slTo: number | null = null;
        if (lastNewNode !== null) {
          nodes[lastNewNode].suffixLink = newInternal.id;
          slFrom = lastNewNode;
          slTo = newInternal.id;
        }
        const prevLastNewNode = lastNewNode;
        lastNewNode = newInternal.id;

        snap(i, lastj, 'rule2case2',
          `Extension ${lastj}: Trying to insert suffix "${txt.slice(lastj, i + 1)}" (indices [${lastj}, ${i}]). ` +
          `Active node is ${nodeLabel(activeNode)}, remainder is ${remStr(activeEdge, activeLength)}. ` +
          `Character '${txt[i]}' differs from '${txt[edgeNode.start]}' mid-edge. ` +
          `Split edge: "${splitLabel}" becomes internal node N${newInternal.id}, ` +
          `"${remainingLabel}" continues to old node, and new leaf L${lastj} added for '${txt[i]}'. ` +
          `Rule 2, Case 2 (Regular) applied.` +
          (prevLastNewNode !== null ? ` Suffix link set: ${nodeLabel(prevLastNewNode)} → N${newInternal.id}.` : '') +
          ` Last new internal node is now N${newInternal.id}.`,
          [newInternal.id, newLeaf.id],
          [activeNode, newInternal.id],
          slFrom,
          slTo,
        );
      }

      lastj++;

      // Active point traversal — record as a separate step
      if (activeNode === root.id && activeLength > 0) {
        const prevAE = activeEdge;
        const prevAL = activeLength;
        activeLength--;
        activeEdge++;

        snap(i, lastj, 'rootadjust',
          `Active point adjustment at root: Since active node is root, we remove the leading character from the remainder. ` +
          `Remainder updated: ${remStr(prevAE, prevAL)} → ${remStr(activeEdge, activeLength)}. ` +
          `This shifts from suffix "${txt.slice(lastj - 1, i + 1)}" to suffix "${txt.slice(lastj, i + 1)}" for the next extension.`
        );
      } else if (activeNode !== root.id) {
        const prevAN = activeNode;
        activeNode = nodes[activeNode].suffixLink!;

        snap(i, lastj, 'suffixlink',
          `Follow suffix link: Active node moves from ${nodeLabel(prevAN)} to ${nodeLabel(activeNode)}. ` +
          `Remainder stays ${remStr(activeEdge, activeLength)}. ` +
          `This positions us to process the next shorter suffix "${txt.slice(lastj, i + 1)}".`
        );
      }
    }
  }

  return steps;
}

// Utility: compute layout positions for tree nodes
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

  const CHAR_WIDTH = 7.5; // approx monospace char width at font-size 11
  const MIN_H_GAP = 60;   // minimum gap between adjacent leaf centers
  const NODE_V_GAP = 100;
  const nodeById = new Map<number, TreeNode>();
  for (const n of treeNodes) nodeById.set(n.id, n);

  const getEndVal = (n: TreeNode) => (n.end === 'leaf' ? leafEnd : n.end);

  // Compute the edge label for a child node
  function edgeLabel(childId: number): string {
    const child = nodeById.get(childId)!;
    return txt.slice(child.start, getEndVal(child) + 1);
  }

  // Compute minimum width a subtree needs (sum of leaf slot widths)
  // Each leaf slot width is determined by the longest label on edges from its parent
  const subtreeWidthCache = new Map<number, number>();
  function subtreeWidth(nodeId: number): number {
    if (subtreeWidthCache.has(nodeId)) return subtreeWidthCache.get(nodeId)!;
    const node = nodeById.get(nodeId)!;
    const kids = node.children.filter((c) => c !== null) as number[];
    if (kids.length === 0) {
      subtreeWidthCache.set(nodeId, MIN_H_GAP);
      return MIN_H_GAP;
    }
    // Width = sum of children subtree widths, but ensure enough spacing for labels
    let totalWidth = 0;
    for (const kidId of kids) {
      const label = edgeLabel(kidId);
      const labelWidth = label.length * CHAR_WIDTH + 30; // label + padding
      const childWidth = subtreeWidth(kidId);
      totalWidth += Math.max(labelWidth, childWidth);
    }
    // Add gaps between children
    totalWidth += (kids.length - 1) * 10;
    subtreeWidthCache.set(nodeId, totalWidth);
    return totalWidth;
  }
  subtreeWidth(root.id);

  const posMap = new Map<number, { x: number; y: number }>();

  // Assign positions: each subtree gets a horizontal slot
  function assignPositions(nodeId: number, depth: number, leftX: number, availableWidth: number) {
    const node = nodeById.get(nodeId)!;
    const kids = node.children.filter((c) => c !== null) as number[];

    if (kids.length === 0) {
      posMap.set(nodeId, { x: leftX + availableWidth / 2, y: depth * NODE_V_GAP });
      return;
    }

    // Distribute available width proportionally to each child's needed width
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

    // Center parent over its children
    const childPositions = kids.map((k) => posMap.get(k)!.x);
    const minCX = Math.min(...childPositions);
    const maxCX = Math.max(...childPositions);
    posMap.set(nodeId, { x: (minCX + maxCX) / 2, y: depth * NODE_V_GAP });
  }

  const totalW = Math.max(subtreeWidth(root.id), 200);
  assignPositions(root.id, 0, 0, totalW);

  // Build layout objects
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

    // Edges
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

    // Suffix links (include root's self-link, skip leaf nodes)
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

  // Normalize positions to have padding
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
