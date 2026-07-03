// Client-side tactic → webm video export using Canvas 2D + MediaRecorder.
// Renders each frame pair with bezier interpolation, records via captureStream.

const COLORS = {
  field: '#31956a',
  fieldStripe: 'rgba(0,0,0,0.02)',
  endzone: 'rgba(255,255,255,0.06)',
  endzoneLabel: 'rgba(255,255,255,0.22)',
  line: 'rgba(255,255,255,0.9)',
  midline: 'rgba(255,255,255,0.35)',
  brick: 'rgba(255,255,255,0.22)',
  trail: 'rgba(255,255,255,0.75)',
  offense: '#ff735c',
  defense: '#3978f6',
  disc: 'rgba(255,255,255,0.85)',
  pieceBorder: '#ffffff',
  pieceText: '#ffffff',
  title: '#ffffff',
  titleShadow: 'rgba(0,0,0,0.45)'
};

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function isVideoExportSupported() {
  return typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

function bezierInterp(fromFrame, toFrame, progress) {
  const fromMap = new Map((fromFrame?.pieces || []).map((piece) => [piece.id, piece]));
  return (toFrame?.pieces || []).map((piece) => {
    const from = fromMap.get(piece.id) || piece;
    const control = piece.curve || { x: (from.x + piece.x) / 2, y: (from.y + piece.y) / 2 };
    const mt = 1 - progress;
    const x = mt * mt * from.x + 2 * mt * progress * control.x + progress * progress * piece.x;
    const y = mt * mt * from.y + 2 * mt * progress * control.y + progress * progress * piece.y;
    return { ...piece, x, y };
  });
}

function drawField(ctx, width, height) {
  ctx.fillStyle = COLORS.field;
  ctx.fillRect(0, 0, width, height);
  // subtle vertical stripes
  ctx.fillStyle = COLORS.fieldStripe;
  const stripeCount = 10;
  const stripeWidth = width / stripeCount;
  for (let i = 0; i < stripeCount; i += 2) {
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, height);
  }
  // margins mirror the on-screen field-canvas (3.5% padding)
  const padX = width * 0.035;
  const padY = height * 0.035;
  // endzones (15% each side of the inner field)
  const innerLeft = padX;
  const innerRight = width - padX;
  const innerTop = padY;
  const innerBottom = height - padY;
  const innerWidth = innerRight - innerLeft;
  const ezWidth = innerWidth * 0.15;
  ctx.fillStyle = COLORS.endzone;
  ctx.fillRect(innerLeft, innerTop, ezWidth, innerBottom - innerTop);
  ctx.fillRect(innerRight - ezWidth, innerTop, ezWidth, innerBottom - innerTop);
  // endzone labels
  ctx.save();
  ctx.fillStyle = COLORS.endzoneLabel;
  ctx.font = `900 ${Math.round(height * 0.035)}px system-ui, -apple-system, "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(innerLeft + ezWidth / 2, (innerTop + innerBottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('END ZONE', 0, 0);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = COLORS.endzoneLabel;
  ctx.font = `900 ${Math.round(height * 0.035)}px system-ui, -apple-system, "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(innerRight - ezWidth / 2, (innerTop + innerBottom) / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText('END ZONE', 0, 0);
  ctx.restore();
  // goal lines
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = Math.max(2, height * 0.006);
  ctx.beginPath();
  ctx.moveTo(innerLeft + ezWidth, innerTop);
  ctx.lineTo(innerLeft + ezWidth, innerBottom);
  ctx.moveTo(innerRight - ezWidth, innerTop);
  ctx.lineTo(innerRight - ezWidth, innerBottom);
  ctx.stroke();
  // midline (dashed)
  ctx.strokeStyle = COLORS.midline;
  ctx.setLineDash([height * 0.02, height * 0.018]);
  ctx.beginPath();
  ctx.moveTo(width / 2, innerTop);
  ctx.lineTo(width / 2, innerBottom);
  ctx.stroke();
  ctx.setLineDash([]);
  // bricks (X markers at 25% and 75% horizontally, midway vertically)
  const brickSize = Math.max(10, height * 0.03);
  ctx.strokeStyle = COLORS.brick;
  ctx.lineWidth = Math.max(2, height * 0.005);
  [0.25, 0.75].forEach((ratio) => {
    const cx = width * ratio;
    const cy = height / 2;
    ctx.beginPath();
    ctx.moveTo(cx - brickSize / 2, cy - brickSize / 2);
    ctx.lineTo(cx + brickSize / 2, cy + brickSize / 2);
    ctx.moveTo(cx + brickSize / 2, cy - brickSize / 2);
    ctx.lineTo(cx - brickSize / 2, cy + brickSize / 2);
    ctx.stroke();
  });
}

