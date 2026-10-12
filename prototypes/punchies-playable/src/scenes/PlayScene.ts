import Phaser from 'phaser';
import { tune } from '../tune';
import { createSim, frontEnemy, punchPhase, punchTotal, FPS, type Enemy, type Sim, type SimEvent, type Input, type PunchState } from '../sim';
import { Intents, bindKeyboard } from '../intents';
import { W, H, PIXEL_RATIO, applyCameraPixelRatio } from '../pixelRatio';
import { Rig, ensureParts, type RigPose } from '../view/Rig';
import { CTA_LABEL, onCtaPressed } from '../cta';
import { debugUnlocked, mountDebugPanel } from '../debug';

const NAVY = 0x101b32;
const GOLD = 0xffc84a;
const FONT = 'Arial Black, Arial, sans-serif';

export class PlayScene extends Phaser.Scene {
  private sim!: Sim;
  private intents = new Intents();
  artLoaded = false;
  private acc = 0;
  private player!: Rig;
  private views = new Map<number, Rig>();
  private bars = new Map<number, Phaser.GameObjects.Graphics>();
  private scoreText!: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.GameObject[] = [];
  private timeBar!: Phaser.GameObjects.Rectangle;
  private hurtEdge!: Phaser.GameObjects.Graphics;
  private endShown = false;
  private endTimer = 0;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private playerAngle = -90;
  retryEnabled = false;
  private keysBound = false;
  paused = false; // test hook: freezes the sim so a frame can be captured

  constructor() {
    super('play');
  }

  preload(): void {
    if (__HAS_ART__) this.load.json('artIndex', 'art/index.json');
  }

  create(): void {
    applyCameraPixelRatio(this);
    this.input.addPointer(2);
    const index = __HAS_ART__ ? (this.cache.json.get('artIndex') as { keys: string[] } | undefined) : undefined;
    if (index) {
      for (const key of index.keys) this.load.image(key, `art/${key}.webp`);
      this.load.once('complete', () => this.begin(true));
      this.load.start();
    } else {
      this.begin(false);
    }
  }

