// Shared types used by both server (API) and client (components)

export interface TreeNode {
  id: number;
  children: (number | null)[];
  start: number;
  end: number | 'leaf';
  isLeaf: boolean;
  suffixIndex: number;
  suffixLink: number | null;
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
  phase: number;
  extension: number;
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
  newNodeIds: number[];
  highlightEdge: [number, number] | null;
  suffixLinkFrom: number | null;
  suffixLinkTo: number | null;
}
