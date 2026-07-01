'use client';

import { useMemo, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function defaultControl(from, to) {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

export default function FieldCanvas({
  frame,
  previousFrame,
  selectedPieceId,
  onSelectPiece,
  onMovePiece,
  onUpdateCurve,
  readOnly = false,
  showTrails = true,
  orientation = 'horizontal'
}) {
  const fieldRef = useRef(null);
  const suppressNextClickRef = useRef(false);
  const [dragging, setDragging] = useState(null); // { id, kind: 'piece' | 'curve' }
  const isVertical = orientation === 'vertical';

  const previousPieces = useMemo(
    () => new Map((previousFrame?.pieces || []).map((piece) => [piece.id, piece])),
    [previousFrame]
  );

  function pointerToField(event) {
    const rect = fieldRef.current.getBoundingClientRect();
    if (isVertical) {
      return {
        x: clamp(((event.clientY - rect.top) / rect.height) * 100, 1.5, 98.5),
        y: clamp(((event.clientX - rect.left) / rect.width) * 60, 1.5, 58.5)
      };
    }
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 1.5, 98.5),
      y: clamp(((event.clientY - rect.top) / rect.height) * 60, 1.5, 58.5)
    };
  }

  function moveFromPointer(event) {
    if (!dragging || readOnly || !fieldRef.current) return;
    const { x, y } = pointerToField(event);
    if (dragging.kind === 'piece') {
      onMovePiece?.(dragging.id, x, y);
    } else if (dragging.kind === 'curve') {
      onUpdateCurve?.(dragging.id, { x, y });
    }
  }

  function handlePiecePointerDown(event, pieceId) {
    event.stopPropagation();
    suppressNextClickRef.current = true;
    onSelectPiece?.(pieceId);
    if (readOnly) return;
    setDragging({ id: pieceId, kind: 'piece' });
    fieldRef.current?.setPointerCapture?.(event.pointerId);
  }

  function handleCurvePointerDown(event, pieceId) {
    event.stopPropagation();
    suppressNextClickRef.current = true;
    if (readOnly) return;
    setDragging({ id: pieceId, kind: 'curve' });
    fieldRef.current?.setPointerCapture?.(event.pointerId);
  }

  function stopDragging(event) {
    if (dragging && fieldRef.current?.hasPointerCapture?.(event.pointerId)) {
      fieldRef.current.releasePointerCapture(event.pointerId);
    }
    setDragging(null);
  }

  // Map field coord (x [0,100], y [0,60]) to canvas viewBox (100 x 60) taking orientation into account.
  function toView(point) {
    return isVertical
      ? { vx: (point.y / 60) * 100, vy: point.x * 0.6 }
      : { vx: point.x, vy: point.y };
  }

  // Piece screen position style (in %).
  function pieceStyle(point) {
    return isVertical
      ? { left: `${(point.y / 60) * 100}%`, top: `${point.x}%` }
      : { left: `${point.x}%`, top: `${(point.y / 60) * 100}%` };
  }

  const selectedPiece = (frame?.pieces || []).find((piece) => piece.id === selectedPieceId);
  const selectedPrev = selectedPiece ? previousPieces.get(selectedPiece.id) : null;
  const showCurveHandle = !readOnly && selectedPiece && selectedPrev
    && (Math.abs(selectedPrev.x - selectedPiece.x) >= 0.2 || Math.abs(selectedPrev.y - selectedPiece.y) >= 0.2);
  const curveHandlePoint = showCurveHandle
    ? (selectedPiece.curve || defaultControl(selectedPrev, selectedPiece))
    : null;

  return (
    <div
      className={`field-canvas ${readOnly ? 'field-canvas--readonly' : ''} ${isVertical ? 'field-canvas--vertical' : ''}`}
      ref={fieldRef}
      onPointerMove={moveFromPointer}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onClick={() => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        onSelectPiece?.(null);
      }}
    >
      <div className="field-canvas__grass" />
      <div className="field-canvas__endzone field-canvas__endzone--left"><span>END ZONE</span></div>
      <div className="field-canvas__endzone field-canvas__endzone--right"><span>END ZONE</span></div>
      <div className="field-canvas__line field-canvas__line--goal-left" />
      <div className="field-canvas__line field-canvas__line--goal-right" />
      <div className="field-canvas__line field-canvas__line--middle" />
      <div className="field-canvas__brick field-canvas__brick--left" />
      <div className="field-canvas__brick field-canvas__brick--right" />

      {showTrails && previousFrame && (
        <svg className="movement-trails" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="trail-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          {(frame?.pieces || []).map((piece) => {
            const previous = previousPieces.get(piece.id);
            if (!previous || (Math.abs(previous.x - piece.x) < 0.2 && Math.abs(previous.y - piece.y) < 0.2)) return null;
            const control = piece.curve || defaultControl(previous, piece);
            const p0 = toView(previous);
            const p1 = toView(piece);
            const c = toView(control);
            return (
              <path
                key={piece.id}
                d={`M ${p0.vx} ${p0.vy} Q ${c.vx} ${c.vy} ${p1.vx} ${p1.vy}`}
                fill="none"
                markerEnd="url(#trail-arrow)"
              />
            );
          })}
        </svg>
      )}

      {(frame?.pieces || []).map((piece) => (
        <button
          key={piece.id}
          type="button"
          className={`field-piece field-piece--${piece.type} ${selectedPieceId === piece.id ? 'field-piece--selected' : ''}`}
          style={pieceStyle(piece)}
          onPointerDown={(event) => handlePiecePointerDown(event, piece.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={piece.type === 'disc' ? '飞盘' : piece.label}
        >
          {piece.type === 'disc' ? <span className="disc-glyph" /> : piece.label}
        </button>
      ))}

      {showCurveHandle && curveHandlePoint && (
        <button
          type="button"
          className="curve-handle"
          style={pieceStyle(curveHandlePoint)}
          onPointerDown={(event) => handleCurvePointerDown(event, selectedPiece.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label="调整移动曲线"
        />
      )}
    </div>
  );
}
