import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

export type ExecutionLeaseStatus = 'ACTIVE' | 'SUPERSEDED' | 'REVOKED' | 'EXPIRED';
export type SourceOfSelection = 'explicit_interactive_handoff' | 'takeover' | 'run_continuation';

export interface ModelMetadata {
  display_model: string;
  runtime_model_id: string;
  provider: string;
  runner: 'agy' | 'codex';
}

export interface ExecutionLease {
  schema_version: '1.0.0';
  lease_id: string;
  marathon_id: string;
  run_id: string;
  controller: string;
  provider: string;
  display_model: string;
  runtime_model_id: string;
  runner: 'agy' | 'codex';
  affinity_revision: number;
  issued_at: string;
  source_of_selection: SourceOfSelection;
  status: ExecutionLeaseStatus;
  takeover_predecessor?: string | null;
  resource_state?: {
    status: 'OK' | 'WAIT_SAME_PROVIDER';
    reason?: string;
    retry_not_before?: string | null;
  };
}

export interface CreateLeaseInput {
  marathon_id?: string;
  run_id?: string;
  controller: string;
  provider?: string;
  display_model?: string;
  runtime_model_id?: string;
  model?: string;
  runner?: 'agy' | 'codex';
  expectedRevision?: number;
  source_of_selection?: SourceOfSelection;
}

export interface TakeoverInput {
  controller: string;
  model: string;
  provider?: string;
  runner?: 'agy' | 'codex';
  expectedRevision?: number;
  isCognitionActive?: boolean;
}

export type AuthorityResolutionStatus =
  | 'RESOLVED'
  | 'EXECUTOR_AFFINITY_UNRESOLVED'
  | 'STALE_LEASE_REVISION'
  | 'SPLIT_BRAIN_ATTEMPT'
  | 'RESOURCE_WAIT'
  | 'LEASE_INACTIVE';

export interface AuthorityResolutionResult {
  status: AuthorityResolutionStatus;
  lease?: ExecutionLease;
  reason?: string;
}

/**
 * Known model normalization table mapping friendly display names,
 * CLI slugs, and runtime IDs to their canonical representations.
 */
const KNOWN_MODELS: Record<string, ModelMetadata> = {
  // Gemini family
  'gemini-3.8-flash-high': {
    display_model: 'Gemini 3.8 Flash High',
    runtime_model_id: 'gemini-3.8-flash-high',
    provider: 'gemini',
    runner: 'agy',
  },
  'gemini 3.8 flash high': {
    display_model: 'Gemini 3.8 Flash High',
    runtime_model_id: 'gemini-3.8-flash-high',
    provider: 'gemini',
    runner: 'agy',
  },
  'gemini 3.8 flash (high)': {
    display_model: 'Gemini 3.8 Flash High',
    runtime_model_id: 'gemini-3.8-flash-high',
    provider: 'gemini',
    runner: 'agy',
  },
  'gemini-3.7-flash-high': {
    display_model: 'Gemini 3.7 Flash High',
    runtime_model_id: 'gemini-3.7-flash-high',
    provider: 'gemini',
    runner: 'agy',
  },
  'gemini 3.7 flash high': {
    display_model: 'Gemini 3.7 Flash High',
    runtime_model_id: 'gemini-3.7-flash-high',
    provider: 'gemini',
    runner: 'agy',
  },
  'gemini-3.6-flash-medium': {
    display_model: 'Gemini 3.6 Flash Medium',
    runtime_model_id: 'gemini-3.6-flash-medium',
    provider: 'gemini',
    runner: 'agy',
  },
  'gemini 3.6 flash (medium)': {
    display_model: 'Gemini 3.6 Flash Medium',
    runtime_model_id: 'gemini-3.6-flash-medium',
    provider: 'gemini',
    runner: 'agy',
  },
  // OpenAI family
  'gpt-5.6-sol': {
    display_model: 'GPT-5.6 Sol',
    runtime_model_id: 'gpt-5.6-sol',
    provider: 'openai',
    runner: 'codex',
  },
  'gpt-5.6 sol': {
    display_model: 'GPT-5.6 Sol',
    runtime_model_id: 'gpt-5.6-sol',
    provider: 'openai',
    runner: 'codex',
  },
  'gpt-5': {
    display_model: 'GPT-5',
    runtime_model_id: 'gpt-5',
    provider: 'openai',
    runner: 'codex',
  },
  'gpt-5.6-preview': {
    display_model: 'GPT-5.6 Preview',
    runtime_model_id: 'gpt-5.6-preview',
    provider: 'openai',
    runner: 'codex',
  },
  // Anthropic family (supported via agy or other runners)
  'claude-sonnet-4-6': {
    display_model: 'Claude Sonnet 4.6 (Thinking)',
    runtime_model_id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    runner: 'agy',
  },
  'claude sonnet 4.6': {
    display_model: 'Claude Sonnet 4.6 (Thinking)',
    runtime_model_id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    runner: 'agy',
  },
  'claude sonnet 4.6 (thinking)': {
    display_model: 'Claude Sonnet 4.6 (Thinking)',
    runtime_model_id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    runner: 'agy',
  },
  // Open-source models
  'gpt-oss-120b-medium': {
    display_model: 'GPT-OSS 120B (Medium)',
    runtime_model_id: 'gpt-oss-120b-medium',
    provider: 'oss',
    runner: 'agy',
  },
};

