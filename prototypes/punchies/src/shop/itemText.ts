import { tOr } from '../i18n';
import type { ShopItem } from './draft';

/** Translated display name of a shop item; falls back to the English name in the data. */
export function itemName(item: Pick<ShopItem, 'id' | 'name'>): string {
  return tOr(`shop.item.${item.id}.name`, item.name);
}
