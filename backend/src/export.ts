import ExcelJS from "exceljs";
import { listPosts } from "./posts";
import { getTotals } from "./totals";

const POSTS_HEADERS = [
  "Date",
  "Platform",
  "Link",
  "Video?",
  "Likes",
  "Comments",
  "Shares",
  "Total Engagement",
  "Total Video Views",
  "Language",
  "Last Updated",
];

const TOTALS_HEADERS = [
  "",
  "NUMBER POSTS",
  "Likes",
  "Comments",
  "Shares",
  "TOTAL ENGAGEMENTS",
  "NUMBER of Videos",
  "TOTAL VIEWS",
];

export async function buildWorkbook(projectId: number): Promise<Buffer> {
  const [posts, totals] = await Promise.all([listPosts(projectId), getTotals(projectId)]);

  const workbook = new ExcelJS.Workbook();

  const postsSheet = workbook.addWorksheet("Posts");
  postsSheet.addRow(POSTS_HEADERS);
  for (const post of [...posts].reverse()) {
    postsSheet.addRow([
      post.date,
      post.platform,
      post.link,
      post.isVideo ? "yes" : "no",
      post.likes,
      post.comments,
      post.shares,
      post.totalEngagement,
      post.totalVideoViews ?? "",
      post.language,
      post.lastUpdated,
    ]);
  }
  postsSheet.getRow(1).font = { bold: true };
  postsSheet.columns.forEach((col) => {
    col.width = 18;
  });

  const totalsSheet = workbook.addWorksheet("TOTALS");
  totalsSheet.addRow(TOTALS_HEADERS);
  for (const row of totals) {
    totalsSheet.addRow([
      row.language,
      row.numberPosts,
      row.likes,
      row.comments,
      row.shares,
      row.totalEngagements,
      row.numberOfVideos,
      row.totalViews,
    ]);
  }
  totalsSheet.getRow(1).font = { bold: true };
  totalsSheet.columns.forEach((col) => {
    col.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
