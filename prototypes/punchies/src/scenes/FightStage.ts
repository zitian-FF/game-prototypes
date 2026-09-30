import Phaser from 'phaser';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { bindKeyboard, IntentLayer } from '../input/intents';
import { TouchControls } from '../ui/TouchControls';
import { Hud } from '../ui/Hud';
import { InfoPanel } from '../ui/InfoPanel';
import { addFullscreenButton } from '../ui/fullscreen';
import { FighterView } from '../render/FighterView';
import { Effects } from '../render/Effects';
import { tune } from '../sim/tune';
import type { SimEvent, SimState } from '../sim/types';
import { unlockAudio } from '../audio/sfx';
import { DEBUG_ENABLED, debugView } from '../debug/debugPanel';

// Everything a fight scene draws, shared by Training and Online: ring,
// fighters, hit effects, HUD, touch controls and the "i" info panel.
export class FightStage {
  readonly intents = new IntentLayer();
  private pollKeyboard: () => void;
  private controls: TouchControls;
  private hud: Hud;
  private info: InfoPanel;
  private views: [FighterView, FighterView];
  private fx: Effects;
  private ring: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    names: [string, string],
    private localIdx: 0 | 1,
  ) {
    this.ring = scene.add.graphics().setDepth(0);
    this.views = [new FighterView(scene, 0x3a78d0), new FighterView(scene, 0xd04a4a)];
    this.fx = new Effects(scene);
    this.fx.onFighterFlash = (idx, color) => this.views[idx].flash(color, scene.time.now);
    this.hud = new Hud(scene, names);
    this.controls = new TouchControls(scene, this.intents);
    this.info = new InfoPanel(scene);
    addFullscreenButton(scene, VIEW.right - 24, VIEW.top + 64);
    this.pollKeyboard = bindKeyboard(scene, this.intents);
    scene.input.on('pointerdown', unlockAudio);
    const clear = () => this.intents.clearAll();
    scene.game.events.on(Phaser.Core.Events.BLUR, clear);
    scene.events.once('shutdown', () => scene.game.events.off(Phaser.Core.Events.BLUR, clear));
  }

  pollDevices(): void {
    this.pollKeyboard();
  }

  handleEvents(events: SimEvent[], s: SimState): void {
    this.fx.handle(events, s, this.localIdx);
  }

  draw(s: SimState, time: number): void {
    this.drawRing();
    this.controls.enabled = !this.info.open;
    const show = this.info.hitboxes || (DEBUG_ENABLED && debugView.showHitboxes);
    this.views[0].draw(s.fighters[0], time, show);
    this.views[1].draw(s.fighters[1], time, show);
    this.hud.draw(s);
    this.controls.draw(s.fighters[this.localIdx]);
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
