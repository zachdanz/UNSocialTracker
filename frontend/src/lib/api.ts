import { PlatformCapability, Post, LanguageOption, Project, TotalsRow } from "./types";

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

export function exportUrl(projectId: string): string {
  return `/api/projects/${projectId}/export.xlsx`;
}

export const api = {
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (name: string) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name }) }),
  renameProject: (projectId: number, name: string) =>
    request<Project>(`/api/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  duplicateProject: (projectId: number) =>
    request<Project>(`/api/projects/${projectId}/duplicate`, { method: "POST" }),
  deleteProject: (projectId: number) =>
    request<void>(`/api/projects/${projectId}`, { method: "DELETE" }),

  listPosts: (projectId: string) => request<Post[]>(`/api/projects/${projectId}/posts`),
  createPost: (projectId: string, payload: PostPayload) =>
    request<Post>(`/api/projects/${projectId}/posts`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePost: (projectId: string, postId: number, payload: PostPayload) =>
    request<Post>(`/api/projects/${projectId}/posts/${postId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  refreshPost: (projectId: string, postId: number) =>
    request<{ autoFetchSupported: boolean; message?: string; post: Post }>(
      `/api/projects/${projectId}/posts/${postId}/refresh`,
      { method: "POST" }
    ),

  getTotals: (projectId: string) => request<TotalsRow[]>(`/api/projects/${projectId}/totals`),

  getPlatforms: () =>
    request<{ platforms: PlatformCapability[]; languages: LanguageOption[] }>("/api/platforms"),
};
