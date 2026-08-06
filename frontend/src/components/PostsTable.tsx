import { useState } from "react";
import { Post, PlatformCapability } from "../lib/types";
import { api } from "../lib/api";

interface Props {
  posts: Post[];
  capabilities: PlatformCapability[];
  onChange: () => void;
}

interface EditState {
  likes: string;
  comments: string;
  shares: string;
  totalVideoViews: string;
  isVideo: boolean;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatTimestamp(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function PostsTable({ posts, capabilities, onChange }: Props) {
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<number, string>>({});

  const supportsAuto = (platform: string) =>
    capabilities.find((c) => c.platform === platform)?.supportsAutoFetch ?? false;

  function startEdit(post: Post) {
    setEditingRow(post.rowNumber);
    setEdit({
      likes: String(post.likes),
      comments: String(post.comments),
      shares: String(post.shares),
      totalVideoViews: String(post.totalVideoViews ?? 0),
      isVideo: post.isVideo,
    });
  }

  async function saveEdit(post: Post) {
    if (!edit) return;
    setBusyRow(post.rowNumber);
    try {
      await api.updatePost(post.rowNumber, {
        link: post.link,
        date: post.date,
        language: post.language,
        isVideo: edit.isVideo,
        likes: Number(edit.likes) || 0,
        comments: Number(edit.comments) || 0,
        shares: Number(edit.shares) || 0,
        totalVideoViews: edit.isVideo ? Number(edit.totalVideoViews) || 0 : null,
      });
      setEditingRow(null);
      setEdit(null);
      onChange();
    } catch (err: any) {
      setRowMessage((m) => ({ ...m, [post.rowNumber]: err.message || "Failed to save." }));
    } finally {
      setBusyRow(null);
    }
  }

  async function refresh(post: Post) {
    setBusyRow(post.rowNumber);
    setRowMessage((m) => ({ ...m, [post.rowNumber]: "" }));
    try {
      const result = await api.refreshPost(post.rowNumber);
      if (!result.autoFetchSupported) {
        setRowMessage((m) => ({
          ...m,
          [post.rowNumber]: result.message || "Automatic refresh not available — update manually.",
        }));
        startEdit(post);
      } else {
        onChange();
      }
    } catch (err: any) {
      setRowMessage((m) => ({ ...m, [post.rowNumber]: err.message || "Refresh failed." }));
    } finally {
      setBusyRow(null);
    }
  }

  if (posts.length === 0) {
    return <p className="empty-state">No posts tracked yet — add one above to get started.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Platform</th>
            <th>Link</th>
            <th>Video?</th>
            <th>Likes</th>
            <th>Comments</th>
            <th>Shares</th>
            <th>Total Engagement</th>
            <th>Video Views</th>
            <th>Language</th>
            <th>Last Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const isEditing = editingRow === post.rowNumber;
            const busy = busyRow === post.rowNumber;
            return (
              <tr key={post.rowNumber}>
                <td>{formatDate(post.date)}</td>
                <td>{post.platform}</td>
                <td className="link-cell">
                  <a href={post.link} target="_blank" rel="noreferrer">
                    open ↗
                  </a>
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="checkbox"
                      checked={edit!.isVideo}
                      onChange={(e) => setEdit((s) => (s ? { ...s, isVideo: e.target.checked } : s))}
                    />
                  ) : post.isVideo ? (
                    "yes"
                  ) : (
                    "no"
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      value={edit!.likes}
                      onChange={(e) => setEdit((s) => (s ? { ...s, likes: e.target.value } : s))}
                    />
                  ) : (
                    post.likes
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      value={edit!.comments}
                      onChange={(e) => setEdit((s) => (s ? { ...s, comments: e.target.value } : s))}
                    />
                  ) : (
                    post.comments
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      value={edit!.shares}
                      onChange={(e) => setEdit((s) => (s ? { ...s, shares: e.target.value } : s))}
                    />
                  ) : (
                    post.shares
                  )}
                </td>
                <td>{post.totalEngagement}</td>
                <td>
                  {isEditing && edit!.isVideo ? (
                    <input
                      type="number"
                      min={0}
                      value={edit!.totalVideoViews}
                      onChange={(e) => setEdit((s) => (s ? { ...s, totalVideoViews: e.target.value } : s))}
                    />
                  ) : (
                    post.totalVideoViews ?? ""
                  )}
                </td>
                <td>{post.language}</td>
                <td className="timestamp-cell">{formatTimestamp(post.lastUpdated)}</td>
                <td className="actions-cell">
                  {isEditing ? (
                    <>
                      <button disabled={busy} onClick={() => saveEdit(post)}>
                        Save
                      </button>
                      <button
                        disabled={busy}
                        className="secondary"
                        onClick={() => {
                          setEditingRow(null);
                          setEdit(null);
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => refresh(post)}
                        title={
                          supportsAuto(post.platform)
                            ? "Fetch latest stats automatically"
                            : "Automatic fetch not set up for this platform yet — will prompt for manual entry"
                        }
                      >
                        {busy ? "…" : "Refresh"}
                      </button>
                      <button disabled={busy} className="secondary" onClick={() => startEdit(post)}>
                        Edit
                      </button>
                    </>
                  )}
                  {rowMessage[post.rowNumber] && (
                    <div className="row-message">{rowMessage[post.rowNumber]}</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
