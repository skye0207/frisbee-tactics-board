import { createDemoTactics } from './demo-data';
import { uuid } from './uuid';

const STORAGE_KEY = 'frisbee-tactics-board:tactics:v1';
const COMMUNITY_KEY = 'frisbee-tactics-board:community:v1';
const LEGACY_STORAGE_KEY = 'ultimate-tactics-board:tactics:v1';
const LEGACY_COMMUNITY_KEY = 'ultimate-tactics-board:community:v1';

function migrateLegacyKey(fromKey, toKey) {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(toKey)) return;
  const legacy = window.localStorage.getItem(fromKey);
  if (legacy) {
    window.localStorage.setItem(toKey, legacy);
    window.localStorage.removeItem(fromKey);
  }
}

function readLocal() {
  if (typeof window === 'undefined') return [];
  migrateLegacyKey(LEGACY_STORAGE_KEY, STORAGE_KEY);
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = createDemoTactics();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const initial = createDemoTactics();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

function writeLocal(tactics) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tactics));
}

function readCommunity() {
  if (typeof window === 'undefined') return [];
  migrateLegacyKey(LEGACY_COMMUNITY_KEY, COMMUNITY_KEY);
  const raw = window.localStorage.getItem(COMMUNITY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function writeCommunity(items) {
  window.localStorage.setItem(COMMUNITY_KEY, JSON.stringify(items));
}

async function apiFetch(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    cache: 'no-store'
  });
  if (!response.ok) {
    const error = new Error(`API request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export async function listTactics() {
  try {
    return { tactics: await apiFetch('/api/tactics'), mode: 'cloud' };
  } catch {
    return { tactics: readLocal(), mode: 'local' };
  }
}

export async function getTactic(id) {
  try {
    return { tactic: await apiFetch(`/api/tactics/${id}`), mode: 'cloud' };
  } catch {
    const tactic = readLocal().find((item) => item.id === id);
    if (!tactic) throw new Error('TACTIC_NOT_FOUND');
    return { tactic, mode: 'local' };
  }
}

export async function createTactic(tactic) {
  try {
    return { tactic: await apiFetch('/api/tactics', { method: 'POST', body: JSON.stringify(tactic) }), mode: 'cloud' };
  } catch {
    const tactics = readLocal();
    writeLocal([tactic, ...tactics]);
    return { tactic, mode: 'local' };
  }
}

export async function saveTactic(tactic) {
  const payload = { ...tactic, updatedAt: new Date().toISOString() };
  try {
    return { tactic: await apiFetch(`/api/tactics/${tactic.id}`, { method: 'PUT', body: JSON.stringify(payload) }), mode: 'cloud' };
  } catch {
    const tactics = readLocal();
    const next = tactics.some((item) => item.id === tactic.id)
      ? tactics.map((item) => (item.id === tactic.id ? payload : item))
      : [payload, ...tactics];
    writeLocal(next);
    return { tactic: payload, mode: 'local' };
  }
}

export async function deleteTactic(id) {
  try {
    await apiFetch(`/api/tactics/${id}`, { method: 'DELETE' });
    return { mode: 'cloud' };
  } catch {
    writeLocal(readLocal().filter((item) => item.id !== id));
    return { mode: 'local' };
  }
}

function toCommunityPayload(tactic, extras) {
  return {
    sourceId: tactic.id,
    title: tactic.title,
    description: tactic.description || '',
    author: extras?.author || '',
    frames: tactic.frames || []
  };
}

export async function publishTactic(tactic, extras) {
  const payload = toCommunityPayload(tactic, extras);
  try {
    return { tactic: await apiFetch('/api/community', { method: 'POST', body: JSON.stringify(payload) }), mode: 'cloud' };
  } catch {
    const record = {
      id: uuid(),
      ...payload,
      likes: 0,
      publishedAt: new Date().toISOString()
    };
    writeCommunity([record, ...readCommunity()]);
    return { tactic: record, mode: 'local' };
  }
}

export async function listCommunityTactics() {
  try {
    return { tactics: await apiFetch('/api/community'), mode: 'cloud' };
  } catch {
    return { tactics: readCommunity(), mode: 'local' };
  }
}

export async function getCommunityTactic(id) {
  try {
    return { tactic: await apiFetch(`/api/community/${id}`), mode: 'cloud' };
  } catch {
    const tactic = readCommunity().find((item) => item.id === id);
    if (!tactic) throw new Error('TACTIC_NOT_FOUND');
    return { tactic, mode: 'local' };
  }
}

export async function unpublishCommunityTactic(id) {
  try {
    await apiFetch(`/api/community/${id}`, { method: 'DELETE' });
    return { mode: 'cloud' };
  } catch {
    writeCommunity(readCommunity().filter((item) => item.id !== id));
    return { mode: 'local' };
  }
}

export async function importCommunityTactic(source) {
  const tactic = {
    id: uuid(),
    title: `${source.title}（副本）`,
    description: source.description || '',
    frames: (source.frames || []).map((frame) => ({
      ...frame,
      id: uuid(),
      pieces: (frame.pieces || []).map((piece) => ({ ...piece }))
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return createTactic(tactic);
}
