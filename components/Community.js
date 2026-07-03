'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cloud, Compass, Disc3, Download, Search, Sparkles } from 'lucide-react';
import { importCommunityTactic, listCommunityTactics } from '@/lib/client-storage';
import MiniField from './MiniField';
import UserProfileButton from './UserProfileButton';
import SidebarTip from './SidebarTip';

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date);
}

export default function Community() {
  const router = useRouter();
  const [tactics, setTactics] = useState([]);
  const [mode, setMode] = useState('local');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [importingId, setImportingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    listCommunityTactics()
      .then((result) => {
        setTactics(result.tactics);
        setMode(result.mode);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleImport(event, tactic) {
    event.stopPropagation();
    setImportingId(tactic.id);
    try {
      const result = await importCommunityTactic(tactic);
      setToast({ kind: 'success', text: '已复制到我的战术' });
      router.push(`/tactics/${result.tactic.id}`);
    } catch {
      setToast({ kind: 'error', text: '复制失败' });
    } finally {
      setImportingId(null);
    }
  }

  const filtered = tactics.filter((item) => `${item.title} ${item.description} ${item.author}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Disc3 size={24} /></div>
          <div>
            <strong>飞盘战术板</strong>
            <span>frisbee-tactics-board</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button className="sidebar-nav__item sidebar-nav__item--active"><Compass size={18} />战术广场</button>
          <button className="sidebar-nav__item" onClick={() => router.push('/tactics')}><Sparkles size={18} />我的战术</button>
        </nav>
        <SidebarTip eyebrow="社区提示" className="sidebar-tip--desktop" />
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">COMMUNITY</p>
            <h1>战术广场</h1>
            <p>大家分享的战术。点开预览，或导入到自己的战术库继续编辑。</p>
          </div>
          <div className="dashboard-header__meta">
            <div className={`storage-badge storage-badge--${mode}`}>
              <Cloud size={15} />
              {mode === 'cloud' ? '云端数据库' : '本地演示模式'}
            </div>
            <UserProfileButton />
          </div>
        </header>

        <div className="dashboard-toolbar">
          <label className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索战术、作者" />
          </label>
        </div>

        {loading ? (
          <div className="empty-state"><div className="loader" /><p>正在读取战术广场…</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><Compass size={34} /></div>
            <h2>{query ? '没有匹配的战术' : '战术广场还空空的'}</h2>
            <p>{query ? '换个关键词试试。' : '在"我的战术"中点更多操作 → 发布到广场，成为第一个分享者。'}</p>
          </div>
        ) : (
          <div className="tactic-grid">
            {filtered.map((tactic) => (
              <article
                className="tactic-card"
                key={tactic.id}
                onClick={() => router.push(`/community/${tactic.id}`)}
              >
                <MiniField frame={tactic.frames?.[0]} />
                <div className="tactic-card__content">
                  <div className="tactic-card__title-row">
                    <h2>{tactic.title}</h2>
                  </div>
                  <p>{tactic.description || '暂无战术说明'}</p>
                  <div className="community-meta">
                    <span>{tactic.ownerNickname || tactic.author || '匿名'}</span>
                    <span>{tactic.frames?.length || 0} 页 · {formatDate(tactic.updatedAt || tactic.publishedAt)}</span>
                  </div>
                  <div className="community-actions">
                    <button
                      className="button button--primary"
                      onClick={(event) => handleImport(event, tactic)}
                      disabled={importingId === tactic.id}
                    ><Download size={15} />{importingId === tactic.id ? '复制中…' : '复制到我的'}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <SidebarTip eyebrow="社区提示" className="sidebar-tip--mobile" defaultClosed storageScope="mobile" />

      {toast && <div className={`toast toast--${toast.kind}`}>{toast.text}</div>}
    </main>
  );
}
