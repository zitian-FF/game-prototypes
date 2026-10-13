import {CodeXShadows} from './codeXShadows';
import {CombatSymbols} from './combatSymbols';
import {CombatText} from './combatText';
import {CombatSparks} from './combatVfx';
import Phaser from 'phaser';
import { t } from '../i18n';
import type { Fighter, SimEvent, SimState } from '../sim/types';
import { sfx } from '../audio/sfx';
import { PIXEL_RATIO, VIEW } from './pixelRatio';
import { tune, TICK_RATE } from '../sim/tune';
import { fightCueTiming } from '../sim/fightCue';
import { fightWord } from '../ui/fightPresentation';

// Turns sim events into visual and audio feedback: sweet sparks, counter
// flash, block/perfect-guard rings, callout labels. Presentation only.
export class Effects {
  roundNumber = 1;
  private fightCue:ReturnType<typeof fightWord>|null=null;
  private fightCueTick=0;
  codeXSources:(()=>readonly Fighter[])|null=null;
  draw(s:SimState):void {this.fightCue?.draw((s.tick-this.fightCueTick)*1000/TICK_RATE);this.codeXShadows.draw(this.codeXSources?.()??s.fighters,!!s.result);}
  private sparks: CombatSparks;
  private combatText:CombatText;
  private symbols:CombatSymbols;
  private codeXShadows:CodeXShadows;
  private flashRect: Phaser.GameObjects.Rectangle;
  private vignette: Phaser.GameObjects.Graphics;
  // Set by FightStage: flash a fighter's body (hit feedback on the boxer).
  // zone: 'head' for a hit that reached the face (vulnerable row), 'body' for arms/torso.
  onFighterFlash: (idx: number, color: number, zone: 'head' | 'body') => void = () => {};

