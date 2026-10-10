// Player alias and the profile that travels with an online connection. Pure functions only
// (no storage, no scenes) so they can be tested directly. Anything that arrives from a peer is
// untrusted: it is re-sanitised here before it is ever drawn.

export interface AliasConfig { minLength: number; maxLength: number; defaultPrefix: string; reserved: string[]; offensive: string[]; }
export interface WireProfile { alias: string; title: string; level: number; }
export type AliasError = 'short' | 'long' | 'chars' | 'reserved' | 'blocked';
export type AliasResult = { ok: true; alias: string } | { ok: false; reason: AliasError };

// Bidirectional controls and zero-width characters can hide or reorder text.
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f­؜᠎​-‏‪-‮⁠-⁯﻿￹-￻]/gu;
const ALLOWED = /^[\p{L}\p{M}\p{N}]+(?: [\p{L}\p{M}\p{N}]+)*$/u;

/** Cleans input without judging it: normalises, strips invisible characters, collapses spaces. */
export function cleanAlias(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(INVISIBLE, '').replace(/[\s 　]+/gu, ' ').trim();
}

const compact = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const length = (s: string): number => [...s].length;

export function validateAlias(cfg: AliasConfig, raw: unknown): AliasResult {
  const alias = cleanAlias(raw);
  if (length(alias) < cfg.minLength) return { ok: false, reason: 'short' };
  if (length(alias) > cfg.maxLength) return { ok: false, reason: 'long' };
  if (!ALLOWED.test(alias)) return { ok: false, reason: 'chars' };
  const flat = compact(alias);
  if (cfg.reserved.some((r) => flat === compact(r))) return { ok: false, reason: 'reserved' };
  if (cfg.offensive.some((w) => compact(w) && flat.includes(compact(w)))) return { ok: false, reason: 'blocked' };
  return { ok: true, alias };
}

/** "Boxer" plus four digits from a seed in [0, 1). */
export function defaultAlias(cfg: AliasConfig, seed: number): string {
  const n = Math.floor(Math.min(0.999999, Math.max(0, Number.isFinite(seed) ? seed : 0)) * 9000) + 1000;
  return `${cfg.defaultPrefix} ${n}`;
}

/** A name a platform gave us: trimmed to fit rather than rejected. Returns null when nothing usable is left. */
export function fitPlatformName(cfg: AliasConfig, raw: unknown): string | null {
  const kept = [...cleanAlias(raw)].filter((c) => /[\p{L}\p{M}\p{N} ]/u.test(c)).join('').replace(/ +/g, ' ').trim();
  const cut = [...kept].slice(0, cfg.maxLength).join('').trim();
  const r = validateAlias(cfg, cut);
  return r.ok ? r.alias : null;
}

/** Validates a profile received from a peer. Never trusts it: bad parts fall back to safe defaults. */
export function readPeerProfile(cfg: AliasConfig, titleIds: string[], maxLevel: number, raw: unknown): WireProfile {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const a = validateAlias(cfg, o.alias);
  const title = typeof o.title === 'string' && titleIds.includes(o.title) ? o.title : titleIds[0];
  const level = Number.isSafeInteger(o.level) ? Math.min(maxLevel, Math.max(1, o.level as number)) : 1;
  return { alias: a.ok ? a.alias : cfg.defaultPrefix, title, level };
}
