import { NextResponse } from 'next/server';
import { ensureSchema, getDb, hasDatabase, mapCommunityRow } from '@/lib/db';
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
  const rows = await sql`
    SELECT c.*, u.nickname AS owner_nickname, u.avatar AS owner_avatar
    FROM community_tactics c
    LEFT JOIN users u ON u.id = c.owner_user_id
    WHERE c.id = ${id}
    LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({
    ...mapCommunityRow(rows[0]),
    ownerNickname: rows[0].owner_nickname || rows[0].author || '',
    ownerAvatar: rows[0].owner_avatar || ''
  });
}

export async function DELETE(request, { params }) {
  if (!hasDatabase()) return unavailable();
  const { user } = await resolveUser(request);
  const { id } = await params;
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`SELECT owner_user_id FROM community_tactics WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return new NextResponse(null, { status: 204 });
  const owner = rows[0].owner_user_id;
  if (owner && user && owner !== user.id) {
    return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
  }
  await sql`DELETE FROM community_tactics WHERE id = ${id}`;
  return new NextResponse(null, { status: 204 });
}
