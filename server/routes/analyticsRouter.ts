import { Router, type Request, type Response } from "express";
import {
  calculateVietnamCreditRegime,
  calculateVietnamCreditRegimeSeries,
  type VietnamCreditRegimeResult,
  type VietnamCreditRegimeOptions,
  type IndicatorInput,
} from "../analytics/vietnamCreditRegime.js";
import {
  calculateLiquidityAdjustedBreakeven,
  type BreakevenAdjustmentResult,
  type BreakevenAdjustmentOptions,
  type YieldInput,
} from "../analytics/breakevenAdjuster.js";
import {
  calculateFxFixingBuffer,
  type FxFixingBufferResult,
  type FxFixingBufferOptions,
  type FxFixingBufferInput,
  type NumericOrObservation,
} from "../analytics/fxFixingBuffer.js";
import { db } from "../db.js";


function getLatestObservation(indicatorId: string): {
  value: number;
  date: string;
  sourceName: string;
  seriesId: string;
} | null {
  try {
    const row = db
      .prepare(
        `
      SELECT value, period, source_name, source_series_id
      FROM observations
      WHERE indicator_id = ?
      ORDER BY period DESC, vintage DESC, ingested_at DESC
      LIMIT 1
    `
      )
      .get(indicatorId) as
      | { value: number; period: string; source_name: string; source_series_id: string | null }
      | undefined;

    if (!row) return null;
    return {
      value: row.value,
      date: row.period,
      sourceName: row.source_name,
      seriesId: row.source_series_id || indicatorId,
    };
  } catch {
    return null;
  }
}

export const getAnalyticsCatalogHandler = (_request: Request, response: Response) => {
  response.json({
    modules: [
      {
        id: "vietnam-credit-regime",
        name: "Vietnam Credit Growth vs Property Price Decoupling Monitor",
        endpoint: "/api/v1/analytics/vietnam-credit-regime",
        description:
          "Monitors credit expansion vs real estate price inflation divergence in Vietnam with strict fact/inference separation.",
        indicators: ["credit-growth-vn", "apartment-price-vn"],
        factOutputs: ["creditGrowthYoY", "propertyPriceGrowthYoY", "rawSpread"],
        inferenceOutputs: ["regime", "decouplingSpread", "severityScore", "methodology"],
      },
      {
        id: "breakeven-adjuster",
        name: "TIPS Liquidity-Adjusted Breakeven Analytics",
        endpoint: "/api/v1/analytics/breakeven",
        description:
          "Computes inflation expectations adjusted for TIPS illiquidity premia.",
        indicators: ["nominal-yield", "tips-yield"],
        factOutputs: ["nominalYield", "tipsYield", "rawBreakeven"],
        inferenceOutputs: ["adjustedBreakeven", "liquidityPremiumApplied", "methodology"],
      },
      {
        id: "fx-fixing-buffer",
        name: "Emerging Market FX Fixing Spread & Reserve Buffer Indicator",
        endpoint: "/api/v1/analytics/fx-fixing-buffer",
        description:
          "Tracks spot FX deviation from central fixing rate against regulatory trading bands and foreign reserve import cover.",
        indicators: ["spot-rate", "central-fixing-rate", "foreign-reserves", "monthly-imports"],
        factOutputs: ["spotRate", "centralFixingRate", "bandWidthPercent", "upperBandCeiling", "lowerBandFloor"],
        inferenceOutputs: ["fixingSpread", "fixingSpreadBps", "bandUtilizationPercent", "distanceToCeilingPercent", "stressRegime"],
      },
    ],
  });
};

export const evaluateVietnamCreditRegimeHandler = (request: Request, response: Response) => {
  try {
    const params = { ...request.query, ...request.body };

    let creditInput: IndicatorInput;
    let propertyInput: IndicatorInput;

    if (params.creditGrowthYoY !== undefined) {
      creditInput = typeof params.creditGrowthYoY === "object"
        ? params.creditGrowthYoY
        : Number(params.creditGrowthYoY);
    } else {
      const dbObs = getLatestObservation("credit-growth-vn");
      creditInput = dbObs
        ? { value: dbObs.value, date: dbObs.date, seriesId: dbObs.seriesId }
        : NaN;
    }

    if (params.propertyPriceGrowthYoY !== undefined) {
      propertyInput = typeof params.propertyPriceGrowthYoY === "object"
        ? params.propertyPriceGrowthYoY
        : Number(params.propertyPriceGrowthYoY);
    } else {
      const dbObs = getLatestObservation("apartment-price-vn");
      propertyInput = dbObs
        ? { value: dbObs.value, date: dbObs.date, seriesId: dbObs.seriesId }
        : NaN;
    }

    const options: VietnamCreditRegimeOptions = {};
    if (params.dateToleranceDays !== undefined) {
      options.dateToleranceDays = Number(params.dateToleranceDays);
    }
    if (params.decouplingSpreadThreshold !== undefined) {
      options.decouplingSpreadThreshold = Number(params.decouplingSpreadThreshold);
    }
    if (params.methodology !== undefined) {
      options.methodology = String(params.methodology);
    }

    const result: VietnamCreditRegimeResult = calculateVietnamCreditRegime(
      creditInput,
      propertyInput,
      options
    );

    response.json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to calculate Vietnam credit regime",
    });
  }
};

