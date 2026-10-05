#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaDir = path.join(root, '.ai-company', 'schemas');
const required = [
  'task.schema.json',
  'decision.schema.json',
  'evidence.schema.json',
  'test-report.schema.json',
];

for (const file of required) {
  const full = path.join(schemaDir, file);
  if (!fs.existsSync(full)) throw new Error(`missing schema: ${file}`);
  const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (parsed.type !== 'object' || parsed.additionalProperties !== false) {
    throw new Error(`schema must be a closed object: ${file}`);
  }
  if (!Array.isArray(parsed.required) || parsed.required.length === 0) {
    throw new Error(`schema has no required fields: ${file}`);
  }
}

const state = JSON.parse(fs.readFileSync(path.join(root, '.ai-company', 'company-state.json'), 'utf8'));
if (!state.schema_version || !state.phase || typeof state.stop_requested !== 'boolean') {
  throw new Error('company-state.json is missing required control fields');
}

const manifestPath = path.join(root, '.ai-company', 'PLATFORM_MANIFEST.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.public_boundary !== 'server/aiCompany/index.ts' || !Array.isArray(manifest.files)) throw new Error('invalid AI Company platform manifest');
  for (const file of manifest.files) if (!fs.existsSync(path.join(root, manifest.source_root, file))) throw new Error(`manifest file missing: ${file}`);
}

console.log(`validated ${required.length} closed artifact schemas and company state`);
