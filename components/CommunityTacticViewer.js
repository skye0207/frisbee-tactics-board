'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Disc3, Download, History, Pause, Play, RotateCcw, RotateCw, Video, X } from 'lucide-react';
import {
  getCommunityTactic,
  getCommunityVersion,
  importCommunityTactic,
  listCommunityVersions,
  rollbackCommunityVersion,
  unpublishCommunityTactic
} from '@/lib/client-storage';
import { fetchCurrentUser } from '@/lib/client-user';
import { exportTacticVideo, isVideoExportSupported } from '@/lib/tactic-video';
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

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
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
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [viewingVersion, setViewingVersion] = useState(null);
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
    fetchCurrentUser().then((u) => setCurrentUser(u));
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
      setToast({ kind: 'success', text: '已复制到我的战术' });
      router.push(`/tactics/${result.tactic.id}`);
    } catch {
      setToast({ kind: 'error', text: '复制失败' });
      setImporting(false);
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
    } catch {
      setToast({ kind: 'error', text: '导出失败，请稍后再试' });
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }

  async function openVersions() {
    setVersionsOpen(true);
    setVersionsLoading(true);
    try {
      const list = await listCommunityVersions(tacticId);
      setVersions(list);
    } finally {
      setVersionsLoading(false);
    }
  }

  async function viewVersion(version) {
    try {
      const full = await getCommunityVersion(tacticId, version.id);
      setViewingVersion(full);
    } catch {
      setToast({ kind: 'error', text: '加载版本详情失败' });
    }
  }

  async function handleRollback(version) {
    if (!window.confirm(`确认回退到 v${version.versionNo}？当前版本会自动存为新的历史记录。`)) return;
    try {
      const updated = await rollbackCommunityVersion(tacticId, version.id);
      setTactic(updated);
      setVersionsOpen(false);
      setViewingVersion(null);
      setToast({ kind: 'success', text: `已回退到 v${version.versionNo}` });
      const list = await listCommunityVersions(tacticId);
      setVersions(list);
    } catch (e) {
      setToast({ kind: 'error', text: e?.status === 401 ? '请先在右上角设置资料' : '回退失败' });
    }
  }

  async function handleUnpublish() {
    if (!window.confirm('确认从广场下架这个战术？相关的历史版本也会删除。')) return;
    try {
      await unpublishCommunityTactic(tacticId);
      router.push('/community');
    } catch {
      setToast({ kind: 'error', text: '下架失败' });
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
  const isOwner = tactic.ownerUserId && currentUser && tactic.ownerUserId === currentUser.id;
  const ownerName = tactic.ownerNickname || tactic.author || '匿名';

  return (
    <main className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-topbar__left">
          <button className="icon-button" onClick={() => router.push('/community')} aria-label="返回战术广场"><ArrowLeft size={19} /></button>
          <div className="editor-brand"><Disc3 size={20} /><span>飞盘战术板</span></div>
          <span className="topbar-divider" />
          <div className="tactic-title-display">
            <strong>{tactic.title}</strong>
            <span>{ownerName} · 只读预览</span>
          </div>
        </div>
        <div className="editor-topbar__right">
          <button className="button button--secondary" onClick={openVersions}>
            <History size={17} /><span>版本历史</span>
          </button>
          <button className="button button--secondary" onClick={handleImport} disabled={importing}>
            <Download size={17} /><span>{importing ? '复制中…' : '复制到我的'}</span>
          </button>
          <button className="button button--secondary" onClick={handleExportVideo} disabled={exporting || tactic.frames.length < 2}>
            <Video size={17} /><span>{exporting ? `导出 ${Math.round(exportProgress * 100)}%` : '导出视频'}</span>
          </button>
          {isOwner && (
            <button className="button button--secondary" onClick={handleUnpublish}>
              <X size={17} /><span>下架</span>
            </button>
          )}
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
            <div className="property-readonly">{ownerName}</div>
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
          <div className="property-section">
            <label>更新时间</label>
            <div className="property-readonly">{formatDateTime(tactic.updatedAt || tactic.publishedAt)}</div>
          </div>
        </aside>
      </div>

      {versionsOpen && (
        <div className="modal-mask" onClick={() => { setVersionsOpen(false); setViewingVersion(null); }}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <header className="modal__header">
              <strong>版本历史</strong>
              <button className="icon-button icon-button--subtle" onClick={() => { setVersionsOpen(false); setViewingVersion(null); }} aria-label="关闭"><X size={18} /></button>
            </header>
            <div className="modal__body">
              {versionsLoading ? (
                <div className="empty-state"><div className="loader" /><p>加载中…</p></div>
              ) : versions.length === 0 ? (
                <div className="empty-state"><p>暂无历史版本，只有更新过才会产生版本记录。</p></div>
              ) : (
                <div className="version-list">
                  {versions.map((v) => (
                    <div key={v.id} className="version-item">
                      <div className="version-item__main">
                        <strong>v{v.versionNo} · {v.title}</strong>
                        <span>{v.editorNickname || '匿名'} · {formatDateTime(v.createdAt)}</span>
                        {v.note && <small>{v.note}</small>}
                      </div>
                      <div className="version-item__actions">
                        <button className="button button--secondary" onClick={() => viewVersion(v)}>查看</button>
                        {isOwner && (
                          <button className="button button--secondary" onClick={() => handleRollback(v)}>
                            <RotateCcw size={14} />回退
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {viewingVersion && (
                <VersionPreview version={viewingVersion} onClose={() => setViewingVersion(null)} />
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast--${toast.kind}`}>{toast.text}</div>}
    </main>
  );
}

function VersionPreview({ version, onClose }) {
  const [index, setIndex] = useState(0);
  const frame = version.frames?.[index] || null;
  return (
    <div className="version-preview">
      <header>
        <strong>v{version.versionNo} · {version.title}</strong>
        <button className="icon-button icon-button--subtle" onClick={onClose} aria-label="关闭预览"><X size={16} /></button>
      </header>
      <div className="version-preview__frames">
        {version.frames?.map((f, i) => (
          <button
            key={f.id || i}
            className={`chip${i === index ? ' chip--active' : ''}`}
            onClick={() => setIndex(i)}
          >{i + 1}</button>
        ))}
      </div>
      <div className="version-preview__canvas">
        <FieldCanvas
          frame={frame}
          previousFrame={index > 0 ? version.frames?.[index - 1] : null}
          selectedPieceId={null}
          onSelectPiece={() => {}}
          onMovePiece={() => {}}
          onUpdateCurve={() => {}}
          readOnly
          showTrails
          orientation="horizontal"
        />
      </div>
      {version.description && <p className="version-preview__desc">{version.description}</p>}
    </div>
  );
}
