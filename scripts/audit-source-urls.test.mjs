import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("source URL audit fail-closed behavior", () => {
  it("preserves a catalog-unavailable sentinel and zero reachable sources", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ai-company-source-audit-"));
    const auditPath = path.join(root, "audit.json");
    const quarantinePath = path.join(root, "quarantine.json");
    await expect(execFileAsync("node", [path.resolve("scripts/audit-source-urls.mjs")], {
      env: {
        ...process.env,
        AUDIT_BASE_URL: "http://127.0.0.1:9",
        AUDIT_OUTPUT: auditPath,
        AUDIT_QUARANTINE_OUTPUT: quarantinePath,
      },
    })).rejects.toMatchObject({ code: 1 });
    const audit = JSON.parse(await readFile(auditPath, "utf8"));
    const quarantine = JSON.parse(await readFile(quarantinePath, "utf8"));
    expect(audit).toMatchObject({ total: 0, reachable: 0 });
    expect(audit.failures).toEqual([expect.objectContaining({ indicatorId: "__catalog__", status: "ERR" })]);
    expect(quarantine).toMatchObject({ quarantinedIndicatorIds: ["__catalog__"], productionPromotion: "BLOCKED" });
    expect(path.resolve(quarantine.sourceAudit)).toBe(path.resolve(auditPath));
  });
});
