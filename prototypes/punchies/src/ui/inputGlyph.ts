import type Phaser from 'phaser';
import { t } from '../i18n';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { loadLayouts, type Action, type Profile } from '../input/layouts';

export function keyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (code.startsWith('Numpad')) return t('layouts.num_key', { key: /^Numpad\d$/.test(code) ? code.slice(6) : t('layouts.key_' + code.slice(6)) });
  const symbols: Record<string, string> = { BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\', Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=' };
  return symbols[code] ?? t('layouts.key_' + code);
}
const PAD_NAMES: Record<number, string> = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 10: 'LS', 11: 'RS' };
export function padLabel(button: number): string {
  return PAD_NAMES[button] ?? t('layouts.dpad_' + button);
}
export function bindingLabel(profile: Profile, action: Action): string {
  const mappings = loadLayouts();
  return (profile === 'kb1' || profile === 'kb2') ? mappings[profile][action].map(keyLabel).join(' / ') : mappings[profile][action].map(padLabel).join(' / ');
}
/** A canvas-only glyph: no texture/raster dependency, reusable at arbitrary scale. */
export function inputGlyph(scene: Phaser.Scene, x: number, y: number, binding: string | number, depth: number): Phaser.GameObjects.Container {
  const label = typeof binding === 'number' ? padLabel(binding) : keyLabel(binding);
  const width = Math.max(26, Math.min(104, label.length * 7 + 16));
  const g = scene.add.graphics();
  const colors: Record<number, number> = { 0: 0x198744, 1: 0xb92c36, 2: 0x1868bd, 3: 0xe5bb22 };
  if (typeof binding === 'number' && binding <= 3) {
    g.fillStyle(colors[binding]).fillCircle(0, 0, 13).lineStyle(2, 0xffffff, .65).strokeCircle(0, 0, 13);
  } else {
    g.fillStyle(0x263e59).fillRoundedRect(-width / 2, -13, width, 26, 5);
    g.lineStyle(1.5, 0xb6cce5).strokeRoundedRect(-width / 2, -13, width, 26, 5);
    g.lineStyle(2, 0x102339).lineBetween(-width / 2 + 5, 9, width / 2 - 5, 9);
  }
  const text = scene.add.text(0, 0, label, { fontFamily: 'Arial', fontSize: 12, fontStyle: 'bold', color: binding === 3 ? '#17212b' : '#ffffff', resolution: PIXEL_RATIO }).setOrigin(.5);
  return scene.add.container(x, y, [g, text]).setDepth(depth);
}
