import { Router, Request } from "express";
import { detectPlatform, isValidUrl } from "../platforms";
import { LANGUAGES, LanguageCode } from "../languages";
import { appendPost, getPost, listPosts, updatePost, PostInput } from "../posts";
import { getFetcher } from "../fetchers";

export const postsRouter = Router({ mergeParams: true });

type ProjectParams = { projectId: string };
type ProjectPostParams = { projectId: string; postId: string };

function isLanguage(value: unknown): value is LanguageCode {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

function parseInput(body: any): { input?: PostInput; error?: string } {
  const link = String(body.link || "").trim();
  if (!link || !isValidUrl(link)) {
    return { error: "A valid post link (http/https URL) is required." };
  }

  const platform = detectPlatform(link);
  if (!platform) {
    return {
      error:
        "Could not recognize this link's platform. Supported platforms: X, Facebook, WhatsApp, Instagram, LinkedIn, Threads, TikTok, VK, Weibo, Bilibili, Kuaishou, WeChat.",
    };
  }

  if (!isLanguage(body.language)) {
    return { error: `Language must be one of: ${LANGUAGES.join(", ")}.` };
  }

  const date = String(body.date || "").trim() || new Date().toISOString().slice(0, 10);
  const isVideo = Boolean(body.isVideo);

  return {
    input: {
      date,
      platform,
      link,
      isVideo,
      likes: toNonNegativeInt(body.likes),
      comments: toNonNegativeInt(body.comments),
      shares: toNonNegativeInt(body.shares),
      totalVideoViews: isVideo ? toNonNegativeInt(body.totalVideoViews) : null,
      language: body.language,
    },
  };
}

postsRouter.get("/", async (req: Request<ProjectParams>, res) => {
  try {
    const posts = await listPosts(Number(req.params.projectId));
    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to read posts." });
  }
});

postsRouter.post("/", async (req: Request<ProjectParams>, res) => {
  const { input, error } = parseInput(req.body || {});
  if (error || !input) {
    res.status(400).json({ error });
    return;
  }
  try {
    const post = await appendPost(Number(req.params.projectId), input);
    res.status(201).json(post);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save post." });
  }
});

postsRouter.put("/:postId", async (req: Request<ProjectPostParams>, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId)) {
    res.status(400).json({ error: "Invalid post id." });
    return;
  }
  const { input, error } = parseInput(req.body || {});
  if (error || !input) {
    res.status(400).json({ error });
    return;
  }
  try {
    const post = await updatePost(Number(req.params.projectId), postId, input);
    if (!post) {
      res.status(404).json({ error: "Post not found." });
      return;
    }
    res.json(post);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update post." });
  }
});

postsRouter.post("/:postId/refresh", async (req: Request<ProjectPostParams>, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId)) {
    res.status(400).json({ error: "Invalid post id." });
    return;
  }
  try {
    const projectId = Number(req.params.projectId);
    const post = await getPost(projectId, postId);
    if (!post) {
      res.status(404).json({ error: "Post not found." });
      return;
    }
    const fetcher = getFetcher(post.platform);
    if (!fetcher.supportsAutoFetch()) {
      res.json({
        autoFetchSupported: false,
        message: `Automatic refresh isn't set up yet for ${post.platform}. Update this post's stats manually.`,
        post,
      });
      return;
    }
    const stats = await fetcher.fetchStats(post.link);
    const updated = await updatePost(projectId, postId, {
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
    res.json({ autoFetchSupported: true, post: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to refresh post." });
  }
});
