// A stable per-browser identity, independent of trystero's peerId (which is
// fresh on every connection). Lets a reload/reconnect be matched back to the
// same host-side roster slot. `storageKey` is passed in by each prototype
// (e.g. 'mp-net:clientId') so existing stored IDs keep resolving unchanged
// across the extraction into this package.
export function getOrCreateClientId(storageKey: string): string {
  let id = localStorage.getItem(storageKey);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
  }
  return id;
}
