/**
 * Macro OS Vietnam Credit Growth vs Property Price Decoupling Monitor
 *
 * Strict fact/inference separation:
 * - Factual observations: Systemic credit growth (YoY), property price index growth (YoY), raw spread
 * - Model inference: Decoupling spread, regime classification, severity score, explicit methodology
 *
 * Fail-closed validation:
 * - Out-of-bounds or non-numeric inputs -> invalid_input
 * - Date mismatches exceeding tolerance (default 90 days for quarterly/monthly series) -> misaligned
 * - Stale/outdated observation inputs -> stale
 */

export type FreshnessStatus = "fresh" | "delayed" | "outdated" | "unavailable";

export interface MacroObservationInput {
  value: number;
  date?: string;
  freshnessStatus?: FreshnessStatus | string;
  seriesId?: string;
}

export type IndicatorInput = number | MacroObservationInput;

export type VietnamCreditRegimeType =
  | "balanced_expansion"
  | "property_bubble_decoupling"
  | "divergent_reallocation"
  | "credit_crunch_freeze"
  | "general_contraction";

export interface VietnamCreditRegimeOptions {
  dateToleranceDays?: number; // default: 90 days
  decouplingSpreadThreshold?: number; // default: 5.0 (percentage points)
  minValidGrowth?: number; // default: -50.0%
  maxValidGrowth?: number; // default: 150.0%
  methodology?: string;
}

export interface VietnamCreditRegimeResult {
  date: string;
  factualObservations: {
    creditGrowthYoY: number;
    propertyPriceGrowthYoY: number;
    rawSpread: number; // propertyPriceGrowthYoY - creditGrowthYoY
  };
  modelInference: {
    regime: VietnamCreditRegimeType;
    decouplingSpread: number;
    severityScore: number; // 0.0 to 1.0
    isInference: true;
    methodology: string;
  };
  status: "valid" | "stale" | "misaligned" | "invalid_input";
  diagnostics?: string[];
}

