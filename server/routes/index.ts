import type { Application } from "express";
import { pollerRouter } from "./pollerRouter.js";
import { telemetryRouter } from "./telemetryRouter.js";
import { alertsRouter } from "./alertsRouter.js";
import { providerRouter } from "./providerRouter.js";
import { evidenceRouter } from "./evidenceRouter.js";
import { scenarioRouter } from "./scenarioRouter.js";
import { factorAttributionRouter } from "./factorAttributionRouter.js";
import { regimeMarkovRouter } from "./regimeMarkovRouter.js";
import { contagionRouter } from "./contagionRouter.js";
import { analyticsRouter } from "./analyticsRouter.js";

export { pollerRouter } from "./pollerRouter.js";
export { telemetryRouter } from "./telemetryRouter.js";
export { alertsRouter } from "./alertsRouter.js";
export { providerRouter } from "./providerRouter.js";
export { evidenceRouter } from "./evidenceRouter.js";
export { scenarioRouter } from "./scenarioRouter.js";
export { factorAttributionRouter } from "./factorAttributionRouter.js";
export { regimeMarkovRouter } from "./regimeMarkovRouter.js";
export { contagionRouter } from "./contagionRouter.js";
export { analyticsRouter } from "./analyticsRouter.js";

export function registerModularRoutes(app: Application): void {
  app.use(telemetryRouter);
  app.use(pollerRouter);
  app.use(alertsRouter);
  app.use(providerRouter);
  app.use(evidenceRouter);
  app.use(scenarioRouter);
  app.use(factorAttributionRouter);
  app.use(regimeMarkovRouter);
  app.use(contagionRouter);
  app.use(analyticsRouter);
}
