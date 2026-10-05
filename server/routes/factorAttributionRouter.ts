import { Router, type Request, type Response } from "express";
import {
  performMultiFactorAttribution,
  exportFactorAttributionToCSV,
  exportFactorAttributionToMarkdown,
  MACRO_FACTORS,
} from "../../src/app/data/multiFactorAttribution.js";

export const factorAttributionRouter = Router();

export const getMacroFactorsCatalogHandler = (_request: Request, response: Response) => {
  response.json({
    factors: MACRO_FACTORS,
    factorCount: Object.keys(MACRO_FACTORS).length,
  });
};

export const decomposeFactorsHandler = (request: Request, response: Response) => {
  try {
    const { portfolioAssets, executedAt } = request.body || {};
    const snapshot = performMultiFactorAttribution(portfolioAssets, executedAt);
    response.json(snapshot);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to decompose macro factors",
    });
  }
};

export const exportFactorDossierHandler = (request: Request, response: Response) => {
  try {
    const { portfolioAssets, format = "markdown", executedAt } = request.body || {};
    const snapshot = performMultiFactorAttribution(portfolioAssets, executedAt);

    if (format === "csv") {
      const csv = exportFactorAttributionToCSV(snapshot);
      response.setHeader("Content-Type", "text/csv");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="factor-attribution-${snapshot.snapshotId}.csv"`
      );
      return response.send(csv);
    }

    if (format === "markdown") {
      const md = exportFactorAttributionToMarkdown(snapshot);
      response.setHeader("Content-Type", "text/markdown");
      return response.send(md);
    }

    return response.json({
      snapshot,
      markdown: exportFactorAttributionToMarkdown(snapshot),
      csv: exportFactorAttributionToCSV(snapshot),
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to export factor dossier",
    });
  }
};

factorAttributionRouter.get("/api/v1/macro/factors/catalog", getMacroFactorsCatalogHandler);
factorAttributionRouter.get("/api/mcp/tools/get_macro_factors_catalog", getMacroFactorsCatalogHandler);
factorAttributionRouter.post("/api/v1/macro/factors/decompose", decomposeFactorsHandler);
factorAttributionRouter.post("/api/mcp/tools/decompose_macro_factors", decomposeFactorsHandler);
factorAttributionRouter.post("/api/v1/macro/factors/dossier", exportFactorDossierHandler);
factorAttributionRouter.post("/api/mcp/tools/export_factor_dossier", exportFactorDossierHandler);
