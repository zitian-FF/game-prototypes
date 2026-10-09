import Phaser from 'phaser';
import { skinTexture } from './skins';
import { limbSkin } from './skinPalette';
import { tune } from '../sim/tune';
import type { Fighter } from '../sim/types';
import { armPose, punchExtension, uppercutFireIntensity, gloveRegistration } from './punchMotion';

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
  tyke: {skin:0x995c39,headOrigin:.5,headScale:1,torsoScale:1,alt:{from:[35,65],shift:0}},
  dragon: {skin:0xf0ae72,headOrigin:.5,headScale:1,torsoScale:1,alt:{from:[335,380],shift:0}},
  tee: {skin:0xf6b886,headOrigin:.49,headScale:1,torsoScale:1,alt:{from:[335,380],shift:70}},
  marco: { skin: 0xf0a060, headOrigin: 0.49, headScale: 1, torsoScale: 1, alt: { from: [190, 265], shift: -36 } },
  mia: { skin: 0xf6b886, headOrigin: 0.452, headScale: 1, torsoScale: 1, alt: { from: [338, 375], shift: -28 } },
  bruno: { skin: 0xee9a62, headOrigin: 0.465, headScale: 1, torsoScale: 1, alt: { from: [85, 175], shift: -38 } },
};

// Art registration follows prepare-assets.mjs; runtime sizes are in tune.view.puppet.
const PONYTAIL_PIVOT = 0.915;

const PARTS = ['head', 'torso', 'glove_left', 'glove_right', 'boot_left', 'boot_right'];

const partKey = (char: string, alt: boolean, name: string) => key(`part_${char}${alt ? '_alt' : ''}_${name}`);

