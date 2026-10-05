import type { CompanyStateStore } from './stateStore';

export function briefSchedulerState(store: CompanyStateStore) {
  return {
    async get(key: string): Promise<string | null> {
      return (await store.latestCheckpoint(`scheduler:${key}`))?.cursor ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      await store.checkpoint({ aggregateId: `scheduler:${key}`, actor: 'chief-of-staff', cursor: value, payload: { scheduler_key: key }, idempotencyKey: `scheduler:${key}:${value}` });
    },
  };
}
