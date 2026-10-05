export const REQUIRED_MIGRATION_FILES = [
  "20260728030000_initial_macro_platform.sql",
  "20260805050000_atomic_ingestion_rpc.sql",
  "20260805060000_forecasts_model_runs.sql",
  "20260820110000_forecast_batch_rpc.sql",
  "20260805070000_quality_summary_rpc.sql",
  "20260805070100_institutional_outlooks.sql",
  "20260805120000_enforce_verified_ingestion_provenance.sql",
  "20260805130000_remove_null_derived_hose_observation.sql",
  "20260805131500_remove_non_trading_hose_liquidity_observations.sql",
  "20260805160000_deduplicate_identical_observations.sql",
  "20260805180000_remove_stale_usdvnd_contract_rows.sql",
  "20260805190000_make_ingestion_idempotent.sql",
  "20260805200000_remove_partial_global_money_basket.sql",
  "20260805210000_reclassify_empty_successful_runs.sql",
  "20260806080000_research_runs.sql",
  "20260820080000_research_memory.sql",
  "20260820100000_debate_checkpoints.sql",
  "20260806090000_ingestion_job_claims.sql",
  "20260806100000_provider_telemetry_snapshots.sql",
] as const;

export function buildMigrationAudit(
  existingFiles: readonly string[],
) {
  const existing = new Set(existingFiles);
  const missing = REQUIRED_MIGRATION_FILES.filter((file) => !existing.has(file));
  return {
    required: [...REQUIRED_MIGRATION_FILES],
    present: REQUIRED_MIGRATION_FILES.filter((file) => existing.has(file)),
    missing,
    complete: missing.length === 0,
    source: "repository" as const,
  };
}
