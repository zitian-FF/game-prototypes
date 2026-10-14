/** Build identity is independent of quality and portal adapter. */
declare const __PUNCHIES_EDITION__: 'master'|'crazygames'|'itchbeta';
declare const __PUNCHIES_EDITION_FIGHTERS__: readonly string[];
declare const __PUNCHIES_EDITION_POLICY_HASH__: string;
declare const __PUNCHIES_EDITION_NAMESPACE__: string;
export const EDITION_ID=typeof __PUNCHIES_EDITION__==='string'?__PUNCHIES_EDITION__:'master';
export const CRAZYGAMES_EDITION=EDITION_ID==='crazygames';
export const ITCH_BETA_EDITION=EDITION_ID==='itchbeta';
export const editionSkinAllowed=(skin:unknown)=>!ITCH_BETA_EDITION||skin==='default';
export const EDITION_FIGHTERS=typeof __PUNCHIES_EDITION_FIGHTERS__!=='undefined'?__PUNCHIES_EDITION_FIGHTERS__:[];
export const EDITION_POLICY_HASH=typeof __PUNCHIES_EDITION_POLICY_HASH__==='string'?__PUNCHIES_EDITION_POLICY_HASH__:'';
export function editionStorageKey(key:string):string {
 const namespace=typeof __PUNCHIES_EDITION_NAMESPACE__==='string'?__PUNCHIES_EDITION_NAMESPACE__:'';
 return namespace?key.replace(/^punchies:/,namespace):key;
}
