import type Phaser from 'phaser';
import { getAudioSettings, setAudioSettings } from '../audio/mixer';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { titleButton } from './titleButton';

export function audioSettingsPanel(scene: Phaser.Scene, inputs: () => void, credits: () => void): void {
  const items: Phaser.GameObjects.GameObject[] = [];
  const D = 410;
  items.push(scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x071020, .85).setDepth(D).setInteractive());
  items.push(scene.add.graphics().setDepth(D + 1).fillStyle(0x142b46).fillRoundedRect(VIEW.cx - 210, VIEW.cy - 160, 420, 320, 18));
  const text = (x: number, y: number, label: string, size = 16) => {
    const t = scene.add.text(x, y, label, { fontFamily: 'Arial', fontSize: `${size}px`, fontStyle: 'bold', color: '#fff1d1', resolution: PIXEL_RATIO }).setOrigin(.5).setDepth(D + 2);
    items.push(t); return t;
  };
  const close = () => items.forEach(o => o.destroy());
  const button = (x: number, y: number, w: number, label: string, action: () => void) => {
    const t = titleButton(scene, x, y, w, 30, label, action, false, D + 2);
    items.push(t, t.getData('bg')); return t;
  };
  text(VIEW.cx, VIEW.cy - 126, 'SETTINGS', 23);
  for (const [channel, y] of [['bgm', -80], ['sfx', -35]] as const) {
    text(VIEW.cx - 130, VIEW.cy + y, channel === 'bgm' ? 'BGM' : 'SFX');
    const value = text(VIEW.cx + 50, VIEW.cy + y, '');
    const refresh = () => value.setText(`${Math.round(getAudioSettings()[channel] * 100)}%`);
    const change = (delta: number) => { setAudioSettings({ [channel]: getAudioSettings()[channel] + delta }); refresh(); };
    button(VIEW.cx - 13, VIEW.cy + y, 38, '−', () => change(-.1));
    button(VIEW.cx + 113, VIEW.cy + y, 38, '+', () => change(.1)); refresh();
  }
  const mute = button(VIEW.cx, VIEW.cy + 12, 250, '', () => {
    setAudioSettings({ muted: !getAudioSettings().muted }); refreshMute();
  });
  const refreshMute = () => mute.setText(`MUTE ALL · ${getAudioSettings().muted ? 'ON' : 'OFF'}`);
  refreshMute();
  button(VIEW.cx, VIEW.cy + 63, 250, 'INPUT SETUP', () => { close(); inputs(); });
  button(VIEW.cx - 82, VIEW.cy + 118, 140, 'CREDITS', () => { close(); credits(); });
  button(VIEW.cx + 82, VIEW.cy + 118, 140, 'BACK', close);
}
