import { NextResponse } from 'next/server';
import { ensureSchema, getDb, hasDatabase, mapCommunityRow } from '@/lib/db';
import { resolveUser } from '@/lib/user-server';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({ code: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
}

export async function GET() {
  if (!hasDatabase()) return unavailable();
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`
    SELECT c.*, u.nickname AS owner_nickname, u.avatar AS owner_avatar
    FROM community_tactics c
    LEFT JOIN users u ON u.id = c.owner_user_id
    ORDER BY c.updated_at DESC NULLS LAST, c.published_at DESC
  `;
  return NextResponse.json(rows.map((row) => ({
    ...mapCommunityRow(row),
    ownerNickname: row.owner_nickname || row.author || '',
    ownerAvatar: row.owner_avatar || ''
  })));
}

/**
 * 发布 / 更新到广场：
 * - 若当前用户 + sourceId 已存在广场条目，则更新它（并把旧版本存进 versions）。
 * - 否则新建。
 */
export async function POST(request) {
  if (!hasDatabase()) return unavailable();
  const { user } = await resolveUser(request);
  const payload = await request.json();
  if (!payload?.title || !Array.isArray(payload?.frames)) {
    return NextResponse.json({ code: 'INVALID_TACTIC' }, { status: 400 });
  }
  await ensureSchema();
  const sql = getDb();

  // 尝试找到已存在的条目
  let existing = null;
  if (user && payload.sourceId) {
    const rows = await sql`
      SELECT * FROM community_tactics
      WHERE owner_user_id = ${user.id} AND source_id = ${payload.sourceId}
      LIMIT 1
    `;
    existing = rows[0] || null;
  }

  if (existing) {
    // 把旧版本存快照
    const countRows = await sql`SELECT COUNT(*)::int AS c FROM community_tactic_versions WHERE tactic_id = ${existing.id}`;
    const nextVersionNo = (countRows[0]?.c || 0) + 1;
    await sql`
      INSERT INTO community_tactic_versions (id, tactic_id, version_no, title, description, frames, editor_user_id, editor_nickname, note)
      VALUES (
        ${crypto.randomUUID()},
        ${existing.id},
        ${nextVersionNo},
        ${existing.title},
        ${existing.description || ''},
        ${sql.json(existing.frames)},
        ${user?.id || null},
        ${user?.nickname || ''},
        ${'更新前自动快照'}
      )
    `;
    const updated = await sql`
      UPDATE community_tactics SET
        title = ${payload.title},
        description = ${payload.description || ''},
        author = ${payload.author || user?.nickname || existing.author},
        frames = ${sql.json(payload.frames)},
        updated_at = NOW()
      WHERE id = ${existing.id}
      RETURNING *
    `;
    return NextResponse.json(mapCommunityRow(updated[0]));
  }

  const id = payload.id || crypto.randomUUID();
  const rows = await sql`
    INSERT INTO community_tactics (id, source_id, title, description, author, frames, likes, owner_user_id, published_at, updated_at)
    VALUES (
      ${id},
      ${payload.sourceId || null},
      ${payload.title},
      ${payload.description || ''},
      ${payload.author || user?.nickname || ''},
      ${sql.json(payload.frames)},
      0,
      ${user?.id || null},
      NOW(),
      NOW()
    )
    RETURNING *
  `;
  return NextResponse.json(mapCommunityRow(rows[0]), { status: 201 });
}
