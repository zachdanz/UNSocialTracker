import { getPool } from "./db";

export interface Project {
  id: number;
  name: string;
  createdAt: string;
}

export async function listProjects(): Promise<Project[]> {
  const db = getPool();
  const res = await db.query(
    `SELECT id, name, created_at FROM projects ORDER BY created_at DESC`
  );
  return res.rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createProject(rawName: string): Promise<Project> {
  const name = rawName.trim();
  if (!name) {
    throw new Error("Please enter a valid project name.");
  }
  if (name.length > 200) {
    throw new Error("Project name is too long (max 200 characters).");
  }

  const db = getPool();
  try {
    const res = await db.query(
      `INSERT INTO projects (name) VALUES ($1) RETURNING id, name, created_at`,
      [name]
    );
    const row = res.rows[0];
    return { id: row.id, name: row.name, createdAt: row.created_at.toISOString() };
  } catch (err: any) {
    if (err.code === "23505") {
      throw new Error(`A project named "${name}" already exists.`);
    }
    throw err;
  }
}

export async function getProject(projectId: number): Promise<Project | null> {
  const db = getPool();
  const res = await db.query(`SELECT id, name, created_at FROM projects WHERE id = $1`, [projectId]);
  const row = res.rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, createdAt: row.created_at.toISOString() };
}
