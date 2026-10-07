export const ADMIN_IDLE_MS = 10 * 60 * 1000;
export const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

export function adminRecordAllowed(record: Record<string, unknown> | undefined): boolean {
  return record?.active === true;
}

export function adminSessionFresh(authenticatedAt: number, now = Date.now()): boolean {
  return Number.isFinite(authenticatedAt) && authenticatedAt > 0
    && authenticatedAt <= now + 60_000 && now - authenticatedAt < ADMIN_SESSION_MS;
}

export async function withAdminDeadline<T>(work: Promise<T>, milliseconds = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Admin verification timed out")), milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
