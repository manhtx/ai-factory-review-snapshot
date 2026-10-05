import type { CouncilFeedback } from './council';

export interface TrialQualityMetrics { user_task_success: number; revise_rate: number; average_confidence: number; }

export function computeTrialQuality(feedback: CouncilFeedback[]): TrialQualityMetrics {
  if (!feedback.length) return { user_task_success: 0, revise_rate: 0, average_confidence: 0 };
  return { user_task_success: feedback.filter((item) => item.verdict === 'ACCEPT').length / feedback.length, revise_rate: feedback.filter((item) => item.verdict === 'REVISE').length / feedback.length, average_confidence: feedback.reduce((sum, item) => sum + item.confidence, 0) / feedback.length };
}
