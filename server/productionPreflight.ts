export type PreflightCheck = { id: string; status: "pass" | "attention" | "blocked"; detail: string };
type SupabaseErrorCode = "jwt-clock-or-credential" | "authentication" | "dns-or-network" | "unavailable";

export function buildProductionPreflight(input: {
  productionRuntime: boolean;
  supabaseConfigured: boolean;
  supabaseConnected: boolean;
  supabaseErrorCode?: SupabaseErrorCode;
  criticalMigrationsTracked: boolean;
  backupRestoreVerified: boolean;
  adminKeyConfigured: boolean;
  providerContractValid: boolean;
  providerRightsReviewed: boolean;
  providerEvidenceOperationsSupported?: boolean;
  remoteMigrationsVerified: boolean;
  ingestionJobRpcAvailable?: boolean;
  ingestionJobRpcMissingPaths?: string[];
}) {
  const checks: PreflightCheck[] = [
    { id: "runtime", status: input.productionRuntime ? "pass" : "attention", detail: input.productionRuntime ? "Production runtime flag is active." : "Runtime is not marked as production; local/development behavior remains possible." },
    { id: "durable-storage", status: input.supabaseConfigured && input.supabaseConnected ? "pass" : "blocked", detail: input.supabaseConfigured && input.supabaseConnected ? "Managed storage is configured and connected." : input.supabaseErrorCode === "jwt-clock-or-credential" ? "Managed storage rejected authentication with a JWT clock/credential diagnostic; verify clock alignment and the server-side credential before retrying." : input.supabaseErrorCode === "authentication" ? "Managed storage authentication failed; verify the server-side credential and project access." : "Managed storage is not both configured and connected." },
    { id: "critical-migrations", status: input.criticalMigrationsTracked ? "pass" : "blocked", detail: input.criticalMigrationsTracked ? "Critical repository migrations are present." : "One or more critical repository migrations are missing." },
    { id: "remote-migrations", status: input.remoteMigrationsVerified ? "pass" : "attention", detail: input.remoteMigrationsVerified ? "Evidence records that critical migrations were applied to the remote database." : "Remote migration application is not verifiable from this runtime; repository files alone are insufficient." },
    { id: "admin-auth", status: input.adminKeyConfigured ? "pass" : "blocked", detail: input.adminKeyConfigured ? "Administrative authentication secret is configured (value withheld)." : "Administrative authentication secret is not configured." },
    { id: "provider-contract", status: input.providerContractValid ? "pass" : "blocked", detail: input.providerContractValid ? "Provider catalog metadata passes the contract audit." : "Provider catalog metadata is incomplete; ingestion readiness is not asserted." },
    { id: "provider-rights-review", status: input.providerRightsReviewed ? "pass" : "attention", detail: input.providerRightsReviewed ? "Provider rights review evidence is recorded for all registered providers." : "One or more provider rights classifications still require external review; no redistribution permission is inferred." },
    ...(input.providerEvidenceOperationsSupported === undefined ? [] : [{ id: "provider-evidence-operation", status: input.providerEvidenceOperationsSupported ? "pass" as const : "blocked" as const, detail: input.providerEvidenceOperationsSupported ? "All registered providers declare the governed evidence operation." : "One or more registered providers do not declare the governed evidence operation." }]),
    { id: "backup-restore", status: input.backupRestoreVerified ? "pass" : "attention", detail: input.backupRestoreVerified ? "Backup/restore drill evidence is recorded." : "Backup/restore drill evidence is not verifiable from this runtime." },
  ];
  if (input.ingestionJobRpcAvailable !== undefined) {
    checks.push({ id: "ingestion-job-rpc", status: input.ingestionJobRpcAvailable ? "pass" : "blocked", detail: input.ingestionJobRpcAvailable ? "Managed storage exposes the ingestion claim, heartbeat and finish RPCs without invoking them." : `Managed storage does not expose all ingestion job RPCs; missing: ${(input.ingestionJobRpcMissingPaths ?? ["unknown"]).join(", ")}. Production ingestion cannot claim jobs safely.` });
  }
  const nextActions = checks.filter((check) => check.status !== "pass").map((check) => ({ id: check.id, action: check.id === "backup-restore" ? "Run and record an owner-approved backup/restore drill with restore verification." : check.id === "remote-migrations" ? "Verify tracked migrations on the managed remote database with an authorized account." : check.id === "provider-rights-review" ? "Record provider-specific rights/retention review; do not infer redistribution permission." : check.id === "durable-storage" ? "Resolve managed storage configuration/connectivity before treating production reads as durable." : check.id === "admin-auth" ? "Configure the server-side admin secret through the approved secret manager." : check.detail }));
  return { productionReady: checks.every((check) => check.status === "pass"), checks, nextActions, limitations: ["This preflight reports configuration and available evidence; it does not apply migrations, perform backup operations or prove provider rights."] };
}
