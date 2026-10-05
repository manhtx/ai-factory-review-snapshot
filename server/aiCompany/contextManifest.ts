import { createHash } from 'node:crypto';

export type ContextLevel = 'L0' | 'L1' | 'L2';

export interface ContextManifestItem {
  name: string;
  category: 'product_goal' | 'assignment' | 'criteria' | 'role_contract' | 'dependency' | 'source_file' | 'test_file' | 'history' | 'dissent' | 'learning';
  content: string;
  token_budget?: number;
}

export interface ContextManifestOptions {
  assignment_id: string;
  level: ContextLevel;
  max_tokens: number;
  target_tokens: number;
  items: ContextManifestItem[];
  historical_dissent?: string[];
  prior_learning?: string[];
  enforce_hard_limit?: boolean;
}

export interface ContextManifestResult {
  manifest_id: string;
  manifest_hash: string;
  level: ContextLevel;
  total_tokens: number;
  target_tokens: number;
  max_tokens: number;
  token_breakdown: Record<string, number>;
  discarded_items: Array<{ name: string; reason: string }>;
  compiled_prompt: string;
  is_overflow: boolean;
}

export function buildContextManifest(options: ContextManifestOptions): ContextManifestResult {
  const { assignment_id, level, max_tokens, target_tokens, items } = options;
  const discarded_items: Array<{ name: string; reason: string }> = [];
  const token_breakdown: Record<string, number> = {
    target_tokens: 0,
    dependency_tokens: 0,
    repeated_tokens: 0,
    discarded_tokens: 0,
  };

  // Filter items appropriate for the context level
  // L0: Product Goal summary, assignment, criteria, role contract
  // L1: L0 + dependencies, targeted source files, test files
  // L2: L1 + history, dissent, prior learning
  const allowedCategoriesByLevel: Record<ContextLevel, Set<string>> = {
    L0: new Set(['product_goal', 'assignment', 'criteria', 'role_contract']),
    L1: new Set(['product_goal', 'assignment', 'criteria', 'role_contract', 'dependency', 'source_file', 'test_file']),
    L2: new Set(['product_goal', 'assignment', 'criteria', 'role_contract', 'dependency', 'source_file', 'test_file', 'history', 'dissent', 'learning']),
  };

  const allowedCategories = allowedCategoriesByLevel[level];
  const selectedItems: Array<{ name: string; content: string; tokens: number; category: string }> = [];
  const seenContentHashes = new Set<string>();

  for (const item of items) {
    if (!allowedCategories.has(item.category)) {
      discarded_items.push({ name: item.name, reason: `category '${item.category}' not permitted at context level ${level}` });
      const estTokens = Math.ceil(item.content.length / 4);
      token_breakdown.discarded_tokens += estTokens;
      continue;
    }

    // Check duplicate content (prevent context repetition)
    const contentHash = createHash('sha256').update(item.content.trim()).digest('hex');
    if (seenContentHashes.has(contentHash)) {
      discarded_items.push({ name: item.name, reason: 'duplicate content detected' });
      const dupTokens = Math.ceil(item.content.length / 4);
      token_breakdown.repeated_tokens += dupTokens;
      continue;
    }
    seenContentHashes.add(contentHash);

    // Apply per-artifact token budget if defined
    let finalContent = item.content;
    let tokens = Math.ceil(finalContent.length / 4);
    if (item.token_budget && tokens > item.token_budget) {
      finalContent = finalContent.slice(0, item.token_budget * 4) + '\n...[TRUNCATED TO ARTIFACT BUDGET]';
      tokens = Math.ceil(finalContent.length / 4);
    }

    selectedItems.push({ name: item.name, content: finalContent, tokens, category: item.category });
  }

  // Calculate tokens
  let runningTokens = 0;
  const compiledSections: string[] = [];

  for (const s of selectedItems) {
    if (runningTokens + s.tokens > max_tokens) {
      discarded_items.push({ name: s.name, reason: `context limit exceeded: adding ${s.tokens} tokens exceeds max ${max_tokens}` });
      token_breakdown.discarded_tokens += s.tokens;
      continue;
    }

    compiledSections.push(`### [${s.name} (${s.category})]\n${s.content}`);
    runningTokens += s.tokens;
    token_breakdown[s.name] = s.tokens;

    if (s.category === 'dependency') {
      token_breakdown.dependency_tokens += s.tokens;
    }
  }

  token_breakdown.target_tokens = runningTokens;

  if (options.enforce_hard_limit && selectedItems.length > 0 && compiledSections.length === 0) {
    throw new Error(`CONTEXT_BUDGET_OVERFLOW: mandatory context items exceeded hard limit of ${max_tokens} tokens`);
  }

  const compiled_prompt = compiledSections.join('\n\n');
  const manifest_hash = createHash('sha256')
    .update(`${assignment_id}:${level}:${compiled_prompt}`)
    .digest('hex');
  const manifest_id = `manifest-${assignment_id}-${manifest_hash.slice(0, 12)}`;

  const isOverflow = discarded_items.some((item) => item.reason.includes('context limit exceeded'));

  return {
    manifest_id,
    manifest_hash,
    level,
    total_tokens: runningTokens,
    target_tokens,
    max_tokens,
    token_breakdown,
    discarded_items,
    compiled_prompt,
    is_overflow: isOverflow,
  };
}

export type EvidenceManifest = {
  required: string[];
  optional?: string[];
  forbidden: string[];
  target_tokens: number;
  max_tokens: number;
};

export function validateEvidenceManifest(m: EvidenceManifest): string[] {
  const e: string[] = [];
  if (!m.required.length) e.push('required evidence is empty');
  if (!m.forbidden.length) e.push('forbidden evidence is empty');
  if (!Number.isInteger(m.target_tokens) || !Number.isInteger(m.max_tokens) || m.target_tokens > m.max_tokens) {
    e.push('invalid context budget');
  }
  return e;
}

export function estimateTokens(parts: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.ceil(v.length / 4)]));
}
