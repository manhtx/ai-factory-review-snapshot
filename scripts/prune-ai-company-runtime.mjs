import { readdir, stat, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.env.AI_COMPANY_STATE_DIR ?? ".ai-company/runtime");
const targets = [
  join(root, "projects", "macro-os", "worker-artifacts"),
  join(root, "projects", "macro-os", "worktrees"),
];
const maxAgeMs = Number(process.env.AI_COMPANY_RUNTIME_RETENTION_HOURS ?? 24) * 60 * 60 * 1000;
const keepRecent = Number(process.env.AI_COMPANY_RUNTIME_KEEP_RECENT ?? 24);
const apply = process.argv.includes("--apply");
const now = Date.now();
const candidates = [];

for (const target of targets) {
  let names;
  try { names = await readdir(target); } catch { continue; }
  for (const name of names) {
    const path = join(target, name);
    const info = await stat(path).catch(() => null);
    if (!info || (!info.isDirectory() && !info.isFile())) continue;
    candidates.push({ path, mtimeMs: info.mtimeMs, stale: now - info.mtimeMs > maxAgeMs });
  }
}

const stale = candidates.filter((item) => item.stale);
const recent = candidates.filter((item) => !item.stale).sort((a, b) => b.mtimeMs - a.mtimeMs);
const overflow = recent.slice(keepRecent);
const removals = [...stale, ...overflow];
if (apply) for (const item of removals) await rm(item.path, { recursive: true, force: true });

console.log(JSON.stringify({
  root,
  apply,
  retentionHours: maxAgeMs / 3600000,
  keepRecent,
  inspected: candidates.length,
  removable: removals.length,
  removed: apply ? removals.length : 0,
  preserved: candidates.length - removals.length,
  ledgersUntouched: true,
}, null, 2));
