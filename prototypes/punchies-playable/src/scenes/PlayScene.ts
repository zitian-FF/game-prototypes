import Phaser from 'phaser';
import { tune } from '../tune';
import { createSim, frontEnemy, punchPhase, punchTotal, FPS, type Enemy, type Sim, type SimEvent, type Input, type PunchState } from '../sim';
import { Intents, bindKeyboard } from '../intents';
import { W, H, PIXEL_RATIO, applyCameraPixelRatio } from '../pixelRatio';
import { FighterView, type ArtIndex } from '../view/FighterView';
import { CTA_LABEL, onCtaPressed } from '../cta';
import { debugUnlocked, mountDebugPanel } from '../debug';

const NAVY = 0x101b32;
const CREAM = 0xfff1d1;
const FONT = 'Arial Black, Arial, sans-serif';

export class PlayScene extends Phaser.Scene {
  private sim!: Sim;
  private intents = new Intents();
  private art: ArtIndex | null = null;
  private acc = 0;
  private player!: FighterView;
  private views = new Map<number, FighterView>();
  private scoreText!: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Rectangle[] = [];
  private timeBar!: Phaser.GameObjects.Rectangle;
  private hurtEdge!: Phaser.GameObjects.Rectangle;
  private endShown = false;
  private endTimer = 0;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private seed = 1;
  private keysBound = false;

  constructor() {
    super('play');
  }

  preload(): void {
    if (!__HAS_ART__) return;
    this.load.json('artIndex', 'art/index.json');
  }

