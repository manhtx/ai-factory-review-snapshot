import { readFile } from "node:fs/promises";

const auditPath = process.env.SOURCE_URL_AUDIT ?? ".ai-company/reports/source-url-audit-authoritative-latest.json";
const quarantinePath = process.env.SOURCE_QUARANTINE ?? ".ai-company/reports/source-contract-quarantine-latest.json";
const audit = JSON.parse(await readFile(auditPath, "utf8"));
const quarantine = JSON.parse(await readFile(quarantinePath, "utf8"));
const failures = new Set((audit.failures ?? []).map((item) => item.indicatorId));
const quarantined = new Set(quarantine.quarantinedIndicatorIds ?? []);
const missing = [...failures].filter((id) => !quarantined.has(id));
const unexpected = [...quarantined].filter((id) => !failures.has(id));
const errors = [];
if (!audit.generatedAt || quarantine.generatedAt !== audit.generatedAt) errors.push("quarantine must be generated from the same source audit run");
if (quarantine.sourceAudit !== auditPath) errors.push(`quarantine source audit mismatch: ${quarantine.sourceAudit}`);
if (missing.length) errors.push(`unquarantined failures: ${missing.join(",")}`);
if (unexpected.length) errors.push(`quarantine contains non-failures: ${unexpected.join(",")}`);
if (quarantine.productionPromotion !== "BLOCKED") errors.push("production promotion must remain BLOCKED");
const report = { status: errors.length ? "FAIL" : "PASS", auditPath, quarantinePath, failureCount: failures.size, quarantinedCount: quarantined.size, productionPromotion: quarantine.productionPromotion, errors };
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
