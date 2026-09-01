import type { BaseRosterEntry } from './types';

// Debounces roster removal on disconnect (mobile connections blip
// constantly) - scheduling is cancelled if the same client ID reappears
// (a reconnect) before the timer fires. One instance per host lobby/game
// scene; call `clearAll()` once disconnects should stop dropping slots
// (e.g. the game has started and a mid-game disconnect should instead
// preserve the slot indefinitely for reconnect).
export interface ReconnectDebouncer<T extends BaseRosterEntry> {
  // Cancels any pending removal timer for this client ID. Call from the
  // identity handler before matching/creating a roster entry, so a
  // reconnect within the debounce window isn't removed out from under it.
  cancelPending(clientId: string): void;
  // Schedules removal of whichever roster entry currently holds this
  // peerId, skipping any entry `isProtected` marks (e.g. the host's own
  // slot). No-ops if no matching entry is found.
  scheduleRemovalOnLeave(peerId: string, isProtected: (entry: T) => boolean): void;
  // Cancels every pending removal timer without running it.
  clearAll(): void;
}

export function createReconnectDebouncer<T extends BaseRosterEntry>(
  roster: Map<string, T>,
  delayMs: number,
  onExpire?: (entry: T) => void,
): ReconnectDebouncer<T> {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    cancelPending(clientId) {
      const timer = pending.get(clientId);
      if (timer) {
        clearTimeout(timer);
        pending.delete(clientId);
      }
    },
    scheduleRemovalOnLeave(peerId, isProtected) {
      for (const entry of roster.values()) {
        if (entry.peerId !== peerId || isProtected(entry)) continue;
        pending.set(
          entry.clientId,
          setTimeout(() => {
            pending.delete(entry.clientId);
            roster.delete(entry.clientId);
            onExpire?.(entry);
          }, delayMs),
        );
        break;
      }
    },
    clearAll() {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    },
  };
}

export type RosterMatchResult<T> =
  | { kind: 'reconnected'; entry: T }
  | { kind: 'created'; entry: T }
  | { kind: 'rejected' };

// Lobby-side identity match: an incoming `identity` message either belongs
// to an existing roster entry (a reconnect - update its peerId in place,
// leaving every other field, including displayName, untouched) or is a
// brand-new join (create a fresh entry via `createEntry`, which may itself
// return null to reject the join, e.g. the room is full).
export function matchOrCreateRosterEntry<T extends BaseRosterEntry>(
  roster: Map<string, T>,
  clientId: string,
  peerId: string,
  createEntry: () => T | null,
): RosterMatchResult<T> {
  const existing = roster.get(clientId);
  if (existing) {
    existing.peerId = peerId;
    return { kind: 'reconnected', entry: existing };
  }
  const created = createEntry();
  if (!created) return { kind: 'rejected' };
  roster.set(clientId, created);
  return { kind: 'created', entry: created };
}

// Mid-game identity match: once a game has started, an incoming `identity`
// message with no existing roster entry is a stranger, not a reconnect -
// there is no "create" path here, only match-and-update-peerId (leaving
// every other field, including displayName, untouched) or reject.
export function matchRosterEntryForReconnect<T extends BaseRosterEntry>(
  roster: Map<string, T>,
  clientId: string,
  peerId: string,
): T | undefined {
  const entry = roster.get(clientId);
  if (entry) entry.peerId = peerId;
  return entry;
}