function roundToPrecision(val: number, decimals: number = 4): number {
  if (!Number.isFinite(val)) return val;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function parseMacroInput(input: IndicatorInput | null | undefined): {
  val: number;
  date?: string;
  freshness?: string;
  seriesId?: string;
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
      seriesId: typeof input.seriesId === "string" ? input.seriesId : undefined,
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

function classifyRegime(
  creditGrowth: number,
  propertyGrowth: number,
  spreadThreshold: number
): { regime: VietnamCreditRegimeType; severityScore: number } {
  const rawSpread = propertyGrowth - creditGrowth;

  if (creditGrowth < 0 && propertyGrowth < 0) {
    const severity = Math.min(
      1.0,
      roundToPrecision(0.7 + (Math.abs(creditGrowth + propertyGrowth) / 50) * 0.3, 4)
    );
    return { regime: "general_contraction", severityScore: severity };
  }

  if (creditGrowth < 0 && propertyGrowth <= spreadThreshold) {
    const severity = Math.min(
      1.0,
      roundToPrecision(0.6 + (Math.abs(creditGrowth) / 20) * 0.4, 4)
    );
    return { regime: "credit_crunch_freeze", severityScore: severity };
  }

  if (rawSpread > spreadThreshold) {
    const excess = rawSpread - spreadThreshold;
    const severity = Math.min(
      1.0,
      roundToPrecision(0.4 + (excess / (spreadThreshold * 2)) * 0.6, 4)
    );
    return { regime: "property_bubble_decoupling", severityScore: severity };
  }

  if (rawSpread < -spreadThreshold) {
    const excess = -rawSpread - spreadThreshold;
    const severity = Math.min(
      1.0,
      roundToPrecision(0.3 + (excess / (spreadThreshold * 2)) * 0.7, 4)
    );
    return { regime: "divergent_reallocation", severityScore: severity };
  }

  const severity = Math.min(
    0.2,
    roundToPrecision((Math.abs(rawSpread) / (spreadThreshold || 1)) * 0.2, 4)
  );
  return { regime: "balanced_expansion", severityScore: severity };
}

export function calculateVietnamCreditRegime(
  creditInput: IndicatorInput,
  propertyInput: IndicatorInput,
  options?: VietnamCreditRegimeOptions
): VietnamCreditRegimeResult {
  const diagnostics: string[] = [];
  const minGrowth = options?.minValidGrowth ?? -50.0;
  const maxGrowth = options?.maxValidGrowth ?? 150.0;
  const dateTolerance = options?.dateToleranceDays ?? 90;
  const spreadThreshold = options?.decouplingSpreadThreshold ?? 5.0;
  const methodology = options?.methodology ?? "vietnam_sbv_credit_property_spread_v1";

  const credit = parseMacroInput(creditInput);
  const property = parseMacroInput(propertyInput);

  let status: "valid" | "stale" | "misaligned" | "invalid_input" = "valid";

  // Check credit growth validity
  if (!credit.isValid) {
    status = "invalid_input";
    diagnostics.push(`Invalid credit growth observation: received ${credit.val}`);
  } else if (credit.val < minGrowth || credit.val > maxGrowth) {
    status = "invalid_input";
    diagnostics.push(
      `Credit growth ${credit.val}% outside valid bounds [${minGrowth}%, ${maxGrowth}%]`
    );
  }

  // Check property growth validity
  if (!property.isValid) {
    status = "invalid_input";
    diagnostics.push(`Invalid property price growth observation: received ${property.val}`);
  } else if (property.val < minGrowth || property.val > maxGrowth) {
    status = "invalid_input";
    diagnostics.push(
      `Property price growth ${property.val}% outside valid bounds [${minGrowth}%, ${maxGrowth}%]`
    );
  }

  // Date parsing and tolerance
  let resultDate = credit.date || property.date || new Date().toISOString().slice(0, 10);
  if (credit.date && property.date) {
    const dCredit = parseIsoDate(credit.date);
    const dProperty = parseIsoDate(property.date);
    if (!dCredit || !dProperty) {
      status = "invalid_input";
      diagnostics.push(
        `Unparseable date string: credit="${credit.date}", property="${property.date}"`
      );
    } else {
      const diffMs = Math.abs(dCredit.getTime() - dProperty.getTime());
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > dateTolerance) {
        if (status === "valid") {
          status = "misaligned";
        }
        diagnostics.push(
          `Observation date misalignment: credit (${credit.date}) and property (${property.date}) differ by ${diffDays} day(s), exceeding tolerance of ${dateTolerance} day(s)`
        );
      }
      resultDate = dCredit >= dProperty ? credit.date : property.date;
    }
  }

  // Freshness check
  const isCreditStale = credit.freshness === "unavailable" || credit.freshness === "outdated";
  const isPropertyStale = property.freshness === "unavailable" || property.freshness === "outdated";
  if (isCreditStale || isPropertyStale) {
    if (status === "valid") {
      status = "stale";
    }
    diagnostics.push(
      `Stale observation detected: credit=${credit.freshness ?? "unspecified"}, property=${property.freshness ?? "unspecified"}`
    );
  }

  // Compute spreads and regime
  let rawSpread = NaN;
  let regime: VietnamCreditRegimeType = "balanced_expansion";
  let severityScore = 0.0;

  if (credit.isValid && property.isValid) {
    rawSpread = roundToPrecision(property.val - credit.val, 4);
    const classification = classifyRegime(credit.val, property.val, spreadThreshold);
    regime = classification.regime;
    severityScore = classification.severityScore;
  }

  // Provenance / series tracking
  if (credit.seriesId || property.seriesId) {
    diagnostics.push(
      `Series IDs: credit=${credit.seriesId ?? "none"}, property=${property.seriesId ?? "none"}`
    );
  }

  return {
    date: resultDate,
    factualObservations: {
      creditGrowthYoY: credit.isValid ? credit.val : NaN,
      propertyPriceGrowthYoY: property.isValid ? property.val : NaN,
      rawSpread: roundToPrecision(rawSpread, 4),
    },
    modelInference: {
      regime,
      decouplingSpread: roundToPrecision(rawSpread, 4),
      severityScore,
      isInference: true,
      methodology,
    },
    status,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

export function calculateVietnamCreditRegimeSeries(
  creditSeries: IndicatorInput[],
  propertySeries: IndicatorInput[],
  options?: VietnamCreditRegimeOptions
): VietnamCreditRegimeResult[] {
  if (!Array.isArray(creditSeries) || !Array.isArray(propertySeries)) {
    return [];
  }

  // If observations have dates, perform nearest date matching
  const hasDates = creditSeries.some(
    (c) => typeof c === "object" && c !== null && typeof c.date === "string"
  );

  if (hasDates) {
    const propMap = propertySeries
      .map((p) => ({ item: p, parsed: parseMacroInput(p) }))
      .filter((p) => p.parsed.isValid && p.parsed.date);

    return creditSeries.map((cInput) => {
      const cParsed = parseMacroInput(cInput);
      if (!cParsed.date || propMap.length === 0) {
        return calculateVietnamCreditRegime(cInput, NaN, options);
      }

      const cDate = parseIsoDate(cParsed.date);
      if (!cDate) {
        return calculateVietnamCreditRegime(cInput, NaN, options);
      }

      // Find property observation with minimal absolute time delta
      let closestProp = propMap[0].item;
      let minDelta = Infinity;

      for (const p of propMap) {
        const pDate = parseIsoDate(p.parsed.date);
        if (pDate) {
          const delta = Math.abs(cDate.getTime() - pDate.getTime());
          if (delta < minDelta) {
            minDelta = delta;
            closestProp = p.item;
          }
        }
      }

      return calculateVietnamCreditRegime(cInput, closestProp, options);
    });
  }

  // Fallback to index-based pairing
  const length = Math.max(creditSeries.length, propertySeries.length);
  const results: VietnamCreditRegimeResult[] = [];
  for (let i = 0; i < length; i++) {
    results.push(
      calculateVietnamCreditRegime(
        creditSeries[i] ?? NaN,
        propertySeries[i] ?? NaN,
        options
      )
    );
  }
  return results;
}