  create(): void {
    applyCameraPixelRatio(this);
    this.input.addPointer(2);
    this.seed = Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 2 ** 32);
    const index = __HAS_ART__ ? (this.cache.json.get('artIndex') as ArtIndex | undefined) : undefined;
    if (index) {
      this.art = index;
      for (const c of Object.keys(index.chars)) this.load.spritesheet(c, `art/${c}.webp`, { frameWidth: index.cell, frameHeight: index.cell });
      this.load.once('complete', () => this.begin());
      this.load.start();
    } else {
      this.begin();
    }
  }

  private begin(): void {
    this.buildStage();
    this.startRun();
    if (!this.keysBound) {
      bindKeyboard(this.intents);
      this.keysBound = true;
    }
    const q = new URLSearchParams(location.search);
    if (debugUnlocked()) void mountDebugPanel(() => this.restart());
    if (q.get('test') === '1' || debugUnlocked()) {
      (window as unknown as Record<string, unknown>).__playable = {
        scene: this,
        tune,
        press: (i: 'jab' | 'cross') => this.intents.press(i),
        advance: (frames: number, input?: Partial<Input>) => {
          for (let i = 0; i < frames; i++) this.advance({ jab: false, cross: false, ...input });
          this.render(performance.now());
        },
        state: () => this.sim.state,
        restart: () => this.restart(),
      };
    }
  }

  private txt(x: number, y: number, s: string, size: number, color = '#fff1d1'): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#101b32', strokeThickness: Math.max(2, size / 8), resolution: PIXEL_RATIO })
      .setOrigin(0.5);
  }

  private buildStage(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x16213f);
    this.add.rectangle(W / 2, H / 2, 200, H, 0x1f2d55); // lane
    this.add.rectangle(W / 2, H / 2, 4, H, 0x2a3c6e);
    this.player = new FighterView(this, 'marco', 0x3a78d0, tune.view.spriteSize, this.art);
    this.player.root.setAngle(-90).setPosition(W / 2, tune.view.playerY).setDepth(5);

    // HUD
    this.scoreText = this.txt(W / 2, 44, '0', 44).setDepth(50);
    this.txt(W / 2, 14, 'SCORE', 11, '#ffc84a').setDepth(50);
    for (let i = 0; i < tune.run.playerHp; i++) {
      this.pips.push(this.add.rectangle(24 + i * 26, 30, 20, 20, 0xe5453d).setStrokeStyle(2, NAVY).setDepth(50));
    }
    this.add.rectangle(W / 2, 3, W, 6, NAVY).setDepth(49);
    this.timeBar = this.add.rectangle(0, 3, W, 6, 0xffc84a).setOrigin(0, 0.5).setDepth(50);
    this.hurtEdge = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(60);

    // Touch buttons: JAB and CROSS.
    this.makeButton(W * 0.25, H - 52, 150, 84, 'JAB', 0x3a78d0, 'jab');
    this.makeButton(W * 0.75, H - 52, 150, 84, 'CROSS', 0xd04a4a, 'cross');
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, color: number, intent: 'jab' | 'cross'): void {
    const r = this.add.rectangle(x, y, w, h, color).setStrokeStyle(4, NAVY).setDepth(40).setInteractive();
    const t = this.txt(x, y, label, 26).setDepth(41);
    r.on('pointerdown', () => {
      this.intents.press(intent);
      r.setFillStyle(0xffffff);
      t.setScale(0.94);
    });
    const up = () => {
      r.setFillStyle(color);
      t.setScale(1);
    };
    r.on('pointerup', up);
    r.on('pointerout', up);
  }

  private startRun(): void {
    this.clearOverlay();
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    this.sim = createSim(tune, this.seed);
    this.endShown = false;
    this.endTimer = 0;
    this.acc = 0;
    this.render(performance.now());
  }

  private restart(): void {
    this.seed = Math.floor(Math.random() * 2 ** 32);
    this.startRun();
  }

  private clearOverlay(): void {
    for (const o of this.overlay) o.destroy();
    this.overlay = [];
  }

  update(time: number, delta: number): void {
    if (!this.sim) return;
    this.acc += Math.min(delta, 100);
    const stepMs = 1000 / FPS;
    while (this.acc >= stepMs) {
      this.acc -= stepMs;
      this.advance(this.intents.consume());
    }
    this.render(time);
    if (this.sim.state.ended && !this.endShown) {
      this.endTimer += delta;
      if (this.endTimer >= tune.view.endDelayMs) this.showEnd();
    }
  }

  private advance(input: Input): void {
    if (this.sim.state.ended) return;
    for (const e of this.sim.step(input)) this.onEvent(e);
  }

  private enemyPos(e: Enemy): { x: number; y: number } {
    const u = tune.view.unitPx;
    let x = W / 2;
    let y = tune.view.playerY - e.d * u;
    if (e.state === 'leave') x += e.side * tune.enemy.leaveSpeed * (e.frame / FPS);
    if (e.state === 'knocked') {
      const k = tune.enemy.knockSpeed * (e.frame / FPS);
      x += e.side * k * 0.6;
      y -= k * 0.8;
    }
    return { x, y };
  }

  private onEvent(e: SimEvent): void {
    const now = performance.now();
    const target = (id: number) => this.sim.state.enemies.find((n) => n.id === id);
    if (e.kind === 'sweet') {
      const en = target(e.enemy);
      const p = en ? this.enemyPos(en) : { x: W / 2, y: H / 2 };
      this.views.get(e.enemy)?.flash(0xffffff, now, 200);
      this.popup(p.x, p.y, e.zone === 'head' ? `+${e.points} HEAD!` : `+${e.points} BODY`, e.zone === 'head' ? '#ffc84a' : '#fff1d1');
      this.cameras.main.shake(70, 0.004);
    } else if (e.kind === 'sour') {
      const en = target(e.enemy);
      const p = en ? this.enemyPos(en) : { x: W / 2, y: H / 2 };
      this.popup(p.x, p.y, 'SOUR', '#ff8a4a');
    } else if (e.kind === 'whiff') {
      this.popup(W / 2, tune.view.playerY - 90, 'MISS', '#9aa6c8');
    } else if (e.kind === 'playerHit') {
      this.player.flash(0xff4a4a, now, 260);
      this.cameras.main.shake(140, 0.012);
      this.hurtEdge.setFillStyle(0xff0000, 0.35);
      this.tweens.add({ targets: this.hurtEdge, fillAlpha: 0, duration: 300 });
    }
  }

  private popup(x: number, y: number, s: string, color: string): void {
    const t = this.txt(x, y, s, 24, color).setDepth(70);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: tune.view.popupMs, onComplete: () => t.destroy() });
  }

  // 0..1 glove extension for the placeholder.
  private extension(p: PunchState): number {
    const c = tune.punch[p.type];
    const ph = punchPhase(tune, p);
    if (ph === 'startup') return 0.3 * (p.frame / c.startup);
    if (ph === 'early') return 0.3 + 0.7 * ((p.frame - c.startup) / c.sourEarly);
    if (ph === 'sweet') return 1;
    const total = punchTotal(tune, p);
    const start = c.startup + c.sourEarly + c.sweet;
    return Math.max(0, 1 - (p.frame - start) / Math.max(1, total - start));
  }

  private render(now: number): void {
    const s = this.sim.state;
    // Player pose.
    const hp = Math.max(0, s.hp);
    if (s.ended === 'dead') this.player.pose('ko', Math.min(1, (this.endTimer + 1) / 600), 0);
    else if (s.punch) this.player.pose(s.punch.type, s.punch.frame / punchTotal(tune, s.punch), this.extension(s.punch));
    else if (s.hurtFrames > 0) this.player.pose('hit_light', 1 - s.hurtFrames / tune.view.hitFlashFrames, 0);
    else this.player.pose('idle', (now / 160) % 6 / 6, 0);
    this.player.tick(now);
    this.scoreText.setText(String(s.score));
    this.pips.forEach((p, i) => p.setFillStyle(i < hp ? 0xe5453d : 0x3a2330));
    this.timeBar.width = W * Math.max(0, 1 - s.frame / (tune.run.durationSec * FPS));

    // Enemies.
    const front = frontEnemy(s);
    const seen = new Set<number>();
    for (const e of s.enemies) {
      seen.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        v = new FighterView(this, 'bruno', 0x3fa34d, tune.view.spriteSize, this.art);
        v.root.setAngle(90);
        this.views.set(e.id, v);
      }
      const p = this.enemyPos(e);
      v.root.setPosition(p.x, p.y).setDepth(10 - e.d / 100);
      if (e.state === 'walk') v.pose('walk', (now / 90) % 8 / 8, 0);
      else if (e.state === 'windup') v.pose('guard', e.frame / tune.enemy.windupFrames, 0);
      else if (e.state === 'strike') v.pose('jab', (e.frame / tune.enemy.strikeFrames) * 0.7, (e.frame / tune.enemy.strikeFrames));
      else if (e.state === 'leave') v.pose('walk', (now / 90) % 8 / 8, 0);
      else {
        v.pose('ko', e.frame / tune.enemy.knockFrames, 0);
        v.root.setAngle(90 + e.side * e.frame * 14);
      }
      // Windup tell for the placeholder: front enemy about to punch pulses.
      v.root.setScale(e === front && e.state === 'windup' ? 1 + 0.06 * Math.sin(now / 40) : 1);
      v.tick(now);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.destroy();
        this.views.delete(id);
      }
    }
  }

  private showEnd(): void {
    this.endShown = true;
    const s = this.sim.state;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.overlay.push(o);
      return o;
    };
    add(this.add.rectangle(W / 2, H / 2, W, H, 0x0a1022, 0.82).setDepth(100).setInteractive());
    add(this.txt(W / 2, 150, s.ended === 'dead' ? 'KO!' : "TIME'S UP!", 40, '#ffc84a').setDepth(101));
    add(this.txt(W / 2, 235, 'SCORE', 18, '#9aa6c8').setDepth(101));
    add(this.txt(W / 2, 305, String(s.score), 84).setDepth(101));
    const r = add(this.add.rectangle(W / 2, 470, 240, 80, 0xffc84a).setStrokeStyle(5, NAVY).setDepth(101).setInteractive());
    const label = add(this.txt(W / 2, 470, CTA_LABEL, 30, '#101b32').setDepth(102));
    label.setStroke('#ffffff', 0);
    r.on('pointerdown', () => {
      r.setFillStyle(CREAM);
      onCtaPressed();
    });
    r.on('pointerup', () => r.setFillStyle(0xffc84a));
    r.on('pointerout', () => r.setFillStyle(0xffc84a));
  }
}
