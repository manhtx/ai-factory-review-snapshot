import { readFile, readdir, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export type MemoryCategory = 'facts' | 'decisions' | 'rejected' | 'experiments';

export interface MemoryReviewerConfirmation {
  reviewer: string;
  verdict: 'PASS';
  timestamp: string;
  evidence_id: string;
}

export interface TypedMemoryItem {
  id: string;
  category: MemoryCategory;
  title: string;
  summary: string;
  evidence_ids: string[];
  timestamp: string;
  confidence: number;
  owner: string;
  supersedes?: string;
  hash: string;
  reviewer_confirmation: MemoryReviewerConfirmation;
  keywords?: string[];
  rejection_reason?: string;
  decision_policy_rules?: string[];
}

export interface ValidatedMemoryItem {
  id: string;
  topic: string;
  cycle: string;
  date: string;
  content: string;
  decision_policy_rules: string[];
}

export function computeMemoryHash(item: Omit<TypedMemoryItem, 'hash'>): string {
  const payload = [
    item.id,
    item.category,
    item.title,
    item.summary,
    [...(item.evidence_ids || [])].sort().join(','),
    item.timestamp,
    item.owner,
    item.supersedes ?? '',
    item.reviewer_confirmation?.evidence_id ?? '',
  ].join(':');
  return createHash('sha256').update(payload).digest('hex');
}

export function validateMemoryForStorage(item: Omit<TypedMemoryItem, 'hash'>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!item.id?.trim()) errors.push('memory id is required');
  if (!item.title?.trim()) errors.push('memory title is required');
  if (!item.summary?.trim()) errors.push('memory summary is required');
  if (!['facts', 'decisions', 'rejected', 'experiments'].includes(item.category)) {
    errors.push(`invalid memory category '${item.category}'`);
  }
  if (!Array.isArray(item.evidence_ids) || item.evidence_ids.length === 0) {
    errors.push('memory requires at least one verified evidence_id');
  }
  if (!item.owner?.trim()) errors.push('owner is required');
  if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1 || !Number.isFinite(item.confidence)) {
    errors.push('confidence must be a number between 0 and 1');
  }
  if (!item.reviewer_confirmation) {
    errors.push('reviewer confirmation is required for long-term memory');
  } else {
    if (item.reviewer_confirmation.verdict !== 'PASS') {
      errors.push('reviewer confirmation must have PASS verdict');
    }
    if (!item.reviewer_confirmation.evidence_id?.trim()) {
      errors.push('reviewer confirmation requires evidence_id');
    }
  }
  return { valid: errors.length === 0, errors };
}

export class ProductMemoryLedger {
  private readonly memoryDir: string;
  constructor(rootDir: string) {
    this.memoryDir = path.join(rootDir, '.ai-company', 'memory');
  }

  async recordMemory(item: Omit<TypedMemoryItem, 'hash'>): Promise<TypedMemoryItem> {
    const validation = validateMemoryForStorage(item);
    if (!validation.valid) {
      throw new Error(`cannot store memory without evidence and reviewer confirmation: ${validation.errors.join('; ')}`);
    }

    const hash = computeMemoryHash(item);
    const fullItem: TypedMemoryItem = { ...item, hash };

    const categoryDir = path.join(this.memoryDir, item.category);
    await mkdir(categoryDir, { recursive: true });

    // Store discrete JSON file
    const itemPath = path.join(categoryDir, `${item.id}.json`);
    await writeFile(itemPath, JSON.stringify(fullItem, null, 2), 'utf8');

    // Also append to category JSONL
    const jsonlPath = path.join(this.memoryDir, `${item.category}.jsonl`);
    await appendFile(jsonlPath, `${JSON.stringify(fullItem)}\n`, 'utf8');

    return fullItem;
  }

  async getMemoriesByCategory(category: MemoryCategory): Promise<TypedMemoryItem[]> {
    const byId = new Map<string, TypedMemoryItem>();

    // 1. Try reading from category JSONL
    const jsonlPath = path.join(this.memoryDir, `${category}.jsonl`);
    try {
      const content = await readFile(jsonlPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const item = JSON.parse(line) as TypedMemoryItem;
          byId.set(item.id, item);
        } catch {
          // ignore malformed line
        }
      }
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }

    // 2. Try reading from category subdirectory
    const categoryDir = path.join(this.memoryDir, category);
    try {
      const files = await readdir(categoryDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await readFile(path.join(categoryDir, file), 'utf8');
          const item = JSON.parse(content) as TypedMemoryItem;
          byId.set(item.id, item);
        } catch {
          // ignore malformed file
        }
      }
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }

    return [...byId.values()];
  }

  async checkProposalAgainstRejected(proposal: {
    title: string;
    problem?: string;
    action?: string;
    keywords?: string[];
  }): Promise<{ is_rejected: boolean; matched_memory?: TypedMemoryItem; reason?: string }> {
    const rejectedMemories = await this.getMemoriesByCategory('rejected');
    const targetText = [
      proposal.title,
      proposal.problem ?? '',
      proposal.action ?? '',
      ...(proposal.keywords ?? []),
    ].join(' ').toLowerCase();

    for (const rej of rejectedMemories) {
      const rejTitle = rej.title.toLowerCase();
      const rejReason = (rej.rejection_reason ?? rej.summary).toLowerCase();
      const titleMatch = rejTitle.length > 5 && targetText.includes(rejTitle);
      const keywordMatch = (rej.keywords ?? []).some(
        (kw) => kw.length > 3 && targetText.includes(kw.toLowerCase())
      );
      const reasonMatch = rejReason.length > 10 && targetText.includes(rejReason);

      if (titleMatch || keywordMatch || reasonMatch) {
        return {
          is_rejected: true,
          matched_memory: rej,
          reason: `Proposal matches previously rejected direction (${rej.id}): ${rej.rejection_reason || rej.summary}`,
        };
      }
    }

    return { is_rejected: false };
  }

  async retrieveLearnings(query: string): Promise<ValidatedMemoryItem[]> {
    const results: ValidatedMemoryItem[] = [];
    let files: string[];
    try {
      files = await readdir(this.memoryDir);
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }

    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(this.memoryDir, file);
      const content = await readFile(filePath, 'utf8');
      const lowerContent = content.toLowerCase();

      const matches = searchTerms.some((term) => lowerContent.includes(term));
      if (matches) {
        const lines = content.split('\n');
        const policyRules: string[] = [];
        let inPolicy = false;
        for (const line of lines) {
          if (line.includes('## Future Decision Policy')) inPolicy = true;
          else if (inPolicy && line.startsWith('## ')) inPolicy = false;
          else if (inPolicy && line.startsWith('- ')) {
            policyRules.push(line.slice(2).trim());
          }
        }

        results.push({
          id: file.replace('.md', ''),
          topic: lines.find((l) => l.startsWith('Topic:'))?.replace('Topic:', '').trim() ?? 'general',
          cycle: lines.find((l) => l.startsWith('Cycle:'))?.replace('Cycle:', '').trim() ?? 'unknown',
          date: lines.find((l) => l.startsWith('Date:'))?.replace('Date:', '').trim() ?? 'unknown',
          content,
          decision_policy_rules: policyRules,
        });
      }
    }

    return results;
  }
}