/**
 * Resolves a model identifier or friendly label to its normalized metadata.
 * Returns null if model is unrecognized or ambiguous.
 */
export function resolveModelMetadata(
  modelInput: string,
  explicitProvider?: string,
  explicitRunner?: 'agy' | 'codex'
): ModelMetadata | null {
  if (!modelInput || typeof modelInput !== 'string') return null;
  const normalizedKey = modelInput.trim().toLowerCase();

  // Exact known model match
  if (KNOWN_MODELS[normalizedKey]) {
    const entry = KNOWN_MODELS[normalizedKey];
    return {
      display_model: entry.display_model,
      runtime_model_id: entry.runtime_model_id,
      provider: explicitProvider || entry.provider,
      runner: explicitRunner || entry.runner,
    };
  }

  // If explicit provider and runner are supplied, allow custom/new model
  if (explicitProvider && explicitRunner) {
    return {
      display_model: modelInput.trim(),
      runtime_model_id: modelInput.trim(),
      provider: explicitProvider,
      runner: explicitRunner,
    };
  }

  // Model known by prefix/pattern
  if (normalizedKey.startsWith('gemini')) {
    return {
      display_model: modelInput.trim(),
      runtime_model_id: normalizedKey,
      provider: explicitProvider || 'gemini',
      runner: explicitRunner || 'agy',
    };
  }
  if (normalizedKey.startsWith('gpt-')) {
    return {
      display_model: modelInput.trim(),
      runtime_model_id: normalizedKey,
      provider: explicitProvider || 'openai',
      runner: explicitRunner || 'codex',
    };
  }
  if (normalizedKey.startsWith('claude')) {
    return {
      display_model: modelInput.trim(),
      runtime_model_id: normalizedKey,
      provider: explicitProvider || 'anthropic',
      runner: explicitRunner || 'agy',
    };
  }

  // Ambiguous or unknown
  return null;
}

export class ExecutionLeaseManager {
  private readonly leaseFile: string;
  private readonly runtimeDir: string;

  constructor(
    private readonly rootDir: string,
    customLeaseFile?: string
  ) {
    this.runtimeDir = path.join(rootDir, '.ai-company', 'runtime');
    this.leaseFile = customLeaseFile || path.join(this.runtimeDir, 'EXECUTION_LEASE.json');
  }

