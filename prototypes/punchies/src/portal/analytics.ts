import { portal } from './select';
import type { AnalyticsProps } from './types';

// Our own analytics. One call shape for every portal: track(category, what, action, props).
//   track('shop', 'earn_tokens', 'visible')
//   track('match', 'VsAI', 'win', { level: 'hard' })
// Poki receives (category, what, action); Playgama receives `${category}_${action}`
// with `what` and props as data; itch.io and CrazyGames keep only the local log
// (CrazyGames has no custom-event module, and no external collector exists yet).
//
// No personal data and no ids: events are anonymous and carry only game facts.
// The last 300 events are kept in memory only, for the debug panel's copy button.
export interface AnalyticsEvent { t: number; category: string; what: string; action: string; props: AnalyticsProps }

const MAX = 300;
const log: AnalyticsEvent[] = [];

export function track(category: string, what: string, action: string, props: AnalyticsProps = {}): void {
  log.push({ t: Math.round(performance.now()), category, what, action, props });
  if (log.length > MAX) log.shift();
  try { portal.track?.(category, what, action, props); } catch { /* analytics must never break the game */ }
}

export function getEventLog(): AnalyticsEvent[] { return log.slice(); }
export function clearEventLog(): void { log.length = 0; }
