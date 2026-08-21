import Phaser from 'phaser';
import type { TileState } from './types';
import tune from '../../tune.json';

export function rowsForDepth(depth: number): number {
  return tune.gridRowsBase + tune.gridRowsGrowthPerDepth * depth;
}

// Depth-scaled base HP, jittered by the same +/-1 spread the original
// Phaser.Math.Between(1, 3) placeholder used (there min 1, center 2).
function rollTileHp(depth: number): number {
  const base = tune.baseTileHp * Math.pow(tune.tileHpDepthMultiplier, depth);
  const jitter = Phaser.Math.Between(-1, 1);
  return Math.max(1, Math.round(base) + jitter);
}

function rollLoot(depth: number): number {
  if (Math.random() >= tune.lootChance) return 0;
  const scale = Math.pow(tune.lootValueDepthMultiplier, depth);
  const min = tune.lootValueBaseMin * scale;
  const max = tune.lootValueBaseMax * scale;
  return Math.max(1, Math.round(Phaser.Math.FloatBetween(min, max)));
}

export function generateBoard(depth: number): TileState[] {
  const rows = rowsForDepth(depth);
  const tiles: TileState[] = [];
  for (let i = 0; i < tune.gridCols * rows; i++) {
    tiles.push({ hp: rollTileHp(depth), loot: rollLoot(depth), revealed: false });
  }
  return tiles;
}

export function shipDamage(shipLevel: number): number {
  return tune.baseDamage + (shipLevel - 1) * tune.damagePerLevel;
}

export function upgradeCost(shipLevel: number): number {
  return Math.round(tune.upgradeCostBase * Math.pow(tune.upgradeCostGrowth, shipLevel - 1));
}