// Every character with parts gets an alt (hue shifted) copy of each part,
// made once in a canvas, so a mirror match needs no extra download.
export function makeAltParts(scene: Phaser.Scene): void {
  for (const [char, look] of Object.entries(LOOKS)) {
    for (const name of [...PARTS, 'ponytail', 'ponytail_left', 'ponytail_right']) {
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

function lerpRgb(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
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
  skin?:string;
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
  vulnerable?: boolean; // open to full-damage hits: the silhouette pulses red-orange
  limp?: boolean; // knocked out: slumped, no sweat or wobble
}

export class Puppet {
  private legs: Phaser.GameObjects.Graphics;
  private arms: Phaser.GameObjects.Graphics;
  private fx: Phaser.GameObjects.Graphics;
  private bootL: Phaser.GameObjects.Image;
  private bootR: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private ponytail: Phaser.GameObjects.Image;
  private twinTails:Phaser.GameObjects.Image[];
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
    this.twinTails=[img(10.12),img(10.12)];
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
    for (const o of [...this.twinTails,this.bootL, this.bootR, this.torso, this.ponytail, this.gloveL, this.gloveR, this.head]) o.setVisible(false);
    for (const g of this.ghosts) {
      g.torso.setVisible(false);
      g.head.setVisible(false);
    }
    this.history.length = 0;
  }

  // True when this character's parts are loaded.
  private bind(char: string, alt: boolean, skin='default'): boolean {
    const id = `${char}${alt ? '_alt' : ''}:${skin}`;
    const part=(name:string)=>skinTexture(this.scene,char,skin,`part_${char}${alt&&skin==='default'?'_alt':''}_${name}`);
    if (this.bound === id) return true;
    const look = LOOKS[char];
    if (!look) return false;
    const need = PARTS.map((p) => part(p));
    if (!need.every((k) => this.scene.textures.exists(k))) return false;
    this.bootL.setTexture(part('boot_left'));
    this.bootR.setTexture(part('boot_right'));
    this.torso.setTexture(part('torso'));
    this.gloveL.setTexture(part('glove_left'));
    this.gloveR.setTexture(part('glove_right'));
    this.head.setTexture(part('head')).setOrigin(look.headOrigin, 0.5);
    const pony = part('ponytail');
    if (this.scene.textures.exists(pony)) this.ponytail.setTexture(pony).setOrigin(PONYTAIL_PIVOT, 0.5);
    ['ponytail_left','ponytail_right'].forEach((name,i)=>{if(this.scene.textures.exists(part(name)))this.twinTails[i].setTexture(part(name)).setOrigin(tune.view.puppet.teeTailOriginX,tune.view.puppet.teeTailOriginY);});
    for (const g of this.ghosts) {
      g.torso.setTexture(part('torso')).setTintFill(0x7fe9ff);
      g.head.setTexture(part('head')).setOrigin(look.headOrigin, 0.5).setTintFill(0x7fe9ff);
    }
    this.bound = id;
    return true;
  }

  // Draws the boxer. Returns false (and hides) when the parts are missing, so
  // the caller can fall back to the older art.
  draw(a: PuppetArgs): boolean {
    const { f } = a;
    const originalLook = LOOKS[f.char];
    const look = originalLook && { ...originalLook, skin: limbSkin(f.char,a.skin??'default',originalLook.skin) };
    if (!look || f.anchored || !this.bind(f.char, a.alt,a.skin)) {
      this.hide();
      return false;
    }
    const v = tune.view;
    const rig = v.puppet;
    const k = a.k;
    const now = a.now;
    const fx = f.fx;
    const fy = f.fy;
    const lx = f.fy; // +v is the boxer's left, hand 0
    const ly = -f.fx;
    const th = Math.atan2(fy, fx);
    const alpha = a.dodging ? 0.55 : 1;
    const P = (u: number, vv: number, dy = 0): Pt => ({ x: f.x + fx * u + lx * vv, y: f.y + fy * u + ly * vv + dy });
    const slump = !!a.limp || f.exhausted || f.stunTimer > 0;
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
      const u0 = (i === 0 ? rig.leadBootForward : rig.rearBootForward) * k;
      const v0 = rig.bootSpread * k * side;
      const pos = P(u0 + mu * amp * sw, v0 + mv * amp * sw, v.feetOffsetY);
      const yaw = 0.3 * strafe * Math.sign(mv || 1) * a.stride;
      const lift = Math.max(0, Math.cos(ph)) * a.stride;
      const hip = P(-2 * k, rig.hipSpread * k * side, v.bodyOffsetY);
      const ankle = { x: pos.x - fx * 4 * k, y: pos.y - fy * 4 * k };
      feet.push({ pos, yaw, lift, ankle, hip, out: { x: lx * side, y: ly * side } });
    }
    [this.bootL, this.bootR].forEach((boot, i) => {
      const ft = feet[i];
      const s = ((rig.bootWidth * k) / boot.width) * (1 + 0.14 * ft.lift);
      boot.setPosition(ft.pos.x, ft.pos.y).setRotation(th + ft.yaw).setScale(s).setAlpha(alpha).setVisible(true).setDepth(9.3 + 0.01 * ft.lift);
    });
    for (const ft of feet) {
      const knee = joint(ft.hip, ft.ankle, 8 * k, ft.out);
      limb(this.legs, ft.hip, knee, ft.ankle, 5.5 * k, look.skin, alpha);
    }

    // ---- torso and head ----
    const tpos = P(-snap * 0.5, 0, v.bodyOffsetY);
    // Torso twist: the shoulder of the striking hand turns forward with the
    // punch (left hand +, right hand -), the head follows part way.
    const twist = f.punch && !a.limp ? (f.punch.hand === 0 ? 1 : -1) * ((rig.torsoTwistDegrees * Math.PI) / 180) * punchExtension(f.punch) : 0;
    const tfx = Math.cos(th + twist);
    const tfy = Math.sin(th + twist);
    const tlx = tfy;
    const tly = -tfx;
    this.torso
      .setPosition(tpos.x, tpos.y)
      .setRotation(th + twist + (f.stunTimer > 0 ? Math.sin(now / 130) * 0.06 : 0))
      .setScale(((rig.torsoHeight * k) / this.torso.height) * look.torsoScale * (f.char==='tee'?rig.teeTorsoScale:1) * (1 + 0.012 * breathe))
      .setAlpha(alpha)
      .setVisible(true);
    const headDy = v.headOffsetY + (slump ? 2 : 0) + (a.guarding ? 0 : 0.4 * breathe);
    const hpos = P(rig.headForward * k - snap, 0, headDy);
    const hrot = th + twist * 0.4 + (f.stunTimer > 0 ? Math.sin(now / 110) * 0.3 : hitT < 1 ? 0.18 * (1 - hitT) * (f.lastBlow && f.lastBlow.dx * ly - f.lastBlow.dy * lx > 0 ? 1 : -1) : Math.sin(now / 900) * 0.03);
    const hscale = ((rig.headHeight * k) / this.head.height) * look.headScale * (f.char==='tee'?rig.teeHeadScale:1);
    this.head.setPosition(hpos.x, hpos.y).setRotation(hrot).setScale(hscale).setAlpha(alpha).setVisible(true);
    if (this.scene.textures.exists(skinTexture(this.scene,f.char,a.skin??'default',`part_${f.char}${a.alt&&(a.skin??'default')==='default'?'_alt':''}_ponytail`))) {
      const sway = Math.sin(a.walk * 0.8 + now / 400) * (0.1 + 0.25 * a.stride) + (hitT < 1 ? 0.4 * (1 - hitT) : 0);
      const ppos = P(rig.headForward * k - snap - 11 * k, 0, headDy);
      this.ponytail.setPosition(ppos.x, ppos.y).setRotation(hrot + sway).setScale(hscale).setAlpha(alpha).setVisible(true);
    } else this.ponytail.setVisible(false);

    this.twinTails.forEach((tail,i)=>{
      const name='ponytail_'+(i===0?'left':'right');
      const texture=skinTexture(this.scene,f.char,a.skin??'default',`part_${f.char}${a.alt&&(a.skin??'default')==='default'?'_alt':''}_${name}`);
      if(!this.scene.textures.exists(texture)){tail.setVisible(false);return;}
      const side=i===0?1:-1,root=P(rig.headForward*k-snap-rig.teeTailBack*k,side*rig.teeTailSpread*k,headDy);
      const sway=Math.sin(now/rig.teeTailSwayMs+a.walk*rig.teeTailWalkCoupling+i*rig.teeTailPhase)*(rig.teeTailIdleSway+rig.teeTailSway*a.stride)+(hitT<1?side*rig.teeTailHitSway*(1-hitT):0);
      tail.setPosition(root.x,root.y).setRotation(hrot+sway+side*rig.teeTailRestAngle).setScale(hscale*rig.teeTailScale).setAlpha(alpha).setVisible(true);
    });

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
    // Vulnerable: the whole silhouette pulses red-orange while it lasts.
    const pulse = a.vulnerable && !a.limp ? rig.vulnerablePulseMax * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now / rig.vulnerablePulseMs))) : 0;
    const warn = pulse > 0 ? lerpRgb(0xffffff, 0xff5a28, pulse) : 0xffffff;
    const skinNow = a.flashBody ? a.flashColor : pulse > 0 ? lerpRgb(look.skin, 0xff5a28, pulse * 0.8) : look.skin;
    [this.gloveL, this.gloveR].forEach((glove, i) => {
      const side = i === 0 ? 1 : -1;
      const fist = fists[i];
      const sh = { x: f.x + tfx * k + tlx * rig.shoulderSpread * k * side, y: f.y + tfy * k + tly * rig.shoulderSpread * k * side + v.bodyOffsetY };
      const registration=gloveRegistration(f.char,glove.width,glove.height,k);
      const striking = f.punch?.hand === i;
      const straight = striking && (f.punch!.type === 'jab' || f.punch!.type === 'cross') ? punchExtension(f.punch!) : 0;
      const minSegment = striking && f.punch!.type === 'hook' ? Math.max(9 * k, Math.hypot(fist.x - sh.x, fist.y - sh.y) * rig.hookElbowRatio) : 9 * k;
      const { elbow, wrist } = armPose(sh, fist, registration.cuff, minSegment, { x: lx * side, y: ly * side }, straight);
      if (!striking || f.punch!.type !== 'uppercut' || uppercutFireIntensity(f.punch!) < 0.2) {
        limb(this.arms, sh, elbow, wrist, 6 * k, skinNow, alpha);
      }
      const dx = fist.x - elbow.x;
      const dy = fist.y - elbow.y;
      glove
        .setPosition(fist.x, fist.y)
        .setRotation(Math.atan2(dy, dx) + registration.axis)
        .setScale(registration.scale)
        .setAlpha(alpha)
        .setVisible(true)
        // High Guard: the gloves come up over the head.
        .setDepth(a.guarding ? 10.25 : 10.1);
    });

    if (f.punch?.type === 'uppercut' && !a.limp) {
      const p = f.punch;
      const intensity = uppercutFireIntensity(p);
      const side = p.hand === 0 ? 1 : -1;
      this.uppercutFlame(P(k, rig.shoulderSpread * k * side, v.bodyOffsetY), fists[p.hand], intensity, now, k);
    }

    // ---- tints: head and torso flash separately when hit ----
    const head = a.flashHead;
    const body = a.flashBody;
    const tintOf = (o: Phaser.GameObjects.Image, flash: boolean) => {
      if (flash) o.setTintFill(a.flashColor);
      else if (pulse > 0) o.setTint(warn);
      else o.clearTint();
    };
    tintOf(this.head, head);
    tintOf(this.ponytail, head);
    this.twinTails.forEach(t=>tintOf(t,head));
    tintOf(this.torso, body);
    for (const o of [this.gloveL, this.gloveR, this.bootL, this.bootR]) tintOf(o, false);

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
      g.head.setPosition(past.x + fx * rig.headForward * k, past.y + v.headOffsetY - v.bodyOffsetY + fy * rig.headForward * k).setRotation(past.rot).setScale(hscale).setAlpha(ga);
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
        this.fx.fillCircle(x, y, rig.sweatRadius * k * (1 - 0.4 * t));
        this.fx.fillStyle(0xffffff, al * 0.8);
        this.fx.fillCircle(x - 0.5, y - 0.6, rig.sweatHighlightRadius * k);
      }
    }
    return true;
  }

  private uppercutFlame(root: Pt, fist: Pt, intensity: number, now: number, k: number): void {
    if (intensity <= 0) return;
    const rig = tune.view.puppet;
    const len = Math.hypot(fist.x - root.x, fist.y - root.y) || 1;
    const dx = (fist.x - root.x) / len, dy = (fist.y - root.y) / len;
    const flicker = 1 + 0.12 * Math.sin(now * rig.uppercutFireFlickerHz * Math.PI * 2 / 1000);
    const width = rig.uppercutFireWidth * k * intensity * flicker;
    const length = rig.uppercutFireLength * k * intensity;
    const point = (u: number, v: number): Pt => ({ x: fist.x + dx * u - dy * v, y: fist.y + dy * u + dx * v });
    const shape = (scale: number): Phaser.Math.Vector2[] => {
      const outline = [
      { x: root.x + (fist.x - root.x) * (1 - scale), y: root.y + (fist.y - root.y) * (1 - scale) },
      point(-8 * k, width * 0.75 * scale), point(length * 0.55 * scale, width * scale),
      point(4 * k, width * 0.35 * scale), point(length * scale, width * 0.1 * scale),
      point(5 * k, -width * 0.35 * scale), point(length * 0.45 * scale, -width * 0.85 * scale),
      point(-8 * k, -width * 0.7 * scale),
      ];
      const curve = new Phaser.Curves.Spline([...outline, outline[0]].map(p => new Phaser.Math.Vector2(p.x, p.y)));
      return curve.getPoints(48);
    };
    const outer = shape(1);
    this.fx.fillStyle(0xff5424, Math.min(1, intensity * 2));
    this.fx.fillPoints(outer, true);
    this.fx.lineStyle(1.5 * k, NAVY, intensity);
    this.fx.strokePoints(outer, true, true);
    this.fx.fillStyle(0xffc83a, intensity);
    this.fx.fillPoints(shape(0.72), true);
    this.fx.fillStyle(0xfff4ce, intensity);
    this.fx.fillPoints(shape(0.4), true);
    for (let i = 0; i < 3; i++) {
      const t = (now * rig.uppercutFireFlickerHz / 1000 + i / 3) % 1;
      const ember = point(length * (0.6 + t), width * (i - 1) * 0.55);
      this.fx.fillStyle(i === 1 ? 0xfff4ce : 0xffb52a, intensity * (1 - t));
      this.fx.fillCircle(ember.x, ember.y, (1.5 + i % 2) * k);
    }
  }

}
