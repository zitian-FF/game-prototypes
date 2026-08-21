import { Pane } from 'tweakpane';
import tune from '../../tune.json';

type TuneKey = keyof typeof tune;

// Per-key slider ranges — digger's tunables span very different scales
// (pixel amounts, ms durations, counts, multipliers close to 1, and a
// 0-1 probability), unlike mp-net's uniformly-scaled timing values.
const RANGE: Partial<Record<TuneKey, { min: number; max: number; step: number }>> = {
  shipBobAmplitudePx: { min: 0, max: 50, step: 1 },
  shipBobDurationMs: { min: 200, max: 10000, step: 100 },
  energyMax: { min: 1, max: 200, step: 1 },
  energyRegenMs: { min: 1000, max: 300000, step: 1000 },
  gridCols: { min: 1, max: 12, step: 1 },
  gridRowsBase: { min: 1, max: 20, step: 1 },
  gridRowsGrowthPerDepth: { min: 0, max: 5, step: 1 },
  baseTileHp: { min: 1, max: 50, step: 1 },
  tileHpDepthMultiplier: { min: 1, max: 3, step: 0.01 },
  baseDamage: { min: 1, max: 50, step: 1 },
  damagePerLevel: { min: 0, max: 20, step: 1 },
  upgradeCostBase: { min: 1, max: 1000, step: 1 },
  upgradeCostGrowth: { min: 1, max: 3, step: 0.01 },
  lootChance: { min: 0, max: 1, step: 0.01 },
  lootValueBaseMin: { min: 0, max: 100, step: 1 },
  lootValueBaseMax: { min: 0, max: 100, step: 1 },
  lootValueDepthMultiplier: { min: 1, max: 3, step: 0.01 },
};

// Tweakpane panel exposing tune.json's values, available in production
// builds via ?debug=1 (see "Tuning" in root CLAUDE.md). Edits a local copy
// for inspection/export only — it does not feed back into the running
// game, matching the pattern used by mp-net/suits-mp's debug panels.
export function mountDebugPanelIfRequested(): void {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;

  const values = { ...tune };
  const pane = new Pane({ title: 'digger tune' });

  for (const key of Object.keys(values) as TuneKey[]) {
    pane.addBinding(values, key, RANGE[key]);
  }

  pane.addButton({ title: 'Copy JSON' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(values, null, 2));
  });
}
