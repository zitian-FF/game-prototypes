import type { GameState } from './types';
import { generateBoard } from './board';
import tune from '../../tune.json';

const SAVE_KEY = 'digger:save:v1';

function freshState(): GameState {
  const depth = 0;
  return {
    energy: tune.energyMax,
    energyTimestamp: Date.now(),
    currency: 0,
    shipLevel: 1,
    depth,
    gridCols: tune.gridCols,
    gridRows: tune.gridRowsBase,
    tiles: generateBoard(depth),
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
