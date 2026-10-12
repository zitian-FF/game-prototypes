/** Explicit compile-time staging policy. URL, hostname and portal never enable QA. */
declare const __PUNCHIES_STAGING__:boolean;
declare const __PUNCHIES_SAVE_RESET_ID__:string;
export const STAGING_BUILD=typeof __PUNCHIES_STAGING__!=='undefined'&&__PUNCHIES_STAGING__===true;
export const SAVE_RESET_ID=typeof __PUNCHIES_SAVE_RESET_ID__==='string'?__PUNCHIES_SAVE_RESET_ID__:'';
export function stagingStorageKey(key:string):string {return STAGING_BUILD?key.replace(/^punchies:/,'punchies:staging:'):key;}
