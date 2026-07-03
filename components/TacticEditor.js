'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Cloud,
  Disc3,
  Pause,
  Play,
  Plus,
  Minus,
  RotateCw,
  Save,
  Shield,
  Trash2,
  Upload,
  UserRound,
  Video
} from 'lucide-react';
import { getTactic, publishTactic, saveTactic } from '@/lib/client-storage';
import { exportTacticVideo, isVideoExportSupported } from '@/lib/tactic-video';
import { makePiece } from '@/lib/constants';
import FieldCanvas from './FieldCanvas';
import FrameThumbnail from './FrameThumbnail';

function cloneFrame(frame, index) {
  return {
    ...frame,
    id: crypto.randomUUID(),
    name: `第 ${index + 1} 页`,
    pieces: frame.pieces.map(({ curve, ...piece }) => ({ ...piece }))
  };
}

function interpolateFrames(fromFrame, toFrame, progress) {
  const fromMap = new Map((fromFrame?.pieces || []).map((piece) => [piece.id, piece]));
  const pieces = (toFrame?.pieces || []).map((piece) => {
    const from = fromMap.get(piece.id) || piece;
    const control = piece.curve || { x: (from.x + piece.x) / 2, y: (from.y + piece.y) / 2 };
    const t = progress;
    const mt = 1 - t;
    const x = mt * mt * from.x + 2 * mt * t * control.x + t * t * piece.x;
    const y = mt * mt * from.y + 2 * mt * t * control.y + t * t * piece.y;
    return { ...piece, x, y };
  });
  return { ...toFrame, pieces };
}

