import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { RoleWorkQueue } from './roleWorkQueue';

describe('product-path interruption and resume', () => {
  it('reclaims a killed backend product task and records one completion', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-product-recovery-'));
    const queue = new RoleWorkQueue(dir);
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'FRESHNESS-RECOVERY-DRILL', title: 'Preserve freshness provenance after interruption', role: 'backend-engineer' });
    const code = `import { RoleWorkQueue } from './server/aiCompany/roleWorkQueue.ts'; const q=new RoleWorkQueue(process.argv[1]); await q.claim(process.argv[2],'child:backend-engineer'); console.log('CLAIMED'); setInterval(()=>{},1000);`;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code, dir, item.work_id], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`child did not claim: ${output}`)), 10_000); child.stdout.on('data', () => { if (output.includes('CLAIMED')) { clearTimeout(timer); resolve(); } }); child.once('error', reject); });
    child.kill('SIGTERM');
    await once(child, 'exit');

    // A fresh runtime process reclaims the abandoned lease, then completes
    // the same assignment. The evidence ID is intentionally one stable ID.
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const restarted = new RoleWorkQueue(dir);
    await expect(restarted.recoverStaleLeases('macro-os', 1_000)).resolves.toHaveLength(1);
    await restarted.claim(item.work_id, 'fresh:backend-engineer');
    await restarted.submitForReview(item.work_id);
    await restarted.complete(item.work_id, ['freshness-recovery-evidence'], undefined, undefined, {
      role: 'backend-engineer', files_changed: [], files_not_changed: ['server/freshness.ts'],
      implementation_summary: 'reconciled interrupted product task without mutation', summary: 'reconciled interrupted product task without mutation',
      tests_run: ['product-path interruption drill'], tests_failed: [], known_limitations: ['local recovery drill'], rollback_instruction: 'none', evidence_ids: ['freshness-recovery-evidence'],
    });

    const rows = (await readFile(join(dir, 'role-work-queue.jsonl'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    const terminal = rows.filter((row: any) => row.work_id === item.work_id && row.state === 'DONE');
    expect(terminal).toHaveLength(1);
    expect(rows.filter((row: any) => row.work_id === item.work_id && row.state === 'CLAIMED')).toHaveLength(2);
  }, 20_000);
});
