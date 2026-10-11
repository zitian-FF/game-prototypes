import Phaser from 'phaser';
import type { Tune } from '../tune';

// Small puppet rig, a trimmed copy of the idea in prototypes/punchies/src/
// render/puppet.ts (kept separate on purpose, see BRIEF.md). Head, torso,
// gloves and boots are loose art parts; arms and legs are two-segment limbs
// drawn in code. All math is in the rig's own space, facing right (+x), and
// the root container is rotated to face the lane. +v is the boxer's left.
// Without art, ensureParts() generates coloured placeholder textures with the
// same names and sizes, so this code path is the same either way.

type Pt = { x: number; y: number };
const NAVY = 0x101b32;

export const LOOKS = {
  marco: { skin: 0xf0a060, headOrigin: 0.49, fill: 0x3a78d0 },
  zombie: { skin: 0x9dbc61, headOrigin: 0.49, fill: 0x6f9a4a },
} as const;
export type Char = keyof typeof LOOKS;

const PART_SIZE: Record<string, [number, number]> = { head: [126, 120], torso: [100, 128], glove_right: [81, 96], boot_right: [84, 41] };

// Generates any missing part texture as a plain coloured shape.
export function ensureParts(scene: Phaser.Scene): void {
  for (const char of Object.keys(LOOKS) as Char[]) {
    for (const [part, [w, h]] of Object.entries(PART_SIZE)) {
      const key = `part_${char}_${part}`;
      if (scene.textures.exists(key)) continue;
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(part === 'glove_right' ? 0xfff1d1 : LOOKS[char].fill, 1);
      g.lineStyle(4, NAVY, 1);
      if (part === 'head') { g.fillCircle(w / 2, h / 2, h / 2 - 3); g.strokeCircle(w / 2, h / 2, h / 2 - 3); }
      else { g.fillRoundedRect(2, 2, w - 4, h - 4, 14); g.strokeRoundedRect(2, 2, w - 4, h - 4, 14); }
      g.generateTexture(key, w, h);
      g.destroy();
    }
  }
}

// Elbow (or knee) of a two-segment limb from s to w, bent toward `outward`.
function joint(s: Pt, w: Pt, minSeg: number, outward: Pt): Pt {
  const dx = w.x - s.x, dy = w.y - s.y;
  const d = Math.hypot(dx, dy) || 1e-3;
  const seg = Math.max(minSeg, (d / 2) * 1.02);
  const h = Math.sqrt(Math.max(0, seg * seg - (d / 2) * (d / 2)));
  let nx = -dy / d, ny = dx / d;
  if (nx * outward.x + ny * outward.y < 0) { nx = -nx; ny = -ny; }
  return { x: (s.x + w.x) / 2 + nx * h, y: (s.y + w.y) / 2 + ny * h };
}

function limb(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, c: Pt, width: number, skin: number): void {
  const pass = (w: number, color: number) => {
    g.lineStyle(w, color, 1);
    g.lineBetween(a.x, a.y, b.x, b.y);
    g.lineBetween(b.x, b.y, c.x, c.y);
    g.fillStyle(color, 1);
    for (const p of [a, b, c]) g.fillCircle(p.x, p.y, w / 2);
  };
  pass(width + 3, NAVY);
  pass(width, skin);
}

export interface RigPose {
  time: number; // ms, drives breathing and the gait
  stride: number; // 0..1, how much the boxer is walking
  hand: 0 | 1 | null; // punching hand: 0 left, 1 right
  ext: number; // punch extension, 0 guard to 1 full (negative pulls back)
  reach: number; // fist travel at full extension (rig units)
  raise: number; // 0..1, non-punching fists pushed forward and in (zombie arms)
  limp: boolean;
  hurt: number; // 0..1 hit reaction
}

export class Rig {
  readonly root: Phaser.GameObjects.Container;
  private readonly look: (typeof LOOKS)[Char];
  private legs: Phaser.GameObjects.Graphics;
  private arms: Phaser.GameObjects.Graphics;
  private bootL: Phaser.GameObjects.Image;
  private bootR: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private gloveL: Phaser.GameObjects.Image;
  private gloveR: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private flashUntil = 0;
  private flashColor = 0xffffff;

