import { Router } from "express";
import { config } from "../config";
import { listPosts, updatePost } from "../posts";
import { listProjects } from "../projects";
import { getFetcher } from "../fetchers";

export const refreshAllRouter = Router();

refreshAllRouter.post("/", async (req, res) => {
  if (!config.refreshCronSecret) {
    res.status(500).json({ error: "REFRESH_CRON_SECRET is not configured on the server." });
    return;
  }
  if (req.header("X-Refresh-Secret") !== config.refreshCronSecret) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const projects = await listProjects();
    const results: {
      project: string;
      postId: number;
      platform: string;
      status: string;
      message?: string;
    }[] = [];
    let totalPosts = 0;

    for (const project of projects) {
      const posts = await listPosts(project.id);
      totalPosts += posts.length;

      for (const post of posts) {
        const fetcher = getFetcher(post.platform);
        if (!fetcher.supportsAutoFetch()) {
          results.push({ project: project.name, postId: post.id, platform: post.platform, status: "skipped" });
          continue;
        }
        try {
          const stats = await fetcher.fetchStats(post.link);
          await updatePost(project.id, post.id, {
            date: post.date,
            platform: post.platform,
            link: post.link,
            isVideo: stats.isVideo ?? post.isVideo,
            likes: stats.likes ?? post.likes,
            comments: stats.comments ?? post.comments,
            shares: stats.shares ?? post.shares,
            totalVideoViews: stats.videoViews ?? post.totalVideoViews,
            language: post.language,
          });
          results.push({ project: project.name, postId: post.id, platform: post.platform, status: "updated" });
        } catch (err: any) {
          results.push({
            project: project.name,
            postId: post.id,
            platform: post.platform,
            status: "error",
            message: err.message,
          });
        }
      }
    }

    res.json({ totalProjects: projects.length, totalPosts, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to refresh posts." });
  }
});
