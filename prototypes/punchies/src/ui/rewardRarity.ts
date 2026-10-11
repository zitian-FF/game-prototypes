import Phaser from 'phaser';
import type { ShopItem } from '../shop/draft';
import { t } from '../i18n';
import { tune } from '../sim/tune';
import { reducedMotion } from './presentation';

export function rewardRarity(item: ShopItem): 'epic' | 'legendary' {
  return item.kind === 'fighters' || item.skinType === 'unique' ? 'legendary' : 'epic';
}

export function rarityLabel(item: ShopItem): string {
  const rarity = rewardRarity(item);
  return rarity === 'epic' ? t('shop.rarity.epic') : t('shop.rarity.legendary');
}

/** A static purple Epic label or smoothly flowing prismatic Legendary lettering. */
export function styleRarity(scene: Phaser.Scene, label: Phaser.GameObjects.Text, item: ShopItem): void {
  if (rewardRarity(item) === 'epic') { label.setColor('#c58aff'); return; }
  label.setColor('#ffffff');
  const paint = (phase: number) => {
    const color = (offset: number) => Phaser.Display.Color.HSVToRGB((phase + offset) % 1, .48, 1).color;
    label.setTint(color(0), color(.2), color(.6), color(.4));
  };
  paint(0);
  if (reducedMotion()) return;
  const tween = scene.tweens.addCounter({ from: 0, to: 1, duration: tune.view.menu.shopRayRotationMs,
    repeat: -1, onUpdate: value => paint(value.getValue() ?? 0) });
  label.once('destroy', () => tween.remove());
}
