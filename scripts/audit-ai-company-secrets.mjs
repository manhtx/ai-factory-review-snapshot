import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// A text-pattern scan cannot establish that browser host state is absent.
// Git failure must never turn an unknown inventory into a clean certificate.
let tracked;
try {
  tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\0').filter(Boolean);
} catch {
  console.error('security census unavailable: cannot enumerate tracked source paths');
  process.exit(1);
}
const privatePaths = tracked.filter(file => /(^|\/)(?:\.chrome[^/]*|\.chromium[^/]*|browser[-_]?profiles?|chrome[-_]?profiles?)(?:\/|$)/i.test(file)
  || /(^|\/)profiles\/(?:firefox|chrome|chromium)(?:\/|$)/i.test(file)
  || /(^|\/)(?:Cookies|History|Login Data|Web Data|Secure Preferences|Local State|cookies\.sqlite|logins\.json|key4\.db|places\.sqlite)(?:-journal|-wal|-shm)?$/.test(file));
if (privatePaths.length) {
  console.error(`private browser host state is tracked: ${privatePaths.length} paths; remove it from source authority while preserving local data`);
  process.exit(1);
}
const hostIdentityPaths = new Set([
  '.ai-company/.controller.lock', '.ai-company/last-exit-code',
  '.ai-company/maintenance/lease.json', '.ai-company/runtime/EXECUTION_LEASE.json',
  '.ai-company/runtime/HEARTBEAT.json', '.ai-company/runtime/supervisor-lease.json',
]);
const trackedHostIdentities = tracked.filter(file => hostIdentityPaths.has(file));
if (trackedHostIdentities.length) {
  console.error(`live host identity is tracked: ${trackedHostIdentities.length} paths; preserve local state and separate it from source authority`);
  process.exit(1);
}

const root = path.join(process.cwd(), '.ai-company');
const patterns = [/bot\d+:[A-Za-z0-9_-]{20,}/i, /sk-[A-Za-z0-9]{20,}/, /-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----/, /AI_COMPANY_TELEGRAM_BOT_TOKEN\s*[:=]/];
const hits = [];
async function walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.name === 'node_modules' || entry.name === 'logs' || entry.name === 'worktrees') continue; if (entry.isDirectory()) await walk(file); else { const text = await readFile(file, 'utf8'); for (const pattern of patterns) if (pattern.test(text)) hits.push(path.relative(process.cwd(), file)); } } }
try {
  await walk(root);
} catch {
  console.error('security inspection unavailable: cannot read every file within the audited scope');
  process.exit(1);
}
if (hits.length) { console.error(`potential secrets found in: ${[...new Set(hits)].join(', ')}`); process.exitCode = 1; } else console.log('no tracked browser/known live host identity paths or known secret patterns found within the audited scope; historical exposure is not certified');
