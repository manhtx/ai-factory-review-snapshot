import { resolve } from 'node:path';
import { CompanyStateStore } from './stateStore';
import { TelegramApi } from './telegramApi';
import { briefSchedulerState } from './briefStateAdapter';
import { createCeoBriefPipeline } from './ceoBriefPipeline';
import type { CompanyHealth } from './healthMetrics';
import { OptimizationLedger } from './optimizationLedger';

export function createConfiguredCeoBriefPipeline(input: { health: () => Promise<CompanyHealth>; env?: NodeJS.ProcessEnv; transport?: ConstructorParameters<typeof TelegramApi>[0] }) {
  const env = input.env ?? process.env;
  if (env.AI_COMPANY_TELEGRAM_ENABLED !== 'true') return null;
  const chatId = env.AI_COMPANY_TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('AI_COMPANY_TELEGRAM_CHAT_ID is required when Telegram is enabled');
  const store = new CompanyStateStore(resolve(env.AI_COMPANY_STATE_DIR ?? '.ai-company/runtime'));
  const optimizationLedger = new OptimizationLedger(resolve(env.AI_COMPANY_STATE_DIR ?? '.ai-company/runtime'));
  const api = new TelegramApi(input.transport, env);
  return createCeoBriefPipeline({
    health: input.health,
    state: briefSchedulerState(store),
    optimizationLedger,
    send: (text, reportId) => api.sendMessage(chatId, text, { reportId }),
  });
}
