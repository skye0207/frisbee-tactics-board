import { NextResponse } from 'next/server';
import { ensureSchema, getDb, hasDatabase, mapCommunityRow, mapVersionRow } from '@/lib/db';
import { resolveUser } from '@/lib/user-server';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({ code: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
}

export async function GET(_request, { params }) {
  if (!hasDatabase()) return unavailable();
  const { id, versionId } = await params;
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM community_tactic_versions
    WHERE tactic_id = ${id} AND id = ${versionId}
    LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json(mapVersionRow(rows[0]));
}

/**
 * 回退：把某个 version 的内容写回主表。
 * 仅广场条目 owner 可以操作。
 * 回退前会把"当前状态"再存一次版本快照。
 */
export async function POST(request, { params }) {
  if (!hasDatabase()) return unavailable();
  const { user } = await resolveUser(request);
  if (!user) return NextResponse.json({ code: 'REQUIRE_LOGIN' }, { status: 401 });
  const { id, versionId } = await params;
  await ensureSchema();
  const sql = getDb();

  const tacticRows = await sql`SELECT * FROM community_tactics WHERE id = ${id} LIMIT 1`;
  const tactic = tacticRows[0];
  if (!tactic) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  if (tactic.owner_user_id && tactic.owner_user_id !== user.id) {
    return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
  }

  const versionRows = await sql`
    SELECT * FROM community_tactic_versions
    WHERE tactic_id = ${id} AND id = ${versionId}
    LIMIT 1
  `;
  const version = versionRows[0];
  if (!version) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });

  // 快照当前状态
  const countRows = await sql`SELECT COUNT(*)::int AS c FROM community_tactic_versions WHERE tactic_id = ${id}`;
  const nextVersionNo = (countRows[0]?.c || 0) + 1;
  await sql`
    INSERT INTO community_tactic_versions (id, tactic_id, version_no, title, description, frames, editor_user_id, editor_nickname, note)
    VALUES (
      ${crypto.randomUUID()},
      ${id},
      ${nextVersionNo},
      ${tactic.title},
      ${tactic.description || ''},
      ${sql.json(tactic.frames)},
      ${user.id},
      ${user.nickname || ''},
      ${`回退到 v${version.version_no} 前自动快照`}
    )
  `;

  const updated = await sql`
    UPDATE community_tactics SET
      title = ${version.title},
      description = ${version.description || ''},
      frames = ${sql.json(version.frames)},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json(mapCommunityRow(updated[0]));
}
