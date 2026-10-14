import { tune } from '../tune';

export type UpgradeId = 'power' | 'splash' | 'value' | 'helper';
export const UPGRADES: UpgradeId[] = ['power', 'splash', 'value', 'helper'];

export interface Save {
  v: 2;
  gems: number;
  levels: Record<UpgradeId, number>;
  savedAt: number;
}

export const SAVE_KEY = 'dig-tap:save:v2';
export const NO_LEVELS: Save['levels'] = { power: 0, splash: 0, value: 0, helper: 0 };

export const upgradeCost = (id: UpgradeId, level: number): number =>
  Math.round(tune.upgrades[id].baseCost * Math.pow(tune.upgrades[id].growth, level));

export const maxLevel = (id: UpgradeId): number => (id === 'splash' ? tune.upgrades.splash.maxLevel : Infinity);
export const tapDamage = (levels: Save['levels']): number => tune.tap.damage + levels.power * tune.upgrades.power.damagePerLevel;
export const gemValue = (base: number, levels: Save['levels']): number => Math.max(1, Math.round(base * (1 + levels.value * tune.upgrades.value.perLevel)));
export const helperRate = (levels: Save['levels']): number => levels.helper * tune.upgrades.helper.tapsPerSecPerLevel;
/** Gems multiply with each chain wave after the first. */
export const chainMultiplier = (wave: number): number => 1 + Math.max(0, wave - 1) * tune.chain.gemBonusPerWave;
