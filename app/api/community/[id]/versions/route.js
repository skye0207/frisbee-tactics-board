import { NextResponse } from 'next/server';
import { ensureSchema, getDb, hasDatabase, mapVersionRow } from '@/lib/db';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({ code: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
}

export async function GET(_request, { params }) {
  if (!hasDatabase()) return unavailable();
  const { id } = await params;
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM community_tactic_versions
    WHERE tactic_id = ${id}
    ORDER BY version_no DESC
  `;
  return NextResponse.json(rows.map(mapVersionRow));
}
