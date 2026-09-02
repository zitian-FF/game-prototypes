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
    if (!response.ok) {
      console.warn(`[suits-mp turn] worker responded with status ${response.status} - falling back to STUN-only`);
      return undefined;
    }

    const data: unknown = await response.json();
    const iceServers = (data as { iceServers?: unknown }).iceServers;
    if (!Array.isArray(iceServers) || iceServers.length === 0) {
      console.warn('[suits-mp turn] worker response had no usable iceServers - falling back to STUN-only');
      return undefined;
    }

    return iceServers as RTCIceServer[];
  } catch (err) {
    // Includes the AbortController firing on timeout - `fetch` rejects with
    // an AbortError in that case, indistinguishable here from a genuine
    // network failure, which is fine: both fall back the same way.
    console.warn('[suits-mp turn] fetch failed or timed out - falling back to STUN-only:', err);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
