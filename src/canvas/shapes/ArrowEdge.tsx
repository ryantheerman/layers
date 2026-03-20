import { Shape } from 'react-konva';
import { useMemo } from 'react';
import type { DiagramEdge } from '../../types/diagram';
import { gen, createRoughCanvas, DEFAULT_EDGE_OPTIONS, ARROW_HEAD_OPTIONS } from '../renderer';

interface Props {
  edge: DiagramEdge;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

const ARROW_LEN = 11;
const ARROW_ANGLE = Math.PI / 6;

function arrowHeadPoints(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): [number, number][] {
  const angle = Math.atan2(ty - sy, tx - sx);
  return [
    [tx, ty],
    [
      tx - ARROW_LEN * Math.cos(angle - ARROW_ANGLE),
      ty - ARROW_LEN * Math.sin(angle - ARROW_ANGLE),
    ],
    [
      tx - ARROW_LEN * Math.cos(angle + ARROW_ANGLE),
      ty - ARROW_LEN * Math.sin(angle + ARROW_ANGLE),
    ],
  ];
}

export default function ArrowEdge({ sourceX, sourceY, targetX, targetY }: Props) {
  const lineDrawable = useMemo(
    () => gen.line(sourceX, sourceY, targetX, targetY, DEFAULT_EDGE_OPTIONS),
    [sourceX, sourceY, targetX, targetY],
  );

  const headDrawable = useMemo(
    () =>
      gen.polygon(arrowHeadPoints(sourceX, sourceY, targetX, targetY), ARROW_HEAD_OPTIONS),
    [sourceX, sourceY, targetX, targetY],
  );

  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        const rc = createRoughCanvas(ctx);
        rc.draw(lineDrawable);
        rc.draw(headDrawable);
      }}
    />
  );
}
