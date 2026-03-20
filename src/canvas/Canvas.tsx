import { Stage, Layer } from 'react-konva';
import { useState, useEffect, useRef } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useDiagramStore } from '../store/diagramStore';
import { toAbsolute } from '../utils/coordinates';
import BoxNode from './shapes/BoxNode';
import ArrowEdge from './shapes/ArrowEdge';
import TextLabel from './shapes/TextLabel';
import { boxEdgePoint } from './renderer';
import type { Camera } from '../types/diagram';

const SCALE_BY = 1.08;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;

export default function Canvas() {
  const diagram = useDiagramStore((s) => s.diagram);
  const getVisibleNodes = useDiagramStore((s) => s.getVisibleNodes);
  const getVisibleEdges = useDiagramStore((s) => s.getVisibleEdges);
  const panTo = useDiagramStore((s) => s.panTo);
  const setCamera = useDiagramStore((s) => s.setCamera);

  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Imperative Stage ref — pan/zoom are applied directly to avoid per-tick re-renders.
  const stageRef = useRef<Konva.Stage>(null);
  // Live camera tracked in a ref; store is only synced when scrolling stops.
  const liveCamera = useRef<Camera>(diagram.camera);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);
  // Accumulated wheel delta and pointer position — updated on every event, consumed once per frame.
  const wheelAccum = useRef(0);
  const wheelPointer = useRef({ x: 0, y: 0 });

  // Initialise Stage transform from store camera on mount.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { panX, panY, zoom } = diagram.camera;
    stage.x(panX);
    stage.y(panY);
    stage.scaleX(zoom);
    stage.scaleY(zoom);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: mount-only init

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    // Accumulate delta and capture latest pointer position — near zero cost.
    wheelAccum.current += e.evt.deltaY;
    const p = stageRef.current!.getPointerPosition()!;
    wheelPointer.current = p;

    // Schedule one RAF to consume everything accumulated this frame.
    if (rafRef.current === undefined) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = undefined;
        const delta = wheelAccum.current;
        wheelAccum.current = 0;
        const { x, y } = wheelPointer.current;
        const { zoom, panX, panY } = liveCamera.current;

        // Scale proportionally to accumulated delta so fast scrolling zooms faster.
        const factor = Math.pow(SCALE_BY, Math.abs(delta) / 100);
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, delta < 0 ? zoom * factor : zoom / factor));
        liveCamera.current = {
          zoom: newZoom,
          panX: x - (x - panX) * (newZoom / zoom),
          panY: y - (y - panY) * (newZoom / zoom),
        };

        stageRef.current!.setAttrs({
          x: liveCamera.current.panX,
          y: liveCamera.current.panY,
          scaleX: newZoom,
          scaleY: newZoom,
        });
      });
    }

    // Sync to store (and trigger React re-render) only once scrolling settles.
    clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => setCamera(liveCamera.current), 150);
  };

  const { nodes } = diagram;
  const visibleNodes = getVisibleNodes();
  const visibleEdges = getVisibleEdges();

  return (
    <Stage
      ref={stageRef}
      width={size.w}
      height={size.h}
      draggable
      onDragEnd={(e) => {
        const { x, y } = e.target.position();
        liveCamera.current = { ...liveCamera.current, panX: x, panY: y };
        panTo(x, y);
      }}
      onWheel={handleWheel}
    >
      <Layer>
        {/* Edges rendered behind nodes */}
        {visibleEdges.map(({ edge, displaySource, displayTarget }) => {
          const srcNode = nodes[displaySource];
          const tgtNode = nodes[displayTarget];
          if (!srcNode || !tgtNode) return null;

          const srcAbs = toAbsolute(displaySource, nodes);
          const tgtAbs = toAbsolute(displayTarget, nodes);
          const tgtCx = tgtAbs.x + tgtNode.width / 2;
          const tgtCy = tgtAbs.y + tgtNode.height / 2;
          const srcCx = srcAbs.x + srcNode.width / 2;
          const srcCy = srcAbs.y + srcNode.height / 2;

          const [sx, sy] = boxEdgePoint(tgtCx, tgtCy, srcAbs.x, srcAbs.y, srcNode.width, srcNode.height);
          const [tx, ty] = boxEdgePoint(srcCx, srcCy, tgtAbs.x, tgtAbs.y, tgtNode.width, tgtNode.height);

          return (
            <ArrowEdge
              key={edge.id}
              edge={edge}
              sourceX={sx}
              sourceY={sy}
              targetX={tx}
              targetY={ty}
            />
          );
        })}

        {/* Nodes — expanded containers first, then leaves on top */}
        {visibleNodes
          .slice()
          .sort((a, b) => (a.expanded === b.expanded ? 0 : a.expanded ? -1 : 1))
          .map((node) => {
            const abs = toAbsolute(node.id, nodes);
            return <BoxNode key={node.id} node={node} x={abs.x} y={abs.y} />;
          })}

        {/* Edge labels */}
        {visibleEdges.map(({ edge, displaySource, displayTarget }) => {
          if (!edge.label) return null;
          const srcNode = nodes[displaySource];
          const tgtNode = nodes[displayTarget];
          if (!srcNode || !tgtNode) return null;
          const srcAbs = toAbsolute(displaySource, nodes);
          const tgtAbs = toAbsolute(displayTarget, nodes);
          const mx = (srcAbs.x + srcNode.width / 2 + tgtAbs.x + tgtNode.width / 2) / 2;
          const my = (srcAbs.y + srcNode.height / 2 + tgtAbs.y + tgtNode.height / 2) / 2;
          return <TextLabel key={`lbl-${edge.id}`} text={edge.label} x={mx} y={my} />;
        })}
      </Layer>
    </Stage>
  );
}
