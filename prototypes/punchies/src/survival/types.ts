import type { CharId } from '../sim/character';
import type { Fighter, SimEvent } from '../sim/types';
import type { EasyAIState } from '../sim/ai';

export interface RunOptions { fighter: CharId; skin: string; seed: number; runId: string; balanceVersion?: string }
export interface SurvivalEnemy {
  id: string;
  kind: 'zombie' | 'boss';
  visualId: 'zombie' | CharId;
  fighter: Fighter;
  attackWait: number;
  speedRatio: number;
  maxHealth: number;
}
export interface SurvivalRun {
  runId: string; fighter: CharId; skin: string; balanceVersion: string;
  seed: number; rngState: number; tick: number; wave: number; clearedWave: number;
  remainingTicks: number; waveKills: number; waveZombieKills: number; totalKills: number;
  status: 'active' | 'intermission' | 'ended';
  endReason: 'defeat' | 'abandoned' | null;
  player: Fighter; enemies: SurvivalEnemy[]; bossChar: CharId | null;
  healing: number; hitstop: number; spawnWait: number; nextEnemyId: number;
  swingHits: string[]; bossSpawned: boolean;
  bossAI: EasyAIState | null;
}
export type SurvivalEvent =
  | { kind: 'combat'; event: SimEvent; entityIds: readonly [string, string] }
  | { kind: 'spawn'; enemyId: string; enemyKind: SurvivalEnemy['kind'] }
  | { kind: 'kill'; enemyId: string; enemyKind: SurvivalEnemy['kind'] }
  | { kind: 'waveCleared'; wave: number; kills: number; zombieKills: number; healing: number }
  | { kind: 'runEnded'; reason: 'defeat' | 'abandoned'; clearedWave: number };

export interface SurvivalBest {
  clearedWave: number; fighter: CharId; skin: string; balanceVersion: string; runId: string;
}
