// Which game events a team may hear about. The sim emits everything; a client
// only gets what its team took part in or can see, and fights it merely
// watches arrive as a bare effect with no unit details.

import type { ArenaGame, CombatLog, GameEvent, MatchResult, March, NodeId, SquadId, TeamId, Vec } from 'arena-sim';

export type ClientEvent =
  | { type: 'marchStarted'; timeMs: number; squadId: SquadId; march: March }
  | { type: 'marchCancelled'; timeMs: number; squadId: SquadId }
  | { type: 'garrisoned'; timeMs: number; nodeId: NodeId; squadId: SquadId }
  | { type: 'garrisonRejected'; timeMs: number; nodeId: NodeId; squadId: SquadId; reason: string }
  | { type: 'hqGarrisoned'; timeMs: number; hqId: string; squadId: SquadId }
  | { type: 'hqGarrisonRejected'; timeMs: number; hqId: string; squadId: SquadId; reason: string }
  | { type: 'nodeCaptured'; timeMs: number; nodeId: NodeId; team: TeamId; previous: TeamId | null }
  /** A fight your team was in: full details. */
  | { type: 'combat'; timeMs: number; log: CombatLog }
  /** A fight you can see but were not in: where and what kind, nothing else. */
  | { type: 'combatFx'; timeMs: number; pos: Vec; subject: 'node' | 'hq' }
  | { type: 'hqDamaged'; timeMs: number; hqId: string; hp: number }
  | { type: 'hqDefeated'; timeMs: number; hqId: string }
  /** An HQ teleport (extract at `from`, landing at `to`). `own` is true for your team's HQs. */
  | { type: 'teleportFx'; timeMs: number; hqId: string; from: Vec; to: Vec; own: boolean; forced: boolean }
  | { type: 'turretPulse'; timeMs: number; nodeId: NodeId; hits: { squadId: SquadId; damage: number }[] }
  /** A turret missile in flight: draw it from `from` to `to` between startMs and arriveMs. */
  | { type: 'missileLaunched'; timeMs: number; id: string; own: boolean; from: Vec; to: Vec; startMs: number; arriveMs: number }
  | { type: 'refilled'; timeMs: number; squadId: SquadId; added: number }
  | { type: 'scoutLaunched'; timeMs: number; owner: string; scoutIndex: number }
  | { type: 'matchEnded'; timeMs: number; result: MatchResult };

export function projectEvents(game: ArenaGame, team: TeamId, events: GameEvent[]): ClientEvent[] {
  const out: ClientEvent[] = [];
  const squadTeam = (id: SquadId): TeamId | undefined => game.squads.get(id)?.team;
  const nodePos = (id: NodeId): Vec | undefined => game.nodes.get(id)?.pos;
  const sees = (pos: Vec | undefined) => !!pos && game.isVisibleTo(team, pos);

  for (const e of events) {
    switch (e.type) {
      case 'marchStarted':
        if (squadTeam(e.squadId) === team) out.push(e);
        break;
      case 'marchCancelled':
      case 'refilled':
        if (squadTeam(e.squadId) === team) out.push(e);
        break;
      case 'garrisoned':
        if (squadTeam(e.squadId) === team || sees(nodePos(e.nodeId))) out.push(e);
        break;
      case 'hqGarrisoned':
      case 'hqGarrisonRejected':
        if (squadTeam(e.squadId) === team) out.push({ ...e });
        break;
      case 'garrisonRejected':
        if (squadTeam(e.squadId) === team) out.push({ ...e });
        break;
      case 'nodeCaptured':
        out.push(e); // who holds a node is public
        break;
      case 'combat': {
        const log = e.log;
        const mine = log.attacker.team === team || log.fights.some((f) => f.defender.team === team);
        if (mine) {
          out.push(e);
        } else {
          const pos = log.subject.kind === 'node' ? nodePos(log.subject.nodeId) : game.playerByHq(log.subject.hqId)?.hq.pos;
          if (pos && sees(pos)) out.push({ type: 'combatFx', timeMs: e.timeMs, pos, subject: log.subject.kind });
        }
        break;
      }
      case 'hqDamaged':
      case 'hqDefeated': {
        const owner = game.playerByHq(e.hqId);
        if (owner && owner.team === team) out.push(e);
        break;
      }
      case 'teleported': {
        const owner = game.playerByHq(e.hqId);
        if (!owner) break;
        const own = owner.team === team;
        if (own || sees(e.from) || sees(e.to)) {
          out.push({ type: 'teleportFx', timeMs: e.timeMs, hqId: e.hqId, from: e.from, to: e.to, own, forced: e.forced });
        }
        break;
      }
      case 'turretPulse':
        if (sees(nodePos(e.nodeId)) || game.nodes.get(e.nodeId)?.owner === team) {
          out.push({ type: 'turretPulse', timeMs: e.timeMs, nodeId: e.nodeId, hits: e.hits.filter((h) => squadTeam(h.squadId) === team) });
        }
        break;
      case 'missileLaunched':
        if (e.team === team || sees(e.from) || sees(e.to)) {
          out.push({ type: 'missileLaunched', timeMs: e.timeMs, id: e.id, own: e.team === team, from: e.from, to: e.to, startMs: e.startMs, arriveMs: e.arriveMs });
        }
        break;
      case 'scoutLaunched':
        if (game.players.get(e.owner)?.team === team) out.push(e);
        break;
      case 'scoutReport':
        // Reports ride along in the view; no separate event needed.
        break;
      case 'matchEnded':
        out.push(e);
        break;
    }
  }
  return out;
}
