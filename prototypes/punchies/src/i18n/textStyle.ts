import type Phaser from 'phaser';
import { getLanguage } from './index';

// Per-language text tweaks applied to every Phaser text object in one place, so
// scenes keep writing plain styles. Japanese, Korean, Chinese and Arabic get a
// system font list after the game's own font, so the browser picks a font that
// has those characters. (Arabic direction is handled in t(), not here.) (Narrow bundled fonts for the
// languages that need more room are a later step.)
const FALLBACK: Record<string, string> = {
  ja: "'Hiragino Sans','Yu Gothic','Meiryo','Noto Sans JP',sans-serif",
  ko: "'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif",
  zh: "'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif",
  ar: "'Geeza Pro','Segoe UI','Noto Sans Arabic',Tahoma,sans-serif",
};

export function tweakTextStyle(style: Phaser.Types.GameObjects.Text.TextStyle | undefined): Phaser.Types.GameObjects.Text.TextStyle | undefined {
  const lang = getLanguage();
  const fallback = FALLBACK[lang];
  if (!fallback) return style;
  const out = { ...(style ?? {}) };
  out.fontFamily = `${out.fontFamily ?? 'Arial'},${fallback}`;
  return out;
}

export function installTextLocale(PhaserNs: typeof Phaser): void {
  type Make = (this: unknown, x: unknown, y: unknown, text: unknown, style?: Phaser.Types.GameObjects.Text.TextStyle) => unknown;
  const factory = PhaserNs.GameObjects.GameObjectFactory.prototype as unknown as { text: Make };
  const original = factory.text;
  factory.text = function (this: unknown, x, y, text, style) {
    return original.call(this, x, y, text, tweakTextStyle(style));
  };
}
