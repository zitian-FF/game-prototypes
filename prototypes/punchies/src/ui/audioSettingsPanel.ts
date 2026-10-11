import type Phaser from 'phaser';
import { t } from '../i18n';
import { getAudioSettings, setAudioSettings } from '../audio/mixer';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { getNav } from './menuNav';
import { titleButton } from './titleButton';
import { resetSavePanel } from './resetSavePanel';

export function audioSettingsPanel(scene: Phaser.Scene, inputs: () => void, credits: () => void, language: () => void): void {
  const items: Phaser.GameObjects.GameObject[] = [];
  const D = 410;
  items.push(scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x071020, .85).setDepth(D).setInteractive());
  items.push(scene.add.graphics().setDepth(D + 1).fillStyle(0x142b46).fillRoundedRect(VIEW.cx - 210, VIEW.cy - 160, 420, 320, 18));
  const text = (x: number, y: number, label: string, size = 16) => {
    const t = scene.add.text(x, y, label, { fontFamily: 'Arial', fontSize: `${size}px`, fontStyle: 'bold', color: '#fff1d1', resolution: PIXEL_RATIO }).setOrigin(.5).setDepth(D + 2);
    items.push(t); return t;
  };
  const close = () => items.forEach(o => o.destroy());
  getNav(scene).modalBack(items[0] as Phaser.GameObjects.Rectangle, close);
  const button = (x: number, y: number, w: number, label: string, action: () => void, role: 'back' | 'confirm' = 'confirm', accent: 'default' | 'red' = 'default') => {
    const t = titleButton(scene, x, y, w, 30, label, action, false, D + 2, accent, role);
    items.push(t, t.getData('bg')); return t;
  };
  text(VIEW.cx, VIEW.cy + 151, t('ui.back_hint'), 12);
  text(VIEW.cx, VIEW.cy - 126, t('common.settings'), 23);
  for (const [channel, y] of [['bgm', -80], ['sfx', -35]] as const) {
    text(VIEW.cx - 130, VIEW.cy + y, channel === 'bgm' ? t('settings.bgm') : t('settings.sfx'));
    const value = text(VIEW.cx + 50, VIEW.cy + y, '');
    const refresh = () => value.setText(`${Math.round(getAudioSettings()[channel] * 100)}%`);
    const change = (delta: number) => { setAudioSettings({ [channel]: getAudioSettings()[channel] + delta }); refresh(); };
    button(VIEW.cx - 13, VIEW.cy + y, 38, '−', () => change(-.1));
    button(VIEW.cx + 113, VIEW.cy + y, 38, '+', () => change(.1)); refresh();
  }
  const mute = button(VIEW.cx, VIEW.cy + 12, 250, '', () => {
    setAudioSettings({ muted: !getAudioSettings().muted }); refreshMute();
  });
  const refreshMute = () => mute.setText(t('settings.mute_all', { state: getAudioSettings().muted ? t('settings.on') : t('settings.off') }));
  refreshMute();
  button(VIEW.cx - 90, VIEW.cy + 63, 170, t('settings.input_setup'), () => { close(); inputs(); });
  button(VIEW.cx + 90, VIEW.cy + 63, 170, t('menu.language'), () => { close(); language(); });
  button(VIEW.cx - 120, VIEW.cy + 118, 112, t('common.credits'), () => { close(); credits(); });
  button(VIEW.cx, VIEW.cy + 118, 112, t('settings.reset_save'), () => resetSavePanel(scene), 'confirm', 'red');
  button(VIEW.cx + 120, VIEW.cy + 118, 112, t('common.back'), close, 'back');
}
