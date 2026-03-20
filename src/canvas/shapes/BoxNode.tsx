import { Group, Shape, Text } from 'react-konva';
import { useMemo } from 'react';
import type { DiagramNode } from '../../types/diagram';
import {
  gen,
  createRoughCanvas,
  DEFAULT_NODE_OPTIONS,
  CONTAINER_NODE_OPTIONS,
} from '../renderer';

interface Props {
  node: DiagramNode;
  x: number;
  y: number;
}

export default function BoxNode({ node, x, y }: Props) {
  const baseOptions = node.expanded ? CONTAINER_NODE_OPTIONS : DEFAULT_NODE_OPTIONS;

  const drawable = useMemo(
    () =>
      gen.rectangle(0, 0, node.width, node.height, {
        ...baseOptions,
        ...(node.style?.fill ? { fill: node.style.fill } : {}),
        ...(node.style?.stroke ? { stroke: node.style.stroke } : {}),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.width, node.height, node.expanded, node.style?.fill, node.style?.stroke],
  );

  const isContainer = node.expanded && node.children.length > 0;

  return (
    <Group x={x} y={y}>
      <Shape
        width={node.width}
        height={node.height}
        listening={false}
        sceneFunc={(ctx) => {
          createRoughCanvas(ctx).draw(drawable);
        }}
      />
      <Text
        text={node.label}
        width={node.width}
        padding={10}
        y={isContainer ? 4 : 0}
        height={isContainer ? 28 : node.height}
        align="center"
        verticalAlign={isContainer ? 'top' : 'middle'}
        fontSize={isContainer ? 12 : 13}
        fontStyle={isContainer ? 'bold' : 'normal'}
        fontFamily="'Inter', 'Segoe UI', sans-serif"
        fill="#f0ece4"
        listening={false}
      />
    </Group>
  );
}
