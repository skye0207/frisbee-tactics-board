import { createBlankTactic } from './constants';

export function createDemoTactics() {
  const vertical = createBlankTactic('纵向进攻 · Vertical Stack');
  vertical.description = 'Handler 发起，Cutters 依次向开阔侧切入。';
  vertical.frames[0].pieces = vertical.frames[0].pieces.map((piece, index) => {
    if (piece.type === 'offense') return { ...piece, x: index === 0 ? 24 : 42, y: index === 0 ? 30 : 14 + index * 9 };
    if (piece.type === 'defense') return { ...piece, x: 52, y: 15 + index * 10 };
    return { ...piece, x: 20, y: 30 };
  });

  const zone = createBlankTactic('区域防守 · Cup Zone');
  zone.description = '三人杯形压迫持盘者，后场覆盖横向与深远区域。';
  zone.frames[0].pieces = zone.frames[0].pieces.map((piece, index) => {
    if (piece.type === 'defense') return { ...piece, x: 40 + index * 5, y: 23 + index * 7 };
    return piece;
  });

  return [vertical, zone];
}
