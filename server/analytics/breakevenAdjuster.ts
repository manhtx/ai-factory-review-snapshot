/**
 * Macro OS TIPS Liquidity-Adjusted Breakeven Analytics
 *
 * Strict fact/inference separation:
 * - Factual observations: nominal treasury yield, TIPS real yield, raw breakeven spread
 * - Model inference: liquidity-adjusted breakeven with explicit methodology and assumptions
 *
 * Fail-closed validation:
 * - Out-of-bounds or non-numeric inputs -> invalid_input
 * - Date mismatches exceeding tolerance -> misaligned
 * - Stale/outdated observation inputs -> stale
 */

export type FreshnessStatus = "fresh" | "delayed" | "outdated" | "unavailable";

export interface YieldObservation {
  value: number;
  date?: string;
  freshnessStatus?: FreshnessStatus | string;
  seriesId?: string;
}

export type YieldInput = number | YieldObservation;

export interface BreakevenAdjustmentOptions {
  dateToleranceDays?: number;
  unit?: "percentage" | "basis_points";
  liquidityUnit?: "percentage" | "basis_points";
  methodology?: string;
  minYieldThreshold?: number;
  maxYieldThreshold?: number;
}

export interface BreakevenAdjustmentResult {
  date: string;
  factualObservations: {
    nominalYield: number;
    tipsYield: number;
    rawBreakeven: number;
  };
  modelInference: {
    adjustedBreakeven: number;
    liquidityPremiumApplied: number;
    methodology: string;
    isInference: true;
  };
  status: "valid" | "stale" | "misaligned" | "invalid_input";
  diagnostics?: string[];
}

function roundToPrecision(val: number, decimals: number = 6): number {
  if (!Number.isFinite(val)) return val;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function parseYieldInput(input: YieldInput | null | undefined): {
  val: number;
  date?: string;
  freshness?: string;
  isValid: boolean;
} {
  if (input === null || input === undefined) {
    return { val: NaN, isValid: false };
  }
  if (typeof input === "number") {
    return {
      val: input,
      isValid: !isNaN(input) && Number.isFinite(input),
    };
  }
  if (typeof input === "object") {
    const val = typeof input.value === "number" ? input.value : Number(input.value);
    return {
      val,
      date: typeof input.date === "string" ? input.date : undefined,
      freshness: input.freshnessStatus,
      isValid: !isNaN(val) && Number.isFinite(val),
    };
  }
  return { val: NaN, isValid: false };
}

function parseIsoDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const timestamp = Date.parse(dateStr);
  if (isNaN(timestamp)) return null;
  return new Date(timestamp);
}

