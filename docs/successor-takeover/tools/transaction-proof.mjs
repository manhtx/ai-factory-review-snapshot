// Isolated storage feasibility experiment, not successor authority or runtime code.
import { DatabaseSync } from 'node:sqlite';
import { fork, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const self = fileURLToPath(import.meta.url);
function connect(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout=2000; PRAGMA synchronous=FULL;');
  return db;
}

if (process.argv[2] === 'worker') {
  const [, , , file, command, expectedText, mode] = process.argv;
  const db = connect(file);
  process.send({ type: 'ready' });
  process.once('message', () => {
    try {
      db.exec('BEGIN IMMEDIATE');
      const previous = db.prepare('SELECT revision FROM receipts WHERE command = ?').get(command);
      if (previous) {
        db.exec('ROLLBACK');
        process.send({ type: 'result', outcome: 'REPLAY', revision: previous.revision, command });
      } else {
        const update = db.prepare('UPDATE authority SET revision = revision + 1, owner = ? WHERE id = 1 AND revision = ?').run(command, Number(expectedText));
        if (update.changes !== 1) {
          db.exec('ROLLBACK');
          process.send({ type: 'result', outcome: 'STALE_REJECTED', command });
        } else {
          const row = db.prepare('SELECT revision FROM authority WHERE id = 1').get();
          db.prepare('INSERT INTO receipts(command, revision) VALUES (?, ?)').run(command, row.revision);
          if (mode === 'crash') {
            process.on('message', () => {}); // Keep IPC live until the parent kills the prepared transaction.
            process.send({ type: 'prepared' });
            return; // Parent kills this process while transaction and IPC remain open.
          }
          db.exec('COMMIT');
          process.send({ type: 'result', outcome: 'COMMITTED', revision: row.revision, command });
        }
      }
      db.close();
      process.disconnect();
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* no transaction began */ }
      process.send({ type: 'result', outcome: 'ERROR', error: error.message, command });
      db.close(); process.disconnect(); process.exitCode = 1;
    }
  });
} else {
  const engine = process.argv[2] ?? 'sqlite';
  if (!['sqlite', 'files'].includes(engine)) throw new Error('Use sqlite or files');
  const root = mkdtempSync(path.join(tmpdir(), 'successor-transaction-proof-'));
  const file = path.join(root, engine === 'sqlite' ? 'candidate.sqlite' : 'candidate.json');
  const db = engine === 'sqlite' ? connect(file) : null;
  if (db) {
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE authority(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, owner TEXT NOT NULL); CREATE TABLE receipts(command TEXT PRIMARY KEY, revision INTEGER NOT NULL);');
    db.prepare('INSERT INTO authority VALUES(1,1,?)').run('initial');
  } else writeFileSync(file, JSON.stringify({ id: 1, revision: 1, owner: 'initial', receipts: {} }));
  const state = () => db ? db.prepare('SELECT * FROM authority WHERE id = 1').get() : (() => {
    const { id, revision, owner } = JSON.parse(readFileSync(file, 'utf8')); return { id, revision, owner };
  })();
  const receipt = command => db ? db.prepare('SELECT * FROM receipts WHERE command = ?').get(command) : JSON.parse(readFileSync(file, 'utf8')).receipts[command];
  function contender(command, revision, mode = 'normal') {
    const child = engine === 'sqlite'
      ? fork(self, ['worker', file, command, String(revision), mode], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
      : spawn('python3', [path.join(path.dirname(self), 'transaction-file-worker.py'), file, command, String(revision), mode], { stdio: ['pipe', 'pipe', 'pipe'] });
    let resolveReady, rejectReady, resolveResult, rejectResult, result, errorText = '', prepared = false;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const done = new Promise((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 6000);
    child.stderr.on('data', bytes => { errorText += bytes; });
    child.on('error', error => { rejectReady(error); rejectResult(error); });
    const messageReceived = message => {
      if (message.type === 'ready') resolveReady();
      if (message.type === 'result') result = message;
      if (message.type === 'prepared' && mode === 'crash') { prepared = true; child.kill('SIGKILL'); }
    };
    if (engine === 'sqlite') child.on('message', messageReceived);
    else {
      let pending = '';
      child.stdout.on('data', bytes => {
        pending += bytes;
        let newline;
        while ((newline = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
          messageReceived(JSON.parse(line));
        }
      });
    }
    child.on('exit', (code, signal) => {
      clearTimeout(timeout);
      if (mode === 'crash' && prepared && signal === 'SIGKILL') resolveResult({ outcome: 'KILLED_WITH_OPEN_TRANSACTION' });
      else if (code === 0 && result) resolveResult(result);
      else { const error = new Error(`Worker ${command} exited ${code}/${signal}: ${errorText}`); rejectReady(error); rejectResult(error); }
    });
    return { ready, done, start: () => engine === 'sqlite' ? child.send('go') : child.stdin.write('go\n') };
  }
  async function runOne(command, revision, mode) {
    const worker = contender(command, revision, mode);
    await worker.ready; worker.start(); return worker.done;
  }
  const workers = Array.from({ length: 8 }, (_, i) => contender(`contender-${i}`, 1));
  await Promise.all(workers.map(worker => worker.ready));
  workers.forEach(worker => worker.start());
  const outcomes = await Promise.all(workers.map(worker => worker.done));
  assert.equal(outcomes.filter(result => result.outcome === 'COMMITTED').length, 1);
  assert.equal(outcomes.filter(result => result.outcome === 'STALE_REJECTED').length, 7);
  const winner = outcomes.find(result => result.outcome === 'COMMITTED');
  const replay = await runOne(winner.command, 1);
  assert.equal(replay.outcome, 'REPLAY');
  const crash = await runOne('interrupted', 2, 'crash');
  const afterCrash = state();
  assert.equal(afterCrash.revision, 2);
  assert.equal(receipt('interrupted'), undefined);
  const recovered = await runOne('after-crash', 2);
  assert.equal(recovered.outcome, 'COMMITTED');
  db?.close();
  const reopened = engine === 'sqlite' ? connect(file) : null;
  const durable = reopened ? reopened.prepare('SELECT * FROM authority').get() : state();
  const receipts = reopened ? reopened.prepare('SELECT * FROM receipts ORDER BY revision').all()
    : Object.entries(JSON.parse(readFileSync(file, 'utf8')).receipts).map(([command, revision]) => ({ command, revision })).sort((a, b) => a.revision - b.revision);
  assert.equal(durable.revision, 3);
  assert.equal(receipts.length, 2);
  reopened?.close();
  const evidence = { schema: 'successor-takeover.transaction-feasibility.v1', generatedAt: new Date().toISOString(), root,
    engine, harnessSha256: createHash('sha256').update(readFileSync(self)).digest('hex'),
    fileWorkerSha256: createHash('sha256').update(readFileSync(path.join(path.dirname(self), 'transaction-file-worker.py'))).digest('hex'),
    concurrentOutcomes: outcomes, duplicateCommand: replay, interruptedCommit: crash, afterCrash, recovered, durable, receipts,
    claimLimit: 'Disposable engine feasibility for revision CAS, receipt replay and process-crash atomicity only. File variant uses POSIX flock and fsynced atomic whole-state replacement. No mission/authority/evidence policy, full effect idempotency, power-loss recovery, hostile writer exclusion or migration proof.' };
  writeFileSync(path.join(root, 'evidence.json'), JSON.stringify(evidence, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ engine, evidence: path.join(root, 'evidence.json'), committed: 1, staleRejected: 7, duplicate: replay.outcome, crash: crash.outcome, afterRestartRevision: durable.revision }));
}
