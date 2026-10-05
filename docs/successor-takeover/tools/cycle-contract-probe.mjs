import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const root = process.cwd();
const { selectRiskAdaptiveWorkflow } = await import(pathToFileURL(resolve(root, 'server/aiCompany/riskAdaptiveWorkflow.ts')).href);
const route = selectRiskAdaptiveWorkflow('P1', 'data_change');
const dir = await mkdtemp(join(tmpdir(), 'takeover-contract-'));
try {
  const script = resolve(root, 'scripts/create-codex-product-cycle.mjs');
  const loader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
  await promisify(execFile)(process.execPath, ['--import', loader, script], { cwd: dir, timeout: 10000,
    env: { PATH: process.env.PATH ?? '', AI_COMPANY_PRODUCT_CYCLE: 'true', AI_COMPANY_PRODUCT_CYCLE_LEAN: 'true',
      AI_COMPANY_CYCLE_ROLES: route.roles.join(','), AI_COMPANY_OBJECTIVE_ID: 'ISOLATED-CONTRACT-PROBE',
      AI_COMPANY_OBJECTIVE: 'Inspect turning-point confirmation lag', AI_COMPANY_ALLOWED_PATHS: '.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json' } });
  const rows = (await readFile(join(dir, '.ai-company/runtime/projects/macro-os/role-work-queue.jsonl'), 'utf8')).split('\n').filter(line => line.trim()).map(JSON.parse);
  console.log(JSON.stringify({ schema: 'successor-takeover.cycle-contract-probe.v1',
    sourceSha256: createHash('sha256').update(await readFile(script)).digest('hex'),
    selectedRisk: route.risk_level, selectedRoles: route.roles,
    assignments: rows.map(row => ({ role: row.role, risk: row.assignment.risk_level, workflow: row.workflow_id, allowedPaths: row.assignment.allowed_paths, acceptance: row.assignment.acceptance_criteria })),
    claimLimit: 'Actual creator CLI in temporary cwd with caller-shaped P1 route inputs. No provider, work executor, canonical state or historical-runtime attestation.',
  }, null, 2));
} finally { await rm(dir, { recursive: true, force: true }); }
