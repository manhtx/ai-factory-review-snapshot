import type { AiUsageEvent } from './aiUsageLedger';

export type TokenWasteTaxonomy = 
  | 'OVER_CONTEXT'
  | 'DUPLICATE_CONTEXT'
  | 'HISTORY_BLOAT'
  | 'TOOL_OUTPUT_BLOAT'
  | 'UNNECESSARY_REVIEW'
  | 'UNNECESSARY_AGENT'
  | 'RETRY_WASTE'
  | 'WRONG_MODEL'
  | 'LOW_VALUE_RESEARCH'
  | 'FAILED_CALL'
  | 'DUPLICATE_WORK';

export interface ResourceAnalyticsReport {
  generated_at: string;
  event_count: number;
  totals: {
    estimated_tokens: number;
    actual_tokens: number;
    failed_events: number;
    successful_events: number;
    retry_waste_ratio: number;
    failed_work_waste_tokens: number;
  };
  metrics: {
    tokens_per_role_run: number;
    tokens_per_task: number;
    tokens_per_successful_task: number;
    tokens_per_workflow: number;
    tokens_per_successful_workflow: number;
  };
  by_role: Record<string, { runs: number; estimated_tokens: number; actual_tokens: number; failed: number; avg_tokens_per_run: number }>;
  by_workflow: Record<string, { runs: number; estimated_tokens: number; actual_tokens: number; failed: number }>;
  by_failure_class: Record<string, { count: number; estimated_tokens: number }>;
  context_composition_totals: Record<string, number>;
  context: {
    estimated_input_median: number | null;
    estimated_input_p90: number | null;
    anomalies: Array<{ id: string; task_id: string; role: string; input_tokens_estimated: number | null; taxonomy: TokenWasteTaxonomy; detail: string }>;
  };
  provenance: {
    actual_and_estimated_kept_separate: boolean;
    unknown_values_are_null: boolean;
    authoritative_baseline: string;
  };
}

