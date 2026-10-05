import { DatabaseSync } from 'node:sqlite';
import { closeSync, lstatSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

export interface GovernanceBinding {
  missionHash: string;
  envelopeHash: string;
  policyHash: string;
  trustEpoch: string;
}
export interface AuthoritySnapshot { owner: string; revision: number; }
export interface AdvanceAuthority {
  commandId: string;
  actor: string;
  expectedRevision: number;
  nextOwner: string;
}
export interface AuthorityReceipt extends AuthoritySnapshot { commandId: string; replayed: boolean; }

const SCHEMA = 'successor-governance-v2';
const TABLES = {
  binding: 'CREATE TABLE binding (singleton INTEGER PRIMARY KEY CHECK(singleton=1), schema_version TEXT NOT NULL, identity TEXT NOT NULL, initial_owner TEXT NOT NULL) STRICT',
  authority: 'CREATE TABLE authority (singleton INTEGER PRIMARY KEY CHECK(singleton=1), owner TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>=0)) STRICT',
  commands: 'CREATE TABLE commands (command_id TEXT PRIMARY KEY, digest TEXT NOT NULL, actor TEXT NOT NULL, expected_revision INTEGER NOT NULL CHECK(expected_revision>=0), owner TEXT NOT NULL, revision INTEGER NOT NULL UNIQUE CHECK(revision>0)) STRICT',
};
const identity = (value: string) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) throw new Error('INVALID_GOVERNANCE_IDENTITY');
  return value;
};
function bindingIdentity(binding: GovernanceBinding): string {
  const hashes = [binding.missionHash, binding.envelopeHash, binding.policyHash];
  for (const hash of hashes) {
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('INVALID_GOVERNANCE_BINDING');
  }
  return JSON.stringify([...hashes, identity(binding.trustEpoch)]);
}
const commandDigest = (command: AdvanceAuthority) => createHash('sha256').update(JSON.stringify(command)).digest('hex');

/** Isolated storage core. Actor authentication and filesystem exclusion belong
 * to the trusted runtime gateway, not to caller-supplied identity strings. */
export class SuccessorGovernanceStore {
  private constructor(private readonly db: DatabaseSync, private readonly binding: string) {}