export default function TacticEditor({ tacticId }) {
  const router = useRouter();
  const [tactic, setTactic] = useState(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [selectedPieceId, setSelectedPieceId] = useState(null);
  const [storageMode, setStorageMode] = useState('local');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [dirty, setDirty] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayFrame, setDisplayFrame] = useState(null);
  const [playbackLabel, setPlaybackLabel] = useState('');
  const [playbackStartIndex, setPlaybackStartIndex] = useState(0);
  const [orientation, setOrientation] = useState('horizontal');
  const [publishing, setPublishing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const saveVersion = useRef(0);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(`tactic-orientation:${tacticId}`);
      if (stored === 'vertical' || stored === 'horizontal') setOrientation(stored);
    } catch {}
  }, [tacticId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`tactic-orientation:${tacticId}`, orientation);
    } catch {}
  }, [tacticId, orientation]);

  useEffect(() => {
    let cancelled = false;
    getTactic(tacticId)
      .then((result) => {
        if (cancelled) return;
        setTactic(result.tactic);
        setStorageMode(result.mode);
      })
      .catch(() => {
        if (!cancelled) router.replace('/');
      });
    return () => { cancelled = true; };
  }, [router, tacticId]);

  const activeFrame = tactic?.frames?.[activeFrameIndex] || null;
  const previousFrame = activeFrameIndex > 0 ? tactic?.frames?.[activeFrameIndex - 1] : null;
  const selectedPiece = useMemo(
    () => activeFrame?.pieces?.find((piece) => piece.id === selectedPieceId) || null,
    [activeFrame, selectedPieceId]
  );

  const pieceCounts = useMemo(() => {
    const counts = { offense: 0, defense: 0, disc: 0 };
    (activeFrame?.pieces || []).forEach((piece) => {
      if (counts[piece.type] !== undefined) counts[piece.type] += 1;
    });
    return counts;
  }, [activeFrame]);

  const updateTactic = useCallback((updater) => {
    setTactic((current) => {
      if (!current) return current;
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...next, updatedAt: new Date().toISOString() };
    });
    setDirty(true);
    setSaveStatus('unsaved');
    saveVersion.current += 1;
  }, []);

  const persist = useCallback(async () => {
    if (!tactic) return;
    const versionAtStart = saveVersion.current;
    setSaveStatus('saving');
    const result = await saveTactic(tactic);
    setStorageMode(result.mode);
    if (saveVersion.current === versionAtStart) {
      setDirty(false);
      setSaveStatus('saved');
    } else {
      setSaveStatus('unsaved');
    }
  }, [tactic]);

  useEffect(() => {
    if (!dirty || !tactic || isPlaying) return undefined;
    const timer = window.setTimeout(() => persist(), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, tactic, persist, isPlaying]);

  useEffect(() => {
    if (!isPlaying || !tactic || tactic.frames.length < 2) return undefined;
    let animationId;
    let segment = playbackStartIndex;
    let startedAt = performance.now();

    const tick = (now) => {
      const from = tactic.frames[segment];
      const to = tactic.frames[segment + 1];
      if (!to) {
        setDisplayFrame(null);
        setActiveFrameIndex(tactic.frames.length - 1);
        setIsPlaying(false);
        setPlaybackLabel('');
        return;
      }
      const duration = Math.max(250, Number(to.duration) || 900);
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayFrame(interpolateFrames(from, to, eased));
      setPlaybackLabel(`${segment + 1} → ${segment + 2}`);

      if (progress >= 1) {
        segment += 1;
        setActiveFrameIndex(segment);
        startedAt = now;
      }
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, tactic, playbackStartIndex]);

  function updateActiveFrame(frameUpdater) {
    updateTactic((current) => ({
      ...current,
      frames: current.frames.map((frame, index) => index === activeFrameIndex ? frameUpdater(frame) : frame)
    }));
  }

  function movePiece(pieceId, x, y) {
    updateActiveFrame((frame) => ({
      ...frame,
      pieces: frame.pieces.map((piece) => piece.id === pieceId ? { ...piece, x, y } : piece)
    }));
  }

  function updatePieceCurve(pieceId, control) {
    updateActiveFrame((frame) => ({
      ...frame,
      pieces: frame.pieces.map((piece) => piece.id === pieceId ? { ...piece, curve: control } : piece)
    }));
  }

  function resetPieceCurve() {
    if (!selectedPieceId) return;
    updateActiveFrame((frame) => ({
      ...frame,
      pieces: frame.pieces.map((piece) => {
        if (piece.id !== selectedPieceId) return piece;
        const { curve, ...rest } = piece;
        return rest;
      })
    }));
  }

  function addPiece(type) {
    const sameTypeCount = activeFrame.pieces.filter((piece) => piece.type === type).length;
    const limit = type === 'disc' ? 1 : 7;
    if (sameTypeCount >= limit) return;
    const piece = makePiece(type, sameTypeCount, {
      x: type === 'offense' ? 30 : type === 'defense' ? 60 : 46,
      y: 12 + ((sameTypeCount * 8) % 40)
    });
    updateActiveFrame((frame) => ({ ...frame, pieces: [...frame.pieces, piece] }));
    setSelectedPieceId(piece.id);
  }

  function removePiece(type) {
    const matching = activeFrame.pieces.filter((piece) => piece.type === type);
    if (matching.length === 0) return;
    const target = matching[matching.length - 1];
    updateActiveFrame((frame) => ({
      ...frame,
      pieces: frame.pieces.filter((piece) => piece.id !== target.id)
    }));
    if (selectedPieceId === target.id) setSelectedPieceId(null);
  }

  function deleteSelectedPiece() {
    if (!selectedPieceId) return;
    updateActiveFrame((frame) => ({
      ...frame,
      pieces: frame.pieces.filter((piece) => piece.id !== selectedPieceId)
    }));
    setSelectedPieceId(null);
  }

  function duplicateFrame(index = activeFrameIndex) {
    updateTactic((current) => {
      const nextFrames = [...current.frames];
      nextFrames.splice(index + 1, 0, cloneFrame(current.frames[index], index + 1));
      return { ...current, frames: nextFrames };
    });
    setActiveFrameIndex(index + 1);
    setSelectedPieceId(null);
  }

  function deleteFrame(index) {
    if (tactic.frames.length <= 1) return;
    updateTactic((current) => ({ ...current, frames: current.frames.filter((_, itemIndex) => itemIndex !== index) }));
    setActiveFrameIndex((current) => Math.max(0, Math.min(current > index ? current - 1 : current, tactic.frames.length - 2)));
    setSelectedPieceId(null);
  }

  function updatePieceLabel(label) {
    updateActiveFrame((frame) => ({
      ...frame,
      pieces: frame.pieces.map((piece) => piece.id === selectedPieceId ? { ...piece, label } : piece)
    }));
  }

  async function handlePublish() {
    if (!tactic || publishing) return;
    const author = window.prompt('署名（选填）', '') || '';
    setPublishing(true);
    try {
      if (dirty) await persist();
      await publishTactic(tactic, { author });
      setToast({ kind: 'success', text: `《${tactic.title}》已发布到战术广场` });
    } catch {
      setToast({ kind: 'error', text: '发布失败，请稍后再试' });
    } finally {
      setPublishing(false);
    }
  }
  function togglePlayback() {
    if (isPlaying) {
      setIsPlaying(false);
      setDisplayFrame(null);
      setPlaybackLabel('');
    } else if (tactic.frames.length > 1) {
      setDisplayFrame(null);
      setSelectedPieceId(null);
      setPlaybackStartIndex(activeFrameIndex >= tactic.frames.length - 1 ? 0 : activeFrameIndex);
      setIsPlaying(true);
    }
  }

  async function handleExportVideo() {
    if (!tactic || exporting) return;
    if (!isVideoExportSupported()) {
      setToast({ kind: 'error', text: '当前浏览器不支持视频导出，请使用最新版 Chrome / Edge' });
      return;
    }
    if (tactic.frames.length < 2) {
      setToast({ kind: 'error', text: '至少需要 2 页才能导出为视频' });
      return;
    }
    setExporting(true);
    setExportProgress(0);
    try {
      await exportTacticVideo(tactic, {}, (progress) => setExportProgress(progress));
      setToast({ kind: 'success', text: '视频已导出（.webm）' });
    } catch (error) {
      setToast({ kind: 'error', text: error?.message === 'VIDEO_EXPORT_UNSUPPORTED' ? '当前浏览器不支持视频导出' : '导出失败，请稍后再试' });
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }

  if (!tactic) {
    return <main className="editor-loading"><div className="loader" /><p>正在打开战术板…</p></main>;
  }

  const renderedFrame = displayFrame || activeFrame;

  return (
    <main className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-topbar__left">
          <button className="icon-button" onClick={() => router.push('/')} aria-label="返回首页"><ArrowLeft size={19} /></button>
          <div className="editor-brand"><Disc3 size={20} /><span>飞盘战术板</span></div>
          <span className="topbar-divider" />
          <input
            className="tactic-title-input"
            value={tactic.title}
            onChange={(event) => updateTactic((current) => ({ ...current, title: event.target.value }))}
            aria-label="战术名称"
          />
        </div>
        <div className="editor-topbar__right">
          <span className={`save-state save-state--${saveStatus}`}>
            {saveStatus === 'saving' ? <Cloud size={15} /> : saveStatus === 'saved' ? <Check size={15} /> : <CircleDot size={15} />}
            {saveStatus === 'saving' ? '保存中' : saveStatus === 'saved' ? '已保存' : '有修改'}
          </span>
          <button className="button button--secondary" onClick={persist}><Save size={17} />保存</button>
          <button className="button button--secondary" onClick={handlePublish} disabled={publishing}>
            <Upload size={17} />{publishing ? '发布中…' : '发布到广场'}
          </button>
          <button className="button button--secondary" onClick={handleExportVideo} disabled={exporting || tactic.frames.length < 2}>
            <Video size={17} />{exporting ? `导出 ${Math.round(exportProgress * 100)}%` : '导出视频'}
          </button>
          <button className="button button--primary" onClick={togglePlayback} disabled={tactic.frames.length < 2}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {isPlaying ? '停止播放' : '播放战术'}
          </button>
        </div>
      </header>

      <div className="editor-workspace">
        <aside className="frames-panel">
          <div className="panel-heading">
            <div><span>页面</span><strong>{tactic.frames.length}</strong></div>
            <button className="icon-button icon-button--small" onClick={() => duplicateFrame()} aria-label="添加页面"><Plus size={17} /></button>
          </div>
          <div className="frames-list">
            {tactic.frames.map((frame, index) => (
              <FrameThumbnail
                key={frame.id}
                frame={frame}
                index={index}
                active={index === activeFrameIndex}
                orientation={orientation}
                onClick={() => {
                  setIsPlaying(false);
                  setDisplayFrame(null);
                  setActiveFrameIndex(index);
                  setSelectedPieceId(null);
                }}
                onDuplicate={() => duplicateFrame(index)}
                onDelete={() => deleteFrame(index)}
                canDelete={tactic.frames.length > 1}
              />
            ))}
          </div>
          <button className="add-frame-button" onClick={() => duplicateFrame()}><Plus size={16} />复制当前页</button>
        </aside>

        <section className="canvas-stage">
          <div className="canvas-toolbar">
            <div className="tool-group">
              <span className="tool-group__label">元素</span>
              <div className="stepper">
                <button onClick={() => removePiece('offense')} disabled={isPlaying || pieceCounts.offense === 0} aria-label="减少我方队员"><Minus size={13} /></button>
                <span className="stepper__label"><UserRound size={15} />我方 {pieceCounts.offense}</span>
                <button onClick={() => addPiece('offense')} disabled={isPlaying || pieceCounts.offense >= 7} aria-label="添加我方队员"><Plus size={13} /></button>
              </div>
              <div className="stepper">
                <button onClick={() => removePiece('defense')} disabled={isPlaying || pieceCounts.defense === 0} aria-label="减少对方队员"><Minus size={13} /></button>
                <span className="stepper__label"><Shield size={15} />对方 {pieceCounts.defense}</span>
                <button onClick={() => addPiece('defense')} disabled={isPlaying || pieceCounts.defense >= 7} aria-label="添加对方队员"><Plus size={13} /></button>
              </div>
              <div className="stepper">
                <button onClick={() => removePiece('disc')} disabled={isPlaying || pieceCounts.disc === 0} aria-label="移除飞盘"><Minus size={13} /></button>
                <span className="stepper__label"><Disc3 size={15} />飞盘 {pieceCounts.disc}</span>
                <button onClick={() => addPiece('disc')} disabled={isPlaying || pieceCounts.disc >= 1} aria-label="添加飞盘"><Plus size={13} /></button>
              </div>
            </div>
            <div className="playback-indicator">
              <button
                type="button"
                className="orientation-toggle"
                onClick={() => setOrientation((current) => current === 'horizontal' ? 'vertical' : 'horizontal')}
                aria-label="切换球场方向"
              >
                <RotateCw size={14} />
                {orientation === 'horizontal' ? '横向' : '竖向'}
              </button>
              {isPlaying ? <span className="pulse-dot" /> : null}
              {isPlaying ? `播放 ${playbackLabel}` : `第 ${activeFrameIndex + 1} / ${tactic.frames.length} 页`}
            </div>
          </div>

          <div className="field-wrap">
            <FieldCanvas
              frame={renderedFrame}
              previousFrame={displayFrame ? null : previousFrame}
              selectedPieceId={selectedPieceId}
              onSelectPiece={setSelectedPieceId}
              onMovePiece={movePiece}
              onUpdateCurve={updatePieceCurve}
              readOnly={isPlaying}
              showTrails={!isPlaying}
              orientation={orientation}
            />
          </div>

          <div className="playback-bar">
            <button
              className="icon-button"
              onClick={() => setActiveFrameIndex((index) => Math.max(0, index - 1))}
              disabled={activeFrameIndex === 0 || isPlaying}
            ><ChevronLeft size={19} /></button>
            <button className="playback-button" onClick={togglePlayback} disabled={tactic.frames.length < 2}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              className="icon-button"
              onClick={() => setActiveFrameIndex((index) => Math.min(tactic.frames.length - 1, index + 1))}
              disabled={activeFrameIndex === tactic.frames.length - 1 || isPlaying}
            ><ChevronRight size={19} /></button>
            <div className="frame-dots">
              {tactic.frames.map((frame, index) => (
                <button
                  key={frame.id}
                  className={index === activeFrameIndex ? 'active' : ''}
                  onClick={() => setActiveFrameIndex(index)}
                  disabled={isPlaying}
                  aria-label={`跳转到第 ${index + 1} 页`}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="properties-panel">
          <div className="panel-heading"><div><span>属性</span></div></div>
          <div className="property-section">
            <label>页面名称</label>
            <input
              value={activeFrame.name || ''}
              onChange={(event) => updateActiveFrame((frame) => ({ ...frame, name: event.target.value }))}
            />
          </div>
          {activeFrameIndex > 0 && (
            <div className="property-section">
              <label>动画时长（从上一页进入本页）</label>
              <div className="duration-control">
                <input
                  type="range"
                  min="300"
                  max="5000"
                  step="100"
                  value={activeFrame.duration || 900}
                  onChange={(event) => updateActiveFrame((frame) => ({ ...frame, duration: Number(event.target.value) }))}
                />
                <span>{((activeFrame.duration || 900) / 1000).toFixed(1)}s</span>
              </div>
            </div>
          )}
          <div className="property-section">
            <label>战术说明</label>
            <textarea
              value={tactic.description || ''}
              rows={4}
              onChange={(event) => updateTactic((current) => ({ ...current, description: event.target.value }))}
            />
          </div>

          <div className="property-divider" />

          {selectedPiece ? (
            <div className="selected-piece-card">
              <div className={`piece-preview piece-preview--${selectedPiece.type}`}>
                {selectedPiece.type === 'disc' ? <Disc3 size={20} /> : selectedPiece.label}
              </div>
              <div>
                <span>已选择</span>
                <strong>{selectedPiece.type === 'offense' ? '我方队员' : selectedPiece.type === 'defense' ? '对方队员' : '飞盘'}</strong>
              </div>
              {selectedPiece.type !== 'disc' && (
                <label className="inline-field">
                  <span>编号</span>
                  <input value={selectedPiece.label || ''} maxLength={4} onChange={(event) => updatePieceLabel(event.target.value)} />
                </label>
              )}
              <div className="position-readout"><span>X {selectedPiece.x.toFixed(1)}</span><span>Y {selectedPiece.y.toFixed(1)}</span></div>
              {previousFrame && previousFrame.pieces.some((piece) => piece.id === selectedPiece.id) && (
                <button className="secondary-button" onClick={resetPieceCurve} disabled={!selectedPiece.curve}>重置移动曲线</button>
              )}
              <button className="danger-button" onClick={deleteSelectedPiece}><Trash2 size={16} />删除元素</button>
            </div>
          ) : (
            <div className="property-empty">
              <CircleDot size={23} />
              <strong>选择球场元素</strong>
              <p>点击队员、对手或飞盘后，可修改编号和位置。</p>
            </div>
          )}

          <div className="storage-note">
            <Cloud size={16} />
            <div><strong>{storageMode === 'cloud' ? '云端保存' : '本地保存'}</strong><span>{storageMode === 'cloud' ? '数据已连接 PostgreSQL' : '配置 DATABASE_URL 后自动切换云端'}</span></div>
          </div>
        </aside>
      </div>
      {toast && <div className={`toast toast--${toast.kind}`}>{toast.text}</div>}
    </main>
  );
}
