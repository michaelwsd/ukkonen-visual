/**
 * Verification harness for Ukkonen's suffix tree implementation.
 *
 * Checks three things:
 *   (A) Step-by-step match against the FIT3155 PDF example (abbbbcbbcbcabbbb$).
 *   (B) Final suffix array matches brute-force sorted suffixes for several strings.
 *   (C) Every internal-node suffix link satisfies the theoretical invariant:
 *       path_label(link(v)) == path_label(v)[1..]
 *
 * Run: npx tsx scripts/verify.ts
 */

import { buildSteps } from '../src/lib/ukkonen';
import { StepSnapshot, TreeNode } from '../src/lib/types';

// ============================================================
// Utilities
// ============================================================

function getEnd(node: TreeNode, leafEnd: number): number {
  return node.end === 'leaf' ? leafEnd : node.end;
}

function finalTree(steps: StepSnapshot[]): { nodes: TreeNode[]; txt: string; leafEnd: number } {
  const last = steps[steps.length - 1];
  return { nodes: last.nodes, txt: last.txt, leafEnd: last.leafEnd };
}

/** Extract suffix array by lex-order DFS over leaves. */
function suffixArrayFromTree(nodes: TreeNode[]): number[] {
  const out: number[] = [];
  function dfs(id: number) {
    const n = nodes[id];
    if (n.isLeaf) {
      out.push(n.suffixIndex);
      return;
    }
    for (let c = 0; c < 128; c++) {
      const kid = n.children[c];
      if (kid !== null) dfs(kid);
    }
  }
  dfs(0); // root
  return out;
}

/** Brute-force: return suffix indices sorted lexicographically. */
function bruteForceSuffixArray(txt: string): number[] {
  const idxs = Array.from({ length: txt.length }, (_, i) => i);
  idxs.sort((a, b) => (txt.slice(a) < txt.slice(b) ? -1 : txt.slice(a) > txt.slice(b) ? 1 : 0));
  return idxs;
}

/** Compute the path label from root to a node by walking up (via parent map). */
function pathLabelOf(nodeId: number, parentOf: Map<number, number>, nodes: TreeNode[], txt: string, leafEnd: number): string {
  if (nodeId === 0) return '';
  const parts: string[] = [];
  let cur = nodeId;
  while (cur !== 0) {
    const n = nodes[cur];
    parts.push(txt.slice(n.start, getEnd(n, leafEnd) + 1));
    cur = parentOf.get(cur)!;
  }
  return parts.reverse().join('');
}

/** Build parent map for the tree. */
function buildParentMap(nodes: TreeNode[]): Map<number, number> {
  const parent = new Map<number, number>();
  for (const n of nodes) {
    for (const kid of n.children) {
      if (kid !== null) parent.set(kid, n.id);
    }
  }
  return parent;
}

// ============================================================
// Colored output helpers
// ============================================================

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let totalChecks = 0;
let failedChecks = 0;

