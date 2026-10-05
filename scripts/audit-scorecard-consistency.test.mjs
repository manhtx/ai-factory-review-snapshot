import { describe, expect, it } from "vitest";
import { execFileSync, execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const run = (env) => new Promise((resolve) => {
  execFile("node", [path.resolve("scripts/audit-scorecard-consistency.mjs")], { env: { ...process.env, ...env } }, (error, stdout, stderr) => resolve({ code: error ? (error.status ?? 1) : 0, stdout, stderr }));
});

describe("AI Company scorecard consistency audit", () => {
  it("accepts the current canonical state", () => {
    const report = JSON.parse(execFileSync("node", ["scripts/audit-scorecard-consistency.mjs"], { encoding: "utf8" }));
    expect(report).toMatchObject({ status: "PASS", total_score_100: 78, historical_snapshots_excluded: true });
  });

  it("fails closed when the scorecard diverges from company state", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ai-company-score-audit-"));
    const statePath = path.join(root, "state.json");
    const scorecardPath = path.join(root, "scorecard.json");
    await writeFile(statePath, JSON.stringify({ scorecard_summary: { total_score_100: 78 }, current_epoch: 407 }));
    await writeFile(scorecardPath, JSON.stringify({ total_score_100: 79 }));
    const result = await run({ AI_COMPANY_STATE: statePath, AI_COMPANY_SCORECARD: scorecardPath });
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ status: "FAIL", errors: ["canonical score mismatch: company-state=78, scorecard=79"] });
  });
});
