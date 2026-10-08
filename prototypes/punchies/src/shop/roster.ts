import { CHARACTER_IDS, type CharId } from '../sim/character';
import { SHOP_ITEMS, WELCOME_FIGHTER, type ShopDraftState, type ShopItem } from './draft';
import { STARTER_SKINS } from '../render/skinPalette';

export const DEFAULT_SKIN = 'default';

export function availableFighters(state: ShopDraftState): CharId[] {
  return CHARACTER_IDS.filter(id => id !== 'tee' || state.owned.includes(WELCOME_FIGHTER));
}

export function skinItem(char: string, skin: string): ShopItem | undefined {
  return SHOP_ITEMS.find(item => item.kind === 'skins' && item.boxer === char && item.id === skin);
}

export function ownedSkins(state: ShopDraftState, char: CharId): string[] {
  return [DEFAULT_SKIN, ...SHOP_ITEMS.filter(item =>
    item.kind === 'skins' && item.boxer === char && (STARTER_SKINS.includes(item.id) || state.owned.includes(item.id))).map(item => item.id)];
}

export function equippedSkin(state: ShopDraftState, char: CharId, requested: unknown): string {
  return typeof requested === 'string' && ownedSkins(state, char).includes(requested) ? requested : DEFAULT_SKIN;
}

export function skinName(char: string, skin: string): string {
  return skinItem(char, skin)?.name.split(' · ')[1] ?? 'DEFAULT';
}