function check(label: string, cond: boolean, detail = '') {
  totalChecks++;
  if (cond) {
    console.log(`  ${GREEN}✓${RESET} ${label}`);
  } else {
    failedChecks++;
    console.log(`  ${RED}✗ ${label}${RESET}${detail ? `\n    ${RED}${detail}${RESET}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${BOLD}${CYAN}=== ${title} ===${RESET}\n`);
}

// ============================================================
// (A) PDF Example: abbbbcbbcbcabbbb$
// ============================================================

/**
 * The PDF uses 1-indexed positions. Our algorithm is 0-indexed.
 *   PDF i, j, GE  →  our phase = i-1, extension = j-1, leafEnd = GE-1
 *
 * PDF notation: "rem: 'ab'" means remainder substring is 'ab'.
 *   Our active_edge, active_length encode this as: txt[active_edge .. active_edge+active_length-1] = 'ab'
 *
 * PDF "AN: r" means active node is root (id 0). "AN: 3" means internal node created as the 3rd internal node.
 * Since my implementation assigns ids sequentially, I'll track by PDF-order: the N-th internal node
 * created corresponds to a specific id. I'll derive it from creation order.
 */

interface PDFCheckpoint {
  label: string;         // human-readable, e.g. "P6 E3"
  phase: number;         // 0-indexed
  extension: number;     // 0-indexed j (the extension lastj value that rule applied to)
  expectedRule: string;  // 'rule1' | 'rule2case1' | 'rule2case2' | 'rule3' | 'skipcount' | 'suffixlink' | 'rootadjust'
  afterRem?: string;     // remainder AFTER this rule fires (substring form)
  afterAN?: 'root' | number; // active node AFTER (root or k-th internal node in creation order, 1-indexed)
  newInternalOrd?: number;   // if rule2case2, this is the k-th internal node created (1-indexed)
  note?: string;
}

/** Map "k-th internal node in creation order" to actual node id. */
function mapInternalOrdToId(nodes: TreeNode[]): number[] {
  const ids: number[] = [];
  for (const n of nodes) {
    if (!n.isLeaf && n.id !== 0) ids.push(n.id);
  }
  return ids; // index k-1 → id of k-th internal node
}

function findStep(steps: StepSnapshot[], phase: number, extension: number, rule: string): StepSnapshot | null {
  // Find the snapshot where the given rule was applied for the given phase/extension.
  for (const s of steps) {
    if (s.phase === phase && s.extension === extension && s.rule === rule) return s;
  }
  return null;
}

function remainderFromStep(s: StepSnapshot): string {
  if (s.activeLength <= 0) return '';
  return s.txt.slice(s.activeEdge, s.activeEdge + s.activeLength);
}

function verifyPDFExample() {
  section('(A) PDF Example — abbbbcbbcbcabbbb$');

  const txt = 'abbbbcbbcbcabbbb$';
  const steps = buildSteps(txt);

  // Find the step right AFTER a given rule at (phase, extension).
  // Usually that is the rule step itself (for rule2case1/rule2case2/rule3),
  // but for rule2 followed by suffix traversal we want to look at the traversal step
  // which records the updated active node / remainder.

  // Helper: find the "after" state for a PDF checkpoint.
  // PDF "After Extension X" captures the state after the rule AND the subsequent
  // active-point traversal (suffix link / root adjust). In our trace, those are recorded as separate steps.
  // So we search for the most relevant step reflecting the "after" state.

  // For each PDF checkpoint, we check:
  //   - rule type matches
  //   - remainder immediately AFTER rule (pre-traversal) matches if PDF's "after" rem was BEFORE traversal step
  //   - final AN after traversal matches

  // Build a mapping from (phase, ext) → { ruleStep, postStep } where postStep is either
  // the same step (for rule3 which doesn't traverse), or the traversal step immediately after.

  const checkpoints: PDFCheckpoint[] = [
    // PDF Phase 1 Ext 1: Rule 2 Alt, rem after='', AN after=r
    { label: 'P1 E1', phase: 0, extension: 0, expectedRule: 'rule2case1', afterRem: '', afterAN: 'root' },
    // P2 E2: Rule 2 Alt
    { label: 'P2 E2', phase: 1, extension: 1, expectedRule: 'rule2case1', afterRem: '', afterAN: 'root' },
    // P3 E3: Rule 3, rem='b'
    { label: 'P3 E3', phase: 2, extension: 2, expectedRule: 'rule3', afterRem: 'b', afterAN: 'root' },
    // P4 E3: Rule 3, rem='bb'
    { label: 'P4 E3', phase: 3, extension: 2, expectedRule: 'rule3', afterRem: 'bb', afterAN: 'root' },
    // P5 E3: Rule 3, rem='bbb'
    { label: 'P5 E3', phase: 4, extension: 2, expectedRule: 'rule3', afterRem: 'bbb', afterAN: 'root' },
    // P6 E3: Rule 2 Reg, internal #1, rem after='bb', AN after=r (root adjust)
    { label: 'P6 E3', phase: 5, extension: 2, expectedRule: 'rule2case2', afterRem: 'bb', afterAN: 'root', newInternalOrd: 1 },
    // P6 E4: Rule 2 Reg, internal #2, rem after='b', AN after=r, resolved 1→2
    { label: 'P6 E4', phase: 5, extension: 3, expectedRule: 'rule2case2', afterRem: 'b', afterAN: 'root', newInternalOrd: 2 },
    // P6 E5: Rule 2 Reg, internal #3, rem after='', AN after=r, resolved 2→3
    { label: 'P6 E5', phase: 5, extension: 4, expectedRule: 'rule2case2', afterRem: '', afterAN: 'root', newInternalOrd: 3 },
    // P6 E6: Rule 2 Alt, resolved 3→r, AN after=r
    { label: 'P6 E6', phase: 5, extension: 5, expectedRule: 'rule2case1', afterRem: '', afterAN: 'root' },
    // P7 E7: Rule 3 rem='b', AN=r
    { label: 'P7 E7', phase: 6, extension: 6, expectedRule: 'rule3', afterRem: 'b', afterAN: 'root' },
    // P8 E7: Rule 3, AN=3, rem='b'
    { label: 'P8 E7', phase: 7, extension: 6, expectedRule: 'rule3', afterRem: 'b', afterAN: 3 },
    // P9 E7: Rule 3, AN=2, rem='c'
    { label: 'P9 E7', phase: 8, extension: 6, expectedRule: 'rule3', afterRem: 'c', afterAN: 2 },
    // P10 E7: Rule 3, AN=2, rem='cb'
    { label: 'P10 E7', phase: 9, extension: 6, expectedRule: 'rule3', afterRem: 'cb', afterAN: 2 },
    // P11 E7: Rule 2 Reg, internal #4, AN after=3 (link 2→3), rem='cb'
    { label: 'P11 E7', phase: 10, extension: 6, expectedRule: 'rule2case2', afterRem: 'cb', afterAN: 3, newInternalOrd: 4 },
    // P11 E8: Rule 2 Reg, internal #5, AN after=r (link 3→r), rem='cb', resolved 4→5
    { label: 'P11 E8', phase: 10, extension: 7, expectedRule: 'rule2case2', afterRem: 'cb', afterAN: 'root', newInternalOrd: 5 },
    // P11 E9: Rule 2 Reg, internal #6, AN after=r, rem='b' (remove 1st char), resolved 5→6
    { label: 'P11 E9', phase: 10, extension: 8, expectedRule: 'rule2case2', afterRem: 'b', afterAN: 'root', newInternalOrd: 6 },
    // P11 E10: Rule 3, AN=3 (following skip-count), rem='c', resolved 6→3
    { label: 'P11 E10', phase: 10, extension: 9, expectedRule: 'rule3', afterRem: 'c', afterAN: 3 },
    // P12 E10: Rule 2 Reg, internal #7, AN after=r (link 3→r), rem='c'
    { label: 'P12 E10', phase: 11, extension: 9, expectedRule: 'rule2case2', afterRem: 'c', afterAN: 'root', newInternalOrd: 7 },
    // P12 E11: Rule 2 Reg, internal #8, AN after=r, rem='' (remove 1st char), resolved 7→8
    { label: 'P12 E11', phase: 11, extension: 10, expectedRule: 'rule2case2', afterRem: '', afterAN: 'root', newInternalOrd: 8 },
    // P12 E12: Rule 3, rem='a', AN=r, resolved 8→r
    { label: 'P12 E12', phase: 11, extension: 11, expectedRule: 'rule3', afterRem: 'a', afterAN: 'root' },
    // P13 E12: Rule 3, rem='ab'
    { label: 'P13 E12', phase: 12, extension: 11, expectedRule: 'rule3', afterRem: 'ab', afterAN: 'root' },
    // P14 E12: Rule 3, rem='abb'
    { label: 'P14 E12', phase: 13, extension: 11, expectedRule: 'rule3', afterRem: 'abb', afterAN: 'root' },
    // P15 E12: Rule 3, rem='abbb'
    { label: 'P15 E12', phase: 14, extension: 11, expectedRule: 'rule3', afterRem: 'abbb', afterAN: 'root' },
    // P16 E12: Rule 3, rem='abbbb'
    { label: 'P16 E12', phase: 15, extension: 11, expectedRule: 'rule3', afterRem: 'abbbb', afterAN: 'root' },
    // P17 E12: Rule 2 Reg, internal #9, AN=r, rem='bbbb' (remove 1st char)
    { label: 'P17 E12', phase: 16, extension: 11, expectedRule: 'rule2case2', afterRem: 'bbbb', afterAN: 'root', newInternalOrd: 9 },
    // P17 E13: Rule 2 Reg, internal #10, AN after=2 (link 1→2), rem='b' (from new AN), resolved 9→10
    { label: 'P17 E13', phase: 16, extension: 12, expectedRule: 'rule2case2', afterRem: 'b', afterAN: 2, newInternalOrd: 10 },
    // P17 E14: Rule 2 Alt, AN after=2 (link 1→2), rem='', resolved 10→1
    { label: 'P17 E14', phase: 16, extension: 13, expectedRule: 'rule2case1', afterRem: '', afterAN: 2 },
    // P17 E15: Rule 2 Alt, AN=3 (link 2→3), rem=''
    { label: 'P17 E15', phase: 16, extension: 14, expectedRule: 'rule2case1', afterRem: '', afterAN: 3 },
    // P17 E16: Rule 2 Alt, AN=r (link 3→r), rem=''
    { label: 'P17 E16', phase: 16, extension: 15, expectedRule: 'rule2case1', afterRem: '', afterAN: 'root' },
    // P17 E17: Rule 2 Alt, AN=r, rem=''
    { label: 'P17 E17', phase: 16, extension: 16, expectedRule: 'rule2case1', afterRem: '', afterAN: 'root' },
  ];

  // We need to determine, after a rule step at (phase, extension), whether the ACTIVE POINT was
  // subsequently updated by a `rootadjust` or `suffixlink` step. That step's active_node/remainder
  // represents the "After Extension X" state.

  // The "after" state for a rule2 extension is the state of the next step (which will be rootadjust or suffixlink).
  // For rule3, the "after" state is the rule3 step itself (no traversal occurs).
  // For rule2case1, "after" is next traversal step.

  // One more wrinkle: the PDF reports "after" AN for some Rule 3 cases as an internal node reached via skip-count
  // (e.g. P8 E7 says AN=3). But skip-count can occur BEFORE rule3 within the same extension. My implementation
  // emits 'skipcount' steps along the way. So for Rule 3, the "after AN" should be read from the rule3 step itself
  // (which reflects the final active node after all skips that happened in that extension).

  // Let me also inspect the rule step's active_node directly for rule3 (no post-step).

  // For each checkpoint, locate the relevant rule step.
  const stepsByKey = new Map<string, StepSnapshot[]>();
  for (const s of steps) {
    const key = `${s.phase}:${s.extension}`;
    if (!stepsByKey.has(key)) stepsByKey.set(key, []);
    stepsByKey.get(key)!.push(s);
  }

  // Internal node creation order: for each step, if rule=rule2case2, the first new node id is the internal node.
  const internalOrder: number[] = [];
  for (const s of steps) {
    if (s.rule === 'rule2case2' && s.newNodeIds.length > 0) {
      internalOrder.push(s.newNodeIds[0]);
    }
  }

  function resolveExpectedNodeId(afterAN: 'root' | number | undefined): number | null {
    if (afterAN === undefined) return null;
    if (afterAN === 'root') return 0;
    // afterAN is k-th internal node created (1-indexed)
    const idx = afterAN - 1;
    if (idx < 0 || idx >= internalOrder.length) return -1;
    return internalOrder[idx];
  }

  let failed = 0;
  for (const cp of checkpoints) {
    const ruleStep = findStep(steps, cp.phase, cp.extension, cp.expectedRule);

    if (!ruleStep) {
      check(`${cp.label} rule=${cp.expectedRule}`, false, `No matching step found for phase=${cp.phase}, ext=${cp.extension}, rule=${cp.expectedRule}`);
      failed++;
      continue;
    }

    // Check rule
    check(`${cp.label} rule=${cp.expectedRule}`, ruleStep.rule === cp.expectedRule);

    // Determine the "after" step:
    //   rule3 → the rule3 step itself (no traversal follows in same extension)
    //   rule1 → rule1 step
    //   rule2case1/case2 → the IMMEDIATELY-NEXT step in the trace (rootadjust or suffixlink)
    let afterStep: StepSnapshot = ruleStep;
    if (cp.expectedRule === 'rule2case1' || cp.expectedRule === 'rule2case2') {
      const idx = steps.indexOf(ruleStep);
      if (idx >= 0 && idx + 1 < steps.length) {
        const next = steps[idx + 1];
        if (next.rule === 'rootadjust' || next.rule === 'suffixlink') {
          afterStep = next;
        }
      }
    }

    // Remainder check
    if (cp.afterRem !== undefined) {
      const actualRem = remainderFromStep(afterStep);
      check(
        `${cp.label} rem after="${cp.afterRem}"`,
        actualRem === cp.afterRem,
        actualRem !== cp.afterRem ? `expected "${cp.afterRem}", got "${actualRem}"` : ''
      );
    }

    // Active node check
    if (cp.afterAN !== undefined) {
      const expectedId = resolveExpectedNodeId(cp.afterAN);
      const actualId = afterStep.activeNodeId;
      const label = cp.afterAN === 'root' ? 'root' : `N${cp.afterAN}(id=${expectedId})`;
      check(
        `${cp.label} AN after=${label}`,
        actualId === expectedId,
        actualId !== expectedId ? `expected id ${expectedId}, got ${actualId}` : ''
      );
    }

    // Internal node creation order check
    if (cp.newInternalOrd !== undefined) {
      const thisRuleIsRule2Case2 = ruleStep.rule === 'rule2case2';
      const createdId = thisRuleIsRule2Case2 && ruleStep.newNodeIds.length > 0 ? ruleStep.newNodeIds[0] : null;
      const expectedId = internalOrder[cp.newInternalOrd - 1];
      check(
        `${cp.label} created internal #${cp.newInternalOrd}`,
        createdId === expectedId,
        createdId !== expectedId ? `expected id ${expectedId}, got ${createdId}` : ''
      );
    }
  }
}

