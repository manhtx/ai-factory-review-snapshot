import { Router } from "express";
import { defaultAdaptivePoller } from "../adaptiveIngestionPoller.js";

export const pollerRouter = Router();

pollerRouter.get("/api/poller/status", (_request, response) => {
  response.json(defaultAdaptivePoller.getStatus());
});

pollerRouter.post("/api/poller/trigger", async (request, response) => {
  const indicatorIds = Array.isArray(request.body?.indicatorIds)
    ? (request.body.indicatorIds as string[])
    : undefined;
  const result = await defaultAdaptivePoller.runPollCycle(indicatorIds);
  response.json(result);
});

pollerRouter.get("/api/mcp/tools/get_poller_status", (_request, response) => {
  response.json(defaultAdaptivePoller.getStatus());
});

pollerRouter.post("/api/mcp/tools/trigger_poller_cycle", async (request, response) => {
  const indicatorIds = Array.isArray(request.body?.indicatorIds)
    ? (request.body.indicatorIds as string[])
    : undefined;
  const result = await defaultAdaptivePoller.runPollCycle(indicatorIds);
  response.json(result);
});
