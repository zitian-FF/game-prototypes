import Phaser from 'phaser';
import { tune } from '../sim/tune';
import type { Fighter } from '../sim/types';

// Runtime boxer puppet, true overhead. Replaces the baked animation frames
// for the three playable characters: head, torso, gloves and boots are static
// design masters (loose/part_<char>_<part>, made small by art/prepare-assets),
// the skin arms and legs are drawn in code every frame (two segments with an
// elbow / knee), and everything is placed from the sim state. Z order, bottom
// to top: ground shadow, legs, boots, arms, torso, (ponytail), gloves, head,
// effects. In High Guard the gloves go above the head. Per-layer screen-Y
// offsets (tune.view) fake the depth. Presentation only: hitboxes, reach and
// the sim are untouched.

type Pt = { x: number; y: number };

const NAVY = 0x101b32;
const key = (name: string) => `punchies:${name}`;

interface CharLook {
  skin: number;
  // Where the head circle's centre sits across the head image (0..1).
  headOrigin: number;
  headScale: number;
  torsoScale: number;
  // Recolour for the mirror-match "alt" look: hue range (deg) and shift.
  alt: { from: [number, number]; shift: number };
}

const LOOKS: Record<string, CharLook> = {
  marco: { skin: 0xf0a060, headOrigin: 0.49, headScale: 1, torsoScale: 1, alt: { from: [190, 265], shift: -36 } },
  mia: { skin: 0xf6b886, headOrigin: 0.452, headScale: 1, torsoScale: 1, alt: { from: [338, 375], shift: -28 } },
  bruno: { skin: 0xee9a62, headOrigin: 0.465, headScale: 1, torsoScale: 1, alt: { from: [85, 175], shift: -38 } },
};

// Sizes in logical px at character scale 1.
const TORSO_H = 40; // shoulder to shoulder
const HEAD_H = 24;
const GLOVE_H = 19; // cuff to knuckles
const BOOT_W = 16;
const SHOULDER_V = 13.5;
const HIP_V = 6;
const BOOT_V = 9;
const BOOT_LEAD_U = 9;
const BOOT_REAR_U = -7;
const HEAD_FWD = 2.5;
const PONYTAIL_PIVOT = 0.915;

const PARTS = ['head', 'torso', 'glove_left', 'glove_right', 'boot_left', 'boot_right'];

const partKey = (char: string, alt: boolean, name: string) => key(`part_${char}${alt ? '_alt' : ''}_${name}`);

// Every character with parts gets an alt (hue shifted) copy of each part,
// made once in a canvas, so a mirror match needs no extra download.
export function makeAltParts(scene: Phaser.Scene): void {
  for (const [char, look] of Object.entries(LOOKS)) {
    for (const name of [...PARTS, 'ponytail']) {
      const src = partKey(char, false, name);
      const dst = partKey(char, true, name);
      if (!scene.textures.exists(src) || scene.textures.exists(dst)) continue;
      const img = scene.textures.get(src).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const w = img.width;
      const h = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] === 0) continue;
        const [hh, s, v] = rgbToHsv(px[i], px[i + 1], px[i + 2]);
        if (s < 0.35 || v < 0.2) continue; // skin is orange, outlines are dark
        let deg = hh;
        if (look.alt.from[1] > 360 && deg < look.alt.from[1] - 360) deg += 360;
        if (deg < look.alt.from[0] || deg > look.alt.from[1]) continue;
        const [r, g, b] = hsvToRgb(deg + look.alt.shift, s, v);
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
      }
      ctx.putImageData(data, 0, 0);
      scene.textures.addCanvas(dst, canvas);
    }
  }
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// Elbow (or knee) of a two-segment limb from `s` to `w`, bent toward `outward`.
// The segments grow just enough to always reach.
function joint(s: Pt, w: Pt, minSeg: number, outward: Pt): Pt {
  const dx = w.x - s.x;
  const dy = w.y - s.y;
  const d = Math.hypot(dx, dy) || 1e-3;
  const seg = Math.max(minSeg, (d / 2) * 1.02);
  const h = Math.sqrt(Math.max(0, seg * seg - (d / 2) * (d / 2)));
  let nx = -dy / d;
  let ny = dx / d;
  if (nx * outward.x + ny * outward.y < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: (s.x + w.x) / 2 + nx * h, y: (s.y + w.y) / 2 + ny * h };
}

// Skin limb with a navy outline and round ends.
function limb(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, c: Pt, width: number, skin: number, alpha: number): void {
  const pass = (w: number, color: number) => {
    g.lineStyle(w, color, alpha);
    g.lineBetween(a.x, a.y, b.x, b.y);
    g.lineBetween(b.x, b.y, c.x, c.y);
    g.fillStyle(color, alpha);
    for (const p of [a, b, c]) g.fillCircle(p.x, p.y, w / 2);
  };
  pass(width + 3, NAVY);
  pass(width, skin);
}

