/**
 * Macro OS Emerging Market FX Fixing Spread & Reserve Buffer Indicator
 *
 * Strict fact/inference separation:
 * - Factual observations: spot rate, central fixing rate, trading band parameters,
 *   official foreign exchange reserves, monthly imports.
 * - Model inferences: fixing spread, basis point spread, band utilization percentage,
 *   distance to upper ceiling, import cover months, stress regime classification.
 *
 * Fail-closed validation:
 * - Non-positive spot/fixing rates, invalid/negative band width, negative reserves -> invalid_input
 * - Observation date misalignment exceeding tolerance -> misaligned
 * - Stale, outdated, or unavailable observation inputs -> stale
 */

export type FreshnessStatus = "fresh" | "delayed" | "outdated" | "unavailable";

export interface IndicatorObservation {
  value: number;
  date?: string;
  freshnessStatus?: FreshnessStatus | string;
  seriesId?: string;
}

export type NumericOrObservation = number | IndicatorObservation;

export interface FxFixingBufferInput {
  spotRate: NumericOrObservation;
  centralFixingRate: NumericOrObservation;
  bandWidthPercent?: number; // default: 5.0 (+/- 5.0%)
  foreignReservesUsdBillions?: NumericOrObservation;
  monthlyImportsUsdBillions?: NumericOrObservation;
  asOfDate?: string;
}

export interface FxFixingBufferOptions {
  dateToleranceDays?: number; // default: 3
  ceilingWarningThresholdPercent?: number; // default: 90.0%
  criticalThresholdPercent?: number; // default: 98.0%
  minImportCoverMonthsBenchmark?: number; // default: 3.0 (IMF standard)
  methodology?: string;
}

export interface FxFixingBufferResult {
  date: string;
  status: "valid" | "stale" | "misaligned" | "invalid_input";
  factualObservations: {
    spotRate: number;
    centralFixingRate: number;
    bandWidthPercent: number;
    upperBandCeiling: number;
    lowerBandFloor: number;
    foreignReservesUsdBillions?: number;
    monthlyImportsUsdBillions?: number;
  };
  modelInference: {
    fixingSpread: number; // spotRate - centralFixingRate
    fixingSpreadBps: number; // (spotRate - centralFixingRate) / centralFixingRate * 10,000
    bandUtilizationPercent: number; // (spot - fixing) / (ceiling - fixing) * 100
    distanceToCeilingPercent: number; // (ceiling - spot) / ceiling * 100
    importCoverMonths?: number; // foreignReservesUsdBillions / monthlyImportsUsdBillions
    stressRegime: "normal" | "monitoring" | "strained" | "critical";
    isInference: true;
    methodology: string;
  };
  diagnostics?: string[];
}

function roundToPrecision(val: number, decimals: number = 4): number {
  if (!Number.isFinite(val)) return val;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function parseObservation(input: NumericOrObservation | null | undefined): {
  val: number;
  date?: string;
  freshness?: string;
  isValid: boolean;
  isProvided: boolean;
} {
  if (input === null || input === undefined) {
    return { val: NaN, isValid: false, isProvided: false };
  }
  if (typeof input === "number") {
    return {
      val: input,
      isValid: !isNaN(input) && Number.isFinite(input),
      isProvided: true,
    };
  }
  if (typeof input === "object") {
    const val = typeof input.value === "number" ? input.value : Number(input.value);
    return {
      val,
      date: typeof input.date === "string" && input.date.trim().length > 0 ? input.date.trim() : undefined,
      freshness: input.freshnessStatus,
      isValid: !isNaN(val) && Number.isFinite(val),
      isProvided: true,
    };
  }
  return { val: NaN, isValid: false, isProvided: true };
}

function parseIsoDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const timestamp = Date.parse(dateStr);
  if (isNaN(timestamp)) return null;
  return new Date(timestamp);
}

