import { NextResponse } from 'next/server';
import { ensureSchema, getDb, hasDatabase, mapCommunityRow } from '@/lib/db';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({ code: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
}

export async function GET(_request, { params }) {
  if (!hasDatabase()) return unavailable();
  const { id } = await params;
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`SELECT * FROM community_tactics WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json(mapCommunityRow(rows[0]));
}

export async function DELETE(_request, { params }) {
  if (!hasDatabase()) return unavailable();
  const { id } = await params;
  await ensureSchema();
  const sql = getDb();
  await sql`DELETE FROM community_tactics WHERE id = ${id}`;
  return new NextResponse(null, { status: 204 });
}
