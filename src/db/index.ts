import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

const { Pool } = pg;

export async function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.includes('YOUR_PASSWORD')) {
    throw new Error(
      'Set DATABASE_URL in server/.env with your real Supabase database password.',
    );
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const db = drizzle(pool, { schema });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS children (
      id SERIAL PRIMARY KEY,
      parent_id TEXT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE children ADD COLUMN IF NOT EXISTS parent_id TEXT;
    ALTER TABLE children ADD COLUMN IF NOT EXISTS buddy_id TEXT NOT NULL DEFAULT 'dino';

    CREATE TABLE IF NOT EXISTS learning_sessions (
      id SERIAL PRIMARY KEY,
      parent_id TEXT,
      child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      maths_correct INTEGER NOT NULL,
      maths_total INTEGER NOT NULL,
      english_correct INTEGER NOT NULL,
      english_total INTEGER NOT NULL,
      stars INTEGER NOT NULL,
      skills JSONB NOT NULL DEFAULT '[]'::jsonb
    );

    ALTER TABLE learning_sessions ADD COLUMN IF NOT EXISTS parent_id TEXT;

    CREATE TABLE IF NOT EXISTS parent_consents (
      parent_id TEXT PRIMARY KEY,
      accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  return db;
}

export type Database = Awaited<ReturnType<typeof createDb>>;