export const evaluateBreakevenHandler = (request: Request, response: Response) => {
  try {
    const params = { ...request.query, ...request.body };

    if (params.nominalYield === undefined || params.tipsYield === undefined) {
      return response.status(400).json({
        error: "Missing required inputs: nominalYield and tipsYield are required.",
      });
    }

    const nominalInput: YieldInput = typeof params.nominalYield === "object"
      ? params.nominalYield
      : Number(params.nominalYield);
    const tipsInput: YieldInput = typeof params.tipsYield === "object"
      ? params.tipsYield
      : Number(params.tipsYield);
    const liquidityPremium = Number(params.liquidityPremium ?? 0);

    const options: BreakevenAdjustmentOptions = {};
    if (params.dateToleranceDays !== undefined) {
      options.dateToleranceDays = Number(params.dateToleranceDays);
    }
    if (params.methodology !== undefined) {
      options.methodology = String(params.methodology);
    }

    const result: BreakevenAdjustmentResult = calculateLiquidityAdjustedBreakeven(
      nominalInput,
      tipsInput,
      liquidityPremium,
      options
    );

    response.json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to calculate breakeven adjustment",
    });
  }
};

export const evaluateFxFixingBufferHandler = (request: Request, response: Response) => {
  try {
    const params = { ...request.query, ...request.body };

    if (params.spotRate === undefined || params.centralFixingRate === undefined) {
      return response.status(400).json({
        error: "Missing required inputs: spotRate and centralFixingRate are required.",
      });
    }

    const input: FxFixingBufferInput = {
      spotRate: typeof params.spotRate === "object" ? params.spotRate : Number(params.spotRate),
      centralFixingRate: typeof params.centralFixingRate === "object" ? params.centralFixingRate : Number(params.centralFixingRate),
      bandWidthPercent: params.bandWidthPercent !== undefined ? Number(params.bandWidthPercent) : undefined,
      foreignReservesUsdBillions: params.foreignReservesUsdBillions !== undefined
        ? (typeof params.foreignReservesUsdBillions === "object" ? params.foreignReservesUsdBillions : Number(params.foreignReservesUsdBillions))
        : undefined,
      monthlyImportsUsdBillions: params.monthlyImportsUsdBillions !== undefined
        ? (typeof params.monthlyImportsUsdBillions === "object" ? params.monthlyImportsUsdBillions : Number(params.monthlyImportsUsdBillions))
        : undefined,
      asOfDate: params.asOfDate !== undefined ? String(params.asOfDate) : undefined,
    };

    const options: FxFixingBufferOptions = {};
    if (params.dateToleranceDays !== undefined) {
      options.dateToleranceDays = Number(params.dateToleranceDays);
    }
    if (params.methodology !== undefined) {
      options.methodology = String(params.methodology);
    }

    const result: FxFixingBufferResult = calculateFxFixingBuffer(input, options);

    response.json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Failed to calculate FX fixing buffer",
    });
  }
};

export function createAnalyticsRouter(): Router {
  const router = Router();

  // Catalog
  router.get("/api/v1/analytics/catalog", getAnalyticsCatalogHandler);
  router.get("/api/analytics/catalog", getAnalyticsCatalogHandler);

  // Vietnam Credit Regime
  router.get("/api/v1/analytics/vietnam-credit-regime", evaluateVietnamCreditRegimeHandler);
  router.post("/api/v1/analytics/vietnam-credit-regime", evaluateVietnamCreditRegimeHandler);
  router.get("/api/analytics/vietnam-credit-regime", evaluateVietnamCreditRegimeHandler);
  router.post("/api/analytics/vietnam-credit-regime", evaluateVietnamCreditRegimeHandler);

  // Breakeven Adjuster
  router.get("/api/v1/analytics/breakeven", evaluateBreakevenHandler);
  router.post("/api/v1/analytics/breakeven", evaluateBreakevenHandler);
  router.get("/api/analytics/breakeven", evaluateBreakevenHandler);
  router.post("/api/analytics/breakeven", evaluateBreakevenHandler);

  // FX Fixing Buffer
  router.get("/api/v1/analytics/fx-fixing-buffer", evaluateFxFixingBufferHandler);
  router.post("/api/v1/analytics/fx-fixing-buffer", evaluateFxFixingBufferHandler);
  router.get("/api/analytics/fx-fixing-buffer", evaluateFxFixingBufferHandler);
  router.post("/api/analytics/fx-fixing-buffer", evaluateFxFixingBufferHandler);

  return router;
}

export const analyticsRouter = createAnalyticsRouter();
