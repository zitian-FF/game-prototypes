import type Phaser from 'phaser';
import { t } from '../i18n';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { KEYS } from '../portal/keys';
import { store } from '../portal/store';
import { getNav } from './menuNav';
import { titleButton } from './titleButton';

// Deletes every saved key on this device, behind two confirmations, then reloads so
// the game starts exactly like a first launch (language choice and the easy fight included).
export function wipeLocalSave(): void {
  for (const key of Object.values(KEYS)) store.removeItem(key);
}

export function resetSavePanel(scene: Phaser.Scene): void {
  const D = 450;
  const show = (title: string, body: string, goLabel: string, go: () => void) => {
    const items: Phaser.GameObjects.GameObject[] = [];
    const close = () => items.forEach((o) => o.destroy());
    items.push(scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x030711, 0.9).setDepth(D).setInteractive());
    items.push(scene.add.graphics().setDepth(D + 1).fillStyle(0x2a1620).fillRoundedRect(VIEW.cx - 190, VIEW.cy - 100, 380, 200, 18).lineStyle(2, 0xe8283c).strokeRoundedRect(VIEW.cx - 190, VIEW.cy - 100, 380, 200, 18));
    items.push(scene.add.text(VIEW.cx, VIEW.cy - 66, title, { fontFamily: 'Arial', fontSize: '22px', fontStyle: 'bold', color: '#ff8a7a', resolution: PIXEL_RATIO }).setOrigin(0.5).setDepth(D + 2));
    items.push(scene.add.text(VIEW.cx, VIEW.cy - 10, body, { fontFamily: 'Arial', fontSize: '14px', color: '#fff1d1', align: 'center', wordWrap: { width: 330 }, resolution: PIXEL_RATIO }).setOrigin(0.5).setDepth(D + 2));
    getNav(scene).modalBack(items[0] as Phaser.GameObjects.Rectangle, close);
    const cancel = titleButton(scene, VIEW.cx - 85, VIEW.cy + 64, 150, 32, t('common.cancel'), close, false, D + 2, 'default', 'back');
    const confirm = titleButton(scene, VIEW.cx + 85, VIEW.cy + 64, 150, 32, goLabel, () => { close(); go(); }, false, D + 2, 'red');
    items.push(cancel, cancel.getData('bg'), confirm, confirm.getData('bg'));
  };
  show(t('reset.title1'), t('reset.body1'), t('reset.continue'), () =>
    show(t('reset.title2'), t('reset.body2'), t('reset.delete_all'), () => {
      wipeLocalSave();
      window.location.reload();
    }));
}
