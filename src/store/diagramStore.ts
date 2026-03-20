import { create } from 'zustand';
import type {
  NodeId,
  EdgeId,
  DiagramNode,
  DiagramEdge,
  EdgeEndpoint,
  Camera,
  Diagram,
  NodeStyle,
  EdgeStyle,
} from '../types/diagram';
import { makeNodeId, makeEdgeId } from '../types/diagram';
import { toAbsolute, toRelative } from '../utils/coordinates';

// ─── Helpers ────────────────────────────────────────────────────────────────

let _nodeCounter = 0;
let _edgeCounter = 0;

function newNodeId(): NodeId {
  return makeNodeId(`node-${++_nodeCounter}`);
}

function newEdgeId(): EdgeId {
  return makeEdgeId(`edge-${++_edgeCounter}`);
}

function cloneDiagram(d: Diagram): Diagram {
  return {
    nodes: { ...d.nodes },
    edges: { ...d.edges },
    camera: { ...d.camera },
  };
}

const DEFAULT_CAMERA: Camera = { panX: 0, panY: 0, zoom: 1 };

const INITIAL_DIAGRAM: Diagram = {
  nodes: {} as Record<NodeId, DiagramNode>,
  edges: {} as Record<EdgeId, DiagramEdge>,
  camera: DEFAULT_CAMERA,
};

// ─── Store shape ─────────────────────────────────────────────────────────────

interface DiagramState {
  diagram: Diagram;
  past: Diagram[];
  future: Diagram[];

  // Node actions
  addNode: (partial: {
    label: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    parentId?: NodeId | null;
    style?: NodeStyle;
  }) => NodeId;
  updateNode: (id: NodeId, partial: Partial<Pick<DiagramNode, 'label' | 'x' | 'y' | 'width' | 'height' | 'style'>>) => void;
  deleteNode: (id: NodeId) => void;
  expandNode: (id: NodeId) => void;
  collapseNode: (id: NodeId) => void;
  groupNodes: (nodeIds: NodeId[], label: string) => NodeId;
  ungroupNode: (parentId: NodeId) => void;
  reparentNode: (nodeId: NodeId, newParentId: NodeId | null) => void;

  // Edge actions
  addEdge: (source: NodeId, target: NodeId, label?: string, style?: EdgeStyle) => EdgeId;
  deleteEdge: (id: EdgeId) => void;
  refineEdge: (edgeId: EdgeId, end: 'source' | 'target', newNodeId: NodeId) => void;

  // Camera
  panTo: (x: number, y: number) => void;
  zoomTo: (level: number) => void;
  setCamera: (camera: Camera) => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;

  // Selectors (computed; called as functions)
  getVisibleNodes: () => DiagramNode[];
  getVisibleEdges: () => Array<{ edge: DiagramEdge; displaySource: NodeId; displayTarget: NodeId }>;
  getUnrefinedEdges: (nodeId: NodeId) => DiagramEdge[];
}

// ─── Edge visibility helper ──────────────────────────────────────────────────

/**
 * Walk up from a node until we find the deepest visible ancestor.
 * A node is "visible" if it is top-level OR its parent is expanded.
 */
function getDisplayEndpoint(nodeId: NodeId, nodes: Record<NodeId, DiagramNode>): NodeId {
  let node = nodes[nodeId];
  if (!node) return nodeId;

  while (node.parentId !== null) {
    const parent = nodes[node.parentId];
    if (!parent) break;
    if (parent.expanded) {
      // parent is showing its children → this node is visible
      break;
    }
    // parent is collapsed → collapse up to parent
    node = parent;
  }

  return node.id;
}

// ─── Mutation helpers ────────────────────────────────────────────────────────

