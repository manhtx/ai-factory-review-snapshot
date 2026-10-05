#!/usr/bin/env node
/** Verify the live ISM publisher response is parseable, not merely HTTP 200. */
import { mkdir, writeFile } from "node:fs/promises";
import { DATA_SOURCES } from "../src/app/config/dataSources.ts";
import { parseIsmManufacturingReportHtml } from "../server/ingestion.ts";

const config = DATA_SOURCES["pmi-us"];
const reportPath = process.env.ISM_AUDIT_OUTPUT ?? ".ai-company/reports/ism-ingestion-authoritative-latest.json";
const response = await fetch(config.sourceUrl, {
  headers: { Accept: "text/html", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
  signal: AbortSignal.timeout(20_000),
});
const html = await response.text();
const observations = response.ok ? parseIsmManufacturingReportHtml(html) : [];
const blocked = /captcha_form|recaptcha/i.test(html);
const result = {
  generated_at: new Date().toISOString(),
  indicator_id: "pmi-us",
  source_url: config.sourceUrl,
  status: response.status,
  content_type: response.headers.get("content-type"),
  response_bytes: Buffer.byteLength(html),
  captcha_or_access_wall: blocked,
  observations,
  status_label: response.ok && !blocked && observations.length > 0 ? "PASS_PARSEABLE" : "FAIL_CLOSED",
  production_promotion: "BLOCKED",
  provenance: "live-publisher-fetch-and-local-parser",
};
await mkdir(reportPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (result.status_label !== "PASS_PARSEABLE") process.exitCode = 1;
