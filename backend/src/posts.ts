import { getPool } from "./db";
import { Platform } from "./platforms";
import { LanguageCode } from "./languages";

export interface Post {
  id: number;
  date: string;
  platform: Platform;
  link: string;
  isVideo: boolean;
  likes: number;
  comments: number;
  shares: number;
  totalEngagement: number;
  totalVideoViews: number | null;
  language: LanguageCode;
  lastUpdated: string;
}

export interface PostInput {
  date: string;
  platform: Platform;
  link: string;
  isVideo: boolean;
  likes: number;
  comments: number;
  shares: number;
  totalVideoViews: number | null;
  language: LanguageCode;
}

function rowToPost(row: any): Post {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    platform: row.platform,
    link: row.link,
    isVideo: row.is_video,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    totalEngagement: row.total_engagement,
    totalVideoViews: row.total_video_views,
    language: row.language,
    lastUpdated: row.last_updated.toISOString(),
  };
}

export async function listPosts(projectId: number): Promise<Post[]> {
  const db = getPool();
  const res = await db.query(`SELECT * FROM posts WHERE project_id = $1 ORDER BY id DESC`, [projectId]);
  return res.rows.map(rowToPost);
}

export async function appendPost(projectId: number, post: PostInput): Promise<Post> {
  const db = getPool();
  const res = await db.query(
    `INSERT INTO posts (project_id, date, platform, link, is_video, likes, comments, shares, total_video_views, language)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      projectId,
      post.date,
      post.platform,
      post.link,
      post.isVideo,
      post.likes,
      post.comments,
      post.shares,
      post.isVideo ? post.totalVideoViews ?? 0 : null,
      post.language,
    ]
  );
  return rowToPost(res.rows[0]);
}

export async function updatePost(projectId: number, postId: number, post: PostInput): Promise<Post | null> {
  const db = getPool();
  const res = await db.query(
    `UPDATE posts
     SET date = $1, platform = $2, link = $3, is_video = $4, likes = $5, comments = $6,
         shares = $7, total_video_views = $8, language = $9, last_updated = now()
     WHERE id = $10 AND project_id = $11
     RETURNING *`,
    [
      post.date,
      post.platform,
      post.link,
      post.isVideo,
      post.likes,
      post.comments,
      post.shares,
      post.isVideo ? post.totalVideoViews ?? 0 : null,
      post.language,
      postId,
      projectId,
    ]
  );
  return res.rows[0] ? rowToPost(res.rows[0]) : null;
}

export async function getPost(projectId: number, postId: number): Promise<Post | null> {
  const db = getPool();
  const res = await db.query(`SELECT * FROM posts WHERE id = $1 AND project_id = $2`, [postId, projectId]);
  return res.rows[0] ? rowToPost(res.rows[0]) : null;
}
