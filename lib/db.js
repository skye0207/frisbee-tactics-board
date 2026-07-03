import postgres from 'postgres';

let client;
let initialized = false;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_NOT_CONFIGURED');
  }
  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      max: 1,
      prepare: false,
      ssl: process.env.DATABASE_SSL === 'require' ? 'require' : undefined
    });
  }
  return client;
}

export async function ensureSchema() {
  if (initialized) return;
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE,
      nickname TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_nickname
    ON users(nickname)
    WHERE nickname <> ''
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_clients (
      client_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tactics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      frames JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE tactics ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;
  await sql`ALTER TABLE tactics ADD COLUMN IF NOT EXISTS community_source_id TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tactics_owner ON tactics(owner_user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS community_tactics (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      frames JSONB NOT NULL DEFAULT '[]'::jsonb,
      likes INTEGER NOT NULL DEFAULT 0,
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE community_tactics ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;
  await sql`ALTER TABLE community_tactics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_community_owner_source
    ON community_tactics(owner_user_id, source_id)
    WHERE owner_user_id IS NOT NULL AND source_id IS NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS community_tactic_versions (
      id TEXT PRIMARY KEY,
      tactic_id TEXT NOT NULL REFERENCES community_tactics(id) ON DELETE CASCADE,
      version_no INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      frames JSONB NOT NULL DEFAULT '[]'::jsonb,
      editor_user_id TEXT,
      editor_nickname TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_versions_tactic ON community_tactic_versions(tactic_id, version_no DESC)`;

  initialized = true;
}

export function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    frames: row.frames,
    ownerUserId: row.owner_user_id || null,
    communitySourceId: row.community_source_id || null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

export function mapCommunityRow(row) {
  return {
    id: row.id,
    sourceId: row.source_id || null,
    title: row.title,
    description: row.description,
    author: row.author || '',
    frames: row.frames,
    likes: row.likes || 0,
    ownerUserId: row.owner_user_id || null,
    publishedAt: new Date(row.published_at).toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date(row.published_at).toISOString()
  };
}

export function mapVersionRow(row) {
  return {
    id: row.id,
    tacticId: row.tactic_id,
    versionNo: row.version_no,
    title: row.title,
    description: row.description,
    frames: row.frames,
    editorUserId: row.editor_user_id || null,
    editorNickname: row.editor_nickname || '',
    note: row.note || '',
    createdAt: new Date(row.created_at).toISOString()
  };
}

export function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone || null,
    nickname: row.nickname || '',
    gender: row.gender || '',
    avatar: row.avatar || '',
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}
