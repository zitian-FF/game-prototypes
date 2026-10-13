import { store } from '../portal/store';
import { KEYS } from '../portal/keys';
import { isDebug } from '../debug/debugPanel';

// One-time first launch flow. The flag is saved when the flow ends, either by
// finishing the easy fight or by skipping it, so it never shows twice.
export function firstRunDone(): boolean {
  try {
    return (JSON.parse(store.getItem(KEYS.firstRun) ?? 'null') as { done?: boolean } | null)?.done === true;
  } catch {
    return false;
  }
}

export function markFirstRunDone(): void {
  try {
    store.setItem(KEYS.firstRun, JSON.stringify({ done: true }));
  } catch {
    /* storage unavailable */
  }
}

// ?firstrun=1 replays the flow for testing (debug builds and ?debug=1 only).
export function needsFirstRun(): boolean {
  if (isDebug() && new URLSearchParams(location.search).get('firstrun') === '1') return true;
  return !firstRunDone();
}