  constructor(private scene: Phaser.Scene) {
    scene.events.once('shutdown',()=>{this.fightCue?.();this.fightCue=null;});
    this.sparks=new CombatSparks(scene);
    this.symbols=new CombatSymbols(scene);
    this.codeXShadows=new CodeXShadows(scene);
    this.combatText=new CombatText(scene);
    this.flashRect = scene.add
      .rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0xffffff, 0)
      .setDepth(80);
    // Red edge glow when you take a hit.
    this.vignette = scene.add.graphics().setDepth(81).setAlpha(0);
    for (let i = 0; i < 6; i++) {
      this.vignette.lineStyle(10, 0xff2a2a, 0.35 - i * 0.05);
      this.vignette.strokeRect(VIEW.left + 5 + i * 9, VIEW.top + 5 + i * 9, VIEW.width - 10 - i * 18, VIEW.height - 10 - i * 18);
    }
  }

  // Delivering vs receiving is judged from the local player's side, so on
  // each phone "you hit" and "you got hit" read differently.
  private hit(e: Extract<SimEvent, { kind: 'hit' }>, s: SimState, localIdx: number): void {
    const att = s.fighters[e.attacker];
    // localIdx -1 (local two-player): no "me", every hit uses the landed style.
    const dealt = localIdx === -1 || e.attacker === localIdx;
    const defIdx = 1 - e.attacker;
    const cam = this.scene.cameras.main;
    const big = e.counter || e.punch === 'uppercut';

    if (e.damage <= 0) {
      this.puff(e.x, e.y);
      this.label(e.x, e.y - 22, 'absorbed', '#bbbbbb', 10);
      sfx.impact(e.punch, false, false);
      return;
    }

    // Directional spark along the strike (attacker's facing).
    const size = (big ? 2 : 1.25) * (e.sweet ? 1 : .45);
    const palette = dealt ? [0xffffff, 0xfff27a, 0xffc83a] : [0xffd0b0, 0xff8a3a, 0xff3a2a];
    this.directionalSpark(e.x, e.y, att.fx, att.fy, size, palette, e.sweet ? (big ? 16 : 10) : 4);
    this.onFighterFlash(defIdx, dealt ? 0xffffff : 0xff4a4a, e.row === 'vulnerable' ? 'head' : 'body');
    const def = s.fighters[defIdx];
    this.damageNumber(def.x, def.y - 34, e.damage, dealt ? '#fff27a' : '#ff5a5a', big);

    sfx.impact(e.punch, e.sweet, e.row === 'vulnerable');
    if (e.counter) sfx.counter();
    if (dealt) {
      cam.shake(big ? 150 : 70, (big ? 0.009 : 0.003) * tune.view.cameraShakeScale);
      if (e.counter) {
        this.shakyLabel(e.x, e.y - 34, t('fx.counter'), '#ffe03a', 22);
        this.screenFlash(0xffffff, 0.3);
      }
    } else {
      cam.shake(big ? 220 : 120, (big ? 0.014 : 0.007) * tune.view.cameraShakeScale);
      this.redEdges(big ? 0.9 : 0.55);
      try {
        navigator.vibrate?.(big ? [60, 40, 60] : 35);
      } catch {
        /* vibration unsupported */
      }
      if (e.counter) {
        this.shakyLabel(e.x, e.y - 34, t('fx.punished'), '#ff3a3a', 22);
      }
    }
    if (e.buffed) this.label(e.x, e.y - 48, t('fx.power'), '#ff9a3a', 13);
    if (e.punch === 'uppercut') this.shakyLabel(e.x, e.y - 52, t('fx.uppercut'), '#ffc83a', 18);
  }

  // Shared pooled world-space burst; receives the existing strike direction/intensity.
  private directionalSpark(x:number,y:number,dx:number,dy:number,size:number,palette:number[],streaks:number):void {
    this.sparks.burst(x,y,dx,dy,size,palette,streaks);
  }

  // Big and bold: pops in above the defender's head, holds, then floats
  // off. Consecutive numbers step sideways so rapid hits don't stack.
  private dmgSlot = 0;
  private damageNumber(x: number, y: number, dmg: number, color: string, big: boolean): void {
    this.dmgSlot = (this.dmgSlot + 1) % 3;
    this.combatText.show('damage',x+(this.dmgSlot-1)*14,y,`${Math.round(dmg*10)/10}`,color,big?24:17);
  }
  private shakyLabel(x:number,y:number,text:string,color:string,size:number):void {
    this.combatText.show('shaky',x,y,text,color,size);
  }
  private redEdges(strength: number): void {
    this.vignette.setAlpha(strength);
    this.scene.tweens.add({ targets: this.vignette, alpha: 0, duration: 380 });
  }

  handle(events: SimEvent[], s: SimState, localIdx: number): void {
    const exhausted = localIdx >= 0 ? s.fighters[localIdx].exhausted : null;
    if (exhausted !== null && this.wasExhausted !== null && exhausted !== this.wasExhausted && !s.result) {
      if (exhausted) sfx.emergency(); else sfx.recovered();
    }
    this.wasExhausted = exhausted;
    for (const e of events) {
      switch (e.kind) {
        case 'staminaRejected':
          if (localIdx === -1 || e.fighter === localIdx) sfx.denied();
          break;
        case 'throw': {
          sfx.swing(e.punch);
          // Subtle cue that this punch type is fatigued (slower, weaker).
          if (e.tired) {
            const f = s.fighters[e.attacker];
            this.subtle(f.x, f.y + 26, 'tired');
          }
          break;
        }
        case 'sweetImpact':
          this.symbols.sweet(e.x,e.y);
          break;
        case 'superChargeLost': {
          const f=s.fighters[e.fighter];
          if(f)this.symbols.chargeLost(f.x-f.fx*38,f.y-f.fy*38);
          break;
        }
        case 'hit':
          this.hit(e, s, localIdx);
          break;
        case 'block':
          this.label(e.x, e.y - 22, e.chip > 0 ? t('fx.chip', { n: e.chip.toFixed(1) }) : t('fx.block'), e.chip > 0 ? '#ffb03a' : '#3ad0c0', 11);
          sfx.block(e.sweet);
          break;
        case 'perfectGuard':
          this.screenFlash(0xffffff, 0.25);
          this.label(e.x, e.y - 28, t('common.perfect_guard'), '#ffffff', 14);
          sfx.perfectGuard();
          break;
        case 'dodged':
          this.label(e.x, e.y - 20, 'dodged', '#b89aff', 11);
          sfx.evade();
          break;
        case 'whiff':
          // Existing recovery/audio stay in the sim; no floating miss label.
          break;
        case 'stunned': {
          const f = s.fighters[e.fighter];
          this.label(f.x, f.y - 36, t('fx.stunned'), '#ffe03a', 16);
          sfx.stun();
          break;
        }
        case 'starsReady':
          if (e.fighter === localIdx) sfx.starsReady();
          break;
        case 'ready':
          this.banner(t('fx.round', { n: this.roundNumber }), Math.max(0.3, tune.match.introSec - (fightCueTiming().entranceMs+tune.view.fightPresentation.fadeMs)/1000), '#fff1d1', false, tune.view.fightPresentation.fadeMs);
          sfx.ready();
          break;
        case 'fightCue':
          this.fightCue?.();this.fightCueTick=s.fightStartTick-fightCueTiming().entranceTicks;
          this.fightCue=fightWord(this.scene);this.draw(s);
          break;
        case 'go':
          sfx.roundBell();
          break;
        case 'ko':
          // Confirmed knockout presentation is started by FightStage.draw.
          break;
        case 'timeUp':
          this.banner(e.winner === null ? t('common.draw') : t('fx.time'));
          sfx.timeUp();
          break;
      }
    }
  }

  private wasExhausted: boolean | null = null;

  private spark(x: number, y: number, color: number, size: number): void {
    const g = this.scene.add.graphics().setDepth(60);
    g.lineStyle(3, color, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.lineBetween(Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3, Math.cos(a) * size, Math.sin(a) * size);
    }
    g.setPosition(x, y);
    this.scene.tweens.add({ targets: g, scale: 1.8, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  private subtle(x: number, y: number, text: string): void {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '9px', color: '#9a9aa0', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setAlpha(0.8)
      .setDepth(69);
    this.scene.tweens.add({ targets: t, y: y + 6, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }

  private puff(x: number, y: number): void {
    const c = this.scene.add.circle(x, y, 7, 0xbbbbbb, 0.7).setDepth(60);
    this.scene.tweens.add({ targets: c, scale: 1.8, alpha: 0, duration: 180, onComplete: () => c.destroy() });
  }

  private screenFlash(color: number, alpha: number): void {
    this.flashRect.setFillStyle(color, alpha);
    this.scene.tweens.add({ targets: this.flashRect, fillAlpha: 0, duration: 160 });
  }

  private label(x: number, y: number, text: string, color: string, size: number): void {
    this.combatText.show('label',x,y,text,color,size);
  }
  private banner(text: string, holdSec = 1.2, color = '#ffffff', punch = false, fadeMs = 250): void {
    const t = this.scene.add
      .text(VIEW.cx, VIEW.cy - 20, text, {
        fontFamily: 'monospace',
        fontSize: '56px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 6,
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(95);
    if (punch) {
      t.setScale(1.8);
      this.scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    }
    this.scene.tweens.add({ targets: t, alpha: 0, delay: holdSec * 1000, duration: fadeMs, onComplete: () => t.destroy() });
  }

}
