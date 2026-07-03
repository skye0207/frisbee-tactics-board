import { ensureSchema, getDb, mapUserRow } from './db';

const CLIENT_HEADER = 'x-client-id';

function newId(prefix = 'u') {
  // 服务端环境（Node 20+）保证有 crypto.randomUUID
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * 根据请求头中的 clientId 查找或创建对应的用户。
 * 返回 { user, clientId }。若请求未带 clientId，返回 { user: null, clientId: null }。
 */
export async function resolveUser(request) {
  const clientId = request.headers.get(CLIENT_HEADER);
  if (!clientId) return { user: null, clientId: null };
  await ensureSchema();
  const sql = getDb();

  const linkRows = await sql`SELECT user_id FROM user_clients WHERE client_id = ${clientId} LIMIT 1`;
  if (linkRows[0]) {
    const userRows = await sql`SELECT * FROM users WHERE id = ${linkRows[0].user_id} LIMIT 1`;
    if (userRows[0]) return { user: mapUserRow(userRows[0]), clientId };
  }

  // 新访客：创建 user + 关联
  const userId = newId();
  const userRows = await sql`
    INSERT INTO users (id, phone, nickname, gender, avatar)
    VALUES (${userId}, NULL, '', '', '')
    RETURNING *
  `;
  await sql`INSERT INTO user_clients (client_id, user_id) VALUES (${clientId}, ${userId})`;
  return { user: mapUserRow(userRows[0]), clientId };
}

/**
 * 更新当前用户资料。若填了新手机号且已存在其他用户，
 * 则把当前 clientId 挂到已有用户上，并删除临时用户。
 */
export async function updateUserProfile(clientId, currentUserId, patch) {
  await ensureSchema();
  const sql = getDb();
  const nickname = typeof patch.nickname === 'string' ? patch.nickname.trim() : undefined;
  const gender = typeof patch.gender === 'string' ? patch.gender.trim() : undefined;
  const avatar = typeof patch.avatar === 'string' ? patch.avatar.trim() : undefined;
  const rawPhone = typeof patch.phone === 'string' ? patch.phone.trim() : undefined;
  const phone = rawPhone ? rawPhone : null;

  // 检查手机号合并
  if (phone) {
    const existing = await sql`SELECT * FROM users WHERE phone = ${phone} LIMIT 1`;
    if (existing[0] && existing[0].id !== currentUserId) {
      // 合并：clientId 重新指向 existing.id，删掉当前临时 user
      await sql`UPDATE user_clients SET user_id = ${existing[0].id} WHERE client_id = ${clientId}`;
      // 只有当当前 user 无关联战术且无其他 client 时才删除；这里保守做法：仅解除
      const stillLinked = await sql`SELECT COUNT(*)::int AS c FROM user_clients WHERE user_id = ${currentUserId}`;
      if (stillLinked[0]?.c === 0) {
        await sql`DELETE FROM users WHERE id = ${currentUserId}`;
      }
      const merged = await sql`
        UPDATE users SET
          nickname = COALESCE(${nickname ?? null}, nickname),
          gender = COALESCE(${gender ?? null}, gender),
          avatar = COALESCE(${avatar ?? null}, avatar),
          updated_at = NOW()
        WHERE id = ${existing[0].id}
        RETURNING *
      `;
      return mapUserRow(merged[0]);
    }
  }

  const rows = await sql`
    UPDATE users SET
      nickname = COALESCE(${nickname ?? null}, nickname),
      gender = COALESCE(${gender ?? null}, gender),
      avatar = COALESCE(${avatar ?? null}, avatar),
      phone = ${phone},
      updated_at = NOW()
    WHERE id = ${currentUserId}
    RETURNING *
  `;
  return mapUserRow(rows[0]);
}

export function displayName(user) {
  if (!user) return '匿名';
  return user.nickname || '匿名';
}
