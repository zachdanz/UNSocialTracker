import { getPool } from "./db";
import { LANGUAGES, LanguageCode } from "./languages";

export interface TotalsRow {
  language: LanguageCode | "TOTAL";
  numberPosts: number;
  likes: number;
  comments: number;
  shares: number;
  totalEngagements: number;
  numberOfVideos: number;
  totalViews: number;
}

export async function getTotals(projectId: number): Promise<TotalsRow[]> {
  const db = getPool();
  const res = await db.query(
    `SELECT
       language,
       COUNT(*)::int AS number_posts,
       COALESCE(SUM(likes), 0)::int AS likes,
       COALESCE(SUM(comments), 0)::int AS comments,
       COALESCE(SUM(shares), 0)::int AS shares,
       COALESCE(SUM(total_engagement), 0)::int AS total_engagements,
       COUNT(*) FILTER (WHERE is_video)::int AS number_of_videos,
       COALESCE(SUM(total_video_views), 0)::int AS total_views
     FROM posts
     WHERE project_id = $1
     GROUP BY language`,
    [projectId]
  );

  const byLanguage = new Map<string, TotalsRow>();
  for (const row of res.rows) {
    byLanguage.set(row.language, {
      language: row.language,
      numberPosts: row.number_posts,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      totalEngagements: row.total_engagements,
      numberOfVideos: row.number_of_videos,
      totalViews: row.total_views,
    });
  }

  const rows: TotalsRow[] = LANGUAGES.map(
    (code) =>
      byLanguage.get(code) || {
        language: code,
        numberPosts: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        totalEngagements: 0,
        numberOfVideos: 0,
        totalViews: 0,
      }
  );

  const total = rows.reduce<TotalsRow>(
    (acc, row) => ({
      language: "TOTAL",
      numberPosts: acc.numberPosts + row.numberPosts,
      likes: acc.likes + row.likes,
      comments: acc.comments + row.comments,
      shares: acc.shares + row.shares,
      totalEngagements: acc.totalEngagements + row.totalEngagements,
      numberOfVideos: acc.numberOfVideos + row.numberOfVideos,
      totalViews: acc.totalViews + row.totalViews,
    }),
    {
      language: "TOTAL",
      numberPosts: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      totalEngagements: 0,
      numberOfVideos: 0,
      totalViews: 0,
    }
  );

  return [...rows, total];
}
