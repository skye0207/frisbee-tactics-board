'use client';

import { useEffect, useRef, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';

const TIPS = [
  { title: '复制页面，再移动队员', body: '播放器会自动补间相同编号队员的位置，形成连贯跑位动画。' },
  { title: '选中队员拖曲线柄', body: '选中一个跑动过的队员，会出现绿色的曲线控制点，拖它可以调整走位弧度。' },
  { title: '横竖切换', body: '球场右上角的横向/竖向按钮可以换个方向布置阵型，画演习图更顺手。' },
  { title: '广场发布 + 版本历史', body: '发布后再更新，旧版本会自动存快照。每个人都能看，作者能一键回退。' },
  { title: '手机号=跨浏览器账号', body: '在个人资料里填手机号，换设备也是同一个账号，不会丢战术。' },
  { title: '导出 .webm 视频', body: '播放战术旁边有"导出视频"，可以直接分享跑位动画。' }
];

const STORAGE_KEY = 'frisbee-tactics-board:tip-index';
const CLOSED_KEY_PREFIX = 'frisbee-tactics-board:tip-closed';
const AUTO_INTERVAL = 6000;

export default function SidebarTip({ eyebrow = '使用提示', className = '', defaultClosed = false, storageScope = 'default' }) {
  const closedKey = `${CLOSED_KEY_PREFIX}:${storageScope}`;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [bulbSpin, setBulbSpin] = useState(0);
  const [closed, setClosed] = useState(defaultClosed);
  const [hydrated, setHydrated] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= 0 && stored < TIPS.length) {
        setIndex(stored);
      }
      const closedFlag = window.localStorage.getItem(closedKey);
      if (closedFlag === '1') setClosed(true);
      else if (closedFlag === '0') setClosed(false);
    } catch {}
    setHydrated(true);
  }, [closedKey]);

  function move(delta) {
    setDirection(delta > 0 ? 1 : -1);
    setIndex((current) => {
      const next = (current + delta + TIPS.length) % TIPS.length;
      try { window.localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }

  useEffect(() => {
    if (closed) return undefined;
    const timer = window.setInterval(() => move(1), AUTO_INTERVAL);
    return () => window.clearInterval(timer);
  }, [closed]);

  function handleBulbClick() {
    setBulbSpin((prev) => prev + 1);
    move(1);
  }

  function handleClose() {
    setClosed(true);
    try { window.localStorage.setItem(closedKey, '1'); } catch {}
  }

  function handleReopen() {
    setClosed(false);
    try { window.localStorage.setItem(closedKey, '0'); } catch {}
  }

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 30) move(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  }

  if (!hydrated) return null;

  if (closed) {
    return (
      <button
        type="button"
        className={`sidebar-tip-reopen ${className}`}
        onClick={handleReopen}
        aria-label="打开使用提示"
      >
        <Lightbulb size={20} />
      </button>
    );
  }

  const tip = TIPS[index];

  return (
    <div className={`sidebar-tip ${className}`}>
      <div className="sidebar-tip__head">
        <button
          type="button"
          className="sidebar-tip__eyebrow sidebar-tip__eyebrow--btn"
          onClick={handleBulbClick}
          aria-label="下一条提示"
        >
          <span
            key={bulbSpin}
            className="sidebar-tip__bulb"
          ><Lightbulb size={11} /></span>
          {eyebrow}
        </button>
        <button
          type="button"
          className="sidebar-tip__close"
          onClick={handleClose}
          aria-label="关闭提示"
        ><X size={12} /></button>
      </div>
      <div
        className="sidebar-tip__viewport"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={index}
          className={`sidebar-tip__card sidebar-tip__card--${direction > 0 ? 'in-right' : 'in-left'}`}
        >
          <strong>{tip.title}</strong>
          <p>{tip.body}</p>
        </div>
      </div>
    </div>
  );
}
