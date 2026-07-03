import { NextResponse } from 'next/server';
import { ensureSchema, getDb, hasDatabase, mapRow } from '@/lib/db';
import { resolveUser } from '@/lib/user-server';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({ code: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
}

export async function GET(_request, { params }) {
  if (!hasDatabase()) return unavailable();
  const { id } = await params;
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`SELECT * FROM tactics WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json(mapRow(rows[0]));
}

export async function PUT(request, { params }) {
  if (!hasDatabase()) return unavailable();
  const { user } = await resolveUser(request);
  const { id } = await params;
  const tactic = await request.json();
  if (!tactic?.title || !Array.isArray(tactic?.frames)) {
    return NextResponse.json({ code: 'INVALID_TACTIC' }, { status: 400 });
  }
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO tactics (id, title, description, frames, owner_user_id, community_source_id, created_at, updated_at)
    VALUES (
      ${id},
      ${tactic.title},
      ${tactic.description || ''},
      ${sql.json(tactic.frames)},
      ${user?.id || null},
      ${tactic.communitySourceId || null},
      ${tactic.createdAt || new Date().toISOString()},
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      frames = EXCLUDED.frames,
      community_source_id = EXCLUDED.community_source_id,
      owner_user_id = COALESCE(tactics.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = NOW()
    RETURNING *
  `;
  return NextResponse.json(mapRow(rows[0]));
}

export async function DELETE(_request, { params }) {
  if (!hasDatabase()) return unavailable();
  const { id } = await params;
  await ensureSchema();
  const sql = getDb();
  await sql`DELETE FROM tactics WHERE id = ${id}`;
  return new NextResponse(null, { status: 204 });
}
