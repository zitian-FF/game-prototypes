import Phaser from 'phaser';
import { tune } from '../tune';
import { createSim, frontEnemy, punchPhase, punchTotal, FPS, type Enemy, type Sim, type SimEvent, type Input, type PunchState } from '../sim';
import { Intents, bindKeyboard } from '../intents';
import { W, H, PIXEL_RATIO, applyCameraPixelRatio } from '../pixelRatio';
import { Rig, ensureParts, type RigPose } from '../view/Rig';
import { CTA_LABEL, onCtaPressed } from '../cta';
import { debugUnlocked, mountDebugPanel } from '../debug';
import { Fx, TIER_COLORS } from '../fx';
import { Sfx, renderSound, renderSoundData, SOUNDS as SOUNDS_FOR_TEST, type SoundName } from '../audio';

const NAVY = 0x101b32;
const GOLD = 0xffc84a;
const FONT = 'Arial Black, Arial, sans-serif';
// Combo call-outs: shown when the combo reaches the count.
const COMBO_WORDS: [number, string][] = [[3, 'GOOD!'], [5, 'GREAT!'], [8, 'AWESOME!'], [12, 'UNSTOPPABLE!'], [20, 'LEGENDARY!']];

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
  private comboLabel!: Phaser.GameObjects.Text;
  private comboNum!: Phaser.GameObjects.Text;
  private lastScore = 0;
  private lastCombo = 0;
  private hitStopUntil = 0;
  private endTween: Phaser.Tweens.Tween | null = null;
  private banners = new Set<Phaser.GameObjects.Text>();
  private sfx = new Sfx();
  private fx!: Fx;
  private muteIcon!: Phaser.GameObjects.Graphics;
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
    this.fx = new Fx(this, tune);
    this.startRun();
    if (!this.keysBound) {
      bindKeyboard(this.intents);
      this.sfx.bindGestures();
      this.sfx.setMuted(new URLSearchParams(location.search).get('mute') === '1');
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
        fxAlive: () => this.fx.alive(),
        sfxLog: () => [...this.sfx.log],
        sfxRender: (n: SoundName) => renderSound(n),
        sfxSamples: async (n: SoundName) => Array.from(await renderSoundData(n)),
        sfxNames: () => Object.keys(SOUNDS_FOR_TEST),
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
      // Slight purple night tint for the zombie mood.
      this.add.image(W / 2, H / 2, 'gym_background', 'mid').setDisplaySize(W, H).setTint(0xa79cd0);
    } else {
      this.add.rectangle(W / 2, H / 2, W, H, 0x16213f);
    }

    this.player = new Rig(this, 'marco', tune);
    this.player.root.setAngle(this.playerAngle).setPosition(W / 2, tune.view.playerY).setDepth(5);

    // HUD
    this.add.rectangle(W / 2, 0, W, 78, NAVY, 0.55).setOrigin(0.5, 0).setDepth(48);
    this.scoreText = this.txt(W / 2, 46, '0', 44).setDepth(50);
    this.txt(W / 2, 14, 'SCORE', 11, '#ffc84a').setDepth(50);
    this.comboLabel = this.txt(W - 48, 14, 'COMBO', 11, '#ffc84a').setDepth(50).setVisible(false);
    this.comboNum = this.txt(W - 48, 44, '', 34, '#ffc84a').setDepth(50).setVisible(false);
    this.pips = [];
    for (let i = 0; i < tune.run.playerHp; i++) {
      const x = 26 + i * 30;
      const pip = this.has('icon_cross')
        ? this.add.image(x, 34, 'icon_cross').setDisplaySize(30, 30)
        : this.add.rectangle(x, 34, 20, 20, 0xe5453d).setStrokeStyle(2, NAVY);
      this.pips.push(pip.setDepth(50));
    }
    this.makeMuteButton(24, 66);
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

  // Small speaker toggle. Sound is on by default; ?mute=1 starts muted. Not saved between visits.
  private makeMuteButton(x: number, y: number): void {
    this.muteIcon = this.add.graphics({ x, y }).setDepth(51);
    this.drawMute();
    const zone = this.add.zone(x, y, 44, 36).setInteractive().setDepth(52);
    zone.on('pointerdown', () => {
      this.sfx.setMuted(!this.sfx.muted);
      this.drawMute();
      if (!this.sfx.muted) this.sfx.play('ui');
    });
  }

  private drawMute(): void {
    const g = this.muteIcon;
    g.clear();
    g.fillStyle(NAVY, 0.7).fillRoundedRect(-17, -13, 34, 26, 8);
    g.fillStyle(0xfff1d1, 1).fillRect(-10, -4, 5, 8).fillTriangle(-5, -4, -5, 4, 1, 9).fillTriangle(-5, -4, 1, -9, 1, 9);
    if (this.sfx.muted) {
      g.lineStyle(3, 0xff5a4a, 1).lineBetween(4, -5, 13, 5).lineBetween(13, -5, 4, 5);
    } else {
      g.lineStyle(2.5, 0xfff1d1, 1).beginPath().arc(2, 0, 6, -0.9, 0.9).strokePath().beginPath().arc(2, 0, 10, -0.9, 0.9).strokePath();
    }
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
    for (const b of this.banners) {
      this.tweens.killTweensOf(b);
      b.destroy();
    }
    this.banners.clear();
    this.fx?.reset();
    this.lastScore = 0;
    this.lastCombo = 0;
    this.hitStopUntil = 0;
    this.endShown = false;
    this.endTimer = 0;
    this.acc = 0;
    this.render(performance.now());
    this.banner('DEFEAT THE\nZOMBIES!', '#ffc84a', 34, 1100);
    this.sfx.play('ready');
  }

  private restart(): void {
    this.startRun();
  }

  private clearOverlay(): void {
    this.endTween?.stop();
    this.endTween = null;
    for (const o of this.overlay) o.destroy();
    this.overlay = [];
  }

  update(time: number, delta: number): void {
    if (!this.sim) return;
    if (!this.paused && this.time.now >= this.hitStopUntil) this.acc += Math.min(delta, 100);
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
    const blowDir = (id: number) => {
      const en = target(id);
      return en ? { x: Math.sin(en.ang), y: -Math.cos(en.ang) } : { x: 0, y: -1 };
    };
    if (e.kind === 'punch') {
      this.sfx.play(e.type === 'jab' ? 'whoosh_jab' : 'whoosh_cross');
      const a = (this.playerAngle * Math.PI) / 180;
      this.fx.swing(W / 2, tune.view.playerY, { x: Math.cos(a), y: Math.sin(a) }, e.type === 'cross');
    } else if (e.kind === 'sweet') {
      this.sfx.play(e.killed ? 'kill' : e.zone === 'head' ? 'hit_head' : 'hit_body');
      const en = target(e.enemy);
      const p = en ? this.enemyPos(en) : { x: W / 2, y: H / 2 };
      this.views.get(e.enemy)?.flash(0xffffff, now, 200);
      this.fx.hit(p.x, p.y, blowDir(e.enemy), e.zone, e.killed);
      this.popup(p.x, p.y, e.zone === 'head' ? `+${e.points} HEAD!` : `+${e.points} BODY`, e.zone === 'head' ? '#ffc84a' : '#fff1d1');
      this.popup(p.x + 44, p.y + 26, `-${e.dmg}`, '#ffffff', 20);
      if (e.killed) this.hitStopUntil = this.time.now + tune.view.hitStopMs;
      const word = COMBO_WORDS.find(([n]) => n === e.combo);
      if (word) {
        const tier = Math.min(4, COMBO_WORDS.indexOf(word));
        this.banner(word[1], TIER_COLORS[tier], 44 + tier * 6, 700);
        this.fx.combo(tier);
        this.sfx.play(`combo_${Math.min(4, COMBO_WORDS.indexOf(word) + 1)}` as SoundName);
      }
    } else if (e.kind === 'sour') {
      this.sfx.play('sour');
      const en = target(e.enemy);
      const p = en ? this.enemyPos(en) : { x: W / 2, y: H / 2 };
      this.views.get(e.enemy)?.flash(0xff8a4a, now, 140);
      this.popup(p.x, p.y, 'SOUR', '#ff8a4a');
      this.fx.sour(p.x, p.y);
      this.popup(p.x + 44, p.y + 26, `-${e.dmg}`, '#ff8a4a', 18);
    } else if (e.kind === 'whiff') {
      this.popup(W / 2, tune.view.playerY - 110, 'MISS', '#9aa6c8');
    } else if (e.kind === 'spawn') {
      const n = tune.run.zombieCount;
      if (e.index === Math.round(n * 0.5)) {
        this.banner('HORDE INCOMING!', '#ff6a5a', 36, 900);
        this.sfx.play('horde');
        this.fx.warn();
      } else if (e.index === Math.round(n * 0.8)) {
        this.banner('FINAL RUSH!', '#ff6a5a', 44, 900);
        this.sfx.play('horde');
        this.fx.warn();
      }
    } else if (e.kind === 'playerHit') {
      this.sfx.play('hurt');
      this.player.flash(0xff6a6a, now, 260, false);
      this.fx.hurt(W / 2, tune.view.playerY);
      this.hitStopUntil = Math.max(this.hitStopUntil, this.time.now + 80);
      this.hurtEdge.setAlpha(1);
      this.tweens.add({ targets: this.hurtEdge, alpha: 0, duration: 350 });
    }
  }

  // Big centre call-out that pops in, holds, then fades.
  private banner(text: string, color: string, size: number, holdMs: number): void {
    const t = this.txt(W / 2, 250, text, size, color).setDepth(80).setAlpha(0).setScale(0.4);
    this.banners.add(t);
    // Long words shrink to fit the screen width.
    const fit = Math.min(1, (W - 64) / (t.width * 1.15));
    this.tweens.add({ targets: t, alpha: 1, scale: 1.15 * fit, duration: 180, ease: 'Back.Out' });
    this.tweens.add({ targets: t, x: { from: W / 2 - 7, to: W / 2 + 7 }, duration: 45, yoyo: true, repeat: 5, delay: 120 });
    this.tweens.add({ targets: t, alpha: 0, y: 225, delay: 180 + holdMs, duration: 260, onComplete: () => { this.banners.delete(t); t.destroy(); } });
  }

  private popup(x: number, y: number, s: string, color: string, size = 24): void {
    const t = this.txt(x, y, s, size, color).setDepth(70);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: tune.view.popupMs, onComplete: () => t.destroy() });
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
    if (s.score !== this.lastScore) {
      this.lastScore = s.score;
      this.tweens.add({ targets: this.scoreText, scale: { from: 1.9, to: 1 }, duration: 220, ease: 'Back.Out' });
    }
    if (s.combo !== this.lastCombo) {
      const grew = s.combo > this.lastCombo;
      this.lastCombo = s.combo;
      const show = s.combo >= 2;
      this.comboLabel.setVisible(show);
      const tier = s.combo >= 20 ? 4 : s.combo >= 12 ? 3 : s.combo >= 8 ? 2 : s.combo >= 5 ? 1 : 0;
      this.comboNum.setVisible(show).setText(`x${s.combo}`).setColor(TIER_COLORS[tier]);
      this.comboLabel.setColor(TIER_COLORS[tier]);
      if (show && grew) this.tweens.add({ targets: this.comboNum, scale: { from: 2.1, to: 1 }, duration: 240, ease: 'Back.Out' });
    }
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
        if (e.frame <= flight) this.fx.trail(p.x, p.y);
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
    // Danger marker while a zombie winds up or strikes.
    if (e.state === 'windup' || e.state === 'strike') {
      g.fillStyle(NAVY, 1).fillTriangle(p.x - 13, y - 5, p.x + 13, y - 5, p.x, y - 30);
      g.fillStyle(0xff4a3a, 1).fillTriangle(p.x - 10, y - 7, p.x + 10, y - 7, p.x, y - 26);
      g.fillStyle(0xffffff, 1).fillRect(p.x - 1.5, y - 21, 3, 8).fillCircle(p.x, y - 10, 1.8);
    }
  }

  private showEnd(): void {
    this.endShown = true;
    for (const b of this.banners) {
      this.tweens.killTweensOf(b);
      b.destroy();
    }
    this.banners.clear();
    const s = this.sim.state;
    this.sfx.play(s.ended === 'dead' ? 'end_lose' : 'end_win');
    this.fx.finish(s.ended !== 'dead');
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.overlay.push(o);
      return o;
    };
    add(this.add.rectangle(W / 2, H / 2, W, H, 0x0a1022, 0.86).setDepth(100).setInteractive());
    if (this.has('logo')) add(this.add.image(W / 2, 66, 'logo').setDisplaySize(230, 72.2).setDepth(101));
    add(this.txt(W / 2, 140, s.ended === 'dead' ? 'OVERRUN!' : "TIME'S UP!", 38, s.ended === 'dead' ? '#ff6a5a' : '#ffc84a').setDepth(101));
    add(this.txt(W / 2, 198, 'SCORE', 16, '#9aa6c8').setDepth(101));
    add(this.txt(W / 2, 258, String(s.score), 72).setDepth(101));
    add(this.txt(W / 2, 318, `ZOMBIES DEFEATED  ${s.kills}`, 19).setDepth(101));
    add(this.txt(W / 2, 346, `BEST COMBO  x${s.bestCombo}`, 19, '#ffc84a').setDepth(101));
    // A goal just above where they ended makes the next try feel winnable.
    const next = (Math.floor(s.score / 10) + 1) * 10;
    add(this.txt(W / 2, 384, `Can you reach ${next}?`, 22, '#9fe0ff').setDepth(101));

    // CTA: one button that pulses to draw the thumb.
    const cta = add(this.add.container(W / 2, 450).setDepth(101));
    const g = this.add.graphics();
    const draw = (pressed: boolean) => {
      g.clear();
      g.fillStyle(NAVY, 1).fillRoundedRect(-128, -45, 256, 90, 26);
      g.fillStyle(pressed ? 0xfff1d1 : GOLD, 1).fillRoundedRect(-122, -39, 244, 78, 22);
      g.fillStyle(0xffffff, pressed ? 0 : 0.3).fillRoundedRect(-112, -34, 224, 24, 12);
    };
    draw(false);
    cta.add([g, this.txt(0, 4, CTA_LABEL, 30, '#101b32').setStroke('#ffffff', 0)]);
    this.endTween = this.tweens.add({ targets: cta, scale: { from: 1, to: 1.06 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const zone = add(this.add.zone(W / 2, 450, 270, 100).setInteractive().setDepth(103));
    zone.on('pointerdown', () => {
      draw(true);
      this.sfx.play('ui');
      onCtaPressed();
    });
    zone.on('pointerup', () => draw(false));
    zone.on('pointerout', () => draw(false));

    if (this.retryEnabled) {
      const rg = add(this.add.graphics().setDepth(101));
      const drawRetry = (pressed: boolean) => {
        rg.clear();
        rg.fillStyle(NAVY, 1).fillRoundedRect(W / 2 - 88, 508, 176, 62, 22);
        rg.fillStyle(pressed ? 0xffffff : 0x4a5d86, 1).fillRoundedRect(W / 2 - 83, 513, 166, 52, 18);
      };
      drawRetry(false);
      add(this.txt(W / 2, 539, 'RETRY', 24).setDepth(102));
      const rz = add(this.add.zone(W / 2, 539, 190, 76).setInteractive().setDepth(103));
      rz.on('pointerdown', () => {
        drawRetry(true);
        this.sfx.play('ui');
        this.restart();
      });
      rz.on('pointerout', () => drawRetry(false));
    }
  }
}
