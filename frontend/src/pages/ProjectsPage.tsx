import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Project } from "../lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listProjects()
      .then((data) => {
        setProjects(data);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err.message || "Failed to load projects."))
      .finally(() => setLoading(false));
  }, []);

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
        <p className="subtitle">
          Choose a project to view or add posts to, or start a new one.
        </p>
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
              <li key={project.id} className="project-list-item">
                <Link className="project-link" to={`/projects/${project.id}`}>
                  {project.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
