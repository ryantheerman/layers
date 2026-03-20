// Branded string types for type safety
export type NodeId = string & { readonly __brand: 'NodeId' };
export type EdgeId = string & { readonly __brand: 'EdgeId' };

export function makeNodeId(id: string): NodeId {
  return id as NodeId;
}

export function makeEdgeId(id: string): EdgeId {
  return id as EdgeId;
}

export interface NodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  dashArray?: number[];
  opacity?: number;
}

export interface DiagramNode {
  id: NodeId;
  label: string;
  x: number;        // relative to parent
  y: number;        // relative to parent
  width: number;
  height: number;
  parentId: NodeId | null;  // null = top-level
  children: NodeId[];       // ordered child node ids
  expanded: boolean;        // whether showing children
  style?: NodeStyle;
}

export interface EdgeEndpoint {
  nodeId: NodeId;
  refined: boolean; // false = unresolved at parent level, waiting to be dragged to a child
}

export interface DiagramEdge {
  id: EdgeId;
  source: EdgeEndpoint;
  target: EdgeEndpoint;
  label?: string;
  style?: EdgeStyle;
}

export interface Camera {
  panX: number;
  panY: number;
  zoom: number;
}

export interface Diagram {
  nodes: Record<NodeId, DiagramNode>;
  edges: Record<EdgeId, DiagramEdge>;
  camera: Camera;
}

export interface UndoStack {
  past: Diagram[];
  future: Diagram[];
}