  static createNew(file: string, expected: GovernanceBinding, initialOwner: string): SuccessorGovernanceStore {
    const binding = bindingIdentity(expected);
    identity(initialOwner);
    mkdirSync(dirname(file), { recursive: true });
    // Interrupted genesis leaves a visibly invalid file, never an empty healthy company.
    closeSync(openSync(file, 'wx', 0o600));
    const db = new DatabaseSync(file);
    try {
      db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000; BEGIN EXCLUSIVE;');
      db.exec(Object.values(TABLES).join(';'));
      db.prepare('INSERT INTO binding VALUES (1, ?, ?, ?)').run(SCHEMA, binding, initialOwner);
      db.prepare('INSERT INTO authority VALUES (1, ?, 0)').run(initialOwner);
      db.exec('COMMIT');
      return new SuccessorGovernanceStore(db, binding);
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* Genesis may not have begun. */ }
      db.close(); throw error;
    }
  }

  static openExisting(file: string, expected: GovernanceBinding): SuccessorGovernanceStore {
    const binding = bindingIdentity(expected);
    const stat = lstatSync(file); // ENOENT is a failure, not implicit initialization.
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('GOVERNANCE_STORAGE_NOT_REGULAR');
    const db = new DatabaseSync(file);
    try {
      db.exec('PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000;');
      const store = new SuccessorGovernanceStore(db, binding);
      store.authority();
      return store;
    } catch (error) { db.close(); throw error; }
  }

  private assertBinding(): string {
    const objects = this.db.prepare('SELECT name, type, sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY name').all();
    if (objects.length !== Object.keys(TABLES).length || objects.some(row => row.type !== 'table'
      || !(String(row.name) in TABLES) || row.sql !== TABLES[row.name as keyof typeof TABLES])) throw new Error('GOVERNANCE_SCHEMA_MISMATCH');
    if (this.db.prepare('PRAGMA journal_mode').get()?.journal_mode !== 'wal'
      || this.db.prepare('PRAGMA synchronous').get()?.synchronous !== 2) throw new Error('GOVERNANCE_DURABILITY_SETTINGS_MISMATCH');
    const row = this.db.prepare('SELECT schema_version, identity, initial_owner FROM binding WHERE singleton=1').get();
    if (!row || row.schema_version !== SCHEMA || row.identity !== this.binding) throw new Error('GOVERNANCE_BINDING_MISMATCH');
    if (typeof row.initial_owner !== 'string') throw new Error('GOVERNANCE_STATE_INVALID');
    return identity(row.initial_owner);
  }

  private readValidatedAuthority(): AuthoritySnapshot {
    let owner = this.assertBinding();
    const row = this.db.prepare('SELECT owner, revision FROM authority WHERE singleton=1').get();
    if (!row || typeof row.owner !== 'string' || typeof row.revision !== 'number' || !Number.isSafeInteger(row.revision) || row.revision < 0) throw new Error('GOVERNANCE_STATE_INVALID');
    const receipts = this.db.prepare('SELECT command_id, digest, actor, expected_revision, owner, revision FROM commands ORDER BY revision').all();
    if (receipts.length !== row.revision) throw new Error('GOVERNANCE_HISTORY_INCOMPLETE');
    for (const [index, receipt] of receipts.entries()) {
      if (receipt.revision !== index + 1 || receipt.expected_revision !== index || receipt.actor !== owner
        || typeof receipt.command_id !== 'string' || typeof receipt.owner !== 'string') throw new Error('GOVERNANCE_HISTORY_INVALID');
      const expectedDigest = commandDigest({ commandId: identity(receipt.command_id), actor: owner,
        expectedRevision: index, nextOwner: identity(receipt.owner) });
      if (receipt.digest !== expectedDigest) throw new Error('GOVERNANCE_RECEIPT_INVALID');
      owner = receipt.owner;
    }
    if (row.owner !== owner) throw new Error('GOVERNANCE_AUTHORITY_PROJECTION_MISMATCH');
    return { owner, revision: row.revision };
  }

  authority(): AuthoritySnapshot {
    this.db.exec('BEGIN');
    try {
      const row = this.readValidatedAuthority();
      this.db.exec('COMMIT');
      return row;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* Preserve original failure. */ }
      throw error;
    }
  }

  advanceAuthority(input: AdvanceAuthority): AuthorityReceipt {
    const command = { commandId: identity(input.commandId), actor: identity(input.actor),
      expectedRevision: input.expectedRevision, nextOwner: identity(input.nextOwner) };
    if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0 || command.expectedRevision >= Number.MAX_SAFE_INTEGER) throw new Error('INVALID_GOVERNANCE_REVISION');
    const digest = commandDigest(command);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.readValidatedAuthority();
      // Replays do not bypass current authorization.
      if (command.actor !== current.owner) throw new Error('GOVERNANCE_ACTOR_NOT_CURRENT');
      const previous = this.db.prepare('SELECT digest, owner, revision FROM commands WHERE command_id=?').get(command.commandId);
      if (previous) {
        if (previous.digest !== digest) throw new Error('GOVERNANCE_COMMAND_ID_CONFLICT');
        if (previous.owner !== command.nextOwner || previous.revision !== command.expectedRevision + 1) throw new Error('GOVERNANCE_RECEIPT_INVALID');
        this.db.exec('COMMIT');
        return { commandId: command.commandId, owner: identity(previous.owner), revision: previous.revision, replayed: true };
      }
      if (command.expectedRevision !== current.revision) throw new Error('GOVERNANCE_STALE_REVISION');
      const revision = current.revision + 1;
      const changed = this.db.prepare('UPDATE authority SET owner=?, revision=? WHERE singleton=1 AND revision=? AND owner=?').run(command.nextOwner, revision, current.revision, command.actor);
      if (changed.changes !== 1) throw new Error('GOVERNANCE_CAS_FAILED');
      const inserted = this.db.prepare('INSERT INTO commands VALUES (?, ?, ?, ?, ?, ?)').run(command.commandId, digest, command.actor, command.expectedRevision, command.nextOwner, revision);
      if (inserted.changes !== 1) throw new Error('GOVERNANCE_RECEIPT_NOT_COMMITTED');
      const projected = this.readValidatedAuthority();
      if (projected.owner !== command.nextOwner || projected.revision !== revision) throw new Error('GOVERNANCE_COMMIT_MISMATCH');
      this.db.exec('COMMIT');
      return { commandId: command.commandId, owner: command.nextOwner, revision, replayed: false };
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* Preserve the original failure. */ }
      throw error;
    }
  }

  close(): void { this.db.close(); }
}
