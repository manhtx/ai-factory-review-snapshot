import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runMacroOsCorpus } from '../server/aiCompany/macroOsCorpus.ts';

const rounds = Number(process.env.MACRO_OS_ROUNDS ?? 3);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) throw new Error('MACRO_OS_ROUNDS must be an integer from 1 to 20');
const report = await runMacroOsCorpus(undefined, rounds);
const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
const outDir = path.resolve('.ai-company/reports');
const outFile = path.join(outDir, `macro-os-corpus-${stamp}.json`);
await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify({ generated_at: new Date().toISOString(), ...report }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ passed: report.passed, cases: report.cases.length, report: outFile }, null, 2));
if (!report.passed) process.exitCode = 1;
