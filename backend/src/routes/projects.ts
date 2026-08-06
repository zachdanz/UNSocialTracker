import { Router } from "express";
import { createProject, listProjects } from "../registry";

export const projectsRouter = Router();

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
  if (name.length > 100) {
    res.status(400).json({ error: "Project name is too long (max 100 characters)." });
    return;
  }
  try {
    const project = await createProject(name);
    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create project." });
  }
});
