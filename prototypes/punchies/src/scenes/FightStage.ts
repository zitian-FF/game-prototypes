import Phaser from 'phaser';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { IntentLayer } from '../input/intents';
import { devices, mergeInputs, type InputSource } from '../input/devices';
import { TouchControls } from '../ui/TouchControls';
import { Hud } from '../ui/Hud';
import { InfoPanel } from '../ui/InfoPanel';
import { addFullscreenButton } from '../ui/fullscreen';
import { FighterView } from '../render/FighterView';
import { Effects } from '../render/Effects';
import { KoAnim } from '../render/KoAnim';
import { tune } from '../sim/tune';
import type { FrameInput, SimEvent, SimState } from '../sim/types';
import { unlockAudio } from '../audio/sfx';
import { DEBUG_ENABLED, debugView } from '../debug/debugPanel';

// Everything a fight scene draws, shared by Training and Online: ring,
// fighters, hit effects, HUD, touch controls and the "i" info panel.
export class FightStage {
  readonly intents = new IntentLayer();
  private controls: TouchControls;
  private hud: Hud;
  private info: InfoPanel;
  private views: [FighterView, FighterView];
  private fx: Effects;
  private ko: KoAnim;
  private ring: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    names: [string, string],
    // -1 = local two-player: no "me", so hit feedback stays neutral.
    private localIdx: 0 | 1 | -1,
    // Whether the on-screen touch controls are available at all.
    private touchEnabled = true,
  ) {
    this.ring = scene.add.graphics().setDepth(0);
    this.views = [new FighterView(scene, 0x3a78d0), new FighterView(scene, 0xd04a4a)];
    this.ko = new KoAnim(scene, [0x3a78d0, 0xd04a4a]);
    this.fx = new Effects(scene);
    this.fx.onFighterFlash = (idx, color) => this.views[idx].flash(color, scene.time.now);
    this.hud = new Hud(scene, names);
    this.controls = new TouchControls(scene, this.intents);
    this.info = new InfoPanel(scene);
    addFullscreenButton(scene, VIEW.right - 24, VIEW.top + 64);
    scene.input.on('pointerdown', unlockAudio);
    const clear = () => {
      this.intents.clearAll();
      devices.clear();
    };
    scene.game.events.on(Phaser.Core.Events.BLUR, clear);
    scene.events.once('shutdown', () => scene.game.events.off(Phaser.Core.Events.BLUR, clear));
  }

  pollDevices(): void {
    devices.poll();
  }

  handleEvents(events: SimEvent[], s: SimState): void {
    this.fx.handle(events, s, this.localIdx);
  }

  // Solo modes: touch + either keyboard half + any controller all drive the
  // one local player.
  sampleLocal(): FrameInput {
    return mergeInputs([this.intents.sample(), devices.sample('kb1'), devices.sample('kb2'), devices.sample('pad1'), devices.sample('pad2')]);
  }

  sampleSource(src: InputSource): FrameInput {
    return src === 'touch' ? this.intents.sample() : devices.sample(src);
  }

  // Tutorial: reveal only the listed controls/HUD parts (null = all), and
  // optionally force the hitbox overlay on.
  forceHitboxes = false;
  reveal(parts: Set<string> | null): void {
    this.controls.shown = parts;
    this.hud.shown = parts;
  }

  hideInfoButton(): void {
    this.info.setButtonVisible(false);
  }

  // True once any KO animation has played out (the result screen waits).
  koFinished(s: SimState, time: number): boolean {
    return this.ko.finished(s, time);
  }

  // koAllowed: online passes false until the KO is confirmed, so a
  // predicted KO that gets rolled back never starts the animation.
  draw(s: SimState, time: number, koAllowed = true): void {
    this.drawRing();
    this.controls.enabled = this.touchEnabled && !this.info.open;
    this.controls.setVisible(this.touchEnabled && devices.lastDevice === 'touch');
    const show = this.forceHitboxes || this.info.hitboxes || (DEBUG_ENABLED && debugView.showHitboxes);
    this.ko.sync(s, koAllowed, time);
    if (this.ko.active) {
      const loser = this.ko.loser;
      this.views[loser].clear();
      this.views[1 - loser].draw(this.ko.winnerView(time) ?? s.fighters[1 - loser], time, false);
      this.ko.draw(time);
    } else {
      this.views[0].draw(s.fighters[0], time, show);
      this.views[1].draw(s.fighters[1], time, show);
    }
    this.hud.draw(s);
    this.controls.draw(s.fighters[this.localIdx === 1 ? 1 : 0]);
  }

  // Small menu-style button (not a gameplay intent).
  button(x: number, y: number, w: number, text: string, onTap: () => void): Phaser.GameObjects.Text {
    return makeButton(this.scene, x, y, w, text, onTap);
  }

  private drawRing(): void {
    const r = tune.ring;
    const g = this.ring;
    g.clear();
    g.fillStyle(0x2a2f3a, 1);
    g.fillRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
    g.lineStyle(4, 0xb03a3a, 1);
    g.strokeRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
    g.lineStyle(1, 0xffffff, 0.06);
    for (let x = r.left + 40; x < r.right; x += 40) g.lineBetween(x, r.top, x, r.bottom);
    for (let y = r.top + 40; y < r.bottom; y += 40) g.lineBetween(r.left, y, r.right, y);
  }
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  text: string,
  onTap: () => void,
  h = 26,
  fontSize = 10,
): Phaser.GameObjects.Text {
  const bg = scene.add.rectangle(x, y, w, h, 0x222222, 0.9).setStrokeStyle(1, 0x888888).setDepth(130);
  bg.setInteractive().on('pointerdown', onTap);
  const label = scene.add
    .text(x, y, text, { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#dddddd', resolution: PIXEL_RATIO })
    .setOrigin(0.5)
    .setDepth(131);
  label.setData('bg', bg);
  return label;
}
