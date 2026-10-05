import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'server', 'aiCompany');
const names = (await readdir(dir)).filter((name) => /\.(ts|tsx)$/.test(name)).sort();
const manifest = { generated_at: new Date().toISOString(), source_root: 'server/aiCompany', files: names, test_files: names.filter((name) => name.endsWith('.test.ts')), public_boundary: 'server/aiCompany/index.ts' };
await writeFile(path.join(root, '.ai-company', 'PLATFORM_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`wrote ${manifest.files.length} platform files`);
