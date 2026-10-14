import { mix } from './color';

export type TileKind = 'soft' | 'normal' | 'hardened';

// Bright, saturated strata, top layer first: grass green, warm orange, sky blue.
export const LAYER_COLORS = [0x5ed957, 0xffa23a, 0x4d9bff];

/** Colour of a block in the given layer (0 = top). Soft is lighter, hardened is stone-tinted. */
export function layerColor(layer: number, kind: TileKind): number {
  const base = LAYER_COLORS[Math.min(layer, LAYER_COLORS.length - 1)];
  if (kind === 'soft') return mix(base, 0xffffff, 0.22);
  if (kind === 'hardened') return mix(base, 0x8c9bc4, 0.6);
  return base;
}
