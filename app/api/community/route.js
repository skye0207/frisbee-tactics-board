import { NextResponse } from 'next/server';
import { ensureSchema, getDb, hasDatabase, mapCommunityRow } from '@/lib/db';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({ code: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
}

export async function GET() {
  if (!hasDatabase()) return unavailable();
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`SELECT * FROM community_tactics ORDER BY published_at DESC`;
  return NextResponse.json(rows.map(mapCommunityRow));
}

export async function POST(request) {
  if (!hasDatabase()) return unavailable();
  const payload = await request.json();
  if (!payload?.title || !Array.isArray(payload?.frames)) {
    return NextResponse.json({ code: 'INVALID_TACTIC' }, { status: 400 });
  }
  await ensureSchema();
  const sql = getDb();
  const id = payload.id || crypto.randomUUID();
  const rows = await sql`
    INSERT INTO community_tactics (id, source_id, title, description, author, frames, likes, published_at)
    VALUES (
      ${id},
      ${payload.sourceId || null},
      ${payload.title},
      ${payload.description || ''},
      ${payload.author || ''},
      ${sql.json(payload.frames)},
      0,
      NOW()
    )
    RETURNING *
  `;
  return NextResponse.json(mapCommunityRow(rows[0]), { status: 201 });
}
