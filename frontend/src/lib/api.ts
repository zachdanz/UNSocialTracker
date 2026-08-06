import { PlatformCapability, Post, LanguageOption } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body as T;
}

export interface PostPayload {
  link: string;
  date: string;
  language: string;
  isVideo: boolean;
  likes: number;
  comments: number;
  shares: number;
  totalVideoViews: number | null;
}

export const api = {
  listPosts: () => request<Post[]>("/api/posts"),
  createPost: (payload: PostPayload) =>
    request<Post>("/api/posts", { method: "POST", body: JSON.stringify(payload) }),
  updatePost: (row: number, payload: PostPayload) =>
    request<Post>(`/api/posts/${row}`, { method: "PUT", body: JSON.stringify(payload) }),
  refreshPost: (row: number) =>
    request<{ autoFetchSupported: boolean; message?: string; post: Post }>(
      `/api/posts/${row}/refresh`,
      { method: "POST" }
    ),
  getPlatforms: () =>
    request<{ platforms: PlatformCapability[]; languages: LanguageOption[] }>("/api/platforms"),
};
