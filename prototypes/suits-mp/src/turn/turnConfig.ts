import tune from '../../tune.json';

// Reuses mp-net's already-deployed Cloudflare Worker rather than standing
// up a second one - it mints short-lived TURN credentials gated to this
// project's own origins, same mechanism, no per-prototype changes needed.
const TURN_WORKER_URL = 'https://mp-net-turn-relay.tianz-88.workers.dev';

// Fetches short-lived TURN credentials from the project's Cloudflare Worker.
// Never blocks the connect flow: any failure (network error, bad response
// shape, timeout) resolves to undefined so callers fall back to STUN-only /
// direct connections.
export async function fetchTurnIceServers(): Promise<RTCIceServer[] | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), tune.turnFetchTimeoutMs);

  try {
    const response = await fetch(TURN_WORKER_URL, { signal: controller.signal });
    if (!response.ok) return undefined;

    const data: unknown = await response.json();
    const iceServers = (data as { iceServers?: unknown }).iceServers;
    if (!Array.isArray(iceServers) || iceServers.length === 0) return undefined;

    return iceServers as RTCIceServer[];
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
