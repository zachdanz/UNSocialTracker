import { Router, Request } from "express";
import { getTotals } from "../totals";

export const totalsRouter = Router({ mergeParams: true });

totalsRouter.get("/", async (req: Request<{ projectId: string }>, res) => {
  try {
    const totals = await getTotals(Number(req.params.projectId));
    res.json(totals);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load totals." });
  }
});
