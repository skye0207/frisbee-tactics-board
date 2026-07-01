'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Cloud, Compass, Disc3, Download, MoreHorizontal, Plus, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { createBlankTactic } from '@/lib/constants';
import { createTactic, deleteTactic, listTactics, publishTactic } from '@/lib/client-storage';
import MiniField from './MiniField';

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function Dashboard() {
  const router = useRouter();
  const [tactics, setTactics] = useState([]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('local');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    listTactics()
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

  async function handleCreate() {
    setCreating(true);
    const tactic = createBlankTactic(`新战术 ${tactics.length + 1}`);
    const result = await createTactic(tactic);
    setMode(result.mode);
    router.push(`/tactics/${tactic.id}`);
  }

  async function handleDelete(event, id) {
    event.stopPropagation();
    if (!window.confirm('确认删除这个战术吗？此操作无法撤销。')) return;
    const result = await deleteTactic(id);
    setMode(result.mode);
    setTactics((current) => current.filter((item) => item.id !== id));
    setMenuId(null);
  }

  async function handlePublish(event, tactic) {
    event.stopPropagation();
    const author = window.prompt('署名（选填）', '') || '';
    setPublishingId(tactic.id);
    setMenuId(null);
    try {
      await publishTactic(tactic, { author });
      setToast({ kind: 'success', text: `《${tactic.title}》已发布到战术广场` });
    } catch {
      setToast({ kind: 'error', text: '发布失败，请稍后再试' });
    } finally {
      setPublishingId(null);
    }
  }

  const filtered = tactics.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase()));

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
          <button className="sidebar-nav__item sidebar-nav__item--active"><Sparkles size={18} />我的战术</button>
          <button className="sidebar-nav__item" onClick={() => router.push('/community')}><Compass size={18} />战术广场</button>
        </nav>
        <div className="sidebar-tip">
          <span className="sidebar-tip__eyebrow">使用提示</span>
          <strong>复制页面，再移动队员</strong>
          <p>播放器会自动补间相同编号队员的位置，形成连贯跑位动画。</p>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">PLAYBOOK</p>
            <h1>我的战术</h1>
            <p>整理阵型、设计跑位，并把每一页串成完整演练。</p>
          </div>
          <div className={`storage-badge storage-badge--${mode}`}>
            <Cloud size={15} />
            {mode === 'cloud' ? '云端数据库' : '本地演示模式'}
          </div>
        </header>

        <div className="dashboard-toolbar">
          <label className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索战术名称" />
          </label>
          <button className="button button--primary" onClick={handleCreate} disabled={creating}>
            <Plus size={18} />{creating ? '正在创建…' : '新建战术'}
          </button>
        </div>

        {loading ? (
          <div className="empty-state"><div className="loader" /><p>正在读取战术库…</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><Disc3 size={34} /></div>
            <h2>{query ? '没有匹配的战术' : '从第一套战术开始'}</h2>
            <p>{query ? '尝试搜索其他关键词。' : '创建一个战术，然后布置队员、对手和飞盘。'}</p>
            {!query && <button className="button button--primary" onClick={handleCreate}><Plus size={18} />新建战术</button>}
          </div>
        ) : (
          <div className="tactic-grid">
            <button className="new-tactic-card" onClick={handleCreate} disabled={creating}>
              <span><Plus size={28} /></span>
              <strong>创建新战术</strong>
              <small>从空白球场开始</small>
            </button>
            {filtered.map((tactic) => (
              <article className="tactic-card" key={tactic.id} onClick={() => router.push(`/tactics/${tactic.id}`)}>
                <MiniField frame={tactic.frames?.[0]} />
                <div className="tactic-card__content">
                  <div className="tactic-card__title-row">
                    <h2>{tactic.title}</h2>
                    <button
                      className="icon-button icon-button--subtle"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuId(menuId === tactic.id ? null : tactic.id);
                      }}
                      aria-label="更多操作"
                    ><MoreHorizontal size={18} /></button>
                    {menuId === tactic.id && (
                      <div className="card-menu">
                        <button
                          className="card-menu__item"
                          onClick={(event) => handlePublish(event, tactic)}
                          disabled={publishingId === tactic.id}
                        ><Upload size={15} />{publishingId === tactic.id ? '发布中…' : '发布到广场'}</button>
                        <button onClick={(event) => handleDelete(event, tactic.id)}><Trash2 size={15} />删除战术</button>
                      </div>
                    )}
                  </div>
                  <p>{tactic.description || '暂无战术说明'}</p>
                  <div className="tactic-card__meta">
                    <span>{tactic.frames?.length || 0} 页 · {formatDate(tactic.updatedAt)}</span>
                    <span className="open-link">编辑 <ArrowRight size={15} /></span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {toast && <div className={`toast toast--${toast.kind}`}>{toast.text}</div>}
    </main>
  );
}
