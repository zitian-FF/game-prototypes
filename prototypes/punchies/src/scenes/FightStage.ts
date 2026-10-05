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
import { artImage, backdrop } from '../render/art';
import { lookFor } from '../render/characterLook';
import { RingPerspective } from '../render/perspective';
import { tune } from '../sim/tune';
import { NEUTRAL_INPUT, type FrameInput, type SimEvent, type SimState } from '../sim/types';
import { unlockAudio } from '../audio/sfx';
import { isDebug, debugView } from '../debug/debugPanel';
import { getNav, navRegister } from '../ui/menuNav';

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
  private floor: Phaser.GameObjects.Image | null;
  private apron: Phaser.GameObjects.Image | null;
  private turnbuckles: (Phaser.GameObjects.Image | null)[];
  private ropes: (Phaser.GameObjects.Image | null)[];
  private posts: (Phaser.GameObjects.Image | null)[];
  private persp: RingPerspective;

  constructor(
    private scene: Phaser.Scene,
    names: [string, string],
    // -1 = local two-player: no "me", so hit feedback stays neutral.
    private localIdx: 0 | 1 | -1,
    // Whether the on-screen touch controls are available at all.
    private touchEnabled = true,
  ) {
    backdrop(scene, 0.15, 'stage_background');
    this.persp = new RingPerspective(scene);
    const before = new Set(scene.children.list);
    this.floor = artImage(scene, 'ring_floor', 422, 219, 310, 310, 0);
    this.apron = artImage(scene, 'ring_apron', 422, 382, 326, 16, -1);
    this.turnbuckles = [0, 1, 2, 3].map(() => artImage(scene, 'ring_turnbuckle', 0, 0, 22, 22, 2));
    if (this.apron) this.persp.take([this.apron]);
    this.ropes = [0, 1, 2, 3].map(() => artImage(scene, 'ring_rope', 0, 0, 326, 12, 1));
    this.posts = [0, 1, 2, 3].map(() => artImage(scene, 'ring_post', 0, 0, 20, 20, 2));
    this.ring = scene.add.graphics().setDepth(0);
    getNav(scene).fightMode = true;
    this.views = [new FighterView(scene, 0x3a78d0), new FighterView(scene, 0xd04a4a)];
    this.ko = new KoAnim(scene, [0x3a78d0, 0xd04a4a]);
    this.fx = new Effects(scene);
    this.fx.onFighterFlash = (idx, color, zone) => this.views[idx].flash(color, scene.time.now, 110, zone);
    // Ring, boxers and hit effects tilt together; screen-space overlays
    // (depth 76 and up), the HUD and the controls stay flat.
    this.persp.take(scene.children.list.filter((o) => !before.has(o) && o !== this.persp.world && (o as Phaser.GameObjects.Image).depth >= 0 && (o as Phaser.GameObjects.Image).depth < 76));
    this.hud = new Hud(scene, names);
    // P1 / P2 tags over each boxer at the start of a round.
    this.tags = [0, 1].map((i) =>
      scene.add
        .text(0, 0, `P${i + 1}`, { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4, resolution: PIXEL_RATIO })
        .setOrigin(0.5, 1)
        .setDepth(60),
    );
    this.persp.take(this.tags);
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
    for (const e of events) {
      if (e.kind !== 'hit' && e.kind !== 'block') continue;
      const defender = 1 - e.attacker;
      if (s.fighters[defender].anchored) {
        this.views[defender].reactToDummyHit(e.kind === 'hit' && e.row === 'vulnerable' ? 'head' : 'body', this.scene.time.now);
      }
    }
    this.fx.handle(events, s, this.localIdx);
  }

  // Solo modes: touch + either keyboard half + any controller all drive the
  // one local player.
  sampleLocal(): FrameInput {
    // While keyboard / controller are driving the menu highlight, only
    // touch reaches the fighter.
    if (getNav(this.scene).capturing) return this.intents.sample();
    return mergeInputs([this.intents.sample(), devices.sample('kb1'), devices.sample('kb2'), devices.sample('pad1'), devices.sample('pad2')]);
  }

  sampleSource(src: InputSource): FrameInput {
    if (src === 'touch') return this.intents.sample();
    return getNav(this.scene).capturing ? NEUTRAL_INPUT : devices.sample(src);
  }

  // Tutorial: reveal only the listed controls/HUD parts (null = all), and
  // optionally force the hitbox overlay on.
  forceHitboxes = false;
  // Local VS: players on keyboard / controller (set by LocalVsScene).
  localVsRows: number[] = [0, 1];
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
    // Character looks (colour, size, ponytail); mirror matches give P2 the alt colour.
    const chars: [string, string] = [s.fighters[0].char, s.fighters[1].char];
    const looks = [lookFor(chars, 0), lookFor(chars, 1)];
    looks.forEach((l, i) => this.views[i].setLook(l.color, l.scale, l.ponytail));
    this.ko.colors = [looks[0].color, looks[1].color];
    this.ko.looks = looks;
    this.drawRing(looks[0].color, looks[1].color);
    this.drawTags(s, looks.map((l) => l.color));
    this.controls.enabled = this.touchEnabled && !this.info.open;
    this.controls.setVisible(this.touchEnabled && devices.lastDevice === 'touch');
    const show = this.forceHitboxes || this.info.hitboxes || (isDebug() && debugView.showHitboxes);
    this.persp.update();
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
    // Star / fatigue row for anyone not using the touch buttons: the local
    // player on keyboard or controller, or both players in Local VS unless
    // that player is on touch.
    const touch = this.touchEnabled && devices.lastDevice === 'touch';
    this.hud.resourceRow = this.localIdx === -1 ? this.localVsRows : touch ? [] : [this.localIdx];
    this.hud.draw(s);
    this.controls.draw(s.fighters[this.localIdx === 1 ? 1 : 0]);
  }

  // Small menu-style button (not a gameplay intent).
  button(x: number, y: number, w: number, text: string, onTap: () => void): Phaser.GameObjects.Text {
    return makeButton(this.scene, x, y, w, text, onTap);
  }

  // Ring: canvas floor with a subtle weave and scuffs, three ropes per side
  // with tape wraps, and corner posts (blue / red / neutral white). Redrawn
  // only when the ring bounds change (they're tunable).
  private ringKey = '';
  // P1 / P2 tags: shown through READY / GO and the first match.tagSec
  // seconds of the fight, fading out over the last second.
  private tags: Phaser.GameObjects.Text[] = [];
  private drawTags(s: SimState, colors: number[]): void {
    const t = Math.max(0, s.tick - s.fightStartTick) / 60;
    const left = tune.match.tagSec - t;
    const a = s.result ? 0 : Math.max(0, Math.min(1, left));
    this.tags.forEach((tag, i) => {
      const f = s.fighters[i];
      tag.setPosition(f.x, f.y - 26);
      tag.setColor('#' + colors[i].toString(16).padStart(6, '0'));
      tag.setAlpha(a);
      tag.setVisible(a > 0);
    });
  }

  private drawRing(c0 = 0x3a78d0, c1 = 0xd04a4a): void {
    const r = tune.ring;
    const key = `${r.left},${r.top},${r.right},${r.bottom},${c0},${c1}`;
    if (key === this.ringKey) return;
    this.ringKey = key;
    const g = this.ring;
    g.clear();
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    this.floor?.setPosition(r.left + w / 2, r.top + h / 2).setDisplaySize(w, h);
    // Keep the skirt inside the flat camera before the post-effect samples it.
    this.apron?.setPosition(r.left + w / 2, r.bottom + 8).setDisplaySize(w + 16, 16);
    if (this.floor && this.ropes.every(Boolean) && this.posts.every(Boolean)) {
      const cx = r.left + w / 2, cy = r.top + h / 2;
      this.ropes[0]!.setPosition(cx, r.top - 5).setDisplaySize(w + 16, 12);
      this.ropes[1]!.setPosition(cx, r.bottom - 3).setDisplaySize(w + 16, 12);
      this.ropes[2]!.setPosition(r.left - 5, cy).setDisplaySize(h + 16, 12).setRotation(Math.PI / 2);
      this.ropes[3]!.setPosition(r.right + 5, cy).setDisplaySize(h + 16, 12).setRotation(Math.PI / 2);
      const positions = [[r.left - 7, r.top - 7, c0], [r.right + 7, r.bottom + 7, c1], [r.right + 7, r.top - 7, 0xffffff], [r.left - 7, r.bottom + 7, 0xffffff]];
      this.posts.forEach((post, i) => post!.setPosition(positions[i][0], positions[i][1]).setTint(positions[i][2]));
      const pads = [[r.left + 3, r.top + 3, -Math.PI / 4], [r.right - 3, r.bottom - 3, Math.PI * 3 / 4], [r.right - 3, r.top + 3, Math.PI / 4], [r.left + 3, r.bottom - 3, -Math.PI * 3 / 4]];
      this.turnbuckles.forEach((pad, i) => pad?.setPosition(pads[i][0], pads[i][1]).setRotation(pads[i][2]));
      return;
    }
    // Partial stage assets are hidden so the intact procedural ring stays coherent.
    this.ropes.forEach(image => image?.setVisible(false));
    this.posts.forEach(image => image?.setVisible(false));
    this.turnbuckles.forEach(image => image?.setVisible(false));
    this.apron?.setVisible(false);

    // Apron just outside the ropes.
    g.fillStyle(0x1b1f27, 1);
    g.fillRect(r.left - 12, r.top - 12, w + 24, h + 24);

    // Canvas floor.
    g.fillStyle(0x2a2f3a, 1);
    g.fillRect(r.left, r.top, w, h);
    // Weave: faint crossing diagonals.
    g.lineStyle(1, 0xffffff, 0.025);
    // "/" diagonals: points with x + y = d inside the floor.
    for (let d = 6; d < w + h; d += 6) {
      const x0 = Math.max(0, d - h);
      const x1 = Math.min(d, w);
      g.lineBetween(r.left + x0, r.top + d - x0, r.left + x1, r.top + d - x1);
    }
    for (let x = r.left + 3; x < r.right; x += 6) g.lineBetween(x, r.top, x, r.bottom);
    // Scuffs: fixed pseudo-random blotches (same every draw).
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      g.fillStyle(rnd() < 0.5 ? 0x000000 : 0xffffff, 0.02 + rnd() * 0.03);
      g.fillEllipse(r.left + rnd() * w, r.top + rnd() * h, 4 + rnd() * 18, 3 + rnd() * 10);
    }
    // Keep the authored floor above procedural floor, below ropes/posts.
    if (this.floor) g.clear();
    // Centre mark.
    g.lineStyle(2, 0xffffff, 0.05);
    g.strokeCircle(r.left + w / 2, r.top + h / 2, 34);

    // Ropes: three per side, stepping outward, each with a highlight.
    const ropes = [2, 5, 8];
    ropes.forEach((o, i) => {
      g.lineStyle(3, 0x6e1f1f, 1);
      g.strokeRect(r.left - o, r.top - o, w + o * 2, h + o * 2);
      g.lineStyle(1, i === 1 ? 0xf0f0f0 : 0xd85a5a, 0.55);
      g.strokeRect(r.left - o - 0.5, r.top - o - 0.5, w + o * 2, h + o * 2);
    });
    // Tape wraps tying the ropes together along each side.
    g.fillStyle(0xd8d8d8, 0.35);
    for (let k = 1; k < 4; k++) {
      const tx = r.left + (w * k) / 4;
      const ty = r.top + (h * k) / 4;
      g.fillRect(tx - 1.5, r.top - 10, 3, 9);
      g.fillRect(tx - 1.5, r.bottom + 1, 3, 9);
      g.fillRect(r.left - 10, ty - 1.5, 9, 3);
      g.fillRect(r.right + 1, ty - 1.5, 9, 3);
    }

    // Corner posts with padded turnbuckle covers: blue (P1 side), red
    // (P2 side), the other two neutral.
    const posts: [number, number, number][] = [
      [r.left, r.top, c0],
      [r.right, r.bottom, c1],
      [r.right, r.top, 0xdddddd],
      [r.left, r.bottom, 0xdddddd],
    ];
    for (const [x, y, c] of posts) {
      const px = x + (x === r.left ? -7 : 7);
      const py = y + (y === r.top ? -7 : 7);
      g.fillStyle(0x000000, 0.4);
      g.fillCircle(px + 2, py + 2, 7);
      g.fillStyle(0x444a55, 1);
      g.fillCircle(px, py, 6.5);
      g.fillStyle(c, 1);
      g.fillCircle(px, py, 5);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(px - 1.5, py - 1.5, 1.8);
    }
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
  const art = artImage(scene, 'ui_button', x, y, w, h, 130);
  if (art) bg.setFillStyle(0x222222, 0).setStrokeStyle(0);
  bg.on('destroy', () => art?.destroy());
  bg.setInteractive().on('pointerdown', onTap);
  navRegister(scene, bg, onTap);
  const label = scene.add
    .text(x, y, text, { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#dddddd', resolution: PIXEL_RATIO })
    .setOrigin(0.5)
    .setDepth(131);
  label.setData('bg', bg);
  return label;
}
