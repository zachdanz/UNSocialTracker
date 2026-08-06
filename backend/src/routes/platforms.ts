import { Router } from "express";
import { listCapabilities } from "../fetchers";
import { LANGUAGES, LANGUAGE_LABELS } from "../languages";

export const platformsRouter = Router();

platformsRouter.get("/", (_req, res) => {
  res.json({
    platforms: listCapabilities(),
    languages: LANGUAGES.map((code) => ({ code, label: LANGUAGE_LABELS[code] })),
  });
});
