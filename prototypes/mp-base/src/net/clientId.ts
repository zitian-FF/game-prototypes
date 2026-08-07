const STORAGE_KEY = 'mp-base:clientId';

// A stable per-browser identity, independent of trystero's peerId (which is
// fresh on every connection). Lets a reload/reconnect be matched back to the
// same host-side roster slot.
export function getOrCreateClientId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
