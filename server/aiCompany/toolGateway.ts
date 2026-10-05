import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type ToolCategory = 'filesystem' | 'git' | 'shell' | 'database' | 'browser' | 'analytics' | 'deployment' | 'memory' | 'backlog' | 'experiments';
export type ToolDecision = 'ALLOW' | 'DENY' | 'APPROVAL_REQUIRED';
export type ToolCall = { agent: string; task: string; tool: ToolCategory; action: string; resource?: string; risk?: 'P0' | 'P1' | 'P2' | 'P3'; argumentsHash?: string };

const readOnly: Record<ToolCategory, string[]> = {
  filesystem: ['read', 'list', 'diff'], git: ['status', 'diff', 'log'], shell: [], database: ['read'], browser: ['read'], analytics: ['read'], deployment: [], memory: ['read'], backlog: ['read'], experiments: ['read'],
};
const engineering = new Set(['tech-lead', 'coder', 'data-engineer', 'backend-engineer', 'frontend-engineer', 'ai-engineer', 'sre']);

/** Application-level tool boundary. It authorizes intent only; callers must
 * execute the approved operation and record its result through `record`. */
export class ToolGateway {
  constructor(private readonly controlRoot: string, private readonly auditPath = path.join(controlRoot, '.ai-company', 'tool-calls.jsonl')) {}

  authorize(call: ToolCall, workspace?: string): ToolDecision {
    if (!call.agent || !call.task || !call.tool || !call.action) return 'DENY';
    if (call.tool === 'shell' || call.tool === 'deployment' || call.tool === 'database' && call.action !== 'read') return 'DENY';
    if (call.risk === 'P0') return 'APPROVAL_REQUIRED';
    if (engineering.has(call.agent) && ['filesystem', 'git'].includes(call.tool)) {
      if (!workspace || path.resolve(workspace) === path.resolve(this.controlRoot)) return 'DENY';
      if (call.resource && !this.isInside(workspace, call.resource)) return 'DENY';
      return readOnly[call.tool].includes(call.action) ? 'ALLOW' : 'APPROVAL_REQUIRED';
    }
    return readOnly[call.tool]?.includes(call.action) ? 'ALLOW' : 'APPROVAL_REQUIRED';
  }

  async record(call: ToolCall, decision: ToolDecision, status: 'started' | 'finished' | 'denied', outputSummary = '') {
    await mkdir(path.dirname(this.auditPath), { recursive: true });
    await appendFile(this.auditPath, `${JSON.stringify({ ...call, argumentsHash: call.argumentsHash ?? '', permission_result: decision, status, output_summary: outputSummary.slice(0, 500), timestamp: new Date().toISOString() })}\n`);
  }

  private isInside(root: string, candidate: string) {
    const base = path.resolve(root) + path.sep;
    return path.resolve(candidate).startsWith(base);
  }
}
