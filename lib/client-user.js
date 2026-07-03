'use client';

import { uuid } from './uuid';

const CLIENT_ID_KEY = 'frisbee-tactics-board:client-id';

export function getClientId() {
  if (typeof window === 'undefined') return null;
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = `c_${uuid()}`;
      window.localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function clientHeaders(extra) {
  const headers = { 'Content-Type': 'application/json', ...(extra || {}) };
  const clientId = getClientId();
  if (clientId) headers['x-client-id'] = clientId;
  return headers;
}

export async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/users/me', { headers: clientHeaders(), cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function updateCurrentUser(patch) {
  const res = await fetch('/api/users/me', {
    method: 'PUT',
    headers: clientHeaders(),
    body: JSON.stringify(patch),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('UPDATE_USER_FAILED');
  return await res.json();
}
