#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dirname } from "node:path";

const root = process.cwd();
const checks = [];
const check = (id, ok, detail) => checks.push({ id, status: ok ? "pass" : "blocked", detail });
const read = (file) => readFileSync(join(root, file), "utf8");

const roles = read("server/aiCompany/roleContracts.ts");
const cadence = read("server/aiCompany/operatingCadence.ts");
const journeys = read(".ai-company/USER_JOURNEY_MATRIX.md");
const goal = read("docs/PRODUCT_GOAL.md");

check("role-contracts", ["ceo", "pm", "data-engineer", "backend-engineer", "frontend-engineer", "functional-qa", "quality-control", "security"].every((role) => roles.includes(`'${role}'`)), "CEO, PM, data, BE, FE, QA, QC and security roles are declared.");
check("executive-cadence", ["daily", "weekly", "monthly", "quarterly", "annual"].every((period) => cadence.includes(`cadence: '${period}'`)), "Daily through annual operating cadences are declared.");
check("user-journeys", ["UJ-001", "UJ-002", "UJ-003", "UJ-004", "UJ-005"].every((id) => journeys.includes(id)), "Five canonical user journeys are documented.");
check("product-goal-link", goal.includes("Macro OS"), "Operating model remains linked to the product source of truth.");
check("durable-ledgers", ["server/aiCompany/stateStore.ts", "server/aiCompany/backlogLedger.ts", "server/aiCompany/outcomeLedger.ts", "server/userTelemetryLedger.ts"].every(existsSync), "State, backlog, outcome and user telemetry ledgers exist.");
check("operating-workflow", ["server/aiCompany/productCycleScheduler.ts", "server/aiCompany/backlogWorkPlanner.ts", "server/aiCompany/roleWorkExecutor.ts", "server/aiCompany/preReleaseReviewGate.ts", "server/aiCompany/postReleaseMonitor.ts"].every(existsSync), "Scheduler, planner, role execution, release gate and post-release monitoring exist.");
check("production-trust-boundary", ["server/productionPreflight.ts", "server/aiCompany/productionGate.ts", "scripts/audit-real-data.mjs", "scripts/audit-synthetic-series.mjs"].every(existsSync), "Production preflight, release gate, real-data and synthetic-data audits exist as separate trust boundaries.");

const result = { evidence: "ai-company-operating-model-audit", generated_at: new Date().toISOString(), checks, production_ready: false, production_note: "This structural audit never authorizes production; use production preflight and real-data audit separately.", status: checks.every((item) => item.status === "pass") ? "PASS" : "BLOCKED" };
console.log(JSON.stringify(result, null, 2));
if (process.env.AI_COMPANY_OPERATING_AUDIT_FILE) {
  const outputFile = process.env.AI_COMPANY_OPERATING_AUDIT_FILE;
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
if (process.env.REQUIRE_AI_COMPANY_OPERATING_MODEL === "true" && result.status !== "PASS") process.exitCode = 1;
