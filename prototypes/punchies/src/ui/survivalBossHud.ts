import type {CharId} from '../sim/character';
import {charName} from '../sim/character';
import type {SurvivalBossHud} from './Hud';
export interface SurvivalBossView {
 runId:string; wave:number; waveMode:'timed'|'boss';
 boss:{state:'incoming'|'alive'|'defeated';char:CharId;currentHP:number|null;maxHP:number|null}|null;
}
/** Consume Logic's actual boss snapshot, never the closest zombie/fighter HP. */
export function survivalBossHud(view:SurvivalBossView):SurvivalBossHud|null {
 if(view.waveMode!=='boss'||!view.boss)return null;
 const boss=view.boss;
 return {key:`${view.runId}:${view.wave}`,name:charName(boss.char),
  health:boss.currentHP,maxHealth:boss.maxHP};
}
