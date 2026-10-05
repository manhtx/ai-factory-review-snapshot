import fs from "node:fs";

const statePath = process.argv[2] ?? ".ai-company/company-state.json";
const toleranceMinutes = Number(process.env.CLOCK_SKEW_TOLERANCE_MINUTES ?? 5);
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const updated = Date.parse(state.last_updated ?? "");
const skewMinutes = Number.isFinite(updated) ? (updated - Date.now()) / 60000 : null;
const result = { statePath, lastUpdated: state.last_updated ?? null, skewMinutes, status: Number.isFinite(skewMinutes) && Math.abs(skewMinutes) <= toleranceMinutes ? "pass" : "blocked" };
console.log(JSON.stringify(result, null, 2));
if (result.status === "blocked") process.exitCode = 1;
