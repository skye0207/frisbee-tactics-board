'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Disc3, Download, Pause, Play, RotateCw } from 'lucide-react';
import { getCommunityTactic, importCommunityTactic } from '@/lib/client-storage';
import FieldCanvas from './FieldCanvas';
import FrameThumbnail from './FrameThumbnail';

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

export default function CommunityTacticViewer({ tacticId }) {
  const router = useRouter();
  const [tactic, setTactic] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayFrame, setDisplayFrame] = useState(null);
  const [playbackLabel, setPlaybackLabel] = useState('');
  const [playbackStartIndex, setPlaybackStartIndex] = useState(0);
  const [orientation, setOrientation] = useState('horizontal');
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    getCommunityTactic(tacticId)
      .then((result) => {
        if (cancelledRef.current) return;
        setTactic(result.tactic);
      })
      .catch(() => {
        if (!cancelledRef.current) setNotFound(true);
      });
    return () => { cancelledRef.current = true; };
  }, [tacticId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  function togglePlayback() {
    if (!tactic) return;
    if (isPlaying) {
      setIsPlaying(false);
      setDisplayFrame(null);
      setPlaybackLabel('');
    } else if (tactic.frames.length > 1) {
      setDisplayFrame(null);
      setPlaybackStartIndex(activeFrameIndex >= tactic.frames.length - 1 ? 0 : activeFrameIndex);
      setIsPlaying(true);
    }
  }

  async function handleImport() {
    if (!tactic || importing) return;
    setImporting(true);
    try {
      const result = await importCommunityTactic(tactic);
      setToast({ kind: 'success', text: '已导入到我的战术' });
      router.push(`/tactics/${result.tactic.id}`);
    } catch {
      setToast({ kind: 'error', text: '导入失败' });
      setImporting(false);
    }
  }

  if (notFound) {
    return (
      <main className="editor-loading">
        <p>找不到这个战术，可能已经被下架。</p>
        <button className="button button--primary" onClick={() => router.push('/community')}>
          <ArrowLeft size={17} />返回战术广场
        </button>
      </main>
    );
  }

  if (!tactic) {
    return <main className="editor-loading"><div className="loader" /><p>正在打开战术…</p></main>;
  }

  const activeFrame = tactic.frames?.[activeFrameIndex] || null;
  const previousFrame = activeFrameIndex > 0 ? tactic.frames?.[activeFrameIndex - 1] : null;
  const renderedFrame = displayFrame || activeFrame;

  return (
    <main className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-topbar__left">
          <button className="icon-button" onClick={() => router.push('/community')} aria-label="返回战术广场"><ArrowLeft size={19} /></button>
          <div className="editor-brand"><Disc3 size={20} /><span>飞盘战术板</span></div>
          <span className="topbar-divider" />
          <div className="tactic-title-display">
            <strong>{tactic.title}</strong>
            <span>{tactic.author ? `@${tactic.author}` : '匿名'} · 只读预览</span>
          </div>
        </div>
        <div className="editor-topbar__right">
          <button className="button button--secondary" onClick={handleImport} disabled={importing}>
            <Download size={17} />{importing ? '导入中…' : '导入编辑'}
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
                }}
                readOnly
                canDelete={false}
              />
            ))}
          </div>
        </aside>

        <section className="canvas-stage">
          <div className="canvas-toolbar">
            <div className="tool-group">
              <span className="tool-group__label">只读预览</span>
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
              selectedPieceId={null}
              onSelectPiece={() => {}}
              onMovePiece={() => {}}
              onUpdateCurve={() => {}}
              readOnly
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
          <div className="panel-heading"><div><span>信息</span></div></div>
          <div className="property-section">
            <label>作者</label>
            <div className="property-readonly">{tactic.author ? `@${tactic.author}` : '匿名'}</div>
          </div>
          <div className="property-section">
            <label>页面</label>
            <div className="property-readonly">{tactic.frames.length} 页</div>
          </div>
          {activeFrame?.name && (
            <div className="property-section">
              <label>当前页</label>
              <div className="property-readonly">{activeFrame.name}</div>
            </div>
          )}
          <div className="property-section">
            <label>战术说明</label>
            <div className="property-readonly property-readonly--multiline">{tactic.description || '暂无战术说明'}</div>
          </div>
        </aside>
      </div>

      {toast && <div className={`toast toast--${toast.kind}`}>{toast.text}</div>}
    </main>
  );
}
