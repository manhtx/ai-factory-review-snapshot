export type RiskLevel = "P0" | "P1" | "P2" | "P3";
export type WorkflowTier = "P0" | "P1" | "P2" | "P3";

export type TaskType =
  | "research"
  | "product_discovery"
  | "ui_change"
  | "backend_change"
  | "data_change"
  | "migration"
  | "security"
  | "release"
  | "production_operation";

export const ALLOWED_TASK_TYPES: readonly TaskType[] = [
  "research",
  "product_discovery",
  "ui_change",
  "backend_change",
  "data_change",
  "migration",
  "security",
  "release",
  "production_operation",
] as const;

export interface RiskAssessmentContext {
  taskType: TaskType;
  baseRisk?: RiskLevel;
  fileScope?: string[];
  mutationPolicy?: "read_only" | "assigned_artifacts" | "worktree";
  dataSensitivity?: "public" | "internal" | "restricted" | "credentials";
  productionImpact?: boolean;
  reversibility?: "reversible" | "difficult" | "irreversible";
  dependencyCount?: number;
}

export function isAllowedTaskType(type: string): type is TaskType {
  return (ALLOWED_TASK_TYPES as readonly string[]).includes(type);
}

/**
 * Calculates effective risk level based on task type, scope, mutation policy,
 * data sensitivity, production impact, reversibility, and dependency count.
 */
export function calculateEffectiveRisk(context: RiskAssessmentContext): RiskLevel {
  if (!isAllowedTaskType(context.taskType)) {
    throw new Error(`unknown task type: ${String(context.taskType)}`);
  }

  // P0 triggers: Direct production operation, credentials access, or irreversible migrations
  if (
    context.taskType === "production_operation" ||
    context.productionImpact === true ||
    context.dataSensitivity === "credentials" ||
    (context.taskType === "migration" && context.reversibility === "irreversible")
  ) {
    return "P0";
  }

  // P1 triggers: Security reviews, release gates, difficult migrations, restricted data,
  // or high dependency count (> 3)
  if (
    context.taskType === "security" ||
    context.taskType === "release" ||
    context.dataSensitivity === "restricted" ||
    context.reversibility === "difficult" ||
    (context.dependencyCount !== undefined && context.dependencyCount > 3)
  ) {
    if (context.baseRisk === "P0") return "P0";
    return "P1";
  }

  // Backend / Data changes: minimum P2, or P1 if scope touches core architecture
  if (context.taskType === "backend_change" || context.taskType === "data_change") {
    if (context.baseRisk === "P0") return "P0";
    if (context.baseRisk === "P1") return "P1";
    const touchesCore = (context.fileScope ?? []).some(
      (path) => path.includes("server/index") || path.includes("migrations") || path.includes("supabase")
    );
    return touchesCore ? "P1" : "P2";
  }

  // UI changes: P3 if reversible and localized, otherwise P2
  if (context.taskType === "ui_change") {
    if (context.baseRisk === "P0") return "P0";
    if (context.baseRisk === "P1") return "P1";
    if (context.baseRisk === "P2") return "P2";
    return "P3";
  }

  // Pure research / product discovery with read-only policy: P3
  if (
    (context.taskType === "research" || context.taskType === "product_discovery") &&
    (context.mutationPolicy === "read_only" || !context.mutationPolicy)
  ) {
    return context.baseRisk ?? "P3";
  }

  return context.baseRisk ?? "P2";
}
