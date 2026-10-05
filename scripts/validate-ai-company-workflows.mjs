import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { getRoleContract } from '../server/aiCompany/roleContracts.ts';

const root = process.cwd();
const dir = path.join(root, '.ai-company/workflows');
const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
if (!files.length) throw new Error('no workflow definitions found');
for (const fileName of files) {
const workflow = JSON.parse(await readFile(path.join(dir, fileName), 'utf8'));
if (!workflow.workflow_id || !workflow.version || !Array.isArray(workflow.steps) || !workflow.steps.length) throw new Error(`workflow definition is incomplete: ${fileName}`);
const ids = new Set(workflow.steps.map((step) => step.id));
for (const step of workflow.steps) {
  if (!step.role || !step.output) throw new Error(`workflow step is missing role/output: ${step.id}`);
  try { getRoleContract(step.role); } catch { throw new Error(`workflow step references unknown role: ${step.role}`); }
  for (const dependency of step.depends_on ?? []) if (!ids.has(dependency)) throw new Error(`unknown workflow dependency: ${dependency}`);
}
if (workflow.workflow_id === 'product_improvement' && (!workflow.steps.some((step) => step.id === 'decide' && step.role === 'ceo-guild') || !workflow.steps.some((step) => step.id === 'measure') || !workflow.steps.some((step) => step.id === 'learn'))) throw new Error('product improvement requires decide, measure and learn steps');
console.log(`validated workflow ${workflow.workflow_id}@${workflow.version} (${workflow.steps.length} steps)`);
}
