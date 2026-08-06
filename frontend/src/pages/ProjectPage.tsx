import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PostForm } from "../components/PostForm";
import { PostsTable } from "../components/PostsTable";
import { TotalsTable } from "../components/TotalsTable";
import { api, exportUrl, PostPayload } from "../lib/api";
import { Post, PlatformCapability, LanguageOption, Project, TotalsRow } from "../lib/types";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [totals, setTotals] = useState<TotalsRow[]>([]);
  const [capabilities, setCapabilities] = useState<PlatformCapability[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [languageFilter, setLanguageFilter] = useState("");

  const loadPosts = useCallback(async () => {
    if (!projectId) return;
    try {
      const [postsData, totalsData] = await Promise.all([
        api.listPosts(projectId),
        api.getTotals(projectId),
      ]);
      setPosts(postsData);
      setTotals(totalsData);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || "Failed to load posts.");
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      await Promise.all([
        loadPosts(),
        api
          .getPlatforms()
          .then((r) => {
            setCapabilities(r.platforms);
            setLanguages(r.languages);
          })
          .catch(() => {}),
        api
          .listProjects()
          .then((projects) => setProject(projects.find((p) => String(p.id) === projectId) || null))
          .catch(() => {}),
      ]);
      setLoading(false);
    })();
  }, [projectId, loadPosts]);

  async function handleCreate(payload: PostPayload) {
    if (!projectId) return;
    await api.createPost(projectId, payload);
    await loadPosts();
  }

  async function refreshAllVisible() {
    if (!projectId) return;
    setRefreshingAll(true);
    try {
      for (const post of posts) {
        try {
          await api.refreshPost(projectId, post.id);
        } catch {
          // individual failures surface per-row on next load; keep going
        }
      }
      await loadPosts();
    } finally {
      setRefreshingAll(false);
    }
  }

  if (!projectId) {
    return null;
  }

  const filteredPosts = languageFilter ? posts.filter((p) => p.language === languageFilter) : posts;

  return (
    <div className="app">
      <header>
        <Link className="back-link" to="/">
          ← All projects
        </Link>
        <h1>{project ? project.name : "Loading project…"}</h1>
        <p className="subtitle">
          Paste a post link to start tracking it, or{" "}
          <a href={exportUrl(projectId)} download>
            download this project as Excel ⬇
          </a>
          .
        </p>
      </header>

      <PostForm languages={languages} onSubmit={handleCreate} />

      <section className="table-section">
        <div className="table-toolbar">
          <h2>Tracked posts</h2>
          <div className="toolbar-controls">
            <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
              <option value="">All languages</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.code}
                </option>
              ))}
            </select>
            <button onClick={refreshAllVisible} disabled={refreshingAll || posts.length === 0}>
              {refreshingAll ? "Refreshing…" : "Refresh all"}
            </button>
          </div>
        </div>

        {loading && <p>Loading…</p>}
        {loadError && <p className="form-error">{loadError}</p>}
        {!loading && !loadError && (
          <PostsTable posts={filteredPosts} capabilities={capabilities} onChange={loadPosts} projectId={projectId} />
        )}
      </section>

      {!loading && !loadError && posts.length > 0 && (
        <section className="table-section">
          <h2>Totals by language</h2>
          <TotalsTable rows={totals} />
        </section>
      )}
    </div>
  );
}
