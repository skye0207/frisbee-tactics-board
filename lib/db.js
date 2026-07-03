/*
 * @Author: skye 3016218068@tju.edu.cn
 * @Date: 2026-07-01 14:45:45
 * @LastEditors: skye 3016218068@tju.edu.cn
 * @LastEditTime: 2026-07-03 11:09:05
 * @FilePath: /frisbee-tactics-board/lib/db.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
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
    CREATE TABLE IF NOT EXISTS tactics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      frames JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
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
  initialized = true;
}

export function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    frames: row.frames,
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
    publishedAt: new Date(row.published_at).toISOString()
  };
}
