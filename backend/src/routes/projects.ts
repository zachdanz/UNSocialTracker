import { Router } from "express";
import { createProject, listProjects } from "../projects";

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
  try {
    const project = await createProject(name);
    res.status(201).json(project);
  } catch (err: any) {
    const status = err.message?.includes("already exists") ? 409 : 500;
    res.status(status).json({ error: err.message || "Failed to create project." });
  }
});
