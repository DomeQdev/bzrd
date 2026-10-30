import { memo, useCallback, useMemo } from 'react';
import Konva from 'konva';
import { Group, Image as KImage, Rect, Shape } from 'react-konva';
import type { BzObject, SymbolObj } from '../model/types';
import { drawSurface, hitPolygon, objectBounds, type Cap, type Drawable } from './draw';
import { useProject } from '../store/project';
import { useSymbolImage } from './symbolImage';
import { symbolById } from '../assets/symbols';

export interface ObjectNodeProps {
  obj: BzObject;
  /** round joints with neighbouring strips (object-local) */
  caps?: Cap[];
  draggable: boolean;
  listening: boolean;
  onMouseDown: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDblClick: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onHover: (id: string | null) => void;
  onDragStart: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (id: string, node: Konva.Group) => void;
}

function SymbolBody({ obj }: { obj: SymbolObj }) {
  const def = symbolById(obj.symbolId);
  const img = useSymbolImage(def, obj.color);
  if (!def) return <Rect x={-obj.width / 2} y={-obj.height / 2} width={obj.width} height={obj.height} fill="#ff00ff" opacity={0.5} />;
  if (!img) return <Rect x={-obj.width / 2} y={-obj.height / 2} width={obj.width} height={obj.height} fill="#ffffff" opacity={0.15} />;
  return <KImage image={img} x={0} y={0} offsetX={obj.width / 2} offsetY={obj.height / 2} width={obj.width} height={obj.height} scaleX={obj.flipX ? -1 : 1} />;
}

/**
 * One Konva group per object: hit area (always) + the object's SURFACE pass. Paint, tram slabs and rails are drawn
 * by the scene shape above (see Board), so dragging updates the store live to keep the two in sync.
 */
export const ObjectNode = memo(function ObjectNode({ obj, caps, draggable, listening, onMouseDown, onDblClick, onHover, onDragStart, onDragMove, onDragEnd, onTransformEnd }: ObjectNodeProps) {
  const scale = useProject((s) => s.viewport.scale);
  const minHalf = 5 / scale; // at least ~5 screen px of hit slack for thin lines
  const b = useMemo(() => objectBounds(obj), [obj]);
  const poly = useMemo(() => (obj.type === 'symbol' ? null : hitPolygon(obj, minHalf)), [obj, minHalf]);

  const sceneFunc = useCallback(
    (context: Konva.Context) => {
      const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context;
      ctx.save();
      drawSurface(ctx, obj as Drawable, caps);
      ctx.restore();
    },
    [obj, caps],
  );
  const hitFunc = useCallback(
    (context: Konva.Context, shape: Konva.Shape) => {
      if (!poly || poly.length < 3) {
        context.beginPath();
        context.rect(b.x, b.y, b.w, b.h);
        context.closePath();
      } else {
        context.beginPath();
        context.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) context.lineTo(poly[i].x, poly[i].y);
        context.closePath();
      }
      context.fillStrokeShape(shape);
    },
    [poly, b],
  );

  if (obj.visible === false) return null;

  return (
    <Group
      id={obj.id}
      name="obj"
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation}
      opacity={obj.opacity ?? 1}
      listening={listening}
      draggable={draggable && !obj.locked}
      onMouseDown={(e) => onMouseDown(obj.id, e)}
      onTouchStart={(e) => onMouseDown(obj.id, e)}
      onDblClick={(e) => onDblClick(obj.id, e)}
      onMouseEnter={() => onHover(obj.id)}
      onMouseLeave={() => onHover(null)}
      onDragStart={(e) => onDragStart(obj.id, e)}
      onDragMove={(e) => onDragMove(obj.id, e)}
      onDragEnd={(e) => onDragEnd(obj.id, e)}
      onTransformEnd={(e) => onTransformEnd(obj.id, e.target as unknown as Konva.Group)}
    >
      <Rect x={b.x} y={b.y} width={b.w} height={b.h} listening={false} />
      {obj.type === 'symbol' ? <SymbolBody obj={obj} /> : <Shape sceneFunc={sceneFunc} hitFunc={hitFunc} fill="#000" perfectDrawEnabled={false} shadowForStrokeEnabled={false} />}
    </Group>
  );
});
