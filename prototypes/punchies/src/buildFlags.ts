/** Explicit compile-time staging policy. URL, hostname and portal never enable QA. */
declare const __PUNCHIES_STAGING__:boolean;
declare const __PUNCHIES_SAVE_RESET_ID__:string;
export const STAGING_BUILD=typeof __PUNCHIES_STAGING__!=='undefined'&&__PUNCHIES_STAGING__===true;
export const SAVE_RESET_ID=typeof __PUNCHIES_SAVE_RESET_ID__==='string'?__PUNCHIES_SAVE_RESET_ID__:'';
export function stagingStorageKey(key:string):string {return STAGING_BUILD?key.replace(/^punchies:/,'punchies:staging:'):key;}

declare const __PUNCHIES_QA__:boolean;
export const DEBUG_TOOLS_BUILD=STAGING_BUILD && typeof __PUNCHIES_QA__!=='undefined' && __PUNCHIES_QA__===true;


declare const __PUNCHIES_SOURCE_SHA__:string;
export const SOURCE_SHA=typeof __PUNCHIES_SOURCE_SHA__==='string'?__PUNCHIES_SOURCE_SHA__:'unknown';
