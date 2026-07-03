import { NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/db';
import { resolveUser, updateUserProfile } from '@/lib/user-server';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({ code: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
}

export async function GET(request) {
  if (!hasDatabase()) return unavailable();
  const { user, clientId } = await resolveUser(request);
  if (!clientId) return NextResponse.json({ code: 'MISSING_CLIENT_ID' }, { status: 400 });
  return NextResponse.json(user);
}

export async function PUT(request) {
  if (!hasDatabase()) return unavailable();
  const { user, clientId } = await resolveUser(request);
  if (!clientId || !user) return NextResponse.json({ code: 'MISSING_CLIENT_ID' }, { status: 400 });
  const patch = await request.json();
  const updated = await updateUserProfile(clientId, user.id, patch || {});
  return NextResponse.json(updated);
}
