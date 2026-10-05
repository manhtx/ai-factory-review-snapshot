import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageQueue, verifyStage } from './migration-staging.mjs';

test('roundtrip preserves history, latest identity and edges without granting trust', () => {
  const records = [{ work_id: 'a', state: 'READY' }, { work_id: 'a', state: 'DONE', evidence_ids: [] }, { work_id: 'b', state: 'QUARANTINED', depends_on: ['a', 'missing'], assignment: { objective_id: 'objective' }, backlog_id: 'cycle' }];
  const bytes = Buffer.from(records.map(row => JSON.stringify(row)).join('\n') + '\n\n');
  const stage = stageQueue(bytes);
  assert.deepEqual(Buffer.from(stage.sourceBytesBase64, 'base64'), bytes);
  assert.equal(stage.items[0].stagingClassification, 'MIGRATED_AS_UNVERIFIED');
  assert.equal(stage.items[0].objectiveId, null);
  assert.equal(stage.items[1].objectiveId, 'objective');
  assert.equal(stage.items[1].backlogId, 'cycle');
  assert.deepEqual(stage.items[1].unresolvedDependencies, ['missing']);
  assert.equal(verifyStage(stage, stage.sourceSha256).latestRows, 2);
});
test('rejects malformed history and missing identity', () => {
  for (const input of ['{bad}', '{"state":"DONE"}', 'null']) assert.throws(() => stageQueue(Buffer.from(input)));
});
test('detects changed classification, missing rows, altered edges and source bytes', () => {
  const baseline = stageQueue(Buffer.from('{"work_id":"a","depends_on":["missing"]}\n'));
  for (const mutate of [x => { x.items[0].stagingClassification = 'TRUSTED'; }, x => { x.items = []; }, x => { x.items[0].original.depends_on = []; }, x => { x.sourceBytesBase64 = ''; }, x => { x.authoritative = true; }]) {
    const copy = structuredClone(baseline); mutate(copy); assert.throws(() => verifyStage(copy, baseline.sourceSha256));
  }
});

test('requires an external source anchor and rejects coherently changed artifacts', () => {
  const original = stageQueue(Buffer.from('{"work_id":"original"}\n'));
  const changed = stageQueue(Buffer.from('{"work_id":"different"}\n'));
  assert.throws(() => verifyStage(original));
  assert.throws(() => verifyStage(original, 'invalid'));
  assert.throws(() => verifyStage(changed, original.sourceSha256));
});
