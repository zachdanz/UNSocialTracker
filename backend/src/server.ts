import express from "express";
import cors from "cors";
import path from "path";
import { config } from "./config";
import { migrate } from "./db";
import { postsRouter } from "./routes/posts";
import { projectsRouter } from "./routes/projects";
import { totalsRouter } from "./routes/totals";
import { exportRouter } from "./routes/export";
import { refreshAllRouter } from "./routes/refreshAll";
import { platformsRouter } from "./routes/platforms";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/projects/:projectId/posts", postsRouter);
app.use("/api/projects/:projectId/totals", totalsRouter);
app.use("/api/projects/:projectId/export.xlsx", exportRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/refresh-all", refreshAllRouter);
app.use("/api/platforms", platformsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(frontendDist));
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

async function start(): Promise<void> {
  try {
    await migrate();
    console.log("Database schema verified.");
  } catch (err: any) {
    console.error("Warning: could not connect to / migrate the database on startup:", err.message);
    console.error("The server will still start, but API calls will fail until this is fixed.");
  }

  app.listen(config.port, () => {
    console.log(`UNSocialTracker server listening on port ${config.port}`);
  });
}

start();
