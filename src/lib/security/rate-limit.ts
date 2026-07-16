type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function checkRateLimit(key: string, limit = 8, windowMs = 60_000) {
  const now = Date.now();
  const current = store.get(key);
  if (!current || current.resetAt <= now) { store.set(key, { count: 1, resetAt: now + windowMs }); return { allowed: true, remaining: limit - 1, retryAfter: 0 }; }
  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfter: Math.ceil((current.resetAt - now) / 1000) };
}
