import type { NodeKind, SquadType, TeamId } from 'arena-sim';

export const COLORS = {
  mine: 0x4db8ff,
  enemy: 0xff6a3d,
  neutral: 0x8a8f98,
  self: 0x5dff8a,
  ally: 0x7a9a86,
  enemyLine: 0xff4a4a,
  gold: 0xffd54a,
  panel: 0x10141a,
  panelEdge: 0x2b3440,
  text: '#e8edf3',
  dim: '#8a94a3',
  warn: '#ffb04a',
  bad: '#ff6a6a',
  good: '#7dff9b',
};

export const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

export const SQUAD_LABEL: Record<SquadType, string> = { tank: 'Tank', aircraft: 'Aircraft', missile: 'Missile' };

const KIND_NAMES: Record<NodeKind, string> = {
  points: 'Score node',
  attackBoost: 'Arsenal',
  defenseBoost: 'Armory',
  speedBoost: 'Accelerator',
  teleportCooldown: 'Tech Centre',
  largeVision: 'Radar Tower',
  turret: 'Missile Turret',
  hospital: 'Hospital',
  portal: 'Portal Nexus',
};

/** What a building is called: score nodes are named by tier. */
export function nodeName(kind: NodeKind, tier: number): string {
  if (kind === 'points') return tier >= 4 ? 'Nuclear Silo' : tier >= 2 ? 'Oil Refinery' : KIND_NAMES.points;
  return KIND_NAMES[kind];
}

/** Power is shown in millions: 63.2M. */
export function fmtPower(power: number): string {
  return `${power.toFixed(1)}M`;
}

export function teamColor(team: TeamId | null, mine: TeamId): number {
  if (team === null) return COLORS.neutral;
  return team === mine ? COLORS.mine : COLORS.enemy;
}

/** Scale a 0xRRGGBB colour. */
export function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * f));
  const b = Math.min(255, Math.round((color & 255) * f));
  return (r << 16) | (g << 8) | b;
}

export function cssColor(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