  private begin(art: boolean): void {
    this.artLoaded = art;
    // Retry is for the testing build only (build switch PLAYABLE_RETRY, see vite.config.ts).
    this.retryEnabled = __RETRY__ && new URLSearchParams(location.search).get('retry') !== '0';
    ensureParts(this); // coloured placeholders for any part the art did not provide
    this.buildStage();
    this.startRun();
    if (!this.keysBound) {
      bindKeyboard(this.intents);
      this.keysBound = true;
    }
    if (debugUnlocked()) void mountDebugPanel(() => this.restart());
    if (new URLSearchParams(location.search).get('test') === '1' || debugUnlocked()) {
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
        pause: (v: boolean) => { this.paused = v; },
      };
    }
  }

  private has(key: string): boolean {
    return this.textures.exists(key);
  }

  private txt(x: number, y: number, s: string, size: number, color = '#fff1d1'): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#101b32', strokeThickness: Math.max(2, size / 8), resolution: PIXEL_RATIO })
      .setOrigin(0.5);
  }

  private buildStage(): void {
    // Gym floor only. The backdrop is landscape, so show its middle slice (floor tiles,
    // props at the far edges cropped out) filling the portrait screen.
    if (this.has('gym_background')) {
      const tex = this.textures.get('gym_background');
      const src = tex.getSourceImage() as HTMLImageElement;
      const cropW = Math.round((src.height * W) / H);
      if (!tex.has('mid')) tex.add('mid', 0, Math.round((src.width - cropW) / 2), 0, cropW, src.height);
      this.add.image(W / 2, H / 2, 'gym_background', 'mid').setDisplaySize(W, H);
    } else {
      this.add.rectangle(W / 2, H / 2, W, H, 0x16213f);
    }

    this.player = new Rig(this, 'marco', tune);
    this.player.root.setAngle(this.playerAngle).setPosition(W / 2, tune.view.playerY).setDepth(5);

    // HUD
    this.add.rectangle(W / 2, 0, W, 78, NAVY, 0.55).setOrigin(0.5, 0).setDepth(48);
    this.scoreText = this.txt(W / 2, 46, '0', 44).setDepth(50);
    this.txt(W / 2, 14, 'SCORE', 11, '#ffc84a').setDepth(50);
    this.pips = [];
    for (let i = 0; i < tune.run.playerHp; i++) {
      const x = 26 + i * 30;
      const pip = this.has('icon_cross')
        ? this.add.image(x, 34, 'icon_cross').setDisplaySize(30, 30)
        : this.add.rectangle(x, 34, 20, 20, 0xe5453d).setStrokeStyle(2, NAVY);
      this.pips.push(pip.setDepth(50));
    }
    this.add.rectangle(W / 2, 3, W, 6, NAVY).setDepth(49);
    this.timeBar = this.add.rectangle(0, 3, W, 6, GOLD).setOrigin(0, 0.5).setDepth(50);
    // Red vignette on the screen edges, flashed when the player is hit.
    this.hurtEdge = this.add.graphics().setDepth(60).setAlpha(0);
    const band = 70;
    this.hurtEdge.fillGradientStyle(0xff2020, 0xff2020, 0xff2020, 0xff2020, 0.45, 0.45, 0, 0).fillRect(0, 0, W, band);
    this.hurtEdge.fillGradientStyle(0xff2020, 0xff2020, 0xff2020, 0xff2020, 0, 0, 0.45, 0.45).fillRect(0, H - band, W, band);
    this.hurtEdge.fillGradientStyle(0xff2020, 0xff2020, 0xff2020, 0xff2020, 0.45, 0, 0.45, 0).fillRect(0, 0, band, H);
    this.hurtEdge.fillGradientStyle(0xff2020, 0xff2020, 0xff2020, 0xff2020, 0, 0.45, 0, 0.45).fillRect(W - band, 0, band, H);

    // Touch buttons: JAB and CROSS.
    this.makeButton(W * 0.25, H - 52, 160, 84, 'JAB', 0x3a78d0, 'jab', 'icon_jab');
    this.makeButton(W * 0.75, H - 52, 160, 84, 'CROSS', 0xd04a4a, 'cross', 'icon_cross');
  }

  private drawButton(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, pressed: boolean): void {
    g.clear();
    g.fillStyle(NAVY, 1).fillRoundedRect(x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8, 22);
    g.fillStyle(pressed ? 0xffffff : color, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 18);
    g.fillStyle(0xffffff, pressed ? 0 : 0.22).fillRoundedRect(x - w / 2 + 6, y - h / 2 + 5, w - 12, h * 0.32, 12);
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, color: number, intent: 'jab' | 'cross', icon: string): void {
    const g = this.add.graphics().setDepth(40);
    this.drawButton(g, x, y, w, h, color, false);
    if (this.has(icon)) this.add.image(x - 62, y, icon).setDisplaySize(40, 40).setDepth(41);
    const t = this.txt(x + (this.has(icon) ? 18 : 0), y, label, 24).setDepth(41);
    const zone = this.add.zone(x, y, w + 20, h + 20).setInteractive().setDepth(42);
    zone.on('pointerdown', () => {
      this.intents.press(intent);
      this.drawButton(g, x, y, w, h, color, true);
      t.setScale(0.94);
    });
    const up = () => {
      this.drawButton(g, x, y, w, h, color, false);
      t.setScale(1);
    };
    zone.on('pointerup', up);
    zone.on('pointerout', up);
  }

  private startRun(): void {
    this.clearOverlay();
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    for (const b of this.bars.values()) b.destroy();
    this.bars.clear();
    this.sim = createSim(tune);
    this.endShown = false;
    this.endTimer = 0;
    this.acc = 0;
    this.render(performance.now());
  }

  private restart(): void {
    this.startRun();
  }

  private clearOverlay(): void {
    for (const o of this.overlay) o.destroy();
    this.overlay = [];
  }

  update(time: number, delta: number): void {
    if (!this.sim) return;
    if (!this.paused) this.acc += Math.min(delta, 100);
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

  // Zombies walk a straight line to the player: e.ang is the bearing from straight
  // above, e.d the distance along it. Knocked zombies fly on along that same line,
  // the direction of the final blow.
  private enemyPos(e: Enemy): { x: number; y: number } {
    const u = tune.view.unitPx;
    const sx = Math.sin(e.ang);
    const cy = Math.cos(e.ang);
    let x = W / 2 + sx * e.d * u;
    let y = tune.view.playerY - cy * e.d * u;
    if (e.state === 'leave') x += e.side * tune.enemy.leaveSpeed * (e.frame / FPS);
    if (e.state === 'knocked') {
      const flight = tune.enemy.knockSpeed * (Math.min(e.frame, tune.enemy.knockFrames) / FPS);
      x += sx * flight;
      y -= cy * flight;
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
      this.spark(p.x, p.y + 20, e.zone === 'head' ? GOLD : 0xffffff);
      this.popup(p.x, p.y, e.zone === 'head' ? `+${e.points} HEAD!` : `+${e.points} BODY`, e.zone === 'head' ? '#ffc84a' : '#fff1d1');
      this.cameras.main.shake(e.killed ? 110 : 70, e.killed ? 0.007 : 0.004);
    } else if (e.kind === 'sour') {
      const en = target(e.enemy);
      const p = en ? this.enemyPos(en) : { x: W / 2, y: H / 2 };
      this.views.get(e.enemy)?.flash(0xff8a4a, now, 140);
      this.popup(p.x, p.y, 'SOUR', '#ff8a4a');
    } else if (e.kind === 'whiff') {
      this.popup(W / 2, tune.view.playerY - 110, 'MISS', '#9aa6c8');
    } else if (e.kind === 'playerHit') {
      this.player.flash(0xff6a6a, now, 260, false);
      this.cameras.main.shake(140, 0.012);
      this.hurtEdge.setAlpha(1);
      this.tweens.add({ targets: this.hurtEdge, alpha: 0, duration: 350 });
    }
  }

  private popup(x: number, y: number, s: string, color: string): void {
    const t = this.txt(x, y, s, 24, color).setDepth(70);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: tune.view.popupMs, onComplete: () => t.destroy() });
  }

  // Short starburst at the point of impact.
  private spark(x: number, y: number, color: number): void {
    const g = this.add.graphics({ x, y }).setDepth(65);
    g.lineStyle(4, color, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      g.lineBetween(Math.cos(a) * 10, Math.sin(a) * 10, Math.cos(a) * (i % 2 ? 26 : 38), Math.sin(a) * (i % 2 ? 26 : 38));
    }
    g.fillStyle(0xffffff, 1).fillCircle(0, 0, 9);
    this.tweens.add({ targets: g, scale: 1.7, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  // 0..1 fist extension for a player punch.
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
    const rig = tune.view.rig;

    // Player: jab is the left hand, cross the right.
    const idle: RigPose = { time: now, stride: 0, hand: null, ext: 0, reach: 0, raise: 0, limp: false, hurt: s.hurtFrames / tune.view.hitFlashFrames };
    if (s.ended === 'dead') idle.limp = true;
    else if (s.punch) {
      idle.hand = s.punch.type === 'jab' ? 0 : 1;
      idle.ext = this.extension(s.punch);
      idle.reach = s.punch.type === 'jab' ? rig.jabReach : rig.crossReach;
    }
    // Marco turns toward the front zombie (position stays fixed).
    const front = frontEnemy(s);
    const target = -90 + (front && !s.ended ? (front.ang * 180) / Math.PI : 0);
    this.playerAngle += (target - this.playerAngle) * tune.view.playerTurn;
    this.player.root.setAngle(this.playerAngle);
    this.player.update(idle, now);
    this.scoreText.setText(String(s.score));
    this.pips.forEach((p, i) => (p as Phaser.GameObjects.Image).setAlpha(i < s.hp ? 1 : 0.22));
    this.timeBar.width = W * Math.max(0, 1 - s.frame / (tune.run.durationSec * FPS));

    // Enemies (zombies): arms forward while walking, right fist pulls back in
    // the wind-up and strikes, limp when knocked off.
    const seen = new Set<number>();
    for (const e of s.enemies) {
      seen.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        v = new Rig(this, 'zombie', tune);
        this.views.set(e.id, v);
      }
      const p = this.enemyPos(e);
      // Zombies face the player along their approach line.
      const face = 90 + (e.ang * 180) / Math.PI;
      v.root.setPosition(p.x, p.y).setDepth(10 - e.d / 100).setAngle(face).setAlpha(1);
      const pose: RigPose = { time: now + e.id * 137, stride: 0, hand: null, ext: 0, reach: rig.enemyReach, raise: 1, limp: false, hurt: e.hurt / tune.view.hitFlashFrames };
      if (e.state === 'walk' || e.state === 'leave') pose.stride = 1;
      else if (e.state === 'windup') {
        pose.hand = (e.id % 2) as 0 | 1;
        pose.ext = -0.5 * Math.min(1, e.frame / tune.enemy.windupFrames);
      } else if (e.state === 'strike') {
        pose.hand = (e.id % 2) as 0 | 1;
        pose.ext = -0.5 + 1.5 * Math.min(1, e.frame / tune.enemy.strikeFrames);
      } else {
        // Knocked off: limp, one full 360 spin during the flight, then fade out.
        pose.limp = true;
        pose.raise = 0;
        const flight = Math.max(1, tune.enemy.knockFrames - tune.enemy.knockFadeFrames);
        v.root.setAngle(face + 360 * Math.min(1, e.frame / flight));
        v.root.setAlpha(e.frame <= flight ? 1 : Math.max(0, 1 - (e.frame - flight) / tune.enemy.knockFadeFrames));
      }
      // Wind-up tell: the front enemy about to punch pulses.
      v.root.setScale(e === front && e.state === 'windup' ? 1 + 0.06 * Math.sin(now / 40) : 1);
      v.update(pose, now);
      this.drawBar(e, p);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.destroy();
        this.views.delete(id);
        this.bars.get(id)?.destroy();
        this.bars.delete(id);
      }
    }
  }

  // Small HP bar above a zombie (hidden once it is knocked off).
  private drawBar(e: Enemy, p: { x: number; y: number }): void {
    let g = this.bars.get(e.id);
    if (!g) {
      g = this.add.graphics().setDepth(55);
      this.bars.set(e.id, g);
    }
    g.clear();
    if (e.state === 'knocked') return;
    const w = 44;
    const frac = Math.max(0, Math.min(1, e.hp / tune.enemy.hp));
    const x = p.x - w / 2;
    const y = p.y - 56;
    g.fillStyle(NAVY, 0.85).fillRoundedRect(x - 2, y - 2, w + 4, 10, 4);
    g.fillStyle(frac > 0.5 ? 0x6fd16f : frac > 0.25 ? GOLD : 0xe5453d, 1).fillRoundedRect(x, y, Math.max(2, w * frac), 6, 3);
  }

  private showEnd(): void {
    this.endShown = true;
    const s = this.sim.state;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.overlay.push(o);
      return o;
    };
    add(this.add.rectangle(W / 2, H / 2, W, H, 0x0a1022, 0.84).setDepth(100).setInteractive());
    if (this.has('logo')) add(this.add.image(W / 2, 78, 'logo').setDisplaySize(250, 78.5).setDepth(101));
    add(this.txt(W / 2, 170, s.ended === 'dead' ? 'KO!' : "TIME'S UP!", 40, '#ffc84a').setDepth(101));
    add(this.txt(W / 2, 245, 'SCORE', 18, '#9aa6c8').setDepth(101));
    add(this.txt(W / 2, 315, String(s.score), 84).setDepth(101));
    const g = add(this.add.graphics().setDepth(101));
    const draw = (pressed: boolean) => {
      g.clear();
      g.fillStyle(NAVY, 1).fillRoundedRect(W / 2 - 128, 365, 256, 90, 26);
      g.fillStyle(pressed ? 0xfff1d1 : GOLD, 1).fillRoundedRect(W / 2 - 122, 371, 244, 78, 22);
      g.fillStyle(0xffffff, pressed ? 0 : 0.3).fillRoundedRect(W / 2 - 112, 376, 224, 24, 12);
    };
    draw(false);
    add(this.txt(W / 2, 410, CTA_LABEL, 30, '#101b32').setStroke('#ffffff', 0).setDepth(102));
    const zone = add(this.add.zone(W / 2, 410, 270, 100).setInteractive().setDepth(103));
    zone.on('pointerdown', () => {
      draw(true);
      onCtaPressed();
    });
    zone.on('pointerup', () => draw(false));
    zone.on('pointerout', () => draw(false));

    if (this.retryEnabled) {
      const rg = add(this.add.graphics().setDepth(101));
      const drawRetry = (pressed: boolean) => {
        rg.clear();
        rg.fillStyle(NAVY, 1).fillRoundedRect(W / 2 - 88, 482, 176, 62, 22);
        rg.fillStyle(pressed ? 0xffffff : 0x4a5d86, 1).fillRoundedRect(W / 2 - 83, 487, 166, 52, 18);
      };
      drawRetry(false);
      add(this.txt(W / 2, 513, 'RETRY', 24).setDepth(102));
      const rz = add(this.add.zone(W / 2, 513, 190, 76).setInteractive().setDepth(103));
      rz.on('pointerdown', () => {
        drawRetry(true);
        this.restart();
      });
      rz.on('pointerout', () => drawRetry(false));
    }
  }
}
