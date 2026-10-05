import { Router } from "express";
import {
  listAlertEvents,
  listAlerts,
} from "../alerts.js";
import {
  shouldUseSupabaseStorage,
  supabaseListAlertEvents,
  supabaseListAlerts,
} from "../supabase.js";
import { buildManagedStorageErrorResponse } from "../storageErrors.js";

export const alertsRouter = Router();

alertsRouter.get("/api/alerts", async (_request, response) => {
  try {
    response.json(
      shouldUseSupabaseStorage() ? await supabaseListAlerts() : listAlerts(),
    );
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

alertsRouter.get("/api/alert-events", async (_request, response) => {
  try {
    response.json(
      shouldUseSupabaseStorage()
        ? await supabaseListAlertEvents()
        : listAlertEvents(),
    );
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});
