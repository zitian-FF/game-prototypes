import type Phaser from 'phaser';
import { t } from '../i18n';
import { devices } from '../input/devices';
import { ACTIONS, assignBinding, LayoutDraft, PAD_CHOICES, PadCapture, resolveTouch, TOUCH_IDS, TOUCH_SLOP, touchValid, validCode, type Action, type Profile, type TouchId } from '../input/layouts';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { getNav } from './menuNav';
import { inputGlyph } from './inputGlyph';
import { titleButton } from './titleButton';

/** All mutations live in the draft. The input hub is suspended until this modal closes. */
export function inputLayoutEditor(scene: Phaser.Scene, profile: Profile | 'touch'): void {
  const draft = new LayoutDraft(profile), nav = getNav(scene), D = 460;
  const items: Phaser.GameObjects.GameObject[] = [], glyphs: Phaser.GameObjects.Container[] = [];
  const releaseDevices = devices.suspend();
  let releaseNav: (() => void) | null = null, capturing: Action | null = null, padCapture: PadCapture | null = null;
  let closed = false;
  const text = (x: number, y: number, label: string, size = 14) => {
    const obj = scene.add.text(x, y, label, { fontFamily: 'Arial', fontSize: size, fontStyle: 'bold', color: '#fff1d1', align: 'center', resolution: PIXEL_RATIO }).setOrigin(.5).setDepth(D + 2);
    items.push(obj); return obj;
  };
  const anchor = scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x071020, .94).setDepth(D).setInteractive(); items.push(anchor);
  const panel = scene.add.graphics().setDepth(D + 1).fillStyle(0x142b46).fillRoundedRect(VIEW.cx - 375, VIEW.cy - 180, 750, 360, 16); items.push(panel);
  text(VIEW.cx, VIEW.cy - 157, t('layouts.edit_title', { device: t('layouts.' + profile) }), 21);
  text(VIEW.cx, VIEW.cy - 126, t(profile === 'touch' ? 'layouts.touch_help' : profile.startsWith('kb') ? 'layouts.keyboard_help' : 'layouts.pad_help'), 12);
  const status = text(VIEW.cx, VIEW.cy + 116, t('layouts.staged'), 12);
  status.setWordWrapWidth(700);
  const stopCapture = () => { capturing = null; padCapture = null; releaseNav?.(); releaseNav = null; };
  const cleanup = () => {
    if (closed) return;
    closed = true; stopCapture(); releaseDevices(); draft.cancel();
    window.removeEventListener('keydown', key, true);
    scene.events.off('update', update); scene.events.off('shutdown', cleanup);
    scene.input.off('pointermove', drag); scene.input.off('pointerup', endDrag); scene.input.off('pointerupoutside', endDrag);
    glyphs.forEach(o => o.destroy()); items.forEach(o => o.destroy());
  };
  const cancel = () => { if (capturing) { stopCapture(); status.setText(t('layouts.staged')); } else cleanup(); };
  nav.modalBack(anchor, cancel);
  const button = (x: number, y: number, w: number, h: number, label: string, fn: () => void, role: 'back' | 'confirm' = 'confirm') => {
    const obj = titleButton(scene, x, y, w, h, label, fn, false, D + 2, 'default', role); items.push(obj, obj.getData('bg')); return obj;
  };
  button(VIEW.cx - 180, VIEW.cy + 151, 180, 32, t('layouts.reset'), () => { stopCapture(); draft.reset(); refresh(); });
  button(VIEW.cx + 15, VIEW.cy + 151, 160, 32, t('common.cancel'), cancel, 'back');
  button(VIEW.cx + 190, VIEW.cy + 151, 160, 32, t('layouts.save'), () => {
    stopCapture();
    if (profile === 'touch' && !touchValid(draft.value.touch, VIEW)) { status.setText(t('layouts.touch_invalid')); return; }
    if (draft.save()) cleanup(); else status.setText(t('layouts.touch_invalid'));
  });
  const select = (action: Action) => {
    stopCapture(); capturing = action; releaseNav = nav.ownBindings();
    if (profile === 'pad1' || profile === 'pad2') padCapture = new PadCapture(devices.pad(profile));
    status.setText(t('layouts.capture', { action: t('layouts.action_' + action) }));
  };
  const assign = (value: string | number) => {
    if (!capturing || profile === 'touch') return;
    const error = profile === 'kb1' || profile === 'kb2' ? assignBinding(draft.value[profile], capturing, value as string) : assignBinding(draft.value[profile], capturing, value as number);
    if (error) { status.setText(t('layouts.duplicate')); return; }
    stopCapture(); refresh();
  };
  const key = (event: KeyboardEvent) => {
    if (!capturing || closed || !scene.scene.isActive()) return;
    devices.blockKey(event.code);
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'Escape') { stopCapture(); status.setText(t('layouts.staged')); return; }
    if (profile !== 'kb1' && profile !== 'kb2') return;
    if (!validCode(event.code)) { status.setText(t('layouts.reserved')); return; }
    assign(event.code);
  };
  const update = () => {
    if (!padCapture || (profile !== 'pad1' && profile !== 'pad2')) return;
    const pad = devices.pad(profile), pressed = padCapture.poll(pad);
    if (pressed === 'cancel') { stopCapture(); status.setText(t('layouts.staged')); }
    else if (pressed !== null) assign(pressed);
  };
  const cells: { action: Action; x: number; y: number }[] = [];
  if (profile !== 'touch') {
    ACTIONS.forEach((action, i) => {
      const x = VIEW.cx - 292 + (i % 5) * 146, y = VIEW.cy - 67 + Math.floor(i / 5) * 66;
      button(x, y, 134, 54, '', () => select(action));
      text(x, y - 15, t('layouts.action_' + action), 12);
      cells.push({ action, x, y: y + 10 });
    });
    if (profile === 'pad1' || profile === 'pad2') {
      text(VIEW.cx, VIEW.cy + 35, t('layouts.pad_choices'), 12);
      PAD_CHOICES.forEach((value, i) => {
        const x = VIEW.cx - 264 + (i % 7) * 88, y = VIEW.cy + 61 + Math.floor(i / 7) * 32;
        button(x, y, 76, 28, '', () => {
          if (!capturing) status.setText(t('layouts.select_action')); else assign(value);
        });
        const obj = inputGlyph(scene, x, y, value, D + 4); items.push(obj);
      });
    } else text(VIEW.cx, VIEW.cy + 61, t('layouts.keyboard_reserved'), 12);
  }
  const preview = scene.add.graphics().setDepth(D + 1); items.push(preview);
  const scale = Math.min(680 / VIEW.width, 210 / VIEW.height);
  const origin = { x: VIEW.cx - VIEW.width * scale / 2, y: VIEW.cy - 106 };
  const handles: { id: TouchId; hit: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }[] = [];
  let dragging: { id: TouchId; pointer: number; dx: number; dy: number } | null = null;
  const point = (p: Phaser.Input.Pointer) => scene.cameras.main.getWorldPoint(p.x, p.y);
  const endDrag = (p: Phaser.Input.Pointer) => { if (dragging?.pointer === p.id) dragging = null; };
  const drag = (p: Phaser.Input.Pointer) => {
    if (!dragging || p.id !== dragging.pointer) return;
    const pos = point(p), resolved = resolveTouch(draft.value.touch, VIEW)[dragging.id];
    const marginX = Math.max((resolved.r + TOUCH_SLOP) / VIEW.width, (resolved.r + TOUCH_SLOP) / 844);
    const marginY = Math.max((resolved.r + TOUCH_SLOP) / VIEW.height, (resolved.r + TOUCH_SLOP) / 390);
    const x = (pos.x - origin.x) / (scale * VIEW.width) - dragging.dx;
    const y = (pos.y - origin.y) / (scale * VIEW.height) - dragging.dy;
    draft.value.touch[dragging.id] = {
      x: Math.max(dragging.id === 'stick' ? marginX : .45 + marginX, Math.min(dragging.id === 'stick' ? .45 - marginX : 1 - marginX, x)),
      y: Math.max(84 / 390 + marginY, Math.min(1 - marginY, y)),
    };
    refresh();
  };
  if (profile === 'touch') {
    TOUCH_IDS.forEach(id => {
      const hit = scene.add.circle(0, 0, Math.max(18, resolveTouch(draft.value.touch, VIEW)[id].r * scale), 0, 0).setDepth(D + 3).setInteractive({ useHandCursor: true });
      items.push(hit);
      const label = text(0, 0, t('layouts.touch_' + id), id === 'main' ? 10 : 9).setDepth(D + 4);
      handles.push({ id, hit, label });
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (dragging) return;
        const pos = point(p), saved = draft.value.touch[id];
        dragging = { id, pointer: p.id, dx: (pos.x - origin.x) / (scale * VIEW.width) - saved.x, dy: (pos.y - origin.y) / (scale * VIEW.height) - saved.y };
      });
    });
  }
  function refresh(): void {
    if (profile === 'touch') {
      preview.clear().fillStyle(0x081c30).fillRoundedRect(origin.x, origin.y, VIEW.width * scale, VIEW.height * scale, 8);
      preview.fillStyle(0x4b5f7a, .5).fillRect(origin.x, origin.y, VIEW.width * scale, 84 * scale);
      preview.lineStyle(1, 0xa6c5e8, .5).lineBetween(origin.x + VIEW.width * scale * .45, origin.y + 84 * scale, origin.x + VIEW.width * scale * .45, origin.y + VIEW.height * scale);
      const positions = resolveTouch(draft.value.touch, VIEW);
      handles.forEach(({ id, hit, label }) => {
        const p = positions[id], x = origin.x + (p.x - VIEW.left) * scale, y = origin.y + (p.y - VIEW.top) * scale;
        hit.setPosition(x, y); label.setPosition(x, y);
        preview.fillStyle(id === 'stick' ? 0x29496e : id === 'guard' ? 0x149eab : 0x47739d).fillCircle(x, y, p.r * scale);
        if (id === 'main') preview.lineStyle(2, 0xffffff, .8).lineBetween(x, y - p.r * scale, x, y + p.r * scale);
        preview.lineStyle(2, 0xffd24a).strokeCircle(x, y, p.r * scale);
        preview.fillStyle(0xffd24a).fillCircle(x, y - p.r * scale, 3);
      });
      status.setText(t(touchValid(draft.value.touch, VIEW) && touchValid(draft.value.touch, { left: 0, top: 0, width: 844, height: 390 }) ? 'layouts.staged' : 'layouts.touch_invalid'));
    } else {
      glyphs.forEach(o => o.destroy()); glyphs.length = 0;
      cells.forEach(({ action, x, y }) => {
        const values = draft.value[profile][action];
        values.forEach((value, i) => glyphs.push(inputGlyph(scene, x + (i - (values.length - 1) / 2) * 60, y, value, D + 4)));
      });
      status.setText(t('layouts.staged'));
    }
  }
  window.addEventListener('keydown', key, true);
  scene.events.on('update', update); scene.events.once('shutdown', cleanup);
  scene.input.on('pointermove', drag); scene.input.on('pointerup', endDrag); scene.input.on('pointerupoutside', endDrag);
  refresh();
}
