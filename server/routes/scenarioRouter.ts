import { Router, type Request, type Response } from "express";
import {
  PREDEFINED_SCENARIO_TEMPLATES,
  runDynamicStressSimulation,
  exportStressDossierToCSV,
  exportStressDossierToMarkdown,
  type CustomShockParameters,
} from "../../src/app/data/scenarioStressGenerator.js";
import { getPredefinedInstitutionalAssetUniverse } from "../../src/app/data/crossAssetRiskMatrix.js";

export const scenarioRouter = Router();

export const getScenarioTemplatesHandler = (_request: Request, response: Response) => {
  response.json({
    templates: PREDEFINED_SCENARIO_TEMPLATES,
    availableUniverse: getPredefinedInstitutionalAssetUniverse().map((a) => ({
      id: a.id,
      name: a.name,
      assetClass: a.assetClass,
      country: a.country,
      baseVol: a.volatilityAnnualized,
    })),
  });
};

export const runStressSimulationHandler = (request: Request, response: Response) => {
  try {
    const params = request.body as CustomShockParameters;
    if (!params || typeof params.rateShockBps !== "number" || typeof params.equityShockPct !== "number") {
      return response.status(400).json({
        error: "Invalid shock parameters: rateShockBps and equityShockPct are required numbers.",
      });
    }

    const simulation = runDynamicStressSimulation(params, request.body.portfolioAssets);
    response.json(simulation);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to run stress simulation",
    });
  }
};

export const exportStressDossierHandler = (request: Request, response: Response) => {
  try {
    const { params, format = "markdown", portfolioAssets } = request.body;
    if (!params || typeof params.rateShockBps !== "number" || typeof params.equityShockPct !== "number") {
      return response.status(400).json({
        error: "Invalid shock parameters: rateShockBps and equityShockPct are required numbers.",
      });
    }

    const simulation = runDynamicStressSimulation(params, portfolioAssets);

    if (format === "csv") {
      const csv = exportStressDossierToCSV(simulation);
      response.setHeader("Content-Type", "text/csv");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="stress-dossier-${simulation.simulationId}.csv"`
      );
      return response.send(csv);
    }

    if (format === "markdown") {
      const md = exportStressDossierToMarkdown(simulation);
      response.setHeader("Content-Type", "text/markdown");
      return response.send(md);
    }

    return response.json({
      simulation,
      markdown: exportStressDossierToMarkdown(simulation),
      csv: exportStressDossierToCSV(simulation),
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to export stress dossier",
    });
  }
};

scenarioRouter.get("/api/v1/macro/stress/templates", getScenarioTemplatesHandler);
scenarioRouter.get("/api/mcp/tools/get_stress_scenario_templates", getScenarioTemplatesHandler);
scenarioRouter.post("/api/v1/macro/stress/simulate", runStressSimulationHandler);
scenarioRouter.post("/api/mcp/tools/run_dynamic_stress_simulation", runStressSimulationHandler);
scenarioRouter.post("/api/v1/macro/stress/dossier", exportStressDossierHandler);
scenarioRouter.post("/api/mcp/tools/export_stress_dossier", exportStressDossierHandler);
