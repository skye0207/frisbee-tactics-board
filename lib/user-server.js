import { ensureSchema, getDb, mapUserRow } from './db';

const CLIENT_HEADER = 'x-client-id';

const NAME_ADJECTIVES = [
  '飞驰的', '灵动的', '沉稳的', '闪电', '轻盈的', '勇敢的', '狡黠的', '悠闲的',
  '呼啸的', '追风', '倔强的', '温柔的', '狂野的', '安静的', '欢乐的', '认真的',
  '爱笑的', '好奇的', '皮皮', '滑滑的', '毛茸茸的', '大力', '小小的', '慢吞吞的'
];
const NAME_NOUNS = [
  '飞盘手', '接锋', '切入手', '长传', '边线', '守中', '推手', '教练',
  '熊猫', '海豚', '猎豹', '狐狸', '雪鸮', '水母', '仓鼠', '小海獭',
  '橡子', '棉花糖', '菠萝', '布丁', '汽水', '气球', '小星球', '月光'
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function newId(prefix = 'u') {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function generateUniqueNickname(sql) {
  // 先试组合，再兜底带随机后缀
  for (let i = 0; i < 8; i += 1) {
    const candidate = `${pick(NAME_ADJECTIVES)}${pick(NAME_NOUNS)}`;
    const rows = await sql`SELECT 1 FROM users WHERE nickname = ${candidate} LIMIT 1`;
    if (rows.length === 0) return candidate;
  }
  // 冲突太多，加随机后缀
  for (let i = 0; i < 10; i += 1) {
    const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const candidate = `${pick(NAME_NOUNS)}${suffix}`;
    const rows = await sql`SELECT 1 FROM users WHERE nickname = ${candidate} LIMIT 1`;
    if (rows.length === 0) return candidate;
  }
  return `玩家${Date.now().toString(36)}`;
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
    if (userRows[0]) {
      // 兼容旧数据：nickname 为空时补一个
      if (!userRows[0].nickname) {
        const name = await generateUniqueNickname(sql);
        const updated = await sql`UPDATE users SET nickname = ${name}, updated_at = NOW() WHERE id = ${userRows[0].id} RETURNING *`;
        return { user: mapUserRow(updated[0]), clientId };
      }
      return { user: mapUserRow(userRows[0]), clientId };
    }
  }

  // 新访客：创建 user + 关联，给随机昵称
  const userId = newId();
  const nickname = await generateUniqueNickname(sql);
  const userRows = await sql`
    INSERT INTO users (id, phone, nickname, gender, avatar)
    VALUES (${userId}, NULL, ${nickname}, '', '')
    RETURNING *
  `;
  await sql`INSERT INTO user_clients (client_id, user_id) VALUES (${clientId}, ${userId})`;
  return { user: mapUserRow(userRows[0]), clientId };
}

export class ProfileUpdateError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
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

  // 检查手机号合并（拉取已有账号，不覆盖）
  if (phone) {
    const existing = await sql`SELECT * FROM users WHERE phone = ${phone} LIMIT 1`;
    if (existing[0] && existing[0].id !== currentUserId) {
      await sql`UPDATE user_clients SET user_id = ${existing[0].id} WHERE client_id = ${clientId}`;
      const stillLinked = await sql`SELECT COUNT(*)::int AS c FROM user_clients WHERE user_id = ${currentUserId}`;
      if (stillLinked[0]?.c === 0) {
        await sql`DELETE FROM users WHERE id = ${currentUserId}`;
      }
      return mapUserRow(existing[0]);
    }
  }

  // 昵称重名校验（排除自己）
  if (nickname) {
    const dup = await sql`SELECT 1 FROM users WHERE nickname = ${nickname} AND id <> ${currentUserId} LIMIT 1`;
    if (dup.length > 0) {
      throw new ProfileUpdateError('NICKNAME_TAKEN', '该昵称已被占用');
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
  if (!user) return '玩家';
  return user.nickname || '玩家';
}
