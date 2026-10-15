import type { Vec } from 'arena-sim';
import type { WireView } from 'firestorm-net';

/** How loud a line is: danger beats alert beats good beats the plain guidance line. */
export type ObjLevel = 'danger' | 'alert' | 'good' | 'guide';

export interface Objective {
  level: ObjLevel;
  title: string;
  sub?: string;
  /** Where on the map the line is about: tapping the line looks there. */
  focus?: Vec;
}

export const LEVEL_RANK: Record<ObjLevel, number> = { danger: 3, alert: 2, good: 1, guide: 0 };

const fmtClock = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const near = (a: Vec, b: Vec, r: number): boolean => Math.hypot(a.x - b.x, a.y - b.y) <= r;

/**
 * Enemy squads that will reach your HQ or one of your team's nodes soon. Every enemy march is public (type and
 * route), so this needs no vision. Your own HQ outranks a node; among nodes the soonest arrival wins.
 */
export function incomingThreat(
  view: WireView,
  hqId: string,
  mine: number,
  simMs: number,
  cell: number,
  warnMs: number,
  nodeLabel: (id: string) => string,
): Objective | null {
  const hq = view.hqs.find((h) => h.id === hqId);
  const hqHits: number[] = [];
  const nodeHits = new Map<string, number[]>();
  for (const m of view.enemyMarches) {
    if (m.burning) continue;
    const eta = m.march.arriveMs - simMs;
    if (eta < 0 || eta > warnMs) continue;
    if (hq && near(m.march.to, hq.pos, cell * 0.6)) {
      hqHits.push(eta);
      continue;
    }
    for (const n of view.nodes) {
      if (n.owner !== mine) continue;
      if (near(m.march.to, n.pos, cell * 0.6)) {
        const list = nodeHits.get(n.id) ?? [];
        list.push(eta);
        nodeHits.set(n.id, list);
        break;
      }
    }
  }
  const squads = (n: number) => `${n} enemy squad${n === 1 ? '' : 's'}`;
  if (hq && hqHits.length) {
    const eta = Math.min(...hqHits);
    return { level: 'danger', title: 'Your HQ is about to be attacked', sub: `${squads(hqHits.length)} ${hqHits.length === 1 ? 'arrives' : 'arrive'} in ${fmtClock(eta)}`, focus: hq.pos };
  }
  let best: { id: string; eta: number; count: number } | null = null;
  for (const [id, etas] of nodeHits) {
    const eta = Math.min(...etas);
    if (!best || eta < best.eta) best = { id, eta, count: etas.length };
  }
  if (!best) return null;
  const node = view.nodes.find((n) => n.id === best!.id)!;
  const more = nodeHits.size > 1 ? `, +${nodeHits.size - 1} more node${nodeHits.size > 2 ? 's' : ''} threatened` : '';
  return { level: 'danger', title: `${nodeLabel(best.id)} is about to be attacked`, sub: `${squads(best.count)} ${best.count === 1 ? 'arrives' : 'arrive'} in ${fmtClock(best.eta)}${more}`, focus: node.pos };
}

/** The plain "what next" line: where your squad is headed, or a nudge to send one. Nodes only: nothing here says tap the ground. */
export function guideLine(view: WireView, playerId: string, simMs: number, nodeLabel: (id: string) => string, idleLongEnough: boolean): Objective | null {
  const own = view.squads.filter((q) => q.owner === playerId);
  const marching = own.filter((q) => q.state === 'march' && q.march && q.march.purpose !== 'home' && q.troops > 0);
  if (marching.length) {
    const soonest = marching.reduce((a, b) => ((a.march?.arriveMs ?? 0) <= (b.march?.arriveMs ?? 0) ? a : b));
    const m = soonest.march!;
    const where = m.nodeId ? nodeLabel(m.nodeId) : 'the target';
    return { level: 'guide', title: `Squad on its way to ${where}`, sub: `Arrives in ${fmtClock(m.arriveMs - simMs)}`, focus: m.to };
  }
  const garrisoned = own.some((q) => q.state === 'garrison' || q.state === 'hqGarrison');
  const idle = own.some((q) => q.state === 'hq' && q.troops > 0);
  if (idle && !garrisoned && idleLongEnough) return { level: 'guide', title: 'Tap a node, then send a squad', sub: 'Held nodes score points every second' };
  return null;
}

/** One suggested move. Tapping it pans the camera to `pos` and rings the target so the next click is obvious. */
export interface Cue {
  key: string;
  title: string;
  sub?: string;
  pos: Vec;
}

export interface CueContext {
  playerId: string;
  hqId: string;
  mine: number;
  simMs: number;
  /** Points per second by tier, index 0 is tier 1. */
  tierPoints: number[];
  garrisonBonus: number;
  nodeLabel: (id: string) => string;
  fmtPower: (p: number) => string;
  teleportReady: boolean;
  /** How many cues at most. */
  max: number;
}

