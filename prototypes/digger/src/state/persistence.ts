import type { GameState } from './types';
import { generateBoard, rowsForDepth } from './board';
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
    gridRows: rowsForDepth(depth),
    tiles: generateBoard(depth),
  };
}

export function loadState(): GameState {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return freshState();
  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return freshState();
  }
}

export function saveState(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}
