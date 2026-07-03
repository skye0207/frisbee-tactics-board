import { NextResponse } from 'next/server';
import { ensureSchema, getDb, hasDatabase, mapRow } from '@/lib/db';
import { resolveUser } from '@/lib/user-server';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({ code: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
}

export async function GET(request) {
  if (!hasDatabase()) return unavailable();
  const { user } = await resolveUser(request);
  await ensureSchema();
  const sql = getDb();
  const rows = user
    ? await sql`SELECT * FROM tactics WHERE owner_user_id = ${user.id} OR owner_user_id IS NULL ORDER BY updated_at DESC`
    : await sql`SELECT * FROM tactics WHERE owner_user_id IS NULL ORDER BY updated_at DESC`;
  return NextResponse.json(rows.map(mapRow));
}

export async function POST(request) {
  if (!hasDatabase()) return unavailable();
  const { user } = await resolveUser(request);
  const tactic = await request.json();
  if (!tactic?.id || !tactic?.title || !Array.isArray(tactic?.frames)) {
    return NextResponse.json({ code: 'INVALID_TACTIC' }, { status: 400 });
  }
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO tactics (id, title, description, frames, owner_user_id, community_source_id, created_at, updated_at)
    VALUES (
      ${tactic.id},
      ${tactic.title},
      ${tactic.description || ''},
      ${sql.json(tactic.frames)},
      ${user?.id || null},
      ${tactic.communitySourceId || null},
      ${tactic.createdAt || new Date().toISOString()},
      ${tactic.updatedAt || new Date().toISOString()}
    )
    RETURNING *
  `;
  return NextResponse.json(mapRow(rows[0]), { status: 201 });
}
