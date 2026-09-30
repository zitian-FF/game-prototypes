import Phaser from 'phaser';
import { tune } from '../sim/tune';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';

// "i" button: full-screen reference overlay (frame data, hit table, hitbox
// legend, defense numbers) plus the hitbox overlay on the fighters. The game
// keeps running underneath; touch controls are disabled while it's open.
// Rebuilt from the live tune values each time it opens.

const PUNCHES = ['jab', 'cross', 'hook', 'uppercut'] as const;
const FONT = 'monospace';
const ROW_H = 15;

type Cell = string | { text: string; color?: string };

export class InfoPanel {
  open = false;
  // Hitbox overlay on the fighters; stays on after the panel closes.
  hitboxes = false;
  private layer: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene) {
    const bx = VIEW.left + 22;
    const by = VIEW.top + 64;
    const btn = scene.add.circle(bx, by, 13, 0x222222, 0.9).setStrokeStyle(2, 0xaaaaaa).setDepth(210);
    scene.add
      .text(bx, by, 'i', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(211);
    btn.setInteractive().on('pointerdown', () => this.toggle());
    this.layer = scene.add.container(0, 0).setDepth(200).setVisible(false);
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) this.build();
    this.layer.setVisible(this.open);
  }

  private text(x: number, y: number, s: string, size = 10, color = '#dddddd', bold = false): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, s, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      resolution: PIXEL_RATIO,
    });
    this.layer.add(t);
    return t;
  }

  // Draws a table with a header row and zebra stripes; returns its height.
  private table(x: number, y: number, title: string, widths: number[], header: string[], rows: Cell[][]): number {
    const g = this.scene.add.graphics();
    this.layer.add(g);
    this.text(x, y, title, 11, '#ffd24a', true);
    let cy = y + 16;
    const total = widths.reduce((a, b) => a + b, 0);
    g.fillStyle(0x3a4256, 1);
    g.fillRect(x, cy, total, ROW_H);
    let cx = x;
    header.forEach((h, i) => {
      this.text(cx + 4, cy + 2, h, 9, '#ffffff', true);
      cx += widths[i];
    });
    cy += ROW_H;
    rows.forEach((row, r) => {
      g.fillStyle(r % 2 ? 0x1c2029 : 0x252a35, 1);
      g.fillRect(x, cy, total, ROW_H);
      cx = x;
      row.forEach((cell, i) => {
        const c = typeof cell === 'string' ? { text: cell } : cell;
        this.text(cx + 4, cy + 2, c.text, 9, c.color ?? (i === 0 ? '#ffffff' : '#cfd3dc'), i === 0);
        cx += widths[i];
      });
      cy += ROW_H;
    });
    g.lineStyle(1, 0x5a6378, 1);
    g.strokeRect(x, y + 16, total, cy - y - 16);
    return cy - y;
  }

  private build(): void {
    this.layer.removeAll(true);
    const bg = this.scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x0b0d12, 0.93);
    this.layer.add(bg);

    const left = VIEW.left + 46;
    const top = VIEW.top + 10;
    this.text(left, top, 'PUNCHIES REFERENCE', 13, '#ffffff', true);
    this.text(left + 170, top + 2, '(game keeps running · tap i to close · values are live tune.json)', 9, '#8a90a0');
    const hbx = VIEW.right - 96;
    const hb = this.scene.add.rectangle(hbx, top + 8, 130, 22, 0x222a38, 1).setStrokeStyle(1, 0x7fb3ff).setInteractive();
    const hbLabel = this.text(hbx, top + 8, '', 10, '#ffffff', true).setOrigin(0.5);
    const refreshHb = () => hbLabel.setText(`HITBOXES: ${this.hitboxes ? 'ON' : 'OFF'}`);
    hb.on('pointerdown', () => {
      this.hitboxes = !this.hitboxes;
      refreshHb();
    });
    this.layer.add(hb);
    this.layer.bringToTop(hbLabel);
    refreshHb();

    // Frame data
    const red = Math.round(tune.hit.reducedDamageMult * 100);
    const frameRows: Cell[][] = PUNCHES.map((k) => {
      const p = tune.punches[k];
      const dmg = k === 'uppercut' ? tune.punches.cross.damage * tune.punches.uppercut.crossDamageMult : tune.punches[k].damage;
      const total = p.startup + p.sourEarly + p.sweet + p.sour + p.recovery;
      return [
        k.toUpperCase(),
        String(p.startup),
        { text: String(p.sourEarly), color: '#ff9a4a' },
        { text: String(p.sweet), color: '#ffe03a' },
        { text: String(p.sour), color: '#ff9a4a' },
        String(p.recovery),
        `+${p.whiffRecovery}`,
        String(total),
        String(p.reach),
        String(dmg),
        String(p.staminaCost),
      ];
    });
    let y = top + 22;
    y +=
      this.table(
        left,
        y,
        'FRAME DATA (frames @60fps)',
        [64, 44, 50, 42, 44, 44, 42, 38, 40, 34, 44],
        ['Punch', 'Start', 'E.sour', 'Sweet', 'L.sour', 'Recov', 'Whiff', 'Total', 'Reach', 'Dmg', 'Stam'],
        frameRows,
      ) + 10;

    // Hit table
    const chip = Math.round(tune.punches.hook.guardChipMult * 100);
    const green = '#7fe08a';
    const dim = '#8a90a0';
    this.table(
      left,
      y,
      'HIT TABLE (damage · stamina)',
      [150, 150, 186],
      ['Where it lands', 'Sweet', 'Sour'],
      [
        ['Face (core)', { text: 'FULL · def -stam', color: green }, `${red}% · def -stam`],
        ['Body (outer ring)', `${red}% · def -stam`, { text: 'absorbed · both -stam', color: dim }],
        ['Vulnerable (no guard)', { text: 'FULL · def -stam', color: green }, `${red}% · def -stam`],
        ['High Guard', { text: '0 · both -stam', color: dim }, { text: '0 · attacker -stam', color: dim }],
        ['High Guard vs HOOK', { text: `chip ${chip}% of full`, color: '#ffb03a' }, { text: `chip ${chip}% of ${red}%`, color: '#ffb03a' }],
        ['Perfect Guard', { text: 'attacker stunned, def +stam', color: '#9fd3ff' }, { text: 'same', color: '#9fd3ff' }],
        ['Uppercut', 'ignores guard', 'can only be dodged'],
      ],
    );

    // Right column: legend, vulnerable, defense numbers
    const rx = left + 496;
    let ry = top + 22;
    this.text(rx, ry, 'HITBOX LEGEND', 11, '#ffd24a', true);
    ry += 18;
    const g = this.scene.add.graphics();
    this.layer.add(g);
    const legend: [number, string][] = [
      [0x00ff88, 'Hurtbox (bigger when Vulnerable)'],
      [0x00aaff, 'Core = FACE'],
      [0x888888, 'Fist: startup'],
      [0xff8800, 'Fist: sour (early / late)'],
      [0xffff00, 'Fist: sweet'],
    ];
    for (const [c, label] of legend) {
      g.lineStyle(2, c, 1);
      g.strokeCircle(rx + 7, ry + 6, 5);
      this.text(rx + 18, ry, label, 9);
      ry += 14;
    }
    ry += 8;
    this.text(rx, ry, 'VULNERABLE WHEN', 11, '#ffd24a', true);
    ry += 16;
    for (const s of ['Punch startup + recovery', '(incl. whiff recovery)', 'Dodge tail + after dodge', 'Stunned', `Stamina hit 0, until ${tune.stamina.exhaustRecoverAt}`, `  (regen x${tune.stamina.exhaustedRegenMult})`]) {
      this.text(rx, ry, s, 9);
      ry += 12;
    }
    ry += 8;
    this.text(rx, ry, 'DEFENSE', 11, '#ffd24a', true);
    ry += 16;
    for (const s of [
      `Perfect Guard window: ${tune.guard.perfectFrames}f`,
      `  only if guard was down ${tune.guard.perfectCooldownFrames}f`,
      `Guard drain: ${tune.guard.staminaDrainPerSec}/s`,
      `Dodge: ${tune.dodge.iFrames}f invincible of ${tune.dodge.frames}f`,
      `  then ${tune.dodge.vulnerableFrames}f Vulnerable`,
      `Dodge then punch within ${tune.dodge.buffWindowFrames}f: x${tune.dodge.buffDamageMult} dmg`,
      `Counter (Cross/Hook on startup): x${tune.hit.counterDamageMult}`,
      `Round: ${tune.match.durationSec}s · HP ${tune.health.max}`,
    ]) {
      this.text(rx, ry, s, 9);
      ry += 12;
    }
  }
}
