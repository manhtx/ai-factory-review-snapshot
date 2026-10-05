import { Router, type Request, type Response } from "express";
import {
  MARKOV_REGIMES,
  PORTFOLIO_ASSET_CLASSES,
  predictRegimeTransitionsAndRebalance,
  exportRegimeMarkovSnapshotToCSV,
  exportRegimeMarkovSnapshotToMarkdown,
} from "../../src/app/data/regimeMarkovPredictor.js";

export const regimeMarkovRouter = Router();

export const getMacroRegimesCatalogHandler = (_request: Request, response: Response) => {
  response.json({
    regimes: MARKOV_REGIMES,
    assetClasses: PORTFOLIO_ASSET_CLASSES,
    regimeCount: Object.keys(MARKOV_REGIMES).length,
    assetClassCount: Object.keys(PORTFOLIO_ASSET_CLASSES).length,
  });
};

export const forecastRegimeMarkovHandler = (request: Request, response: Response) => {
  try {
    const { inputs, currentPortfolioWeights, executedAt } = request.body || {};
    const snapshot = predictRegimeTransitionsAndRebalance(
      inputs,
      currentPortfolioWeights,
      executedAt
    );
    response.json(snapshot);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to forecast regime transitions",
    });
  }
};

export const exportRegimeMarkovDossierHandler = (request: Request, response: Response) => {
  try {
    const { inputs, currentPortfolioWeights, format = "markdown", executedAt } = request.body || {};
    const snapshot = predictRegimeTransitionsAndRebalance(
      inputs,
      currentPortfolioWeights,
      executedAt
    );

    if (format === "csv") {
      const csv = exportRegimeMarkovSnapshotToCSV(snapshot);
      response.setHeader("Content-Type", "text/csv");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="regime-markov-${snapshot.snapshotId}.csv"`
      );
      return response.send(csv);
    }

    if (format === "markdown") {
      const md = exportRegimeMarkovSnapshotToMarkdown(snapshot);
      response.setHeader("Content-Type", "text/markdown");
      return response.send(md);
    }

    return response.json({
      snapshot,
      markdown: exportRegimeMarkovSnapshotToMarkdown(snapshot),
      csv: exportRegimeMarkovSnapshotToCSV(snapshot),
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to export regime Markov dossier",
    });
  }
};

regimeMarkovRouter.get("/api/v1/macro/regimes/catalog", getMacroRegimesCatalogHandler);
regimeMarkovRouter.get("/api/mcp/tools/get_macro_regimes_catalog", getMacroRegimesCatalogHandler);
regimeMarkovRouter.post("/api/v1/macro/regimes/markov/forecast", forecastRegimeMarkovHandler);
regimeMarkovRouter.post("/api/mcp/tools/forecast_regime_markov", forecastRegimeMarkovHandler);
regimeMarkovRouter.post("/api/v1/macro/regimes/markov/dossier", exportRegimeMarkovDossierHandler);
regimeMarkovRouter.post("/api/mcp/tools/export_regime_markov_dossier", exportRegimeMarkovDossierHandler);