function fieldToCanvas(point, width, height) {
  return {
    x: (point.x / 100) * width,
    y: (point.y / 60) * height
  };
}

function drawTrails(ctx, fromFrame, toFrame, width, height) {
  if (!fromFrame) return;
  const fromMap = new Map((fromFrame.pieces || []).map((piece) => [piece.id, piece]));
  ctx.strokeStyle = COLORS.trail;
  ctx.lineWidth = Math.max(1.5, height * 0.004);
  ctx.setLineDash([height * 0.014, height * 0.012]);
  (toFrame.pieces || []).forEach((piece) => {
    const previous = fromMap.get(piece.id);
    if (!previous) return;
    if (Math.abs(previous.x - piece.x) < 0.2 && Math.abs(previous.y - piece.y) < 0.2) return;
    const control = piece.curve || { x: (previous.x + piece.x) / 2, y: (previous.y + piece.y) / 2 };
    const p0 = fieldToCanvas(previous, width, height);
    const c = fieldToCanvas(control, width, height);
    const p1 = fieldToCanvas(piece, width, height);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(c.x, c.y, p1.x, p1.y);
    ctx.stroke();
    // arrowhead
    const angle = Math.atan2(p1.y - c.y, p1.x - c.x);
    const arrow = Math.max(8, height * 0.018);
    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.trail;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x - arrow * Math.cos(angle - Math.PI / 6), p1.y - arrow * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(p1.x - arrow * Math.cos(angle + Math.PI / 6), p1.y - arrow * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  ctx.setLineDash([]);
}

function drawPieces(ctx, pieces, width, height) {
  const pieceRadius = Math.max(14, height * 0.045);
  const discRadius = Math.max(10, height * 0.033);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `850 ${Math.round(pieceRadius * 0.85)}px system-ui, -apple-system, "PingFang SC", sans-serif`;
  (pieces || []).forEach((piece) => {
    const { x, y } = fieldToCanvas(piece, width, height);
    if (piece.type === 'disc') {
      ctx.beginPath();
      ctx.fillStyle = COLORS.disc;
      ctx.strokeStyle = COLORS.pieceBorder;
      ctx.lineWidth = Math.max(2, height * 0.005);
      ctx.arc(x, y, discRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    }
    const bg = piece.type === 'offense' ? COLORS.offense : COLORS.defense;
    ctx.shadowColor = 'rgba(17,35,29,0.35)';
    ctx.shadowBlur = height * 0.02;
    ctx.shadowOffsetY = height * 0.006;
    ctx.beginPath();
    ctx.fillStyle = bg;
    ctx.arc(x, y, pieceRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = Math.max(2, height * 0.005);
    ctx.strokeStyle = COLORS.pieceBorder;
    ctx.stroke();
    ctx.fillStyle = COLORS.pieceText;
    ctx.fillText(piece.label || '', x, y + 1);
  });
}

function drawHeader(ctx, tactic, activeName, pageInfo, width, height) {
  ctx.save();
  ctx.fillStyle = COLORS.title;
  ctx.shadowColor = COLORS.titleShadow;
  ctx.shadowBlur = height * 0.012;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 ${Math.round(height * 0.045)}px system-ui, -apple-system, "PingFang SC", sans-serif`;
  ctx.fillText(tactic.title || '未命名战术', width * 0.04, height * 0.045);
  ctx.font = `600 ${Math.round(height * 0.028)}px system-ui, -apple-system, "PingFang SC", sans-serif`;
  ctx.fillText(`${activeName || ''}  ·  ${pageInfo}`, width * 0.04, height * 0.045 + Math.round(height * 0.06));
  ctx.restore();
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(name) {
  return (name || 'tactic').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'tactic';
}

export async function exportTacticVideo(tactic, options = {}, onProgress) {
  if (!isVideoExportSupported()) {
    throw new Error('VIDEO_EXPORT_UNSUPPORTED');
  }
  if (!tactic || !tactic.frames || tactic.frames.length === 0) {
    throw new Error('NO_FRAMES');
  }

  const width = options.width || 1280;
  const height = options.height || Math.round(width * 0.6); // 100:60 aspect
  const fps = options.fps || 30;
  const holdMsFirst = options.holdMs ?? 700;
  const holdMsLast = options.holdMs ?? 900;
  const holdMsBetween = options.holdBetweenMs ?? 250;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const mimeType = pickMimeType();
  const stream = canvas.captureStream(fps);
  const recorderOptions = mimeType ? { mimeType, videoBitsPerSecond: options.bitsPerSecond || 4_000_000 } : {};
  const recorder = new MediaRecorder(stream, recorderOptions);
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = () => resolve(); });

  const frames = tactic.frames;
  const totalMs = frames.reduce((sum, frame, index) => {
    if (index === 0) return sum + holdMsFirst;
    return sum + Math.max(250, Number(frame.duration) || 900) + holdMsBetween;
  }, 0) + holdMsLast;

  let elapsedMs = 0;

  function renderComposite(pieces, fromFrame, toFrame, activeName, pageInfo) {
    drawField(ctx, width, height);
    drawTrails(ctx, fromFrame, toFrame, width, height);
    drawPieces(ctx, pieces, width, height);
    drawHeader(ctx, tactic, activeName, pageInfo, width, height);
  }

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function renderHold(pieces, fromFrame, toFrame, activeName, pageInfo, ms) {
    const frameCount = Math.max(1, Math.round((ms / 1000) * fps));
    const frameDelay = ms / frameCount;
    for (let i = 0; i < frameCount; i += 1) {
      renderComposite(pieces, fromFrame, toFrame, activeName, pageInfo);
      elapsedMs += frameDelay;
      onProgress?.(Math.min(1, elapsedMs / totalMs));
      await sleep(frameDelay);
    }
  }

  async function renderTween(fromFrame, toFrame, activeName, pageInfo) {
    const duration = Math.max(250, Number(toFrame.duration) || 900);
    const frameCount = Math.max(2, Math.round((duration / 1000) * fps));
    const frameDelay = duration / frameCount;
    for (let i = 0; i <= frameCount; i += 1) {
      const raw = i / frameCount;
      const eased = 1 - Math.pow(1 - raw, 3);
      const pieces = bezierInterp(fromFrame, toFrame, eased);
      renderComposite(pieces, fromFrame, toFrame, activeName, pageInfo);
      elapsedMs += frameDelay;
      onProgress?.(Math.min(1, elapsedMs / totalMs));
      await sleep(frameDelay);
    }
  }

  // Prime the first frame before starting recorder to avoid a black flash.
  renderComposite(frames[0].pieces, null, frames[0], frames[0].name || '第 1 页', `1 / ${frames.length}`);
  recorder.start();
  // Small yield so recorder captures the priming frame.
  await new Promise((resolve) => setTimeout(resolve, 60));

  await renderHold(frames[0].pieces, null, frames[0], frames[0].name || '第 1 页', `1 / ${frames.length}`, holdMsFirst);

  for (let i = 1; i < frames.length; i += 1) {
    const fromFrame = frames[i - 1];
    const toFrame = frames[i];
    const pageInfo = `${i + 1} / ${frames.length}`;
    const name = toFrame.name || `第 ${i + 1} 页`;
    await renderTween(fromFrame, toFrame, name, pageInfo);
    // brief hold on the destination frame
    await renderHold(toFrame.pieces, fromFrame, toFrame, name, pageInfo, holdMsBetween);
  }

  // final hold on last frame
  const last = frames[frames.length - 1];
  await renderHold(last.pieces, frames[frames.length - 2] || null, last, last.name || `第 ${frames.length} 页`, `${frames.length} / ${frames.length}`, holdMsLast);

  onProgress?.(1);
  recorder.stop();
  await stopped;

  const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
  const filename = `${sanitizeFilename(tactic.title)}.webm`;
  download(blob, filename);
  return { blob, filename, mimeType: blob.type };
}