export function analyzeAiUsage(events: AiUsageEvent[], now = Date.now()): ResourceAnalyticsReport {
  const recent = events.filter((event) => Date.parse(event.timestamp) <= now);
  const sum = (rows: AiUsageEvent[], field: keyof AiUsageEvent) =>
    rows.reduce((total, row) => total + (typeof row[field] === 'number' ? (row[field] as number) : 0), 0);

  const completed = recent.filter((row) => row.status === 'COMPLETED');
  const failed = recent.filter((row) => row.status !== 'COMPLETED');

  const totalEstimated = sum(recent, 'total_tokens_estimated');
  const totalActual = sum(recent, 'total_tokens_actual');
  const retryWaste = sum(failed, 'total_tokens_estimated');

  const uniqueTasks = new Set(recent.map((r) => r.task_id));
  const completedTasks = new Set(completed.map((r) => r.task_id));
  const uniqueWorkflows = new Set(recent.map((r) => r.workflow_id));
  const completedWorkflows = new Set(
    [...uniqueWorkflows].filter((wId) => {
      const wRows = recent.filter((r) => r.workflow_id === wId);
      return wRows.length > 0 && wRows.every((r) => r.status === 'COMPLETED');
    })
  );

  const groupRole = () =>
    Object.fromEntries(
      [...new Set(recent.map((row) => String(row.agent_role)))].map((role) => {
        const rows = recent.filter((row) => String(row.agent_role) === role);
        const roleEst = sum(rows, 'total_tokens_estimated');
        return [
          role,
          {
            runs: rows.length,
            estimated_tokens: roleEst,
            actual_tokens: sum(rows, 'total_tokens_actual'),
            failed: rows.filter((row) => row.status !== 'COMPLETED').length,
            avg_tokens_per_run: rows.length ? Math.round(roleEst / rows.length) : 0,
          },
        ];
      })
    );

  const groupWorkflow = () =>
    Object.fromEntries(
      [...new Set(recent.map((row) => String(row.workflow_id)))].map((wId) => {
        const rows = recent.filter((row) => String(row.workflow_id) === wId);
        return [
          wId,
          {
            runs: rows.length,
            estimated_tokens: sum(rows, 'total_tokens_estimated'),
            actual_tokens: sum(rows, 'total_tokens_actual'),
            failed: rows.filter((row) => row.status !== 'COMPLETED').length,
          },
        ];
      })
    );

  const groupFailureClass = () => {
    const classes: Record<string, { count: number; estimated_tokens: number }> = {};
    for (const f of failed) {
      const fClass = f.failure_class || 'UNKNOWN_FAILURE';
      if (!classes[fClass]) classes[fClass] = { count: 0, estimated_tokens: 0 };
      classes[fClass].count += 1;
      classes[fClass].estimated_tokens += f.total_tokens_estimated ?? 0;
    }
    return classes;
  };

  const contextCompositionTotals: Record<string, number> = {};
  for (const row of recent) {
    if (row.context_composition) {
      for (const [category, tokens] of Object.entries(row.context_composition)) {
        if (typeof tokens !== 'number' || !Number.isFinite(tokens)) continue;
        const normalizedCategory = category.trim().toUpperCase();
        if (!normalizedCategory) continue;
        contextCompositionTotals[normalizedCategory] = (contextCompositionTotals[normalizedCategory] ?? 0) + tokens;
      }
    }
  }

  const contextValues = recent
    .map((row) => row.input_tokens_estimated)
    .filter((value): value is number => typeof value === 'number');
  const sorted = [...contextValues].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const p90 = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : null;

  const anomalies: ResourceAnalyticsReport['context']['anomalies'] = [];
  for (const row of recent) {
    if (median != null && (row.input_tokens_estimated ?? 0) > median * 2) {
      anomalies.push({
        id: row.id,
        task_id: row.task_id,
        role: row.agent_role,
        input_tokens_estimated: row.input_tokens_estimated ?? null,
        taxonomy: 'OVER_CONTEXT',
        detail: `Input tokens (${row.input_tokens_estimated}) exceeded 2x rolling median (${median})`,
      });
    }
    if ((row.retry_count ?? 0) > 1) {
      anomalies.push({
        id: row.id,
        task_id: row.task_id,
        role: row.agent_role,
        input_tokens_estimated: row.input_tokens_estimated ?? null,
        taxonomy: 'RETRY_WASTE',
        detail: `Task experienced ${row.retry_count} retries`,
      });
    }
  }

  return {
    generated_at: new Date(now).toISOString(),
    event_count: recent.length,
    totals: {
      estimated_tokens: totalEstimated,
      actual_tokens: totalActual,
      failed_events: failed.length,
      successful_events: completed.length,
      retry_waste_ratio: totalEstimated ? Math.round((retryWaste / totalEstimated) * 1000) / 1000 : 0,
      failed_work_waste_tokens: retryWaste,
    },
    metrics: {
      tokens_per_role_run: recent.length ? Math.round(totalEstimated / recent.length) : 0,
      tokens_per_task: uniqueTasks.size ? Math.round(totalEstimated / uniqueTasks.size) : 0,
      tokens_per_successful_task: completedTasks.size ? Math.round(sum(completed, 'total_tokens_estimated') / completedTasks.size) : 0,
      tokens_per_workflow: uniqueWorkflows.size ? Math.round(totalEstimated / uniqueWorkflows.size) : 0,
      tokens_per_successful_workflow: completedWorkflows.size ? Math.round(sum(completed, 'total_tokens_estimated') / completedWorkflows.size) : 0,
    },
    by_role: groupRole(),
    by_workflow: groupWorkflow(),
    by_failure_class: groupFailureClass(),
    context_composition_totals: contextCompositionTotals,
    context: {
      estimated_input_median: median,
      estimated_input_p90: p90,
      anomalies,
    },
    provenance: {
      actual_and_estimated_kept_separate: true,
      unknown_values_are_null: true,
      authoritative_baseline: 'BENCHMARK_B0',
    },
  };
}
