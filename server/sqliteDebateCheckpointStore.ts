import type { DebateCheckpoint, DebateCheckpointStore } from "./debateOrchestrator.js";
import { deleteDebateCheckpoint, getDebateCheckpoint, saveDebateCheckpoint } from "./db.js";

/** Durable local adapter for the provider-agnostic checkpoint contract. */
export class SqliteDebateCheckpointStore implements DebateCheckpointStore {
  get(runId: string) { return getDebateCheckpoint(runId); }
  save(checkpoint: DebateCheckpoint) { return saveDebateCheckpoint(checkpoint); }
  delete(runId: string) { deleteDebateCheckpoint(runId); }
}
