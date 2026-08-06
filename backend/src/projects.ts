import { getPool } from "./db";

export interface Project {
  id: number;
  name: string;
  createdAt: string;
  postCount: number;
  totalEngagement: number;
}

function validateName(rawName: string): string {
  const name = rawName.trim();
  if (!name) {
    throw new Error("Please enter a valid project name.");
  }
  if (name.length > 200) {
    throw new Error("Project name is too long (max 200 characters).");
  }
  return name;
}

export async function listProjects(): Promise<Project[]> {
  const db = getPool();
  const res = await db.query(`
    SELECT
      p.id,
      p.name,
      p.created_at,
      COUNT(posts.id)::int AS post_count,
      COALESCE(SUM(posts.total_engagement), 0)::int AS total_engagement
    FROM projects p
    LEFT JOIN posts ON posts.project_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);
  return res.rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    postCount: row.post_count,
    totalEngagement: row.total_engagement,
  }));
}

export async function createProject(rawName: string): Promise<Project> {
  const name = validateName(rawName);

  const db = getPool();
  try {
    const res = await db.query(
      `INSERT INTO projects (name) VALUES ($1) RETURNING id, name, created_at`,
      [name]
    );
    const row = res.rows[0];
    return { id: row.id, name: row.name, createdAt: row.created_at.toISOString(), postCount: 0, totalEngagement: 0 };
  } catch (err: any) {
    if (err.code === "23505") {
      throw new Error(`A project named "${name}" already exists.`);
    }
    throw err;
  }
}

export async function getProject(projectId: number): Promise<Project | null> {
  const db = getPool();
  const res = await db.query(
    `SELECT
       p.id, p.name, p.created_at,
       COUNT(posts.id)::int AS post_count,
       COALESCE(SUM(posts.total_engagement), 0)::int AS total_engagement
     FROM projects p
     LEFT JOIN posts ON posts.project_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [projectId]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    postCount: row.post_count,
    totalEngagement: row.total_engagement,
  };
}

export async function renameProject(projectId: number, rawName: string): Promise<Project | null> {
  const name = validateName(rawName);
  const db = getPool();
  try {
    const res = await db.query(`UPDATE projects SET name = $1 WHERE id = $2 RETURNING id`, [name, projectId]);
    if (!res.rows[0]) return null;
    return getProject(projectId);
  } catch (err: any) {
    if (err.code === "23505") {
      throw new Error(`A project named "${name}" already exists.`);
    }
    throw err;
  }
}

export async function deleteProject(projectId: number): Promise<boolean> {
  const db = getPool();
  const res = await db.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
  return (res.rowCount || 0) > 0;
}

async function findAvailableCopyName(db: ReturnType<typeof getPool>, baseName: string): Promise<string> {
  const existing = await db.query(`SELECT name FROM projects`);
  const taken = new Set(existing.rows.map((r) => r.name as string));
  let candidate = `${baseName} (copy)`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${baseName} (copy ${n})`;
    n += 1;
  }
  return candidate;
}

export async function duplicateProject(projectId: number): Promise<Project | null> {
  const db = getPool();
  const source = await getProject(projectId);
  if (!source) return null;

  const newName = await findAvailableCopyName(db, source.name);
  const insertRes = await db.query(`INSERT INTO projects (name) VALUES ($1) RETURNING id`, [newName]);
  const newProjectId = insertRes.rows[0].id;

  await db.query(
    `INSERT INTO posts (project_id, date, platform, link, is_video, likes, comments, shares, total_video_views, language)
     SELECT $1, date, platform, link, is_video, likes, comments, shares, total_video_views, language
     FROM posts WHERE project_id = $2`,
    [newProjectId, projectId]
  );

  return getProject(newProjectId);
}