export interface PuppetArgs {
  f: Fighter;
  now: number;
  k: number; // character scale
  alt: boolean;
  fists: [Pt, Pt]; // glove centres from the sim (rest / guard / punch)
  fistColors: [number, number]; // phase feedback colours (sweet, sour, guard)
  baseColor: number;
  walk: number; // gait phase, advances with distance walked
  stride: number; // 0..1, how much the boxer is walking
  vel: Pt; // world movement this frame
  flashHead: boolean;
  flashBody: boolean;
  flashColor: number;
  dodging: boolean;
  guarding: boolean;
}

export class Puppet {
  private legs: Phaser.GameObjects.Graphics;
  private arms: Phaser.GameObjects.Graphics;
  private fx: Phaser.GameObjects.Graphics;
  private bootL: Phaser.GameObjects.Image;
  private bootR: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private ponytail: Phaser.GameObjects.Image;
  private gloveL: Phaser.GameObjects.Image;
  private gloveR: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private ghosts: { torso: Phaser.GameObjects.Image; head: Phaser.GameObjects.Image }[];
  private bound = '';
  private history: { x: number; y: number; rot: number }[] = [];

  constructor(private scene: Phaser.Scene) {
    const img = (d: number) => scene.add.image(0, 0, '__DEFAULT').setDepth(d).setVisible(false);
    this.legs = scene.add.graphics().setDepth(9.2);
    this.bootL = img(9.3);
    this.bootR = img(9.3);
    this.ghosts = [0, 1].map(() => ({ torso: img(9.6), head: img(9.62) }));
    this.arms = scene.add.graphics().setDepth(9.9);
    this.torso = img(10);
    this.gloveL = img(10.1);
    this.gloveR = img(10.1);
    this.ponytail = img(10.12);
    this.head = img(10.2);
    this.fx = scene.add.graphics().setDepth(10.4);
  }

  get visible(): boolean {
    return this.head.visible;
  }

  hide(): void {
    this.legs.clear();
    this.arms.clear();
    this.fx.clear();
    for (const o of [this.bootL, this.bootR, this.torso, this.ponytail, this.gloveL, this.gloveR, this.head]) o.setVisible(false);
    for (const g of this.ghosts) {
      g.torso.setVisible(false);
      g.head.setVisible(false);
    }
    this.history.length = 0;
  }

  // True when this character's parts are loaded.
  private bind(char: string, alt: boolean): boolean {
    const id = `${char}${alt ? '_alt' : ''}`;
    if (this.bound === id) return true;
    const look = LOOKS[char];
    if (!look) return false;
    const need = PARTS.map((p) => partKey(char, alt, p));
    if (!need.every((k) => this.scene.textures.exists(k))) return false;
    this.bootL.setTexture(partKey(char, alt, 'boot_left'));
    this.bootR.setTexture(partKey(char, alt, 'boot_right'));
    this.torso.setTexture(partKey(char, alt, 'torso'));
    this.gloveL.setTexture(partKey(char, alt, 'glove_left'));
    this.gloveR.setTexture(partKey(char, alt, 'glove_right'));
    this.head.setTexture(partKey(char, alt, 'head')).setOrigin(look.headOrigin, 0.5);
    const pony = partKey(char, alt, 'ponytail');
    if (this.scene.textures.exists(pony)) this.ponytail.setTexture(pony).setOrigin(PONYTAIL_PIVOT, 0.5);
    for (const g of this.ghosts) {
      g.torso.setTexture(partKey(char, alt, 'torso')).setTintFill(0x7fe9ff);
      g.head.setTexture(partKey(char, alt, 'head')).setOrigin(look.headOrigin, 0.5).setTintFill(0x7fe9ff);
    }
    this.bound = id;
    return true;
  }

