import Phaser from 'phaser';
import { tune } from '../sim/tune';
import type { Fighter } from '../sim/types';
import { hurtRadius, isVulnerable, phaseOf, punchPoint, stanceOf } from '../sim/sim';

// Placeholder top-down boxer: body circle, two fists, state tints. Reads sim
// state only; never writes it.

const BODY_R = 17;
const FIST_R = 7;

export class FighterView {
  private g: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private color: number,
  ) {
    this.g = scene.add.graphics().setDepth(10);
  }

  draw(f: Fighter, now: number, showHitboxes: boolean): void {
    const g = this.g;
    g.clear();
    const stance = stanceOf(f);
    const lx = f.fy;
    const ly = -f.fx;
    const alpha = stance === 'dodging' ? 0.35 : 1;

    // Shadow + vulnerable halo
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(f.x + 3, f.y + 5, BODY_R * 2.3, BODY_R * 2);
    if (isVulnerable(f) && stance !== 'dodging') {
      g.lineStyle(2, 0xff4a3a, 0.35 + 0.2 * Math.sin(now / 60));
      g.strokeCircle(f.x, f.y, tune.body.vulnerableHurtRadius);
    }

    // Body
    g.fillStyle(this.color, alpha);
    g.fillCircle(f.x, f.y, BODY_R);
    g.fillStyle(0xf0c8a0, alpha);
    g.fillCircle(f.x - f.fx * 3, f.y - f.fy * 3, 9);

    // Fists
    const rest = (hand: 0 | 1) => {
      const side = hand === 0 ? 1 : -1;
      return { x: f.x + f.fx * 15 + lx * 12 * side, y: f.y + f.fy * 15 + ly * 12 * side };
    };
    let fists = [rest(0), rest(1)];
    const colors = [0xeeeeee, 0xeeeeee];
    if (f.guarding) {
      fists = [
        { x: f.x + f.fx * 20 + lx * 6, y: f.y + f.fy * 20 + ly * 6 },
        { x: f.x + f.fx * 20 - lx * 6, y: f.y + f.fy * 20 - ly * 6 },
      ];
      colors[0] = colors[1] = stance === 'perfectGuard' ? 0xffffff : 0x3ad0c0;
    }
    if (f.punch) {
      const p = f.punch;
      const phase = phaseOf(p);
      const activeEnd = p.startup + p.sweet + p.sour;
      let t: number;
      if (phase === 'startup') t = -0.15 * (p.frame / p.startup);
      else if (phase === 'recovery') t = 1 - (p.frame - activeEnd) / p.recovery;
      else t = 1;
      const from = rest(p.hand);
      const to = punchPoint(f, p);
      let x = from.x + (to.x - from.x) * t;
      let y = from.y + (to.y - from.y) * t;
      if (p.type === 'hook' || p.type === 'uppercut') {
        const side = p.hand === 0 ? 1 : -1;
        const bulge = Math.sin(Math.max(0, t) * Math.PI) * (p.type === 'hook' ? 14 : 6) * side;
        x += lx * bulge;
        y += ly * bulge;
      }
      fists[p.hand] = { x, y };
      colors[p.hand] =
        phase === 'sweet' ? 0xffe03a : phase === 'sour' ? 0xff8a3a : p.type === 'uppercut' ? 0xffc83a : 0xcccccc;
    }
    for (let i = 0; i < 2; i++) {
      g.fillStyle(colors[i], alpha);
      g.fillCircle(fists[i].x, fists[i].y, FIST_R);
      g.lineStyle(1, 0x000000, 0.5 * alpha);
      g.strokeCircle(fists[i].x, fists[i].y, FIST_R);
    }

    // Stun: orbiting stars
    if (f.stunTimer > 0) {
      g.fillStyle(0xffe03a, 1);
      for (let i = 0; i < 3; i++) {
        const a = now / 150 + (i * Math.PI * 2) / 3;
        g.fillCircle(f.x + Math.cos(a) * 20, f.y - 4 + Math.sin(a) * 8, 3);
      }
    }

    if (showHitboxes) this.drawHitboxes(f);
  }

  private drawHitboxes(f: Fighter): void {
    const g = this.g;
    g.lineStyle(1, 0x00ff88, 0.8);
    g.strokeCircle(f.x, f.y, hurtRadius(f));
    if (!isVulnerable(f)) {
      g.lineStyle(1, 0x00aaff, 0.9);
      g.strokeCircle(f.x, f.y, tune.body.coreRadius);
    }
    if (f.punch) {
      const phase = phaseOf(f.punch);
      const pt = punchPoint(f, f.punch);
      const c = phase === 'sweet' ? 0xffff00 : phase === 'sour' ? 0xff8800 : 0x888888;
      g.lineStyle(1, c, phase === 'startup' || phase === 'recovery' ? 0.4 : 1);
      g.strokeCircle(pt.x, pt.y, tune.punches[f.punch.type].hitRadius);
    }
  }
}
