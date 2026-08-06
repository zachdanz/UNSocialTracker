import { Router } from "express";
import { createProject, deleteProject, duplicateProject, listProjects, renameProject } from "../projects";

export const projectsRouter = Router();

function conflictAware(err: any, res: any, fallback: string) {
  const status = err.message?.includes("already exists") ? 409 : 500;
  res.status(status).json({ error: err.message || fallback });
}

projectsRouter.get("/", async (_req, res) => {
  try {
    const projects = await listProjects();
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load projects." });
  }
});

projectsRouter.post("/", async (req, res) => {
  const name = String((req.body || {}).name || "").trim();
  if (!name) {
    res.status(400).json({ error: "A project name is required." });
    return;
  }
  try {
    const project = await createProject(name);
    res.status(201).json(project);
  } catch (err: any) {
    conflictAware(err, res, "Failed to create project.");
  }
});

projectsRouter.patch("/:projectId", async (req, res) => {
  const name = String((req.body || {}).name || "").trim();
  if (!name) {
    res.status(400).json({ error: "A project name is required." });
    return;
  }
  try {
    const project = await renameProject(Number(req.params.projectId), name);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json(project);
  } catch (err: any) {
    conflictAware(err, res, "Failed to rename project.");
  }
});

projectsRouter.post("/:projectId/duplicate", async (req, res) => {
  try {
    const project = await duplicateProject(Number(req.params.projectId));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to duplicate project." });
  }
});

projectsRouter.delete("/:projectId", async (req, res) => {
  try {
    const deleted = await deleteProject(Number(req.params.projectId));
    if (!deleted) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete project." });
  }
});
