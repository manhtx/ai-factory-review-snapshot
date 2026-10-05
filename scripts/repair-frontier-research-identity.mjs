#!/usr/bin/env node
import { readFile, rename, writeFile } from 'node:fs/promises';

const path = '.ai-company/product-intelligence/QUALIFIED_WORK_INVENTORY.json';
const inventory = JSON.parse(await readFile(path, 'utf8'));
const duplicates = (inventory.items || []).filter((item) =>
  String(item.id || '').startsWith('RQ-FRONTIER-') &&
  (inventory.items || []).some((candidate) => candidate.id === `QW-${item.id}`)
);
if (duplicates.length) {
  const mergedAt = new Date().toISOString();
  for (const duplicate of duplicates) {
    const canonicalId = `QW-${duplicate.id}`;
    duplicate.qualification_status = 'MERGED_SUPERSEDED';
    duplicate.status = 'ARCHIVED';
    duplicate.superseded_by = canonicalId;
    duplicate.superseded_reason = 'Duplicate inventory identity created during frontier research routing; canonical work item is QW-*.';
    duplicate.merged_at = mergedAt;
  }
  const tmp = `${path}.repair.tmp`;
  await writeFile(tmp, JSON.stringify({ ...inventory, updated_at: new Date().toISOString() }, null, 2) + '\n', 'utf8');
  await rename(tmp, path);
  console.log(JSON.stringify({ status: 'MERGED_DUPLICATES', duplicate_ids: duplicates.map((item) => item.id), canonical_ids: duplicates.map((item) => `QW-${item.id}`) }));
} else {
  console.log(JSON.stringify({ status: 'NO_DUPLICATES' }));
}
