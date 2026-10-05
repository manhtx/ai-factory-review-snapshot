/**
 * Provider-agnostic debate orchestration.
 *
 * The contract mirrors the useful checkpoint/resume property of the upstream
 * TradingAgents graph while keeping the Macro OS deterministic backend free of
 * provider credentials and SDK-specific state.
 */

export const DEBATE_GRAPH_VERSION = "macro-debate-v1";

export type DebateCheckpointState =
  | "created"
  | "evidence_locked"
  | "bull_completed"
  | "bear_completed"
  | "risk_completed"
  | "verdict_completed"
  | "completed"
  | "failed";

export interface DebateCheckpoint {
  runId: string;
  sessionId: string;
  graphVersion: string;
  inputFingerprint: string;
  state: DebateCheckpointState;
  completedNodes: string[];
  outputs: Record<string, unknown>;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  failureCode?: "provider-transient" | "provider-permanent" | "schema-invalid" | "unknown";
}

export interface DebateCheckpointStore {
  get(runId: string): DebateCheckpoint | null;
  save(checkpoint: DebateCheckpoint): DebateCheckpoint;
  delete(runId: string): void;
}

export class InMemoryDebateCheckpointStore implements DebateCheckpointStore {
  private readonly checkpoints = new Map<string, DebateCheckpoint>();
  get(runId: string) { return this.checkpoints.get(runId) ?? null; }
  save(checkpoint: DebateCheckpoint) { this.checkpoints.set(checkpoint.runId, checkpoint); return checkpoint; }
  delete(runId: string) { this.checkpoints.delete(runId); }
}

const TRANSITIONS: Record<DebateCheckpointState, DebateCheckpointState | null> = {
  created: "evidence_locked",
  evidence_locked: "bull_completed",
  bull_completed: "bear_completed",
  bear_completed: "risk_completed",
  risk_completed: "verdict_completed",
  verdict_completed: "completed",
  completed: null,
  failed: null,
};

export function createDebateCheckpoint(input: { runId: string; sessionId: string; inputFingerprint: string; now?: string; graphVersion?: string }): DebateCheckpoint {
  if (!input.runId || !input.sessionId || !input.inputFingerprint) throw new Error("runId, sessionId and inputFingerprint are required");
  const now = input.now ?? new Date().toISOString();
  return { runId: input.runId, sessionId: input.sessionId, graphVersion: input.graphVersion ?? DEBATE_GRAPH_VERSION, inputFingerprint: input.inputFingerprint, state: "created", completedNodes: [], outputs: {}, attemptCount: 0, createdAt: now, updatedAt: now };
}

export function resumeDebateCheckpoint(store: DebateCheckpointStore, runId: string, input: { inputFingerprint: string; graphVersion?: string }): DebateCheckpoint {
  const checkpoint = store.get(runId);
  if (!checkpoint) throw new Error("checkpoint-not-found");
  if (checkpoint.inputFingerprint !== input.inputFingerprint) throw new Error("checkpoint-input-fingerprint-mismatch");
  if (checkpoint.graphVersion !== (input.graphVersion ?? DEBATE_GRAPH_VERSION)) throw new Error("checkpoint-graph-version-mismatch");
  if (checkpoint.state === "completed") return checkpoint;
  if (checkpoint.state === "failed") throw new Error("checkpoint-failed-requires-new-run");
  return checkpoint;
}

export function advanceDebateCheckpoint(store: DebateCheckpointStore, runId: string, input: { from: DebateCheckpointState; output?: unknown; now?: string }): DebateCheckpoint {
  const checkpoint = store.get(runId);
  if (!checkpoint) throw new Error("checkpoint-not-found");
  if (checkpoint.state !== input.from) throw new Error(`invalid-checkpoint-transition:${checkpoint.state}->${input.from}`);
  const next = TRANSITIONS[input.from];
  if (!next) return checkpoint;
  const now = input.now ?? new Date().toISOString();
  const node = next === "evidence_locked" ? "evidence" : next.replace("_completed", "");
  const updated: DebateCheckpoint = {
    ...checkpoint,
    state: next,
    completedNodes: [...checkpoint.completedNodes, node],
    outputs: input.output === undefined ? checkpoint.outputs : { ...checkpoint.outputs, [node]: input.output },
    attemptCount: checkpoint.attemptCount + 1,
    updatedAt: now,
  };
  return store.save(updated);
}

export function failDebateCheckpoint(store: DebateCheckpointStore, runId: string, failureCode: DebateCheckpoint["failureCode"], now = new Date().toISOString()): DebateCheckpoint {
  const checkpoint = store.get(runId);
  if (!checkpoint) throw new Error("checkpoint-not-found");
  if (checkpoint.state === "completed") return checkpoint;
  return store.save({ ...checkpoint, state: "failed", failureCode, attemptCount: checkpoint.attemptCount + 1, updatedAt: now });
}
