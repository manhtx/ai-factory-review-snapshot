import { readFile } from "node:fs/promises";

const reportPath = process.env.FRED_AUDIT_REPORT ?? ".ai-company/reports/audit-fred-contracts-latest.json";
const quarantinePath = process.env.SOURCE_QUARANTINE ?? ".ai-company/reports/source-contract-quarantine-latest.json";
const report = JSON.parse(await readFile(reportPath, "utf8"));
const quarantine = JSON.parse(await readFile(quarantinePath, "utf8"));
const failures = new Set([...(report.contract404 ?? []), ...(report.transientFailures ?? [])]);
const quarantined = new Set(quarantine.quarantinedIndicatorIds ?? []);
const missing = [...failures].filter((id) => !quarantined.has(id));
const errors = [];
if (missing.length) errors.push(`live FRED failures not quarantined: ${missing.join(",")}`);
if (quarantine.productionPromotion !== "BLOCKED") errors.push("production promotion must remain BLOCKED");
const result = {
  status: errors.length ? "FAIL" : "PASS",
  reportPath,
  quarantinePath,
  liveFailureCount: failures.size,
  quarantinedFailureCount: [...failures].filter((id) => quarantined.has(id)).length,
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