  // Draws the boxer. Returns false (and hides) when the parts are missing, so
  // the caller can fall back to the older art.
  draw(a: PuppetArgs): boolean {
    const { f } = a;
    const look = LOOKS[f.char];
    if (!look || f.anchored || !this.bind(f.char, a.alt)) {
      this.hide();
      return false;
    }
    const v = tune.view;
    const k = a.k;
    const now = a.now;
    const fx = f.fx;
    const fy = f.fy;
    const lx = f.fy; // +v is the boxer's left, hand 0
    const ly = -f.fx;
    const th = Math.atan2(fy, fx);
    const alpha = a.dodging ? 0.55 : 1;
    const P = (u: number, vv: number, dy = 0): Pt => ({ x: f.x + fx * u + lx * vv, y: f.y + fy * u + ly * vv + dy });
    const slump = f.exhausted || f.stunTimer > 0;
    const hitT = f.lastBlow && f.framesSinceHit < 10 ? f.framesSinceHit / 10 : 1;
    const heavy = !!f.lastBlow && f.lastBlow.sweet && f.lastBlow.punch !== 'jab';
    const snap = hitT < 1 ? (heavy ? 5 : 3) * k * (1 - hitT) : 0;
    const breathe = Math.sin(now / 520);

    this.legs.clear();
    this.arms.clear();
    this.fx.clear();

    // ---- feet: gait follows the movement direction relative to facing ----
    const speed = Math.hypot(a.vel.x, a.vel.y);
    let mu = 0;
    let mv = 0;
    if (speed > 0.01) {
      mu = (a.vel.x * fx + a.vel.y * fy) / speed;
      mv = (a.vel.x * lx + a.vel.y * ly) / speed;
    }
    // 0 = walking forward / back, 1 = side-stepping (past ~45 degrees).
    const angle = Math.atan2(Math.abs(mv), Math.abs(mu));
    const strafe = Math.min(1, Math.max(0, (angle - 0.52) / 0.5));
    const amp = (9 - 2 * strafe) * k * a.stride;
    const feet: { pos: Pt; yaw: number; lift: number; ankle: Pt; hip: Pt; out: Pt }[] = [];
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1; // boot_left on +v
      const ph = a.walk + (i === 0 ? 0 : Math.PI);
      const sw = Math.sin(ph);
      const u0 = (i === 0 ? BOOT_LEAD_U : BOOT_REAR_U) * k;
      const v0 = BOOT_V * k * side;
      const pos = P(u0 + mu * amp * sw, v0 + mv * amp * sw, v.feetOffsetY);
      const yaw = 0.3 * strafe * Math.sign(mv || 1) * a.stride;
      const lift = Math.max(0, Math.cos(ph)) * a.stride;
      const hip = P(-2 * k, HIP_V * k * side, v.bodyOffsetY);
      const ankle = { x: pos.x - fx * 4 * k, y: pos.y - fy * 4 * k };
      feet.push({ pos, yaw, lift, ankle, hip, out: { x: lx * side, y: ly * side } });
    }
    [this.bootL, this.bootR].forEach((boot, i) => {
      const ft = feet[i];
      const s = ((BOOT_W * k) / boot.width) * (1 + 0.14 * ft.lift);
      boot.setPosition(ft.pos.x, ft.pos.y).setRotation(th + ft.yaw).setScale(s).setAlpha(alpha).setVisible(true).setDepth(9.3 + 0.01 * ft.lift);
    });
    for (const ft of feet) {
      const knee = joint(ft.hip, ft.ankle, 8 * k, ft.out);
      limb(this.legs, ft.hip, knee, ft.ankle, 5.5 * k, look.skin, alpha);
    }

    // ---- torso and head ----
    const tpos = P(-snap * 0.5, 0, v.bodyOffsetY);
    this.torso
      .setPosition(tpos.x, tpos.y)
      .setRotation(th + (f.stunTimer > 0 ? Math.sin(now / 130) * 0.06 : 0))
      .setScale(((TORSO_H * k) / this.torso.height) * look.torsoScale * (1 + 0.012 * breathe))
      .setAlpha(alpha)
      .setVisible(true);
    const headDy = v.headOffsetY + (slump ? 2 : 0) + (a.guarding ? 0 : 0.4 * breathe);
    const hpos = P(HEAD_FWD * k - snap, 0, headDy);
    const hrot = th + (f.stunTimer > 0 ? Math.sin(now / 110) * 0.3 : hitT < 1 ? 0.18 * (1 - hitT) * (f.lastBlow && f.lastBlow.dx * ly - f.lastBlow.dy * lx > 0 ? 1 : -1) : Math.sin(now / 900) * 0.03);
    const hscale = ((HEAD_H * k) / this.head.height) * look.headScale;
    this.head.setPosition(hpos.x, hpos.y).setRotation(hrot).setScale(hscale).setAlpha(alpha).setVisible(true);
    if (this.scene.textures.exists(partKey(f.char, a.alt, 'ponytail'))) {
      const sway = Math.sin(a.walk * 0.8 + now / 400) * (0.1 + 0.25 * a.stride) + (hitT < 1 ? 0.4 * (1 - hitT) : 0);
      const ppos = P(HEAD_FWD * k - snap - 11 * k, 0, headDy);
      this.ponytail.setPosition(ppos.x, ppos.y).setRotation(hrot + sway).setScale(hscale).setAlpha(alpha).setVisible(true);
    } else this.ponytail.setVisible(false);

