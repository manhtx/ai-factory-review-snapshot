export async function resolveWithTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(onTimeout()), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function boundedAuditTimeoutMs(env: Record<string, string | undefined> = process.env) {
  const configured = Number(env.SUPABASE_AUDIT_TIMEOUT_MS ?? 5_000);
  return Number.isFinite(configured) ? Math.min(15_000, Math.max(1_000, configured)) : 5_000;
}