export function calculateLiquidityAdjustedBreakeven(
  nominalInput: YieldInput,
  tipsInput: YieldInput,
  liquidityPremium: number,
  options?: BreakevenAdjustmentOptions
): BreakevenAdjustmentResult {
  const diagnostics: string[] = [];
  const minThreshold = options?.minYieldThreshold ?? -10;
  const maxThreshold = options?.maxYieldThreshold ?? 50;
  const dateTolerance = options?.dateToleranceDays ?? 0;
  const methodology = options?.methodology ?? "deterministic_proxy_addition";

  const nom = parseYieldInput(nominalInput);
  const tips = parseYieldInput(tipsInput);

  let status: "valid" | "stale" | "misaligned" | "invalid_input" = "valid";

  // Check liquidity premium validity
  const premiumValid =
    typeof liquidityPremium === "number" &&
    !isNaN(liquidityPremium) &&
    Number.isFinite(liquidityPremium);
  if (!premiumValid) {
    status = "invalid_input";
    diagnostics.push(`Invalid liquidity premium: received ${liquidityPremium}`);
  }

  // Check nominal yield
  if (!nom.isValid) {
    status = "invalid_input";
    diagnostics.push(`Invalid nominal yield observation: received ${nom.val}`);
  } else if (nom.val < minThreshold || nom.val > maxThreshold) {
    status = "invalid_input";
    diagnostics.push(
      `Nominal yield ${nom.val}% outside reasonable bounds [${minThreshold}%, ${maxThreshold}%]`
    );
  }

  // Check tips yield
  if (!tips.isValid) {
    status = "invalid_input";
    diagnostics.push(`Invalid TIPS yield observation: received ${tips.val}`);
  } else if (tips.val < minThreshold || tips.val > maxThreshold) {
    status = "invalid_input";
    diagnostics.push(
      `TIPS yield ${tips.val}% outside reasonable bounds [${minThreshold}%, ${maxThreshold}%]`
    );
  }

  // Date parsing and tolerance
  let resultDate = nom.date || tips.date || new Date().toISOString().slice(0, 10);
  if (nom.date && tips.date) {
    const dNom = parseIsoDate(nom.date);
    const dTips = parseIsoDate(tips.date);
    if (!dNom || !dTips) {
      status = "invalid_input";
      diagnostics.push(`Unparseable date string: nominal="${nom.date}", tips="${tips.date}"`);
    } else {
      const diffMs = Math.abs(dNom.getTime() - dTips.getTime());
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > dateTolerance) {
        if (status === "valid") {
          status = "misaligned";
        }
        diagnostics.push(
          `Observation date misalignment: nominal (${nom.date}) and TIPS (${tips.date}) differ by ${diffDays} day(s), exceeding tolerance of ${dateTolerance} day(s)`
        );
      }
      resultDate = dNom >= dTips ? nom.date : tips.date;
    }
  }

  // Freshness check
  const isNomStale = nom.freshness === "unavailable" || nom.freshness === "outdated";
  const isTipsStale = tips.freshness === "unavailable" || tips.freshness === "outdated";
  if (isNomStale || isTipsStale) {
    if (status === "valid") {
      status = "stale";
    }
    diagnostics.push(
      `Stale observation detected: nominal=${nom.freshness ?? "unspecified"}, tips=${tips.freshness ?? "unspecified"}`
    );
  }

  // Liquidity unit conversion if requested
  let effectivePremium = liquidityPremium;
  if (
    (options?.liquidityUnit === "basis_points" || options?.unit === "basis_points") &&
    premiumValid
  ) {
    effectivePremium = liquidityPremium / 100;
  }

  // Calculate spreads
  let rawBreakeven = NaN;
  let adjustedBreakeven = NaN;
  if (nom.isValid && tips.isValid) {
    rawBreakeven = roundToPrecision(nom.val - tips.val, 6);
    if (premiumValid) {
      adjustedBreakeven = roundToPrecision(rawBreakeven + effectivePremium, 6);
    }
  }

  return {
    date: resultDate,
    factualObservations: {
      nominalYield: nom.isValid ? nom.val : NaN,
      tipsYield: tips.isValid ? tips.val : NaN,
      rawBreakeven: roundToPrecision(rawBreakeven, 4),
    },
    modelInference: {
      adjustedBreakeven: roundToPrecision(adjustedBreakeven, 4),
      liquidityPremiumApplied: premiumValid ? effectivePremium : NaN,
      methodology,
      isInference: true,
    },
    status,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

export function calculateLiquidityAdjustedBreakevenSeries(
  nominalSeries: YieldObservation[],
  tipsSeries: YieldObservation[],
  liquidityPremiumInput: number | YieldObservation[] | Record<string, number>,
  options?: BreakevenAdjustmentOptions
): BreakevenAdjustmentResult[] {
  const tipsByDate = new Map<string, YieldObservation>();
  for (const t of tipsSeries) {
    if (t.date) {
      tipsByDate.set(t.date, t);
    }
  }

  const results: BreakevenAdjustmentResult[] = [];

  for (const nom of nominalSeries) {
    const dateKey = nom.date;
    let matchingTips: YieldObservation | undefined;
    if (dateKey) {
      matchingTips = tipsByDate.get(dateKey);
    }

    let premium = 0;
    if (typeof liquidityPremiumInput === "number") {
      premium = liquidityPremiumInput;
    } else if (Array.isArray(liquidityPremiumInput)) {
      const match = liquidityPremiumInput.find((p) => p.date === dateKey);
      premium = match ? match.value : NaN;
    } else if (typeof liquidityPremiumInput === "object" && dateKey) {
      premium = liquidityPremiumInput[dateKey] ?? NaN;
    }

    if (!matchingTips) {
      results.push({
        date: dateKey || "",
        factualObservations: {
          nominalYield: nom.value,
          tipsYield: NaN,
          rawBreakeven: NaN,
        },
        modelInference: {
          adjustedBreakeven: NaN,
          liquidityPremiumApplied: premium,
          methodology: options?.methodology ?? "deterministic_proxy_addition",
          isInference: true,
        },
        status: "invalid_input",
        diagnostics: [`Missing matching TIPS observation for date ${dateKey}`],
      });
    } else {
      results.push(calculateLiquidityAdjustedBreakeven(nom, matchingTips, premium, options));
    }
  }

  return results;
}
