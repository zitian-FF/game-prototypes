import { Pane } from 'tweakpane';
import tune from '../../tune.json';

type ScalarTuneKey = Exclude<keyof typeof tune, 'treasure'>;
type TreasureKey = keyof typeof tune.treasure;

// Per-key slider ranges — digger's tunables span very different scales
// (pixel amounts, ms durations, counts, multipliers close to 1, and a
// 0-1 probability), unlike mp-net's uniformly-scaled timing values.
const RANGE: Partial<Record<ScalarTuneKey, { min: number; max: number; step: number }>> = {
  shipBobAmplitudePx: { min: 0, max: 50, step: 1 },
  shipBobDurationMs: { min: 200, max: 10000, step: 100 },
  energyMax: { min: 1, max: 200, step: 1 },
  energyRegenMs: { min: 1000, max: 300000, step: 1000 },
  gridCols: { min: 1, max: 12, step: 1 },
  gridRowsBase: { min: 1, max: 20, step: 1 },
  minTileTapPx: { min: 20, max: 80, step: 1 },
  resetConfirmWindowMs: { min: 500, max: 10000, step: 100 },
  baseTileHp: { min: 1, max: 50, step: 1 },
  tileHpDepthMultiplier: { min: 1, max: 3, step: 0.01 },
  baseDamage: { min: 1, max: 50, step: 1 },
  damagePerLevel: { min: 0, max: 20, step: 1 },
  upgradeCostBase: { min: 1, max: 1000, step: 1 },
  upgradeCostGrowth: { min: 1, max: 3, step: 0.01 },
  laserFadeMs: { min: 50, max: 2000, step: 50 },
  debrisScaleMin: { min: 0.1, max: 3, step: 0.05 },
  debrisScaleMax: { min: 0.1, max: 3, step: 0.05 },
  debrisLifespanMinMs: { min: 50, max: 3000, step: 50 },
  debrisLifespanMaxMs: { min: 50, max: 3000, step: 50 },
  debrisConeHalfAngleDeg: { min: 0, max: 180, step: 1 },
  debrisSpeedMin: { min: 0, max: 500, step: 5 },
  debrisSpeedMax: { min: 0, max: 500, step: 5 },
  debrisGravityY: { min: -1000, max: 1000, step: 10 },
  debrisRotationSpeedMinDeg: { min: -720, max: 720, step: 10 },
  debrisRotationSpeedMaxDeg: { min: -720, max: 720, step: 10 },
  debrisWeakCountMin: { min: 0, max: 30, step: 1 },
  debrisWeakCountMax: { min: 0, max: 30, step: 1 },
  debrisStrongCountMin: { min: 0, max: 30, step: 1 },
  debrisStrongCountMax: { min: 0, max: 30, step: 1 },
};

const TREASURE_RANGE: Record<TreasureKey, { min: number; max: number; step: number }> = {
  countMin: { min: 0, max: 10, step: 1 },
  countMax: { min: 0, max: 10, step: 1 },
  valuePerCellBase: { min: 0, max: 100, step: 1 },
  valueDepthMultiplier: { min: 1, max: 3, step: 0.01 },
};

// Tweakpane panel exposing tune.json's values, available in production
// builds via ?debug=1 (see "Tuning" in root CLAUDE.md). Edits a local copy
// for inspection/export only — it does not feed back into the running
// game, matching the pattern used by mp-net/suits-mp's debug panels.
export function mountDebugPanelIfRequested(): void {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;

  // Deep-copy the nested treasure group specifically -- a shallow
  // { ...tune } keeps the same object reference for `.treasure` (ES module
  // imports of the same JSON file are cached/shared), so without this,
  // Tweakpane bindings on the group would mutate the real config every
  // other module reads from, unlike every scalar top-level key which is
  // already copied by value.
  const values = { ...tune, treasure: { ...tune.treasure } };
  const pane = new Pane({ title: 'digger tune' });

  for (const key of Object.keys(tune) as (keyof typeof tune)[]) {
    if (key === 'treasure') continue;
    pane.addBinding(values, key, RANGE[key as ScalarTuneKey]);
  }

  const treasureFolder = pane.addFolder({ title: 'treasure' });
  for (const key of Object.keys(tune.treasure) as TreasureKey[]) {
    treasureFolder.addBinding(values.treasure, key, TREASURE_RANGE[key]);
  }

  pane.addButton({ title: 'Copy JSON' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(values, null, 2));
  });
}