  async loadActiveLease(): Promise<ExecutionLease | null> {
    try {
      const data = await readFile(this.leaseFile, 'utf8');
      const lease = JSON.parse(data) as ExecutionLease;
      return lease;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async saveLease(lease: ExecutionLease): Promise<void> {
    await mkdir(path.dirname(this.leaseFile), { recursive: true });
    const tmpFile = `${this.leaseFile}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    await writeFile(tmpFile, JSON.stringify(lease, null, 2) + '\n', 'utf8');
    const { rename } = await import('node:fs/promises');
    await rename(tmpFile, this.leaseFile);
  }

  /**
   * LEVEL 1: Explicit current run handoff or creation of lease.
   */
  async createOrUpdateExecutionLease(input: CreateLeaseInput): Promise<ExecutionLease> {
    if (!input.controller || !input.controller.trim()) {
      throw new Error('EXECUTOR_AFFINITY_UNRESOLVED: controller is required for execution lease handoff');
    }

    const rawModel = input.model || input.runtime_model_id || input.display_model;
    if (!rawModel || !rawModel.trim()) {
      throw new Error('EXECUTOR_AFFINITY_UNRESOLVED: model is required for execution lease handoff');
    }

    const resolved = resolveModelMetadata(rawModel, input.provider, input.runner);
    if (!resolved) {
      throw new Error(`EXECUTOR_AFFINITY_UNRESOLVED: model '${rawModel}' could not be resolved to valid provider and runner`);
    }

    const existing = await this.loadActiveLease();
    let nextRevision = 1;
    let predecessor: string | null = null;

    if (existing) {
      // Split-brain and CAS protection:
      // If expectedRevision was explicitly provided, it must match existing.affinity_revision
      if (input.expectedRevision !== undefined && input.expectedRevision !== existing.affinity_revision) {
        if (input.expectedRevision < existing.affinity_revision) {
          throw new Error(
            `STALE_LEASE_REVISION: expected revision ${input.expectedRevision} but active revision is ${existing.affinity_revision}`
          );
        } else {
          throw new Error(
            `SPLIT_BRAIN_ATTEMPT: revision mismatch (expected ${input.expectedRevision}, current ${existing.affinity_revision})`
          );
        }
      }

      nextRevision = existing.affinity_revision + 1;
      predecessor = existing.lease_id;
    }

    const marathonId = input.marathon_id || existing?.marathon_id || 'MARATHON-ANTIGRAVITY-PERPETUAL-01';
    const runId = input.run_id || existing?.run_id || `run-${Date.now()}`;
    const leaseId = `LEASE:${marathonId}:rev-${nextRevision}`;

    const newLease: ExecutionLease = {
      schema_version: '1.0.0',
      lease_id: leaseId,
      marathon_id: marathonId,
      run_id: runId,
      controller: input.controller.trim().toLowerCase(),
      provider: resolved.provider,
      display_model: resolved.display_model,
      runtime_model_id: resolved.runtime_model_id,
      runner: resolved.runner,
      affinity_revision: nextRevision,
      issued_at: new Date().toISOString(),
      source_of_selection: input.source_of_selection || 'explicit_interactive_handoff',
      status: 'ACTIVE',
      takeover_predecessor: predecessor,
      resource_state: {
        status: 'OK',
      },
    };

    await this.saveLease(newLease);
    return newLease;
  }

  /**
   * LEVEL 2: Takeover from a new controller or model change.
   */
  async takeoverExecutionLease(input: TakeoverInput): Promise<ExecutionLease> {
    if (input.isCognitionActive) {
      throw new Error('TAKEOVER_REJECTED: active atomic cognition in flight; safe takeover requires durable boundary');
    }

    const existing = await this.loadActiveLease();
    if (!existing) {
      return this.createOrUpdateExecutionLease({
        controller: input.controller,
        model: input.model,
        provider: input.provider,
        runner: input.runner,
        source_of_selection: 'takeover',
      });
    }

    if (input.expectedRevision !== undefined && input.expectedRevision !== existing.affinity_revision) {
      if (input.expectedRevision < existing.affinity_revision) {
        throw new Error(
          `STALE_LEASE_REVISION: stale takeover attempt with revision ${input.expectedRevision} against current ${existing.affinity_revision}`
        );
      }
      throw new Error(
        `SPLIT_BRAIN_ATTEMPT: concurrent takeover collision (expected ${input.expectedRevision}, current ${existing.affinity_revision})`
      );
    }

    return this.createOrUpdateExecutionLease({
      marathon_id: existing.marathon_id,
      run_id: existing.run_id,
      controller: input.controller,
      model: input.model,
      provider: input.provider,
      runner: input.runner,
      expectedRevision: existing.affinity_revision,
      source_of_selection: 'takeover',
    });
  }

  /**
   * Resolves execution authority in strict hierarchy:
   * Level 1: Explicit current handoff passed in options.
   * Level 2: Active valid lease in runtime directory (run continuation).
   * Otherwise: Fails closed with EXECUTOR_AFFINITY_UNRESOLVED.
   */
  async resolveExecutionAuthority(options?: {
    explicitHandoff?: CreateLeaseInput;
    allowRunResume?: boolean;
    resourceProbe?: (lease: ExecutionLease) => Promise<{ accepted: boolean; reason?: string }>;
    requireResourceProbe?: boolean;
  }): Promise<AuthorityResolutionResult> {
    // Level 1: Explicit handoff provided
    if (options?.explicitHandoff) {
      try {
        const lease = await this.createOrUpdateExecutionLease(options.explicitHandoff);
        return { status: 'RESOLVED', lease };
      } catch (err: any) {
        if (err?.message?.includes('STALE_LEASE_REVISION')) {
          return { status: 'STALE_LEASE_REVISION', reason: err.message };
        }
        if (err?.message?.includes('SPLIT_BRAIN_ATTEMPT')) {
          return { status: 'SPLIT_BRAIN_ATTEMPT', reason: err.message };
        }
        return { status: 'EXECUTOR_AFFINITY_UNRESOLVED', reason: err?.message || String(err) };
      }
    }

    // Level 2: Load existing active lease
    const activeLease = await this.loadActiveLease();
    if (!activeLease) {
      return {
        status: 'EXECUTOR_AFFINITY_UNRESOLVED',
        reason: 'No active run execution lease found; explicit handoff required before model dispatch',
      };
    }

    if (activeLease.status !== 'ACTIVE') {
      return {
        status: 'LEASE_INACTIVE',
        reason: `Execution lease ${activeLease.lease_id} has status ${activeLease.status}; not dispatchable`,
      };
    }

    // Check if quota wait is currently active
    if (activeLease.resource_state?.status === 'WAIT_SAME_PROVIDER') {
      const retryNotBefore = activeLease.resource_state.retry_not_before;
      if (retryNotBefore && new Date(retryNotBefore).getTime() > Date.now()) {
        return {
          status: 'RESOURCE_WAIT',
          lease: activeLease,
          reason: `Resource wait active for ${activeLease.provider} until ${retryNotBefore}: ${activeLease.resource_state.reason}`,
        };
      }

      // Time window elapsed: evaluate active resource probe if supplied or required
      if (options?.resourceProbe) {
        const probe = await options.resourceProbe(activeLease);
        if (!probe.accepted) {
          return {
            status: 'RESOURCE_WAIT',
            lease: activeLease,
            reason: `Resource admission probe rejected for ${activeLease.provider}: ${probe.reason || 'upstream rejection'}`,
          };
        }
      } else if (options?.requireResourceProbe) {
        return {
          status: 'RESOURCE_WAIT',
          lease: activeLease,
          reason: `Resource admission probe required for ${activeLease.provider}; time elapsed alone is insufficient`,
        };
      }
    }

    return { status: 'RESOLVED', lease: activeLease };
  }

  /**
   * Records quota/429 pause on the active lease without switching providers.
   */
  async recordQuotaWait(reason: string, waitMs = 300_000): Promise<ExecutionLease> {
    const activeLease = await this.loadActiveLease();
    if (!activeLease) {
      throw new Error('Cannot record quota wait: no active execution lease');
    }
    const retryNotBefore = new Date(Date.now() + waitMs).toISOString();
    activeLease.resource_state = {
      status: 'WAIT_SAME_PROVIDER',
      reason,
      retry_not_before: retryNotBefore,
    };
    await this.saveLease(activeLease);
    return activeLease;
  }

  /**
   * Resets resource state to OK when provider recovers.
   */
  async clearQuotaWait(): Promise<ExecutionLease> {
    const activeLease = await this.loadActiveLease();
    if (!activeLease) {
      throw new Error('Cannot clear quota wait: no active execution lease');
    }
    activeLease.resource_state = { status: 'OK' };
    await this.saveLease(activeLease);
    return activeLease;
  }

  /**
   * Revokes the active execution lease.
   */
  async revokeLease(reason = 'Explicit revocation'): Promise<void> {
    const activeLease = await this.loadActiveLease();
    if (activeLease) {
      activeLease.status = 'REVOKED';
      await this.saveLease(activeLease);
    }
  }
}
