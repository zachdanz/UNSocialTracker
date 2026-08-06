import { Router, Request } from "express";
import { buildWorkbook } from "../export";
import { getProject } from "../projects";

export const exportRouter = Router({ mergeParams: true });

exportRouter.get("/", async (req: Request<{ projectId: string }>, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const project = await getProject(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    const buffer = await buildWorkbook(projectId);
    const filename = `${project.name.replace(/[^a-z0-9 _-]/gi, "")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to export spreadsheet." });
  }
});
