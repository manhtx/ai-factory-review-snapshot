import { Router, type Request, type Response } from "express";
import {
  SOVEREIGN_BANKING_PROFILES,
  DEFAULT_BILATERAL_EXPOSURE_WEIGHTS,
  simulateLiquidityCascadeContagion,
  exportContagionSnapshotToCSV,
  exportContagionSnapshotToMarkdown,
} from "../../src/app/data/liquidityCascadeContagion.js";

export const contagionRouter = Router();

export const getContagionCatalogHandler = (_request: Request, response: Response) => {
  response.json({
    sovereignBankingProfiles: SOVEREIGN_BANKING_PROFILES,
    bilateralExposures: DEFAULT_BILATERAL_EXPOSURE_WEIGHTS,
    countryCount: Object.keys(SOVEREIGN_BANKING_PROFILES).length,
    defaultShockScenarios: [
      {
        name: "Southern Europe Sovereign Debt Squeeze",
        shocks: [{ epicenterCountry: "IT", initialSovereignCdsShockBps: 250, initialBankCapitalLossPct: 3.5 }],
      },
      {
        name: "Transatlantic Banking Liquidity Freeze",
        shocks: [
          { epicenterCountry: "US", initialSovereignCdsShockBps: 80, initialBankCapitalLossPct: 4.0, interbankLiquidityFreeze: true },
          { epicenterCountry: "GB", initialSovereignCdsShockBps: 120, initialBankCapitalLossPct: 4.5, interbankLiquidityFreeze: true },
        ],
      },
      {
        name: "Emerging Market Debt & FX Basis Squeeze",
        shocks: [
          { epicenterCountry: "VN", initialSovereignCdsShockBps: 300, initialBankCapitalLossPct: 5.0 },
          { epicenterCountry: "BR", initialSovereignCdsShockBps: 350, initialBankCapitalLossPct: 6.0 },
        ],
      },
    ],
  });
};

export const simulateLiquidityContagionHandler = (request: Request, response: Response) => {
  try {
    const { shocks, simulatedAt } = request.body || {};
    const snapshot = simulateLiquidityCascadeContagion(shocks, simulatedAt);
    response.json(snapshot);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to simulate liquidity contagion",
    });
  }
};

export const exportContagionDossierHandler = (request: Request, response: Response) => {
  try {
    const { shocks, format = "markdown", simulatedAt } = request.body || {};
    const snapshot = simulateLiquidityCascadeContagion(shocks, simulatedAt);

    if (format === "csv") {
      const csv = exportContagionSnapshotToCSV(snapshot);
      response.setHeader("Content-Type", "text/csv");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="contagion-${snapshot.snapshotId}.csv"`
      );
      return response.send(csv);
    }

    if (format === "markdown") {
      const md = exportContagionSnapshotToMarkdown(snapshot);
      response.setHeader("Content-Type", "text/markdown");
      return response.send(md);
    }

    return response.json({
      snapshot,
      markdown: exportContagionSnapshotToMarkdown(snapshot),
      csv: exportContagionSnapshotToCSV(snapshot),
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to export contagion dossier",
    });
  }
};


contagionRouter.get("/api/v1/macro/contagion/catalog", getContagionCatalogHandler);
contagionRouter.get("/api/mcp/tools/get_contagion_catalog", getContagionCatalogHandler);
contagionRouter.post("/api/v1/macro/contagion/simulate", simulateLiquidityContagionHandler);
contagionRouter.post("/api/mcp/tools/simulate_liquidity_contagion", simulateLiquidityContagionHandler);
contagionRouter.post("/api/v1/macro/contagion/dossier", exportContagionDossierHandler);
contagionRouter.post("/api/mcp/tools/export_contagion_dossier", exportContagionDossierHandler);
