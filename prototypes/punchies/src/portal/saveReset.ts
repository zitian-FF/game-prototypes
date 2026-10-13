import {GAME_SAVE_KEYS,KEYS} from './keys';
import {SAVE_RESET_ID,STAGING_BUILD} from '../buildFlags';
import type {PortalStorage} from './types';
export interface SaveResetReceipt {id:string;status:'disabled'|'already-applied'|'preserved'|'failed';staging:boolean;keys:readonly string[]}
/** The historical one-time reset is retired. Missing receipts never authorize another wipe. */
export function applySaveReset(storage:PortalStorage):SaveResetReceipt {
 const receipt:SaveResetReceipt={id:SAVE_RESET_ID,status:'disabled',staging:STAGING_BUILD,keys:GAME_SAVE_KEYS};
 if(!SAVE_RESET_ID)return receipt;
 try{
  if(storage.getItem(KEYS.resetReceipt)===SAVE_RESET_ID)return {...receipt,status:'already-applied'};
  // Preserve every player value, including saves whose receipt was lost or
  // never persisted. Keep the original epoch; updates must not replay it.
  const persisted=storage.persistResetReceipt?storage.persistResetReceipt(KEYS.resetReceipt,SAVE_RESET_ID):(storage.setItem(KEYS.resetReceipt,SAVE_RESET_ID),storage.getItem(KEYS.resetReceipt)===SAVE_RESET_ID);
  if(!persisted)return {...receipt,status:'failed'};
  return {...receipt,status:'preserved'};
 }catch{return {...receipt,status:'failed'};}
}
