import { PlatformCapability, Post, LanguageOption, Project } from "./types";

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
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (name: string) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name }) }),

  listPosts: (projectId: string) => request<Post[]>(`/api/projects/${projectId}/posts`),
  createPost: (projectId: string, payload: PostPayload) =>
    request<Post>(`/api/projects/${projectId}/posts`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePost: (projectId: string, row: number, payload: PostPayload) =>
    request<Post>(`/api/projects/${projectId}/posts/${row}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  refreshPost: (projectId: string, row: number) =>
    request<{ autoFetchSupported: boolean; message?: string; post: Post }>(
      `/api/projects/${projectId}/posts/${row}/refresh`,
      { method: "POST" }
    ),

  getPlatforms: () =>
    request<{ platforms: PlatformCapability[]; languages: LanguageOption[] }>("/api/platforms"),
};
