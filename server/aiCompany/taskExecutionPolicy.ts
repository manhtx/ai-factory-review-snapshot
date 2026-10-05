import type { AssignmentEnvelope } from './assignmentEnvelope';

export type CapabilityAction = 'read' | 'write' | 'execute' | 'review';

export interface TaskExecutionPolicy {
  policy_id: string;
  assignment_id: string;
  agent_id: string;
  risk_level: AssignmentEnvelope['risk_level'];
  allowed_tools: string[];
  allowed_paths: string[];
  actions: CapabilityAction[];
  max_child_tasks: number;
  max_concurrent_runs: number;
  max_provider_calls: number;
  max_tool_calls: number;
  max_retries: number;
  max_tokens: number;
  issued_at: string;
  expires_at: string;
  revoked: boolean;
}

export function deriveTaskExecutionPolicy(input: AssignmentEnvelope, now = Date.now()): TaskExecutionPolicy {
  const write = input.mutation_policy !== 'read_only';
  const ttlMs = Math.max(60_000, Math.min(input.timeout, 24 * 60 * 60_000));
  return {
    policy_id: `POLICY:${input.assignment_id}`,
    assignment_id: input.assignment_id,
    agent_id: input.role,
    risk_level: input.risk_level,
    allowed_tools: [...new Set(input.allowed_tools)],
    allowed_paths: [...new Set(input.allowed_paths)],
    actions: write ? ['read', 'write', 'execute', 'review'] : ['read', 'review'],
    max_child_tasks: input.risk_level === 'P0' ? 0 : 3,
    max_concurrent_runs: input.risk_level === 'P0' ? 1 : 2,
    max_provider_calls: input.risk_level === 'P0' ? 1 : 8,
    max_tool_calls: input.risk_level === 'P0' ? 5 : 40,
    max_retries: input.retry_budget,
    max_tokens: input.token_budget,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttlMs).toISOString(),
    revoked: false,
  };
}

export function assertTaskExecutionPolicy(policy: TaskExecutionPolicy, now = Date.now()): TaskExecutionPolicy {
  if (policy.revoked) throw new Error('task execution policy is revoked');
  if (Date.parse(policy.expires_at) <= now) throw new Error('task execution policy is expired');
  if (policy.max_tokens <= 0 || policy.max_tool_calls <= 0) throw new Error('task execution policy has invalid limits');
  return policy;
}
