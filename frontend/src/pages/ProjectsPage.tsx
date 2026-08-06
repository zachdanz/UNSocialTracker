import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Project } from "../lib/types";

interface ItemProps {
  project: Project;
  onChange: () => void;
}

function ProjectListItem({ project, onChange }: ItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRenameSave() {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await api.renameProject(project.id, trimmed);
      setRenaming(false);
      onChange();
    } catch (err: any) {
      setError(err.message || "Failed to rename project.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try {
      await api.duplicateProject(project.id);
      onChange();
    } catch (err: any) {
      setError(err.message || "Failed to duplicate project.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteProject(project.id);
      onChange();
    } catch (err: any) {
      setError(err.message || "Failed to delete project.");
      setBusy(false);
    }
  }

  if (renaming) {
    return (
      <li className="project-list-item">
        <div className="project-rename-row">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
          <button disabled={busy} onClick={handleRenameSave}>
            Save
          </button>
          <button
            disabled={busy}
            className="secondary"
            onClick={() => {
              setRenaming(false);
              setRenameValue(project.name);
            }}
          >
            Cancel
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </li>
    );
  }

  return (
    <li className="project-list-item">
      <div className="project-info">
        <Link className="project-link" to={`/projects/${project.id}`}>
          {project.name}
        </Link>
        <div className="project-stats">
          # of posts: {project.postCount} · # of engagements: {project.totalEngagement}
        </div>
        {error && <p className="form-error">{error}</p>}
      </div>
      <div className="project-menu">
        <button
          type="button"
          className="menu-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Project actions"
          disabled={busy}
        >
          ⋮
        </button>
        {menuOpen && (
          <div className="project-dropdown" onMouseLeave={() => setMenuOpen(false)}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setRenaming(true);
              }}
            >
              Rename
            </button>
            <button type="button" onClick={handleDuplicate}>
              Duplicate
            </button>
            <button type="button" className="danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || "Failed to load projects.");
    }
  }, []);

  useEffect(() => {
    loadProjects().finally(() => setLoading(false));
  }, [loadProjects]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!name.trim()) {
      setCreateError("Please enter a project name.");
      return;
    }
    setCreating(true);
    try {
      const project = await api.createProject(name.trim());
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create project.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>UN Social Media Campaign Tracker</h1>
        <p className="subtitle">Choose a project to view or add posts to, or start a new one.</p>
      </header>

      <form className="post-form" onSubmit={handleCreate}>
        <div className="field-row">
          <div className="field" style={{ flex: 3 }}>
            <label htmlFor="projectName">New project name</label>
            <input
              id="projectName"
              type="text"
              placeholder="e.g. Climate Week 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        {createError && <p className="form-error">{createError}</p>}
        <button type="submit" disabled={creating}>
          {creating ? "Creating…" : "+ New project"}
        </button>
        <p className="form-hint">Project names must be unique.</p>
      </form>

      <section className="table-section">
        <h2>Projects</h2>
        {loading && <p>Loading…</p>}
        {loadError && <p className="form-error">{loadError}</p>}
        {!loading && !loadError && projects.length === 0 && (
          <p className="empty-state">No projects yet — create one above to get started.</p>
        )}
        {!loading && !loadError && projects.length > 0 && (
          <ul className="project-list">
            {projects.map((project) => (
              <ProjectListItem key={project.id} project={project} onChange={loadProjects} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
