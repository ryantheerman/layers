import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';
import type Konva from 'konva';

export const DEFAULT_NODE_OPTIONS: Options = {
  roughness: 0.8,
  stroke: '#9e9a8e',
  strokeWidth: 1.5,
  fill: '#2a2825',
  fillStyle: 'solid',
};

export const CONTAINER_NODE_OPTIONS: Options = {
  roughness: 0.7,
  stroke: '#9e9a8e',
  strokeWidth: 1.5,
  fill: '#4a4640',
  fillStyle: 'hachure',
  hachureAngle: -41,
  hachureGap: 12,
};

export const DEFAULT_EDGE_OPTIONS: Options = {
  roughness: 0.7,
  stroke: '#7a7670',
  strokeWidth: 1.5,
};

export const ARROW_HEAD_OPTIONS: Options = {
  roughness: 0.3,
  stroke: '#7a7670',
  strokeWidth: 1,
  fill: '#7a7670',
  fillStyle: 'solid',
};

export const gen = rough.generator();

/**
 * Create a RoughCanvas that draws into the Konva canvas context.
 * Konva.Context wraps a CanvasRenderingContext2D; we pass a fake HTMLCanvasElement
 * whose getContext() returns the underlying 2D context.
 */
export function createRoughCanvas(ctx: Konva.Context) {
  const fakeCanvas = {
    getContext: () => (ctx as unknown as { _context: CanvasRenderingContext2D })._context,
  };
  return rough.canvas(fakeCanvas as unknown as HTMLCanvasElement);
}

/**
 * Find the point on the edge of a rectangle (boxX, boxY, boxW, boxH)
 * that lies along the line from the rect's center toward (fromX, fromY).
 */
export function boxEdgePoint(
  fromX: number,
  fromY: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): [number, number] {
  const cx = boxX + boxW / 2;
  const cy = boxY + boxH / 2;
  const dx = fromX - cx;
  const dy = fromY - cy;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return [cx, cy];

  const sx = dx !== 0 ? (boxW / 2) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (boxH / 2) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);

  return [cx + dx * s, cy + dy * s];
}