/** Collect nodeId + all descendant ids. */
function collectDescendants(nodeId: NodeId, nodes: Record<NodeId, DiagramNode>): Set<NodeId> {
  const result = new Set<NodeId>();
  const queue: NodeId[] = [nodeId];
  while (queue.length) {
    const id = queue.pop()!;
    result.add(id);
    const node = nodes[id];
    if (node) {
      for (const childId of node.children) {
        queue.push(childId);
      }
    }
  }
  return result;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useDiagramStore = create<DiagramState>((set, get) => {
  // Push current diagram to undo stack before mutation
  function snapshot() {
    const { diagram, past } = get();
    set({ past: [...past, cloneDiagram(diagram)], future: [] });
  }

  function mutateDiagram(fn: (d: Diagram) => Diagram) {
    snapshot();
    set((state) => ({ diagram: fn(cloneDiagram(state.diagram)) }));
  }

  return {
    diagram: cloneDiagram(INITIAL_DIAGRAM),
    past: [],
    future: [],

    // ── Node actions ──────────────────────────────────────────────────────

    addNode({ label, x, y, width = 120, height = 60, parentId = null, style }) {
      const id = newNodeId();
      mutateDiagram((d) => {
        const node: DiagramNode = {
          id,
          label,
          x,
          y,
          width,
          height,
          parentId: parentId ?? null,
          children: [],
          expanded: false,
          style,
        };
        d.nodes[id] = node;
        if (parentId && d.nodes[parentId]) {
          d.nodes[parentId] = {
            ...d.nodes[parentId],
            children: [...d.nodes[parentId].children, id],
          };
        }
        return d;
      });
      return id;
    },

    updateNode(id, partial) {
      mutateDiagram((d) => {
        if (d.nodes[id]) {
          d.nodes[id] = { ...d.nodes[id], ...partial };
        }
        return d;
      });
    },

    deleteNode(id) {
      mutateDiagram((d) => {
        const toDelete = collectDescendants(id, d.nodes);

        // Remove from parent's children list
        const node = d.nodes[id];
        if (node?.parentId && d.nodes[node.parentId]) {
          d.nodes[node.parentId] = {
            ...d.nodes[node.parentId],
            children: d.nodes[node.parentId].children.filter((c) => c !== id),
          };
        }

        // Delete all nodes in the subtree
        for (const nid of toDelete) {
          delete d.nodes[nid];
        }

        // Delete edges referencing any deleted node
        for (const eid of Object.keys(d.edges) as EdgeId[]) {
          const edge = d.edges[eid];
          if (toDelete.has(edge.source.nodeId) || toDelete.has(edge.target.nodeId)) {
            delete d.edges[eid];
          }
        }

        return d;
      });
    },

    expandNode(id) {
      mutateDiagram((d) => {
        if (d.nodes[id]) d.nodes[id] = { ...d.nodes[id], expanded: true };
        return d;
      });
    },

    collapseNode(id) {
      mutateDiagram((d) => {
        if (d.nodes[id]) d.nodes[id] = { ...d.nodes[id], expanded: false };
        return d;
      });
    },

    groupNodes(nodeIds, label) {
      const groupId = newNodeId();
      mutateDiagram((d) => {
        if (nodeIds.length === 0) return d;

        // All selected nodes must share the same parent
        const firstParentId = d.nodes[nodeIds[0]]?.parentId ?? null;

        // Compute bounding box of all selected nodes (positions are parent-relative)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const nid of nodeIds) {
          const n = d.nodes[nid];
          if (!n) continue;
          minX = Math.min(minX, n.x);
          minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x + n.width);
          maxY = Math.max(maxY, n.y + n.height);
        }
        const padding = 20;
        const gx = minX - padding;
        const gy = minY - padding;
        const gw = maxX - minX + padding * 2;
        const gh = maxY - minY + padding * 2;

        // Create the group node
        const groupNode: DiagramNode = {
          id: groupId,
          label,
          x: gx,
          y: gy,
          width: gw,
          height: gh,
          parentId: firstParentId,
          children: [...nodeIds],
          expanded: true,
          style: undefined,
        };
        d.nodes[groupId] = groupNode;

        // Reparent children: convert positions from firstParent-relative → group-relative
        for (const nid of nodeIds) {
          const n = d.nodes[nid];
          if (!n) continue;
          d.nodes[nid] = {
            ...n,
            parentId: groupId,
            x: n.x - gx,
            y: n.y - gy,
          };
        }

        // Replace the children in the grandparent
        if (firstParentId && d.nodes[firstParentId]) {
          const grandparent = d.nodes[firstParentId];
          const siblings = grandparent.children.filter((c) => !nodeIds.includes(c));
          d.nodes[firstParentId] = {
            ...grandparent,
            children: [...siblings, groupId],
          };
        }

        return d;
      });
      return groupId;
    },

    ungroupNode(parentId) {
      mutateDiagram((d) => {
        const parent = d.nodes[parentId];
        if (!parent) return d;

        const grandparentId = parent.parentId;
        const parentAbsPos = toAbsolute(parentId, d.nodes);

        // Promote children to grandparent level with transformed coordinates
        for (const childId of parent.children) {
          const child = d.nodes[childId];
          if (!child) continue;

          // child pos is relative to parent; convert to grandparent-relative
          const absX = parentAbsPos.x + child.x;
          const absY = parentAbsPos.y + child.y;
          const newPos = toRelative({ x: absX, y: absY }, grandparentId, d.nodes);

          d.nodes[childId] = {
            ...child,
            parentId: grandparentId,
            x: newPos.x,
            y: newPos.y,
          };
        }

        // Update grandparent's children list
        if (grandparentId && d.nodes[grandparentId]) {
          const gp = d.nodes[grandparentId];
          const filtered = gp.children.filter((c) => c !== parentId);
          d.nodes[grandparentId] = {
            ...gp,
            children: [...filtered, ...parent.children],
          };
        }

        // Re-attach edges that pointed to the dissolved parent → mark as unrefined
        for (const eid of Object.keys(d.edges) as EdgeId[]) {
          const edge = d.edges[eid];
          let updated = { ...edge };
          if (edge.source.nodeId === parentId) {
            updated = { ...updated, source: { nodeId: grandparentId ?? makeNodeId(''), refined: false } };
          }
          if (edge.target.nodeId === parentId) {
            updated = { ...updated, target: { nodeId: grandparentId ?? makeNodeId(''), refined: false } };
          }
          if (updated !== edge) {
            d.edges[eid] = updated;
          }
        }

        delete d.nodes[parentId];
        return d;
      });
    },

    reparentNode(nodeId, newParentId) {
      mutateDiagram((d) => {
        const node = d.nodes[nodeId];
        if (!node) return d;

        const oldParentId = node.parentId;

        // Convert position: old-parent-relative → absolute → new-parent-relative
        const absPos = toAbsolute(nodeId, d.nodes);
        const newPos = toRelative(absPos, newParentId, d.nodes);

        // Remove from old parent's children
        if (oldParentId && d.nodes[oldParentId]) {
          d.nodes[oldParentId] = {
            ...d.nodes[oldParentId],
            children: d.nodes[oldParentId].children.filter((c) => c !== nodeId),
          };
        }

        // Add to new parent's children
        if (newParentId && d.nodes[newParentId]) {
          d.nodes[newParentId] = {
            ...d.nodes[newParentId],
            children: [...d.nodes[newParentId].children, nodeId],
          };
        }

        d.nodes[nodeId] = {
          ...node,
          parentId: newParentId,
          x: newPos.x,
          y: newPos.y,
        };

        return d;
      });
    },

    // ── Edge actions ──────────────────────────────────────────────────────

    addEdge(sourceId, targetId, label, style) {
      const id = newEdgeId();
      mutateDiagram((d) => {
        d.edges[id] = {
          id,
          source: { nodeId: sourceId, refined: true },
          target: { nodeId: targetId, refined: true },
          label,
          style,
        };
        return d;
      });
      return id;
    },

    deleteEdge(id) {
      mutateDiagram((d) => {
        delete d.edges[id];
        return d;
      });
    },

    refineEdge(edgeId, end, newNodeId) {
      mutateDiagram((d) => {
        const edge = d.edges[edgeId];
        if (!edge) return d;
        const endpoint: EdgeEndpoint = { nodeId: newNodeId, refined: true };
        d.edges[edgeId] = {
          ...edge,
          [end]: endpoint,
        };
        return d;
      });
    },

    // ── Camera ────────────────────────────────────────────────────────────

    panTo(x, y) {
      set((state) => ({
        diagram: { ...state.diagram, camera: { ...state.diagram.camera, panX: x, panY: y } },
      }));
    },

    zoomTo(level) {
      set((state) => ({
        diagram: { ...state.diagram, camera: { ...state.diagram.camera, zoom: level } },
      }));
    },

    setCamera(camera) {
      set((state) => ({ diagram: { ...state.diagram, camera } }));
    },

    // ── Undo / redo ───────────────────────────────────────────────────────

    undo() {
      const { past, diagram, future } = get();
      if (past.length === 0) return;
      const prev = past[past.length - 1];
      set({
        past: past.slice(0, -1),
        diagram: prev,
        future: [cloneDiagram(diagram), ...future],
      });
    },

    redo() {
      const { future, diagram, past } = get();
      if (future.length === 0) return;
      const next = future[0];
      set({
        future: future.slice(1),
        diagram: next,
        past: [...past, cloneDiagram(diagram)],
      });
    },

    // ── Selectors ─────────────────────────────────────────────────────────

    getVisibleNodes() {
      const { nodes } = get().diagram;

      const visible: DiagramNode[] = [];

      function visit(nodeId: NodeId) {
        const node = nodes[nodeId];
        if (!node) return;
        visible.push(node);
        if (node.expanded) {
          for (const childId of node.children) {
            visit(childId);
          }
        }
      }

      // Start from top-level nodes (no parent)
      for (const node of Object.values(nodes)) {
        if (node.parentId === null) {
          visit(node.id);
        }
      }

      return visible;
    },

    getVisibleEdges() {
      const { nodes, edges } = get().diagram;
      type DisplayEdge = { edge: DiagramEdge; displaySource: NodeId; displayTarget: NodeId };
      const seen = new Map<string, DisplayEdge>();

      for (const edge of Object.values(edges)) {
        const displaySource = getDisplayEndpoint(edge.source.nodeId, nodes);
        const displayTarget = getDisplayEndpoint(edge.target.nodeId, nodes);

        // Skip self-loops (collapsed to same node)
        if (displaySource === displayTarget) continue;

        // Deduplicate: multiple collapsed edges between same pair → one display edge
        const key = [displaySource, displayTarget].sort().join('::');
        if (!seen.has(key)) {
          seen.set(key, { edge, displaySource, displayTarget });
        }
      }

      return Array.from(seen.values());
    },

    getUnrefinedEdges(nodeId) {
      const { edges } = get().diagram;
      return Object.values(edges).filter(
        (edge) =>
          (edge.source.nodeId === nodeId && !edge.source.refined) ||
          (edge.target.nodeId === nodeId && !edge.target.refined)
      );
    },
  };
});
