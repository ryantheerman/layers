/**
 * Verification script — run via: npx tsx src/store/__tests__/verify.ts
 *
 * Tests:
 * 1. Hierarchy creation + getVisibleNodes / getVisibleEdges
 * 2. Edge refinement
 * 3. Undo / redo
 */
import { useDiagramStore } from '../diagramStore';

const s = useDiagramStore.getState;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  PASS: ${msg}`);
}

// ── Test 1: Hierarchy + visibility ───────────────────────────────────────────
console.log('\n[1] Hierarchy + visibility');

const a = s().addNode({ label: 'A', x: 0, y: 0 });
const b = s().addNode({ label: 'B', x: 200, y: 0 });
void s().addNode({ label: 'C', x: 400, y: 0 });

const a1 = s().addNode({ label: 'A1', x: 10, y: 10, parentId: a });
const a2 = s().addNode({ label: 'A2', x: 10, y: 80, parentId: a });
const b1 = s().addNode({ label: 'B1', x: 10, y: 10, parentId: b });
const b2 = s().addNode({ label: 'B2', x: 10, y: 80, parentId: b });
const b3 = s().addNode({ label: 'B3', x: 10, y: 150, parentId: b });

// All collapsed → only top-level visible
let visible = s().getVisibleNodes().map((n) => n.label);
assert(visible.length === 3, `top-level only: got ${visible}`);
assert(['A', 'B', 'C'].every((l) => visible.includes(l)), 'A, B, C visible');

// Expand A → A1, A2 now visible
s().expandNode(a);
visible = s().getVisibleNodes().map((n) => n.label);
assert(visible.length === 5, `after expand A: got ${visible}`);
assert(visible.includes('A1') && visible.includes('A2'), 'A1 A2 visible');

// Expand B → B1, B2, B3 now visible
s().expandNode(b);
visible = s().getVisibleNodes().map((n) => n.label);
assert(visible.length === 8, `after expand B: got ${visible}`);

// Collapse A → A1, A2 hidden again
s().collapseNode(a);
visible = s().getVisibleNodes().map((n) => n.label);
assert(visible.length === 6, `after collapse A: got ${visible}`);
assert(!visible.includes('A1'), 'A1 hidden after collapse');

// ── Test 2: Edge visibility + dedup ─────────────────────────────────────────
console.log('\n[2] Edge visibility + dedup');

s().expandNode(a); // re-expand A

// Edge from A1 → B1 (both expanded, both visible) → shows as A1→B1
const e1 = s().addEdge(a1, b1);
let displayEdges = s().getVisibleEdges();
assert(displayEdges.length === 1, 'one display edge');
assert(
  displayEdges[0].displaySource === a1 && displayEdges[0].displayTarget === b1,
  'A1→B1 when both expanded'
);

// Collapse A → A1 collapses to A → edge shows as A→B1
s().collapseNode(a);
displayEdges = s().getVisibleEdges();
assert(displayEdges[0].displaySource === a && displayEdges[0].displayTarget === b1, 'A→B1 when A collapsed');

// Collapse B → both collapse → A→B
s().collapseNode(b);
displayEdges = s().getVisibleEdges();
assert(displayEdges[0].displaySource === a && displayEdges[0].displayTarget === b, 'A→B when both collapsed');

// Add second edge A2→B2 (same pair when collapsed) → should dedup
s().expandNode(a);
s().expandNode(b);
const e2 = s().addEdge(a2, b2);
s().collapseNode(a);
s().collapseNode(b);
displayEdges = s().getVisibleEdges();
assert(displayEdges.length === 1, 'dedup: two leaf edges collapse to one A→B');

// ── Test 3: Edge refinement ──────────────────────────────────────────────────
console.log('\n[3] Edge refinement');

const e3 = s().addEdge(a, b3); // parent-level edge, source unrefined intent
// Refine source end to a1
s().refineEdge(e3, 'source', a1);
const edge3 = s().diagram.edges[e3];
assert(edge3.source.nodeId === a1 && edge3.source.refined === true, 'source refined to a1');
assert(edge3.target.nodeId === b3, 'target unchanged');

// ── Test 4: Undo / redo ───────────────────────────────────────────────────────
console.log('\n[4] Undo / redo');

const countBefore = Object.keys(s().diagram.nodes).length;
const newNode = s().addNode({ label: 'Temp', x: 600, y: 0 });
assert(Object.keys(s().diagram.nodes).length === countBefore + 1, 'node added');

s().undo();
assert(Object.keys(s().diagram.nodes).length === countBefore, 'undo removed node');
assert(!(newNode in s().diagram.nodes), 'temp node gone after undo');

s().redo();
assert(Object.keys(s().diagram.nodes).length === countBefore + 1, 'redo restored node');

s().undo(); // clean up

// ── Test 5: groupNodes ───────────────────────────────────────────────────────
console.log('\n[5] groupNodes');

s().expandNode(a); // make sure A's children are tracked
const preGroupCount = Object.keys(s().diagram.nodes).length;

const groupId = s().groupNodes([a1, a2], 'A-group');
assert(s().diagram.nodes[groupId] !== undefined, 'group node created');
assert(s().diagram.nodes[a1].parentId === groupId, 'a1 reparented to group');
assert(s().diagram.nodes[a2].parentId === groupId, 'a2 reparented to group');
assert(Object.keys(s().diagram.nodes).length === preGroupCount + 1, 'one extra node');

// Ungroup
s().ungroupNode(groupId);
assert(s().diagram.nodes[groupId] === undefined, 'group node removed');
assert(s().diagram.nodes[a1].parentId === a, 'a1 back under A');

// ── Test 6: deleteNode cascade ───────────────────────────────────────────────
console.log('\n[6] deleteNode cascade');

s().deleteNode(b);
assert(s().diagram.nodes[b] === undefined, 'B deleted');
assert(s().diagram.nodes[b1] === undefined, 'B1 cascaded');
assert(s().diagram.nodes[b2] === undefined, 'B2 cascaded');
assert(s().diagram.nodes[b3] === undefined, 'B3 cascaded');
// Edges involving B's descendants should be gone
assert(s().diagram.edges[e1] === undefined, 'e1 (A1→B1) cleaned up');
assert(s().diagram.edges[e2] === undefined, 'e2 (A2→B2) cleaned up');
assert(s().diagram.edges[e3] === undefined, 'e3 (A→B3) cleaned up');

console.log('\nAll tests passed.');
