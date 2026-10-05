// A running estimate of this game's use of the Cloudflare Workers Free plan's daily limits, kept by one
// Durable Object (prototypes/firestorm-arena/server). It only sees this game's own traffic, not the account's,
// so it is a courtesy gate, not an exact meter. All maths lives here so it can be tested in plain Node.

export interface QuotaConfig {
  /** Daily Durable Object row writes allowed on the plan. */
  writesLimit: number;
  /** Daily requests allowed on the plan (WebSocket messages count 20:1, alarms count as requests). */
  requestsLimit: number;
  /** What one 30 minute bot-filled match costs, measured with the end-to-end run, rounded up. */
  matchWrites: number;
  matchRequests: number;
  /** Share of the limits this game may use; the rest is headroom for anything else on the account. */
  safety: number;
}

export const DEFAULT_QUOTA: QuotaConfig = {
  writesLimit: 100_000,
  requestsLimit: 100_000,
  matchWrites: 4_000,
  matchRequests: 2_500,
  safety: 0.9,
};

export interface QuotaUsage {
  /** UTC date the counters belong to (the plan resets at 00:00 UTC). */
  day: string;
  writes: number;
  requests: number;
}

export interface QuotaStatus {
  day: string;
  writesUsed: number;
  writesLimit: number;
  requestsUsed: number;
  requestsLimit: number;
  /** Whole matches the remaining budget covers (the smaller of the two limits decides). */
  matchesLeft: number;
  /** Share of today's usable budget still free (0 to 100): the tighter of writes and requests. */
  percentLeft: number;
  /** False when there is not enough left for one more match. */
  canStart: boolean;
  /** When the counters reset (next 00:00 UTC), epoch ms. */
  resetsAtMs: number;
}

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function nextResetMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/** Start the counters over when the UTC day has changed. */
export function rollover(u: QuotaUsage, nowMs: number): QuotaUsage {
  const day = utcDay(nowMs);
  return u.day === day ? u : { day, writes: 0, requests: 0 };
}

export function addUsage(u: QuotaUsage, nowMs: number, writes: number, requests: number): QuotaUsage {
  const cur = rollover(u, nowMs);
  return { day: cur.day, writes: cur.writes + Math.max(0, writes), requests: cur.requests + Math.max(0, requests) };
}

export function quotaStatus(u: QuotaUsage, nowMs: number, cfg: QuotaConfig = DEFAULT_QUOTA): QuotaStatus {
  const cur = rollover(u, nowMs);
  const writesBudget = cfg.writesLimit * cfg.safety;
  const requestsBudget = cfg.requestsLimit * cfg.safety;
  const byWrites = Math.floor((writesBudget - cur.writes) / cfg.matchWrites);
  const byRequests = Math.floor((requestsBudget - cur.requests) / cfg.matchRequests);
  const matchesLeft = Math.max(0, Math.min(byWrites, byRequests));
  const freeWrites = 1 - cur.writes / writesBudget;
  const freeRequests = 1 - cur.requests / requestsBudget;
  const percentLeft = Math.max(0, Math.min(100, Math.round(Math.min(freeWrites, freeRequests) * 100)));
  return {
    day: cur.day,
    percentLeft,
    writesUsed: Math.round(cur.writes),
    writesLimit: cfg.writesLimit,
    requestsUsed: Math.round(cur.requests),
    requestsLimit: cfg.requestsLimit,
    matchesLeft,
    canStart: matchesLeft >= 1,
    resetsAtMs: nextResetMs(nowMs),
  };
}
