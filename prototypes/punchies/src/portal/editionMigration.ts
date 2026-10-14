import type {PortalStorage} from './types';
/** Preserve the existing itch player's save when the live edition changes.
 * Copy absent CG keys only. Never delete or overwrite MASTER or existing CG. */
export function migrateCrazyGamesSaves(target:PortalStorage,native:PortalStorage,master:Record<string,string>,cg:Record<string,string>):number {
 let copied=0;
 for(const name of Object.keys(master)){
  const oldKey=master[name],newKey=cg[name];if(!newKey||oldKey===newKey)continue;
  try{
   if(target.getItem(newKey)!==null)continue;
   const value=target.getItem(oldKey)??native.getItem(oldKey);if(value===null)continue;
   target.setItem(newKey,value);if(target.getItem(newKey)===value)copied++;
  }catch{/* Blocked reads/writes must never clear or replace an existing save. */}
 }
 return copied;
}
