export interface ForecastCoverageCatalogItem {
  id: string;
  name?: string;
  country?: string;
  category?: string;
}

export interface ForecastCoverageForecast {
  id?: string;
  indicatorId: string;
  institution?: string;
  targetDate: string;
  forecastDate: string;
  version?: number;
  sourceName?: string;
  sourceUrl?: string;
}

export interface ForecastCoverageRow {
  indicatorId: string;
  name: string | null;
  country: string | null;
  category: string | null;
  covered: boolean;
  forecastCount: number;
  latest: ForecastCoverageForecast | null;
}

export function buildForecastCoverage(
  catalog: ForecastCoverageCatalogItem[],
  forecasts: ForecastCoverageForecast[],
  debateForecastIds: Iterable<string> = [],
  generatedAt = new Date().toISOString(),
) {
  const debateIds = new Set(debateForecastIds);
  const byIndicator = new Map<string, ForecastCoverageForecast[]>();
  for (const forecast of forecasts) {
    const rows = byIndicator.get(forecast.indicatorId) ?? [];
    rows.push(forecast);
    byIndicator.set(forecast.indicatorId, rows);
  }
  const rows = catalog.map((item): ForecastCoverageRow => {
    const indicatorForecasts = [...(byIndicator.get(item.id) ?? [])].sort((a, b) => {
      const target = b.targetDate.localeCompare(a.targetDate);
      if (target) return target;
      const forecastDate = b.forecastDate.localeCompare(a.forecastDate);
      if (forecastDate) return forecastDate;
      const version = Number(b.version ?? 0) - Number(a.version ?? 0);
      if (version) return version;
      return String(b.id ?? "").localeCompare(String(a.id ?? ""));
    });
    return {
      indicatorId: item.id,
      name: item.name ?? null,
      country: item.country ?? null,
      category: item.category ?? null,
      covered: indicatorForecasts.length > 0,
      forecastCount: indicatorForecasts.length,
      latest: indicatorForecasts[0] ? { ...indicatorForecasts[0], debateAvailable: Boolean(indicatorForecasts[0].id && debateIds.has(indicatorForecasts[0].id)) } as ForecastCoverageForecast & { debateAvailable: boolean } : null,
    };
  });
  const coveredCount = rows.filter((row) => row.covered).length;
  return {
    generatedAt,
    totalIndicators: rows.length,
    coveredIndicators: coveredCount,
    uncoveredIndicators: rows.length - coveredCount,
    coveragePercent: rows.length ? Math.round((coveredCount / rows.length) * 10000) / 100 : 0,
    rows,
    evidence: "persisted-forecast-revisions",
    limitations: [
      "Coverage counts only validated revisions persisted by Macro OS; it does not prove that external predictions were supplied for every indicator.",
      "A forecast is an expectation, not an actual observation or investment recommendation.",
    ],
  };
}
