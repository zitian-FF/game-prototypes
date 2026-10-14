import { tune } from '../tune';

export type UpgradeId = 'power' | 'value' | 'helper';
export const UPGRADES: UpgradeId[] = ['power', 'value', 'helper'];

export interface Save {
  v: 1;
  gems: number;
  levels: Record<UpgradeId, number>;
  savedAt: number;
}

export const SAVE_KEY = 'dig-tap:save:v1';

export const upgradeCost = (id: UpgradeId, level: number): number =>
  Math.round(tune.upgrades[id].baseCost * Math.pow(tune.upgrades[id].growth, level));

export const tapDamage = (levels: Save['levels']): number => tune.tap.damage + levels.power * tune.upgrades.power.damagePerLevel;
export const gemValue = (base: number, levels: Save['levels']): number => Math.max(1, Math.round(base * (1 + levels.value * tune.upgrades.value.perLevel)));
export const helperRate = (levels: Save['levels']): number => levels.helper * tune.upgrades.helper.tapsPerSecPerLevel;
