import tuneJson from '../tune.json';
import { COLORS } from './theme';

/** One block of handbook text. `tri` is the counter triangle drawing. */
export type Item = { k: 'h' | 'p' | 'b' | 'tri'; t?: string; color?: string };

export const TABS = ['What it is', 'Nodes', 'Units', 'Teleport'] as const;
export type Tab = (typeof TABS)[number];

const tune = tuneJson;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const mins = (s: number) => `${Math.round(s / 60)}`;

/** Handbook text. Numbers come from tune.json, so they follow the rules the server runs. */
export function handbook(): Record<Tab, Item[]> {
  const pts = tune.scoring.tierPointsPerSecond;
  const gb = tune.scoring.garrisonPointsPerSecond;
  const cx = tune.combat.counterMultiplier;
  const ex = tune.combat.powerExponent;
  const tcd = tune.hq.teleportCooldownSeconds;
  const ph = tune.phases;
  const dmgFor = (ratio: number) => Math.pow(ratio, ex).toFixed(1);
  const tp = (tier: number) => `${pts[tier - 1]} pts/s`;
  return {
    'What it is': [
      { k: 'h', t: 'Firestorm Arena' },
      { k: 'p', t: `${tune.match.playersPerTeam} v ${tune.match.playersPerTeam} commanders fight over nodes. When the clock ends, the team with more points wins.` },
      { k: 'p', t: 'Three things make it what it is:' },
      { k: 'b', t: 'Fog of war. You only see around nodes your team holds. Enemy squads show as masked units. A scout reveals a node or HQ garrison for ' + tune.scout.revealSeconds + 's, and combat logs show both sides after a fight.' },
      { k: 'b', t: `Restrictive teleport. Your HQ cannot walk. It jumps (${tcd}s cooldown) only to a node your team holds or a Portal Nexus. Choose where you stand with care.` },
      { k: 'b', t: 'Random map. Every match is a new layout. It is point-symmetric, so both teams get the same nodes, but nobody can memorise routes. Scout, read, adapt.' },
      { k: 'h', t: 'How you win' },
      { k: 'b', t: `Held nodes score every second: T1 ${pts[0]}, T2 ${pts[1]}, T3 ${pts[2]}, T4 ${pts[3]} pts/s. Each commander garrisoned in a node adds ${gb}/s.` },
      { k: 'b', t: `A node's points are permanent for ${tune.pool.settleSeconds}s after any capture. After that they pile into a pool. If the enemy takes the node, the pool drops as ${tune.pool.minCaches} to ${tune.pool.maxCaches} caches that any scout can bank for its own team.` },
      { k: 'b', t: 'Commander score (personal leaderboard): troops defeated, nodes captured, garrison time, HQs downed, cache points banked.' },
      { k: 'h', t: 'Your commander' },
      { k: 'b', t: `You get 2 to 4 squads (power ${tune.power.min} to ${tune.power.max}M, up to ${tune.squad.maxTroops} troops). Squads 1 and 2 are your fighters, 3 and 4 are utility.` },
      { k: 'b', t: `A reserve pool of ${tune.squad.reservePoolMin / 1000} to ${tune.squad.reservePoolMax / 1000}k troops refills squads at your HQ. Lost troops are gone.` },
      { k: 'b', t: `${tune.scout.perHq} scouts, fast and unarmed. Use them before every attack.` },
    ],
    Nodes: [
      { k: 'p', t: 'Effects are base value x tier, apply to the whole team while held, and stack. Higher tiers score more.' },
      { k: 'h', t: `Nuclear Silo  T4  ${tp(4)}` },
      { k: 'p', t: `Map centre. Opens when ${pct(1 - ph.tier4UnlockRemaining)} of the match has passed.` },
      { k: 'h', t: `Missile Turret  T3  ${tp(3)}` },
      { k: 'p', t: `Opens when ${pct(1 - ph.tier3UnlockRemaining)} has passed. Every ${tune.turret.pulseSeconds}s it fires at each enemy turret and silo: -${pct(tune.turret.damageFraction)} max troops on every garrisoned squad.` },
      { k: 'h', t: `Oil Refinery  T2  ${tp(2)}` },
      { k: 'p', t: 'Pure score.' },
      { k: 'h', t: `Radar Tower  T2  ${tp(2)}` },
      { k: 'p', t: `Sees ${tune.nodes.largeVision.visionRadiusCells} cells around it (other nodes see ${tune.nodes.points.visionRadiusCells}).` },
      { k: 'h', t: `Arsenal  T1  ${tp(1)}` },
      { k: 'p', t: `Team attack +${pct(tune.nodes.attackBoost.attackPct)}.` },
      { k: 'h', t: `Armory  T1  ${tp(1)}` },
      { k: 'p', t: `Team damage taken -${pct(tune.nodes.defenseBoost.defensePct)}.` },
      { k: 'h', t: `Accelerator  T1  ${tp(1)}` },
      { k: 'p', t: `Squads cross the map ${tune.nodes.speedBoost.marchEdgeSecondsCut}s faster edge to edge (${tune.march.edgeToEdgeSeconds}s base). Scouts and missiles are not affected.` },
      { k: 'h', t: `Tech Centre  T1  ${tp(1)}` },
      { k: 'p', t: `Teleport cooldown runs ${1 + tune.nodes.teleportCooldown.teleportCooldownRate}x as fast (${1 + 2 * tune.nodes.teleportCooldown.teleportCooldownRate}x with two).` },
      { k: 'h', t: `Hospital  T1  ${tp(1)}` },
      { k: 'p', t: `Every ally regains ${tune.nodes.hospital.poolRegenPerSecond} reserve troops a second.` },
      { k: 'h', t: 'Portal Nexus' },
      { k: 'p', t: 'Neutral, cannot be captured. Any HQ may teleport here. Both teams see around it, so HQs that land are in plain view.' },
      { k: 'h', t: 'Garrisons' },
      { k: 'p', t: `A node holds ${tune.garrison.maxSquads} squads, one per commander. Garrison for the score bonus and to defend. An ungarrisoned node stays yours until an enemy squad touches it.` },
    ],
    Units: [
      { k: 'h', t: 'Counter triangle' },
      { k: 'tri' },
      { k: 'p', t: `Aircraft beat Tank, Tank beat Missile, Missile beat Aircraft. Arrows point from winner to loser. A counter is worth x${cx} power.` },
      { k: 'h', t: 'Combat, roughly' },
      { k: 'p', t: `Fights happen only at nodes and HQs, auto-resolved in rounds. Both sides hit at once. Damage per round grows with (power x counter / ${tune.combat.powerRef})^${ex}, and shrinks as the squad loses troops.` },
      { k: 'b', t: `Power gap matters a lot: +10% power = ${dmgFor(1.1)}x damage, +20% = ${dmgFor(1.2)}x.` },
      { k: 'b', t: `A counter (x${cx}) = ${dmgFor(cx)}x damage. A counter beats an enemy with up to ${pct(cx - 1)} more power.` },
      { k: 'b', t: `Arsenal +${pct(tune.nodes.attackBoost.attackPct)} attack = ${dmgFor(1 + tune.nodes.attackBoost.attackPct)}x damage. Armory cuts damage taken by ${pct(tune.nodes.defenseBoost.defensePct)}.` },
      { k: 'b', t: `Small random swing of +/-${(tune.combat.variance * 100).toFixed(1)}% per fight.` },
      { k: 'h', t: 'Attacking a node' },
      { k: 'b', t: `The attacker fights defenders one at a time, newest garrison first, up to ${tune.combat.maxDefendersPerAttack} per attack, and keeps its troops between fights.` },
      { k: 'b', t: 'Clear them all and the node is yours at once. Clear 10 with defenders left and the attacker goes home.' },
      { k: 'b', t: `A squad at 0 troops is defeated: it walks home at half speed. Troops lost are gone for good. Refill from your reserve pool at your HQ.` },
      { k: 'h', t: 'Marching' },
      { k: 'p', t: `Edge to edge in ${tune.march.edgeToEdgeSeconds}s at base speed. Scouts and missiles fly ${tune.scout.speedFactor}x faster. Squads in the field cannot fight until they arrive.` },
    ],
    Teleport: [
      { k: 'h', t: 'The rules' },
      { k: 'b', t: `Instant jump of your HQ. Cooldown ${tcd}s, shortened by Tech Centres.` },
      { k: 'b', t: `Destination: a free slot (${tune.hq.slotsPerNode} around each node) at a node your team holds, or any Portal Nexus. Never a neutral or enemy node.` },
      { k: 'b', t: 'All your squads and scouts, wherever they are, return to the HQ and jump with it.' },
      { k: 'b', t: 'The Teleport button always shows the time left or the reason it is blocked.' },
      { k: 'h', t: 'Risks' },
      { k: 'b', t: 'Your starting safe zone cannot be attacked. An HQ on a node is a target.' },
      { k: 'b', t: 'When a node flips, HQs standing at it are stranded: they stay and can be attacked. They can only escape by teleporting to a node their team holds, if off cooldown.' },
      { k: 'b', t: 'The capturing team can teleport into the free slots beside stranded HQs and strike them.' },
      { k: 'b', t: 'Portal Nexus is neutral and lit for both teams. Quick to reach, but everyone sees you land.' },
      { k: 'h', t: 'Using it well' },
      { k: 'b', t: 'Hold a forward node, then jump to it to reinforce or dodge a strike.' },
      { k: 'b', t: `Keep the cooldown in mind: after a jump you are committed for ${mins(tcd)} minutes.` },
    ],
  };
}

export const HANDBOOK_COLORS = { heading: '#ffb066', body: COLORS.text, dim: COLORS.dim };
