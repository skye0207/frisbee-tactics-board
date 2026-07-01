import { NextResponse } from 'next/server';
import { ensureSchema, getDb, hasDatabase, mapRow } from '@/lib/db';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({ code: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
}

export async function GET() {
  if (!hasDatabase()) return unavailable();
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`SELECT * FROM tactics ORDER BY updated_at DESC`;
  return NextResponse.json(rows.map(mapRow));
}

export async function POST(request) {
  if (!hasDatabase()) return unavailable();
  const tactic = await request.json();
  if (!tactic?.id || !tactic?.title || !Array.isArray(tactic?.frames)) {
    return NextResponse.json({ code: 'INVALID_TACTIC' }, { status: 400 });
  }
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO tactics (id, title, description, frames, created_at, updated_at)
    VALUES (
      ${tactic.id},
      ${tactic.title},
      ${tactic.description || ''},
      ${sql.json(tactic.frames)},
      ${tactic.createdAt || new Date().toISOString()},
      ${tactic.updatedAt || new Date().toISOString()}
    )
    RETURNING *
  `;
  return NextResponse.json(mapRow(rows[0]), { status: 201 });
}
