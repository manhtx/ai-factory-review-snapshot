import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = (process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const timeoutMs = Math.max(1000, Number(process.env.AUDIT_TIMEOUT_MS ?? 15000));
let catalog;
try {
  const catalogResponse = await fetch(`${baseUrl}/api/catalog`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!catalogResponse.ok) throw new Error(`catalog HTTP ${catalogResponse.status}`);
  catalog = await catalogResponse.json();
} catch (error) {
  const report = { generatedAt: new Date().toISOString(), baseUrl, total: 0, reachable: 0, failures: [{ indicatorId: "__catalog__", status: "ERR", error: String(error) }] };
  console.log(JSON.stringify(report, null, 2));
  if (process.env.AUDIT_OUTPUT) {
    await mkdir(process.env.AUDIT_OUTPUT.split("/").slice(0, -1).join("/") || ".", { recursive: true });
    await writeFile(process.env.AUDIT_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  const quarantineOutput = process.env.AUDIT_QUARANTINE_OUTPUT ?? ".ai-company/reports/source-contract-quarantine-latest.json";
  await mkdir(quarantineOutput.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  await writeFile(quarantineOutput, `${JSON.stringify({ generatedAt: report.generatedAt, sourceAudit: process.env.AUDIT_OUTPUT ?? "runtime source URL audit", policy: "FAIL_CLOSED_UNTIL_CANONICAL_PROVIDER_MAPPING_IS_SEMANTICALLY_VERIFIED", quarantinedIndicatorIds: ["__catalog__"], failures: report.failures, productionPromotion: "BLOCKED" }, null, 2)}\n`, "utf8");
  process.exit(1);
}
const concurrency = Math.max(1, Number(process.env.AUDIT_CONCURRENCY ?? 8));
const check = async (item) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(item.sourceUrl, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
      return {
        indicatorId: item.indicatorId,
        status: response.status,
        contentType: response.headers.get("content-type"),
        finalUrl: response.url,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
    }
  }
  return { indicatorId: item.indicatorId, status: "ERR", error: String(lastError), attempts: 3 };
};
const results = [];
for (let offset = 0; offset < catalog.length; offset += concurrency) {
  const batch = catalog.slice(offset, offset + concurrency);
  results.push(...await Promise.all(batch.map(check)));
}
const failures = results.filter((result) => result.status === "ERR" || result.status >= 400);
const contentTypes = results.reduce((counts, result) => {
  const key = result.contentType ?? "unknown";
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});
const report = { generatedAt: new Date().toISOString(), concurrency, total: results.length, reachable: results.length - failures.length, contentTypes, failures };
const serialized = JSON.stringify(report, null, 2);
console.log(serialized);
if (process.env.AUDIT_OUTPUT) {
  const output = process.env.AUDIT_OUTPUT;
  await mkdir(output.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  await writeFile(output, `${serialized}\n`, "utf8");
}
const quarantineOutput = process.env.AUDIT_QUARANTINE_OUTPUT ?? ".ai-company/reports/source-contract-quarantine-latest.json";
await mkdir(quarantineOutput.split("/").slice(0, -1).join("/") || ".", { recursive: true });
await writeFile(quarantineOutput, `${JSON.stringify({
  generatedAt: report.generatedAt,
  sourceAudit: process.env.AUDIT_OUTPUT ?? "runtime source URL audit",
  policy: "FAIL_CLOSED_UNTIL_CANONICAL_PROVIDER_MAPPING_IS_SEMANTICALLY_VERIFIED",
  quarantinedIndicatorIds: failures.map((failure) => failure.indicatorId),
  failures,
  productionPromotion: "BLOCKED",
}, null, 2)}\n`, "utf8");
if (failures.length > 0) process.exitCode = 1;
