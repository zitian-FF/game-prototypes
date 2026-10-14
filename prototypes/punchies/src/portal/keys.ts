// Every persisted key, in one place. The portal preloads these before the first
// scene runs, so any new saved key must be added here (test-punchies-portal.mjs
// fails if a key is read from the store without being listed).
import {stagingStorageKey} from '../buildFlags';
import {EDITION_ID} from '../edition';
const playerKeys = {
  audio: 'punchies:audio:v1',
  shop: 'punchies:shop-preview:v1',
  tutorial: 'punchies:tutorial:v1',
  chars: 'punchies:chars:v1',
  localInputs: 'punchies:localInputs:v1',
  language: 'punchies:language:v1',
  firstRun: 'punchies:firstrun:v1',
  progress: 'punchies:progress:v1',
  profile: 'punchies:profile:v1',
  survival: 'punchies:survival:v1',
  rating: 'punchies:rating:v1',
} as const;
export const MASTER_KEYS=Object.freeze({...playerKeys,resetReceipt:'punchies:save-reset:v1'});
const betaKeys=EDITION_ID==='itchbeta'?{betaCompletions:'punchies:beta-completions:v1'}:{};
export const KEYS=Object.fromEntries(Object.entries({...MASTER_KEYS,...betaKeys}).map(([name,key])=>[name,stagingStorageKey(key)])) as {[K in keyof typeof playerKeys|'resetReceipt']:string}&{betaCompletions?:string};
export const GAME_SAVE_KEYS=Object.freeze([...Object.keys(playerKeys).map(name=>KEYS[name as keyof typeof playerKeys]),...(KEYS.betaCompletions?[KEYS.betaCompletions]:[])]);
/** Developer preferences are isolated in staging but are not player-save data. */
export const DEV_KEYS={debug:stagingStorageKey('punchies:debug:v1'),unlock:stagingStorageKey('punchies:debug:unlock:v1')};
