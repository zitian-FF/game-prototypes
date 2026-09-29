import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { bindKeyboard, IntentLayer } from '../input/intents';
import { TouchControls } from '../ui/TouchControls';
import { Hud } from '../ui/Hud';
import { FighterView } from '../render/FighterView';
import { Effects } from '../render/Effects';
import { createSimState, step } from '../sim/sim';
import { tune, TICK_RATE } from '../sim/tune';
import { NEUTRAL_INPUT, type FrameInput, type SimState } from '../sim/types';
import { unlockAudio } from '../audio/sfx';
import { DEBUG_ENABLED, debugView } from '../debug/debugPanel';

// Solo training: player vs a static dummy that either idles or holds High
// Guard. Same sim and controls as PvP, no match timer.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;
const KO_RESET_MS = 1500;

type DummyMode = 'idle' | 'guard';

export class TrainingScene extends Phaser.Scene {
  private sim!: SimState;
  private intents = new IntentLayer();
  private pollKeyboard: () => void = () => {};
  private controls!: TouchControls;
  private hud!: Hud;
  private views!: [FighterView, FighterView];
  private fx!: Effects;
  private acc = 0;
  private dummyMode: DummyMode = 'idle';
  private dummyLabel!: Phaser.GameObjects.Text;
  private resetAt = 0;
  private ringGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Training');
  }

  create(): void {
    applyCameraPixelRatio(this);
    this.intents = new IntentLayer();
    this.newSim();

    this.ringGfx = this.add.graphics().setDepth(0);
    this.drawRing();
    this.views = [new FighterView(this, 0x3a78d0), new FighterView(this, 0xd04a4a)];
    this.fx = new Effects(this);
    this.hud = new Hud(this, ['YOU', 'DUMMY']);
    this.controls = new TouchControls(this, this.intents);
    this.pollKeyboard = bindKeyboard(this, this.intents);

    this.dummyLabel = this.menuButton(VIEW.cx - 50, VIEW.top + 46, 92, '', () => this.toggleDummy());
    this.menuButton(VIEW.cx + 50, VIEW.top + 46, 64, 'RESET', () => this.newSim());
    this.refreshDummyLabel();

    this.input.on('pointerdown', unlockAudio);
    this.game.events.on(Phaser.Core.Events.BLUR, () => this.intents.clearAll());
    addVersionStamp(this);
  }

  private newSim(): void {
    this.sim = createSimState({
      timed: false,
      fighters: [{}, { anchored: true, infiniteStamina: tune.training.dummyInfiniteStamina }],
    });
    this.resetAt = 0;
  }

  private toggleDummy(): void {
    this.dummyMode = this.dummyMode === 'idle' ? 'guard' : 'idle';
    this.refreshDummyLabel();
  }

  private refreshDummyLabel(): void {
    this.dummyLabel.setText(this.dummyMode === 'idle' ? 'DUMMY: IDLE' : 'DUMMY: GUARD');
  }

  // Small menu-style button for training options (not a gameplay intent).
  private menuButton(x: number, y: number, w: number, text: string, onTap: () => void): Phaser.GameObjects.Text {
    const bg = this.add.rectangle(x, y, w, 26, 0x222222, 0.85).setStrokeStyle(1, 0x888888).setDepth(110);
    bg.setInteractive().on('pointerdown', onTap);
    return this.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '10px', color: '#dddddd', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(111);
  }

  private drawRing(): void {
    const r = tune.ring;
    const g = this.ringGfx;
    g.clear();
    g.fillStyle(0x2a2f3a, 1);
    g.fillRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
    g.lineStyle(4, 0xb03a3a, 1);
    g.strokeRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
    g.lineStyle(1, 0xffffff, 0.06);
    for (let x = r.left + 40; x < r.right; x += 40) g.lineBetween(x, r.top, x, r.bottom);
    for (let y = r.top + 40; y < r.bottom; y += 40) g.lineBetween(r.left, y, r.right, y);
  }

  private dummyInput(): FrameInput {
    return this.dummyMode === 'guard' ? { ...NEUTRAL_INPUT, guard: true } : NEUTRAL_INPUT;
  }

  update(time: number, delta: number): void {
    this.pollKeyboard();
    this.acc = Math.min(this.acc + delta, STEP_MS * MAX_STEPS_PER_FRAME);

    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      const input = this.intents.sample();
      const events = step(this.sim, [input, this.dummyInput()]);
      this.fx.handle(events, this.sim);

      const dummy = this.sim.fighters[1];
      if (dummy.framesSinceHit > tune.training.dummyHealthRefillFrames) dummy.health = tune.health.max;
    }

    if (this.sim.result) {
      if (!this.resetAt) this.resetAt = time + KO_RESET_MS;
      else if (time >= this.resetAt) this.newSim();
    }

    this.drawRing();
    const show = DEBUG_ENABLED && debugView.showHitboxes;
    this.views[0].draw(this.sim.fighters[0], time, show);
    this.views[1].draw(this.sim.fighters[1], time, show);
    this.hud.draw(this.sim);
    this.controls.draw(this.sim.fighters[0]);
  }
}
