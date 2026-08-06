import { Pool } from "pg";
import { config } from "./config";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = config.databaseUrl();
  pool = new Pool({
    connectionString,
    // Hosted providers like Neon require TLS; local Postgres during development typically doesn't.
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  });
  return pool;
}

export async function migrate(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      platform TEXT NOT NULL,
      link TEXT NOT NULL,
      is_video BOOLEAN NOT NULL DEFAULT false,
      likes INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      total_engagement INTEGER GENERATED ALWAYS AS (likes + comments + shares) STORED,
      total_video_views INTEGER,
      language TEXT NOT NULL,
      last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS posts_project_id_idx ON posts(project_id);`);
}