  constructor(scene: Phaser.Scene, char: Char, private readonly tune: Tune) {
    this.look = LOOKS[char];
    const img = (part: string) => scene.add.image(0, 0, `part_${char}_${part}`);
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.18);
    shadow.fillCircle(0, 0, (tune.view.rig.torsoHeight * tune.view.rig.scale) / 2.2);
    this.legs = scene.add.graphics();
    this.arms = scene.add.graphics();
    this.bootL = img('boot_right').setFlipY(true);
    this.bootR = img('boot_right');
    this.torso = img('torso');
    this.gloveL = img('glove_right').setFlipX(true);
    this.gloveR = img('glove_right');
    this.head = img('head').setOrigin(this.look.headOrigin, 0.5);
    this.root = scene.add.container(0, 0, [shadow, this.legs, this.bootL, this.bootR, this.arms, this.torso, this.gloveL, this.gloveR, this.head]);
  }

  flash(color: number, now: number, ms: number): void {
    this.flashColor = color;
    this.flashUntil = now + ms;
  }

  update(p: RigPose, now: number): void {
    const r = this.tune.view.rig;
    const k = r.scale;
    const P = (u: number, v: number): Pt => ({ x: u * k, y: -v * k });
    const flashing = now < this.flashUntil && Math.floor(now / 50) % 2 === 0;
    const skin = flashing ? this.flashColor : this.look.skin;
    const breathe = p.limp ? 0 : Math.sin(p.time / 520);
    const snap = 5 * p.hurt;

    this.legs.clear();
    this.arms.clear();

    // Feet: the two boots alternate while walking, settle into a stance at rest.
    const phase = (p.time / 1000) * r.walkHz * Math.PI * 2;
    const mid = (r.leadBootForward + r.rearBootForward) / 2;
    const boots = [this.bootL, this.bootR];
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const ph = phase + (i === 0 ? 0 : Math.PI);
      const rest = i === 0 ? r.leadBootForward : r.rearBootForward;
      const lift = Math.max(0, Math.cos(ph)) * p.stride;
      const pos = P(rest + (mid - rest) * p.stride + Math.sin(ph) * r.strideAmp * p.stride, r.bootSpread * side);
      boots[i].setPosition(pos.x, pos.y).setScale(((r.bootWidth * k) / boots[i].width) * (1 + 0.14 * lift));
      const hip = P(-2, r.hipSpread * side);
      const ankle = { x: pos.x - r.bootWidth * k * 0.2, y: pos.y };
      const knee = joint(hip, ankle, Math.hypot(ankle.x - hip.x, ankle.y - hip.y) * 0.51, { x: 0, y: -side });
      limb(this.legs, hip, knee, ankle, 5.5 * k, skin);
    }

    // Torso twists the punching shoulder forward, the head follows part way.
    const twist = p.hand !== null && !p.limp ? (p.hand === 0 ? 1 : -1) * ((r.torsoTwistDeg * Math.PI) / 180) * Math.max(0, p.ext) : 0;
    const tpos = P(-snap * 0.5, 0);
    this.torso.setPosition(tpos.x, tpos.y).setRotation(twist).setScale(((r.torsoHeight * k) / this.torso.height) * (1 + 0.012 * breathe));
    const hpos = P(r.headForward - snap, 0);
    hpos.y += p.limp ? 2 : 0.4 * breathe;
    this.head
      .setPosition(hpos.x, hpos.y)
      .setRotation(twist * 0.4 + (p.hurt > 0 ? 0.18 * p.hurt : Math.sin(p.time / 900) * 0.03))
      .setScale((r.headHeight * k) / this.head.height);

    // Arms: shoulder to fist with the elbow bent outward.
    const tf = { x: Math.cos(twist), y: Math.sin(twist) };
    const tl = { x: tf.y, y: -tf.x };
    [this.gloveL, this.gloveR].forEach((glove, i) => {
      const side = i === 0 ? 1 : -1;
      const sh = { x: (tf.x + tl.x * r.shoulderSpread * side) * k, y: (tf.y + tl.y * r.shoulderSpread * side) * k };
      const striking = p.hand === i;
      let fist: Pt;
      if (p.limp) fist = P(4, 17 * side);
      else if (striking) fist = P(r.guardU + (p.reach - r.guardU) * p.ext, (r.guardV + (2 - r.guardV) * Math.max(0, p.ext)) * side);
      else fist = P(r.guardU + 8 * p.raise + Math.sin(p.time / 300 + i) * 0.6, (r.guardV - 3 * p.raise) * side);
      const h = r.gloveHeight * k;
      const cuff = h * 0.4;
      const straight = striking ? Math.max(0, Math.min(1, p.ext)) : 0;
      const dx = fist.x - sh.x, dy = fist.y - sh.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const seg = Math.max(9 * k, dist * 0.51);
      const bend = Math.sqrt(Math.max(0, seg * seg - (dist * dist) / 4)) * (1 - straight);
      const out = { x: 0, y: -side };
      const sign = -dy * out.x + dx * out.y < 0 ? -1 : 1;
      const elbow = { x: (sh.x + fist.x) / 2 - (dy / dist) * bend * sign, y: (sh.y + fist.y) / 2 + (dx / dist) * bend * sign };
      const fa = Math.hypot(fist.x - elbow.x, fist.y - elbow.y) || 1;
      const wrist = { x: fist.x - ((fist.x - elbow.x) / fa) * cuff, y: fist.y - ((fist.y - elbow.y) / fa) * cuff };
      limb(this.arms, sh, elbow, wrist, 6 * k, skin);
      glove.setPosition(fist.x, fist.y).setRotation(Math.atan2(fist.y - elbow.y, fist.x - elbow.x) + Math.PI / 2).setScale(h / glove.height);
    });

    for (const o of [this.head, this.torso, this.gloveL, this.gloveR, this.bootL, this.bootR]) {
      if (flashing) o.setTintFill(this.flashColor);
      else o.clearTint();
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}
