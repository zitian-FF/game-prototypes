import { tune } from '../sim/tune';

// Same Cloudflare Worker mp-net uses for short-lived TURN credentials (for
// peers behind symmetric NAT / carrier CGNAT). Fails open: any error means
// STUN/direct only.
const TURN_WORKER_URL = 'https://mp-net-turn-relay.tianz-88.workers.dev';

export async function fetchTurnIceServers(): Promise<RTCIceServer[] | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), tune.net.turnFetchTimeoutMs);
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
