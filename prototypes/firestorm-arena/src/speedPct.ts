/** Cutting `cutSeconds` off the edge-to-edge march time is a speed-up of edge / (edge - cut), as a rounded percent. */
export function speedBoostPct(march: { edgeToEdgeSeconds: number; minEdgeToEdgeSeconds: number }, cutSeconds: number): number {
  return Math.round((march.edgeToEdgeSeconds / Math.max(march.minEdgeToEdgeSeconds, march.edgeToEdgeSeconds - cutSeconds) - 1) * 100);
}