const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * A short list of "brain-off" things to do next, best first: capture the nearest free node, scout the nearest enemy
 * node, hit one you have scouted, garrison one of yours that is empty, grab a cache, jump to a forward node. Each
 * one only appears when you can actually do it right now.
 */
export function suggestCues(view: WireView, c: CueContext): Cue[] {
  const hq = view.hqs.find((h) => h.id === c.hqId);
  if (!hq) return [];
  const own = view.squads.filter((q) => q.owner === c.playerId);
  const idle = own.some((q) => q.state === 'hq' && q.troops > 0);
  const marching = own.some((q) => q.state === 'march' && q.troops > 0);
  const scoutHome = view.scouts.some((s) => s.owner === c.playerId && s.state === 'home');
  const locked = (n: { unlocksAtMs?: number }) => n.unlocksAtMs !== undefined && c.simMs < n.unlocksAtMs;
  const byDist = <T extends { pos: Vec }>(list: T[]): T[] => [...list].sort((a, b) => dist(a.pos, hq.pos) - dist(b.pos, hq.pos));
  const pts = (tier: number) => c.tierPoints[tier - 1] ?? 0;
  const out: Cue[] = [];
  const used = new Set<string>();
  const add = (cue: Cue): void => {
    if (!used.has(cue.key)) {
      used.add(cue.key);
      out.push(cue);
    }
  };

  // Nodes your squads are already heading for need no suggestion.
  const headedFor = new Set(own.filter((q) => q.state === 'march' && q.march?.nodeId).map((q) => q.march!.nodeId as string));
  const reports = view.scoutReports.filter((r) => r.expiresAtMs > c.simMs && r.target.kind === 'node');
  const reported = new Set(reports.map((r) => (r.target.kind === 'node' ? r.target.nodeId : '')));

  if (idle) {
    for (const n of byDist(view.nodes.filter((x) => x.owner === null && x.kind !== 'portal' && !locked(x) && !headedFor.has(x.id))).slice(0, 2)) {
      add({ key: `cap:${n.id}`, title: `Capture ${c.nodeLabel(n.id)}`, sub: `+${pts(n.tier)} pts/s once it is yours`, pos: n.pos });
    }
  }
  if (scoutHome) {
    const enemy = byDist(view.nodes.filter((x) => x.owner !== null && x.owner !== c.mine && x.kind !== 'portal' && !locked(x) && !reported.has(x.id)))[0];
    if (enemy) add({ key: `scout:${enemy.id}`, title: `Scout ${c.nodeLabel(enemy.id)}`, sub: 'See what defends it before you attack', pos: enemy.pos });
  }
  if (idle) {
    for (const r of reports) {
      if (r.target.kind !== 'node' || r.empty) continue;
      const nodeId = r.target.nodeId;
      const n = view.nodes.find((x) => x.id === nodeId);
      if (!n || n.owner === c.mine || n.owner === null || headedFor.has(n.id)) continue;
      const strongest = Math.max(0, ...r.defenders.map((d) => d.effectivePower));
      add({ key: `atk:${n.id}`, title: `Attack ${c.nodeLabel(n.id)}`, sub: `Scouted: ${r.defenders.length} squad${r.defenders.length === 1 ? '' : 's'}, strongest ${c.fmtPower(strongest)}`, pos: n.pos });
      break;
    }
    const empty = byDist(view.nodes.filter((x) => x.owner === c.mine && x.kind !== 'portal' && x.garrisonCount === 0 && !headedFor.has(x.id)))[0];
    if (empty) add({ key: `gar:${empty.id}`, title: `Garrison ${c.nodeLabel(empty.id)}`, sub: `Defends it, +${c.garrisonBonus} pts/s for you`, pos: empty.pos });
  }
  if (scoutHome) {
    const cache = byDist(view.caches)[0];
    if (cache) add({ key: `cache:${cache.id}`, title: 'Collect a score cache', sub: `Free points: ${Math.round(cache.value)}`, pos: cache.pos });
  }
  if (c.teleportReady && !marching) {
    // A held node closest to the middle of the fight.
    const centre = { x: 0, y: 0 };
    for (const n of view.nodes) {
      centre.x += n.pos.x / view.nodes.length;
      centre.y += n.pos.y / view.nodes.length;
    }
    const spot = [...view.nodes.filter((x) => x.owner === c.mine && x.kind !== 'portal')].sort((a, b) => dist(a.pos, centre) - dist(b.pos, centre))[0];
    if (spot && dist(spot.pos, hq.pos) > 400) add({ key: `tp:${spot.id}`, title: `Teleport to ${c.nodeLabel(spot.id)}`, sub: 'Moves your HQ and squads closer to the action', pos: spot.pos });
  }
  return out.slice(0, c.max);
}
