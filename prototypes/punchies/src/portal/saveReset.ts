import {GAME_SAVE_KEYS,KEYS} from './keys';
import {SAVE_RESET_ID,STAGING_BUILD} from '../buildFlags';
import type {PortalStorage} from './types';
export interface SaveResetReceipt {id:string;status:'disabled'|'already-applied'|'applied'|'failed';staging:boolean;keys:readonly string[]}
/** Only the registered player-save allowlist. Never clear origin storage or delete receipt. */
export function applySaveReset(storage:PortalStorage):SaveResetReceipt {
 const receipt:SaveResetReceipt={id:SAVE_RESET_ID,status:'disabled',staging:STAGING_BUILD,keys:GAME_SAVE_KEYS};
 if(!SAVE_RESET_ID)return receipt;
 try{
  if(storage.getItem(KEYS.resetReceipt)===SAVE_RESET_ID)return {...receipt,status:'already-applied'};
  for(const key of GAME_SAVE_KEYS)storage.removeItem(key);
  if(GAME_SAVE_KEYS.some(key=>storage.getItem(key)!==null))return {...receipt,status:'failed'};
  storage.setItem(KEYS.resetReceipt,SAVE_RESET_ID);
  return {...receipt,status:storage.getItem(KEYS.resetReceipt)===SAVE_RESET_ID?'applied':'failed'};
 }catch{return {...receipt,status:'failed'};}
}
