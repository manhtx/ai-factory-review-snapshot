import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.AI_COMPANY_LIFECYCLE_ROOT ?? '.ai-company/runtime');
const output = path.resolve(process.env.AI_COMPANY_LIFECYCLE_REPORT ?? '.ai-company/reports/ai-company-lifecycle-latest.json');
const maxEntries = Math.max(1, Number(process.env.AI_COMPANY_LIFECYCLE_MAX_ENTRIES ?? 10000));
const deadline = Date.now() + Math.max(100, Number(process.env.AI_COMPANY_LIFECYCLE_TIMEOUT_MS ?? 5000));
const now = Date.now();
const counts = { HOT: 0, WARM: 0, COLD: 0, EPHEMERAL: 0 };
const examples = { HOT: [], WARM: [], COLD: [], EPHEMERAL: [] };
let visited = 0;
let truncated = false;

function bucket(relative, mtimeMs) {
  const name = relative.toLowerCase();
  if (/tmp|cache|\.lock$|\.partial$|\.tmp$|\.pid$/.test(name)) return 'EPHEMERAL';
  const age = now - mtimeMs;
  if (age <= 24 * 60 * 60 * 1000) return 'HOT';
  if (age <= 7 * 24 * 60 * 60 * 1000) return 'WARM';
  return 'COLD';
}

async function walk(directory, relative = '') {
  if (visited >= maxEntries || Date.now() > deadline) { truncated = true; return; }
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    if (visited >= maxEntries || Date.now() > deadline) { truncated = true; return; }
    const entryRelative = path.join(relative, entry.name);
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { await walk(full, entryRelative); continue; }
    if (!entry.isFile()) continue;
    visited += 1;
    const metadata = await stat(full);
    const kind = bucket(entryRelative, metadata.mtimeMs);
    counts[kind] += 1;
    if (examples[kind].length < 10) examples[kind].push(entryRelative);
  }
}

await walk(root);
const report = {
  generated_at: new Date().toISOString(), root, max_entries: maxEntries,
  timeout_ms: Number(process.env.AI_COMPANY_LIFECYCLE_TIMEOUT_MS ?? 5000),
  visited_entries: visited, truncated, counts, examples,
  policy: { authoritative_retained: true, deletes_performed: false, truncated_scan_is_not_complete_inventory: true },
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (truncated && process.env.AI_COMPANY_LIFECYCLE_REQUIRE_COMPLETE === 'true') process.exitCode = 2;
