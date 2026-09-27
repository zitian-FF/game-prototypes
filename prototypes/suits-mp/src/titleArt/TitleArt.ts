import Phaser from 'phaser';
import tune from '../../tune.json';

const W = 390;
const H = 844;
const TAU = Math.PI * 2;

// Title composition is assembled from independent layers. Only the deep
// sky/mineral floor is baked; the celestial bodies and sigil are separate.
export class TitleArt {
  private readonly farStars: Phaser.GameObjects.Graphics;
  private readonly nearDust: Phaser.GameObjects.Graphics;
  private readonly sigil: Phaser.GameObjects.Graphics;
  private readonly blue: Phaser.GameObjects.Image;
  private readonly violet: Phaser.GameObjects.Image;
  private readonly ochre: Phaser.GameObjects.Image;
  private readonly floorGlints: Phaser.GameObjects.Graphics;
  private elapsed = 0;

  constructor(scene: Phaser.Scene) {
    scene.add.image(W / 2, H / 2, 'title_cosmos_backdrop_v2').setDisplaySize(W, H);

    this.farStars = scene.add.graphics();
    this.drawParticles(this.farStars, 48, 0xbed3dc, 0.08, 0.65);

    this.sigil = scene.add.graphics({ x: W / 2, y: 171 });
    this.drawSigil();

    this.blue = scene.add.image(54, 132, 'title_celestial_moon').setDisplaySize(93, 93).setAlpha(0.8);
    this.violet = scene.add.image(341, 116, 'title_planet_amethyst').setDisplaySize(72, 72).setAlpha(0.68);
    this.ochre = scene.add.image(318, 266, 'title_planet_ochre').setDisplaySize(48, 48).setAlpha(0.55);

    this.nearDust = scene.add.graphics();
    this.drawParticles(this.nearDust, 34, 0xd2d0c0, 0.13, 1.1);

    this.floorGlints = scene.add.graphics();
    this.floorGlints.lineStyle(1, 0xb4cbd1, 0.28);
    this.floorGlints.lineBetween(72, 758, 91, 757);
    this.floorGlints.lineBetween(268, 786, 295, 785);
    this.floorGlints.lineBetween(149, 815, 162, 814);
  }

  private drawParticles(graphics: Phaser.GameObjects.Graphics, count: number, color: number, alpha: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      const x = (i * 137.508 + 17) % W;
      const y = (i * 251.17 + 29) % 760;
      graphics.fillStyle(color, alpha * (0.6 + (i % 4) * 0.16));
      graphics.fillCircle(x, y, i % 9 === 0 ? radius * 1.5 : radius);
    }
  }

  private drawSigil(): void {
    const g = this.sigil;
    g.lineStyle(0.8, 0xa9bac0, 0.23);
    g.strokeCircle(0, 0, 164);
    g.strokeCircle(0, 0, 151);
    g.lineStyle(0.65, 0xb2c1c5, 0.16);
    g.strokeCircle(0, 0, 119);
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12;
      const c = Math.cos(a), s = Math.sin(a);
      g.lineBetween(c * 151, s * 151, c * 164, s * 164);
      if (i % 3 === 0) g.lineBetween(c * 119, s * 119, c * 151, s * 151);
    }
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + Math.PI / 4;
      const x = Math.cos(a) * 139, y = Math.sin(a) * 139;
      g.strokePoints([
        { x, y: y - 5 }, { x: x + 4, y }, { x, y: y + 5 }, { x: x - 4, y },
      ], true);
    }
  }

  update(delta: number, reducedMotion: boolean): void {
    if (document.hidden) return;
    this.elapsed += Math.min(delta, 50);
    const t = this.elapsed;
    // Reduced motion preserves the layered scene at a gentler amplitude
    // instead of freezing the entire title into a still image.
    const motion = reducedMotion ? 0.45 : 1;
    this.sigil.rotation = t * TAU / tune.titleOrbitPeriodMs * motion;
    this.farStars.x = Math.sin(t * TAU / tune.titleFarStarsPeriodMs) * tune.titleFarStarsTravelPx * motion;
    this.nearDust.y = Math.sin(t * TAU / tune.titleDustPeriodMs) * tune.titleDustTravelPx * motion;
    this.blue.setPosition(
      54 + Math.sin(t * TAU / tune.titleBluePeriodMs) * tune.titleBlueTravelPx * motion,
      132 + Math.cos(t * TAU / tune.titleBluePeriodMs) * tune.titleBlueTravelPx * 0.35 * motion,
    );
    this.violet.setPosition(
      341 + Math.sin(t * TAU / tune.titleVioletPeriodMs + 1) * tune.titleVioletTravelPx * motion,
      116 + Math.cos(t * TAU / tune.titleVioletPeriodMs + 1) * tune.titleVioletTravelPx * 0.5 * motion,
    );
    this.ochre.setPosition(
      318 + Math.sin(t * TAU / tune.titleOchrePeriodMs + 2) * tune.titleOchreTravelPx * motion,
      266 + Math.cos(t * TAU / tune.titleOchrePeriodMs + 2) * tune.titleOchreTravelPx * 0.45 * motion,
    );
    this.floorGlints.alpha = reducedMotion ? 0.3 : 0.25 + (Math.sin(t * TAU / tune.titleGlintPeriodMs) + 1) * 0.26;
  }
}