// ============================================================
// (B) Suffix array correctness for many strings
// ============================================================

function verifySuffixArrays() {
  section('(B) Suffix Array Correctness');

  const testStrings = [
    'a$',
    'ab$',
    'abc$',
    'aaa$',
    'abab$',
    'banana$',
    'mississippi$',
    'abacabad$',
    'abaaba$',
    'xabxa$',
    'abcabc$',
    'abbbbcbbcbcabbbb$', // PDF example
    'aabaaabaaaab$',
    'xyzxyzxyz$',
    'aaaaaaaaa$',
    'abracadabra$',
  ];

  for (const txt of testStrings) {
    const steps = buildSteps(txt);
    const { nodes } = finalTree(steps);
    const ours = suffixArrayFromTree(nodes);
    const ref = bruteForceSuffixArray(txt);
    const match = ours.length === ref.length && ours.every((v, i) => v === ref[i]);
    check(
      `"${txt}" SA matches brute force`,
      match,
      match ? '' : `ours=[${ours.join(',')}] ref=[${ref.join(',')}]`
    );
  }
}

// ============================================================
// (C) Suffix link correctness
// ============================================================

function verifySuffixLinks() {
  section('(C) Suffix Link Invariant');

  const testStrings = [
    'abbbbcbbcbcabbbb$',
    'mississippi$',
    'abacabad$',
    'abaaba$',
    'aabaaabaaaab$',
    'xyzxyzxyz$',
    'abracadabra$',
  ];

  for (const txt of testStrings) {
    const steps = buildSteps(txt);
    const { nodes, leafEnd } = finalTree(steps);
    const parent = buildParentMap(nodes);

    let ok = true;
    const failures: string[] = [];

    for (const n of nodes) {
      if (n.isLeaf) continue;
      if (n.id === 0) {
        // root self-link
        if (n.suffixLink !== 0) {
          ok = false;
          failures.push(`root.suffixLink=${n.suffixLink} (expected 0)`);
        }
        continue;
      }
      if (n.suffixLink === null) {
        ok = false;
        failures.push(`Node ${n.id} has null suffix link`);
        continue;
      }
      const pLabel = pathLabelOf(n.id, parent, nodes, txt, leafEnd);
      const slLabel = pathLabelOf(n.suffixLink, parent, nodes, txt, leafEnd);
      const expected = pLabel.slice(1);
      if (slLabel !== expected) {
        ok = false;
        failures.push(
          `Node ${n.id} path="${pLabel}" sl→${n.suffixLink} path="${slLabel}" (expected "${expected}")`
        );
      }
    }

    check(`"${txt}" all suffix links correct`, ok, ok ? '' : failures.slice(0, 3).join(' | '));
  }
}

// ============================================================
// Run all
// ============================================================

console.log(`${BOLD}Ukkonen Suffix Tree — Verification Harness${RESET}`);

verifyPDFExample();
verifySuffixArrays();
verifySuffixLinks();

console.log(
  `\n${BOLD}Summary:${RESET} ${totalChecks - failedChecks}/${totalChecks} checks passed` +
  (failedChecks === 0 ? ` ${GREEN}ALL PASS${RESET}` : ` ${RED}${failedChecks} FAILED${RESET}`)
);

process.exit(failedChecks === 0 ? 0 : 1);
