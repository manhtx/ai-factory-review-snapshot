import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("AI Company operating model audit", () => {
  it("passes the structural company contract without claiming production readiness", () => {
    const output = execFileSync("node", ["scripts/audit-ai-company-operating-model.mjs"], { encoding: "utf8" });
    const report = JSON.parse(output);
    expect(report).toMatchObject({ evidence: "ai-company-operating-model-audit", status: "PASS", production_ready: false });
    expect(report.checks).toHaveLength(7);
    expect(report.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("can retain a machine-readable audit artifact", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ai-company-audit-"));
    const file = path.join(root, "operating-audit.json");
    const output = execFileSync("node", [path.resolve("scripts/audit-ai-company-operating-model.mjs")], { env: { ...process.env, AI_COMPANY_OPERATING_AUDIT_FILE: file }, encoding: "utf8" });
    expect(JSON.parse(output).status).toBe("PASS");
    expect(JSON.parse(await readFile(file, "utf8"))).toMatchObject({ evidence: "ai-company-operating-model-audit", status: "PASS" });
  });
});
