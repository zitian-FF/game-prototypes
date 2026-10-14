import type { GameState } from './types';
import { generateBoard } from './board';
import tune from '../../tune.json';

// Bumped from v1: TileState dropped `loot` and gained `adjacent`/
// `treasureIndex`, and GameState gained `treasures` -- a breaking
// save-shape change, so old saves are discarded (see house Persistence
// rule) rather than migrated.
const SAVE_KEY = 'digger:save:v2';

function freshState(): GameState {
  const depth = 0;
  const { tiles, treasures } = generateBoard(depth);
  return {
    energy: tune.energyMax,
    energyTimestamp: Date.now(),
    currency: 0,
    shipLevel: 1,
    depth,
    gridCols: tune.gridCols,
    gridRows: tune.gridRowsBase,
    tiles,
    treasures,
  };
}

export function loadState(): GameState {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return freshState();
  try {
    const state = JSON.parse(raw) as GameState;
    // Safety net for saves written before energyMax was lowered (e.g. from
    // 32): clamp so a returning player's energy can't sit permanently above
    // the current cap, which would otherwise never regenerate further.
    state.energy = Math.min(state.energy, tune.energyMax);
    return state;
  } catch {
    return freshState();
  }
}

export function saveState(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearState(): void {
  localStorage.removeItem(SAVE_KEY);
}