export function calculateFxFixingBuffer(
  input: FxFixingBufferInput,
  options?: FxFixingBufferOptions
): FxFixingBufferResult {
  const diagnostics: string[] = [];
  let status: "valid" | "stale" | "misaligned" | "invalid_input" = "valid";

  const bandWidthPercent = input.bandWidthPercent !== undefined ? input.bandWidthPercent : 5.0;
  const dateToleranceDays = options?.dateToleranceDays ?? 3;
  const ceilingWarningThreshold = options?.ceilingWarningThresholdPercent ?? 90.0;
  const criticalThreshold = options?.criticalThresholdPercent ?? 98.0;
  const minImportCoverMonthsBenchmark = options?.minImportCoverMonthsBenchmark ?? 3.0;
  const methodology = options?.methodology ?? "em_fixing_band_reserve_buffer_v1";

  const spot = parseObservation(input.spotRate);
  const fixing = parseObservation(input.centralFixingRate);
  const reserves = parseObservation(input.foreignReservesUsdBillions);
  const imports = parseObservation(input.monthlyImportsUsdBillions);

  // Validate core parameters
  if (!Number.isFinite(bandWidthPercent) || bandWidthPercent <= 0) {
    status = "invalid_input";
    diagnostics.push(`Invalid bandWidthPercent: received ${bandWidthPercent}, must be positive finite number`);
  }

  if (!spot.isValid || spot.val <= 0) {
    status = "invalid_input";
    diagnostics.push(`Invalid spotRate observation: received ${spot.val}`);
  }

  if (!fixing.isValid || fixing.val <= 0) {
    status = "invalid_input";
    diagnostics.push(`Invalid centralFixingRate observation: received ${fixing.val}`);
  }

  if (reserves.isProvided) {
    if (!reserves.isValid || reserves.val < 0) {
      status = "invalid_input";
      diagnostics.push(`Invalid foreignReservesUsdBillions observation: received ${reserves.val}`);
    }
  }

  if (imports.isProvided) {
    if (!imports.isValid || imports.val < 0) {
      status = "invalid_input";
      diagnostics.push(`Invalid monthlyImportsUsdBillions observation: received ${imports.val}`);
    } else if (imports.val === 0 && reserves.isProvided && reserves.isValid && reserves.val > 0) {
      diagnostics.push("Monthly imports is zero; import cover cannot be calculated");
    }
  }

  // Date alignment and date selection
  let resultDate = input.asOfDate || spot.date || fixing.date || new Date().toISOString().slice(0, 10);
  if (spot.date && fixing.date) {
    const dSpot = parseIsoDate(spot.date);
    const dFixing = parseIsoDate(fixing.date);
    if (!dSpot || !dFixing) {
      status = "invalid_input";
      diagnostics.push(`Unparseable date string: spot="${spot.date}", fixing="${fixing.date}"`);
    } else {
      const diffMs = Math.abs(dSpot.getTime() - dFixing.getTime());
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > dateToleranceDays) {
        if (status === "valid") {
          status = "misaligned";
        }
        diagnostics.push(
          `Observation date misalignment: spot (${spot.date}) and fixing (${fixing.date}) differ by ${diffDays} day(s), exceeding tolerance of ${dateToleranceDays} day(s)`
        );
      }
      if (!input.asOfDate) {
        resultDate = dSpot >= dFixing ? spot.date : fixing.date;
      }
    }
  }

  // Freshness check
  const isStale = (obs: { isProvided: boolean; freshness?: string }) =>
    obs.isProvided && (obs.freshness === "unavailable" || obs.freshness === "outdated");

  if (isStale(spot) || isStale(fixing) || isStale(reserves) || isStale(imports)) {
    if (status === "valid") {
      status = "stale";
    }
    diagnostics.push(
      `Stale observation detected: spot=${spot.freshness ?? "none"}, fixing=${fixing.freshness ?? "none"}, reserves=${reserves.freshness ?? "none"}, imports=${imports.freshness ?? "none"}`
    );
  }

  // Factual calculations
  let upperBandCeiling = NaN;
  let lowerBandFloor = NaN;
  let fixingSpread = NaN;
  let fixingSpreadBps = NaN;
  let bandUtilizationPercent = NaN;
  let distanceToCeilingPercent = NaN;
  let importCoverMonths: number | undefined = undefined;
  let stressRegime: "normal" | "monitoring" | "strained" | "critical" = "normal";

  const coreInputsValid =
    spot.isValid &&
    spot.val > 0 &&
    fixing.isValid &&
    fixing.val > 0 &&
    Number.isFinite(bandWidthPercent) &&
    bandWidthPercent > 0;

  if (coreInputsValid) {
    upperBandCeiling = roundToPrecision(fixing.val * (1 + bandWidthPercent / 100), 4);
    lowerBandFloor = roundToPrecision(fixing.val * (1 - bandWidthPercent / 100), 4);
    fixingSpread = roundToPrecision(spot.val - fixing.val, 4);
    fixingSpreadBps = roundToPrecision(((spot.val - fixing.val) / fixing.val) * 10000, 2);

    const halfBandWidth = upperBandCeiling - fixing.val;
    bandUtilizationPercent = roundToPrecision(((spot.val - fixing.val) / halfBandWidth) * 100, 4);
    distanceToCeilingPercent = roundToPrecision(((upperBandCeiling - spot.val) / upperBandCeiling) * 100, 4);

    if (
      reserves.isProvided &&
      reserves.isValid &&
      reserves.val >= 0 &&
      imports.isProvided &&
      imports.isValid &&
      imports.val > 0
    ) {
      importCoverMonths = roundToPrecision(reserves.val / imports.val, 2);
    }

    const isCritical =
      bandUtilizationPercent >= criticalThreshold ||
      spot.val >= upperBandCeiling ||
      (bandUtilizationPercent >= ceilingWarningThreshold &&
        importCoverMonths !== undefined &&
        importCoverMonths < minImportCoverMonthsBenchmark);

    const isStrained =
      bandUtilizationPercent >= ceilingWarningThreshold ||
      (bandUtilizationPercent >= 75.0 &&
        importCoverMonths !== undefined &&
        importCoverMonths < minImportCoverMonthsBenchmark);

    if (isCritical) {
      stressRegime = "critical";
    } else if (isStrained) {
      stressRegime = "strained";
    } else if (bandUtilizationPercent >= 50.0) {
      stressRegime = "monitoring";
    } else {
      stressRegime = "normal";
    }
  }

  const factualObservations: FxFixingBufferResult["factualObservations"] = {
    spotRate: spot.isValid ? spot.val : NaN,
    centralFixingRate: fixing.isValid ? fixing.val : NaN,
    bandWidthPercent: Number.isFinite(bandWidthPercent) ? bandWidthPercent : NaN,
    upperBandCeiling,
    lowerBandFloor,
    ...(reserves.isProvided && reserves.isValid && reserves.val >= 0
      ? { foreignReservesUsdBillions: reserves.val }
      : {}),
    ...(imports.isProvided && imports.isValid && imports.val >= 0
      ? { monthlyImportsUsdBillions: imports.val }
      : {}),
  };

  const modelInference: FxFixingBufferResult["modelInference"] = {
    fixingSpread,
    fixingSpreadBps,
    bandUtilizationPercent,
    distanceToCeilingPercent,
    ...(importCoverMonths !== undefined ? { importCoverMonths } : {}),
    stressRegime,
    isInference: true,
    methodology,
  };

  return {
    date: resultDate,
    status,
    factualObservations,
    modelInference,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

export function calculateFxFixingBufferSeries(
  inputs: FxFixingBufferInput[],
  options?: FxFixingBufferOptions
): FxFixingBufferResult[] {
  return inputs.map((input) => calculateFxFixingBuffer(input, options));
}
