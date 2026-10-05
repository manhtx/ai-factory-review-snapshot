import { classifySupabaseConnectionError, SupabaseConnectionErrorCode } from "./supabase.js";

export type ManagedStorageErrorResponse = {
  error: "Managed storage unavailable";
  code: "MANAGED_STORAGE_UNAVAILABLE";
  diagnosticCode: SupabaseConnectionErrorCode;
  retryable: false;
  limitations: string[];
};

export function buildManagedStorageErrorResponse(error: unknown): ManagedStorageErrorResponse {
  return {
    error: "Managed storage unavailable",
    code: "MANAGED_STORAGE_UNAVAILABLE",
    diagnosticCode: classifySupabaseConnectionError(error),
    retryable: false,
    limitations: [
      "The managed storage read failed; no local SQLite fallback is used in production.",
      "Resolve the storage diagnostic before treating research hydration as available.",
    ],
  };
}