    // ---- arms: shoulder to wrist, elbow bent outward ----
    const fists = a.fists.map((p, i) => {
      // Exhausted or stunned boxers let their guard drop toward the body.
      if (slump && !f.punch) {
        const side = i === 0 ? 1 : -1;
        const rest = P(7 * k, 11 * side * k);
        return { x: p.x + (rest.x - p.x) * 0.45, y: p.y + (rest.y - p.y) * 0.45 };
      }
      return p;
    });
    const skinNow = a.flashBody ? a.flashColor : look.skin;
    [this.gloveL, this.gloveR].forEach((glove, i) => {
      const side = i === 0 ? 1 : -1;
      const fist = fists[i];
      const sh = P(1 * k, SHOULDER_V * k * side, v.bodyOffsetY);
      const gh = GLOVE_H * k;
      let dx = fist.x - sh.x;
      let dy = fist.y - sh.y;
      let d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const wrist = { x: fist.x - dx * gh * 0.4, y: fist.y - dy * gh * 0.4 };
      const elbow = joint(sh, wrist, 9 * k, { x: lx * side, y: ly * side });
      limb(this.arms, sh, elbow, wrist, 6 * k, skinNow, alpha);
      dx = fist.x - elbow.x;
      dy = fist.y - elbow.y;
      d = Math.hypot(dx, dy) || 1;
      glove
        .setPosition(fist.x, fist.y)
        .setRotation(Math.atan2(dy, dx) + Math.PI / 2)
        .setScale(gh / glove.height)
        .setAlpha(alpha)
        .setVisible(true)
        // High Guard: the gloves come up over the head.
        .setDepth(a.guarding ? 10.25 : 10.1);
      // Sweet / sour / guard feedback ring around the glove.
      if (a.fistColors[i] !== a.baseColor) {
        this.fx.lineStyle(2, a.fistColors[i], 0.85 * alpha);
        this.fx.strokeCircle(fist.x, fist.y, gh * 0.55);
      }
    });

    // ---- tints: head and torso flash separately when hit ----
    const head = a.flashHead;
    const body = a.flashBody;
    for (const o of [this.head, this.ponytail]) (head ? o.setTintFill(a.flashColor) : o.clearTint());
    if (body) this.torso.setTintFill(a.flashColor);
    else this.torso.clearTint();

    // ---- effects: dodge afterimage + speed lines, exhausted sweat ----
    this.history.push({ x: tpos.x, y: tpos.y, rot: th });
    if (this.history.length > 12) this.history.shift();
    this.ghosts.forEach((g, i) => {
      const past = this.history[this.history.length - 1 - 4 * (i + 1)];
      const on = !!f.dodge && !!past;
      g.torso.setVisible(on);
      g.head.setVisible(on);
      if (!on) return;
      const ga = (i === 0 ? 0.38 : 0.2) * (alpha < 1 ? 1 : 1);
      g.torso.setPosition(past.x, past.y).setRotation(past.rot).setScale(this.torso.scale).setAlpha(ga);
      g.head.setPosition(past.x + fx * HEAD_FWD * k, past.y + v.headOffsetY - v.bodyOffsetY + fy * HEAD_FWD * k).setRotation(past.rot).setScale(hscale).setAlpha(ga);
    });
    if (f.dodge) {
      let dx = f.dodge.dx;
      let dy = f.dodge.dy;
      const dl = Math.hypot(dx, dy);
      if (dl < 0.01) {
        dx = -fx;
        dy = -fy;
      } else {
        dx /= dl;
        dy /= dl;
      }
      const nx = -dy;
      const ny = dx;
      for (let j = 0; j < 6; j++) {
        const off = (j - 2.5) * 4.5 * k;
        const len = (12 + (j % 3) * 8) * k;
        const sx = tpos.x - dx * 10 * k + nx * off;
        const sy = tpos.y - dy * 10 * k + ny * off;
        this.fx.lineStyle(2, 0xdff6ff, 0.7);
        this.fx.lineBetween(sx, sy, sx - dx * len, sy - dy * len);
      }
    }
    if (f.exhausted) {
      for (let j = 0; j < 3; j++) {
        const t = (now / 750 + j / 3) % 1;
        const ang = th + 1.3 + j * 1.9;
        const r = (12 + 11 * t) * k;
        const x = hpos.x + Math.cos(ang) * r;
        const y = hpos.y + Math.sin(ang) * r + 6 * t * t;
        const al = (1 - t) * 0.9;
        this.fx.fillStyle(0x9fe0ff, al);
        this.fx.fillCircle(x, y, 2.8 * k * (1 - 0.4 * t));
        this.fx.fillStyle(0xffffff, al * 0.8);
        this.fx.fillCircle(x - 0.5, y - 0.6, 0.8 * k);
      }
    }
    return true;
  }
}
