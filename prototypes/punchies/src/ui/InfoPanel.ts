import Phaser from 'phaser';
import { tune } from '../sim/tune';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';

// "i" button: toggles the hitbox overlay on the fighters plus a compact
// hit/hurt box reference table. Does not pause the game. Built from the live
// tune values each time it opens.

const PUNCHES = ['jab', 'cross', 'hook', 'uppercut'] as const;

export class InfoPanel {
  open = false;
  private panel: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Text;
  private bg: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const bx = VIEW.left + 22;
    const by = VIEW.top + 64;
    const btn = scene.add.circle(bx, by, 13, 0x222222, 0.9).setStrokeStyle(2, 0xaaaaaa).setDepth(120);
    scene.add
      .text(bx, by, 'i', { fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(121);
    btn.setInteractive().on('pointerdown', () => this.toggle());

    const x = VIEW.left + 40;
    const y = VIEW.top + 52;
    this.bg = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.8).setOrigin(0).setStrokeStyle(1, 0x666666);
    this.body = scene.add.text(8, 6, '', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#dddddd',
      lineSpacing: 1,
      resolution: PIXEL_RATIO,
    });
    this.panel = scene.add.container(x, y, [this.bg, this.body]).setDepth(119).setVisible(false);
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) this.refresh();
    this.panel.setVisible(this.open);
  }

  private refresh(): void {
    const rows = PUNCHES.map((k) => {
      const p = tune.punches[k];
      const dmg = k === 'uppercut' ? tune.punches.cross.damage * tune.punches.uppercut.crossDamageMult : tune.punches[k].damage;
      return `${k.padEnd(8)}${String(p.startup).padStart(3)}${String(p.sourEarly).padStart(3)}${String(p.sweet).padStart(3)}${String(p.sour).padStart(3)}${String(p.recovery).padStart(4)}${('+' + p.whiffRecovery).padStart(4)}${String(p.reach).padStart(4)}${String(dmg).padStart(4)}`;
    });
    const red = Math.round(tune.hit.reducedDamageMult * 100);
    const chip = Math.round(tune.punches.hook.guardChipMult * 100);
    this.body.setText(
      [
        'HITBOXES (overlay on)',
        ' green ring  hurtbox (grows when Vulnerable)',
        ' blue circle core = FACE',
        ' fist: grey startup  orange sour  yellow sweet',
        '',
        'FRAMES  st  es  sw  so rec whf rch dmg',
        ...rows,
        ' es=early sour (fist extending) so=late sour',
        '',
        'HIT TABLE            sweet      sour',
        ` face / Vulnerable   full       ${red}%`,
        ` body (outer ring)   ${red}%        absorbed`,
        ' High Guard          0 dmg      0 dmg',
        `   Hook on guard     chip ${chip}% of the hit`,
        ' Perfect Guard       attacker stunned',
        ' Uppercut            unblockable, dodgeable',
        '',
        'VULNERABLE: punch startup + recovery (incl.',
        ' whiff), dodge tail, stunned, 0 stamina',
      ].join('\n'),
    );
    this.bg.setSize(this.body.width + 16, this.body.height + 12);
  }
}
