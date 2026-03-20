import type { NodeId, DiagramNode } from '../types/diagram';

export interface Point {
  x: number;
  y: number;
}

/**
 * Convert a node's position to absolute (canvas-space) coordinates
 * by walking up through all ancestors and summing relative offsets.
 */
export function toAbsolute(nodeId: NodeId, nodes: Record<NodeId, DiagramNode>): Point {
  const node = nodes[nodeId];
  if (!node) return { x: 0, y: 0 };

  let x = node.x;
  let y = node.y;
  let current = node;

  while (current.parentId !== null) {
    const parent = nodes[current.parentId];
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    current = parent;
  }

  return { x, y };
}

/**
 * Convert an absolute position to a position relative to the given parent.
 * Pass null for parentId to get top-level (absolute) coordinates.
 */
export function toRelative(
  absolutePos: Point,
  parentId: NodeId | null,
  nodes: Record<NodeId, DiagramNode>
): Point {
  if (parentId === null) return absolutePos;

  const parentAbs = toAbsolute(parentId, nodes);
  return {
    x: absolutePos.x - parentAbs.x,
    y: absolutePos.y - parentAbs.y,
  };
}
