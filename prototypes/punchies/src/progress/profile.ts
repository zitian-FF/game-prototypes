import { store } from '../portal/store';
import { KEYS } from '../portal/keys';
import { portal } from '../portal/select';
import aliasCfg from './alias.json';
import progressCfg from './progress-config.json';
import { defaultAlias, fitPlatformName, readPeerProfile, validateAlias, type AliasConfig, type AliasResult, type WireProfile } from './alias';
import { progressView } from './progress';
import { TITLE_IDS } from './titles';

declare const __PUNCHIES_FIXED_ALIAS__: boolean;

const A = aliasCfg as AliasConfig;

interface Saved { alias: string | null; generated: string | null; }

function load(): Saved {
  try {
    const v = JSON.parse(store.getItem(KEYS.profile) ?? 'null') as Partial<Saved> | null;
    return { alias: typeof v?.alias === 'string' ? v.alias : null, generated: typeof v?.generated === 'string' ? v.generated : null };
  } catch { return { alias: null, generated: null }; }
}
const save = (s: Saved): void => { try { store.setItem(KEYS.profile, JSON.stringify(s)); } catch { /* storage unavailable */ } };

/** The alias to show: the one the player typed, else the portal's player name, else a generated "Boxer 1234" kept for good. */
export function getAlias(): string {
  const s = load();
  const typed = s.alias && validateAlias(A, s.alias);
  if (typed && typed.ok) return typed.alias;
  const platform = fitPlatformName(A, portal.playerName?.());
  if (platform) return platform;
  if (s.generated && validateAlias(A, s.generated).ok) return s.generated;
  const generated = defaultAlias(A, Math.random());
  save({ ...s, generated });
  return generated;
}

/** Whether the player may type their own alias. Portals that forbid user-generated text can force the generated or platform name. */
export const aliasEditable = (): boolean => !__PUNCHIES_FIXED_ALIAS__;

export function setAlias(raw: string): AliasResult {
  if (!aliasEditable()) return { ok: false, reason: 'blocked' };
  const r = validateAlias(A, raw);
  if (r.ok) save({ ...load(), alias: r.alias });
  return r;
}

/** What we tell an online opponent. Only the alias is free text; the title is an id. */
export function localWireProfile(): WireProfile {
  const v = progressView();
  return { alias: getAlias(), title: v.title, level: v.level };
}

export const peerProfile = (raw: unknown): WireProfile => readPeerProfile(A, TITLE_IDS, progressCfg.maxLevel, raw);

/** Per-side profiles for a match, for the VS intro, health bar area and victory screen. Offline only your own title shows; a bot has none. */
export function sideProfiles(localIdx: 0 | 1, peer: WireProfile | null): [WireProfile | null, WireProfile | null] {
  const me = localWireProfile();
  return localIdx === 0 ? [me, peer] : [peer, me];
}
