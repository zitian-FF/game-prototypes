import { awardMatch } from '../progress/progress';
import { startScreen } from '../ui/presentation';
import { t } from '../i18n';
import { track } from '../portal/analytics';
import { setGameplay } from '../portal/gameplay';
import Phaser from 'phaser';
import { applyCameraPixelRatio, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { newSeries, finishRound, type SeriesState } from '../sim/series';
import { roundSplash, matchResult } from '../ui/matchPresentation';
import { tune } from '../sim/tune';
import { fighterGroups, whenGroupsReady } from '../render/art';
import { charName } from '../sim/character';
import { createSimState, step } from '../sim/sim';
import { makeBot, type Bot, type BotLevel } from '../sim/bot';
import { TICK_RATE } from '../sim/tune';
import type { SimState } from '../sim/types';

// Single player: a full timed round against the easy AI.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;

export class VsAIScene extends Phaser.Scene {
  private sim!: SimState;
  private stage!: FightStage;
  private ai!: Bot;
  private level: BotLevel = 'easy';
  private acc = 0;
  private over = false;
  private series!: SeriesState;


  constructor() {
    super('VsAI');
  }

  private skins:[string,string]=['default','default'];
  private chars: [string, string] = ['marco', 'marco'];

  create(data: { chars?: [string, string]; skins?:[string,string]; level?: BotLevel; series?: SeriesState }): void {
    this.series = data?.series ?? newSeries(tune.match.bestOf);

    this.skins=data?.skins??['default','default'];
    this.chars = data?.chars ?? this.chars;
    this.level = data?.level ?? this.level;
    applyCameraPixelRatio(this);
    this.built = false;
    whenGroupsReady(this, fighterGroups(this.chars), () => this.build());
  }

  private built = false;

  private build(): void {
    this.built = true;
    this.acc = 0;
    this.over = false;
    this.sim = createSimState({ timed: true, showcase: this.series.roundNumber === 1, fighters: [{ char: this.chars[0] }, { char: this.chars[1] }] });
    this.ai = makeBot(this.level, 1);
    this.stage = new FightStage(this, [t('match.you_name', { name: charName(this.chars[0]) }), t('match.cpu_name', { level: t(`level.${this.level}`), name: charName(this.chars[1]) })], 0,true,this.skins);
    this.stage.setSeries(this.series);

    addVersionStamp(this);
  }

  update(time: number, delta: number): void {
    if (!this.built) return;
    this.stage.pollDevices();
    if (!this.over) {
      this.acc = Math.min(this.acc + delta, STEP_MS * MAX_STEPS_PER_FRAME);
      while (this.acc >= STEP_MS) {
        this.acc -= STEP_MS;
        const events = step(this.sim, [this.stage.sampleLocal(), this.ai.think(this.sim)]);
        this.stage.handleEvents(events, this.sim);
      }
      if (this.sim.result && this.stage.koFinished(this.sim, time)) this.showResult();
    }
    this.stage.draw(this.sim, time);
  }

  private showResult(): void {
    setGameplay(false);
    this.over = true;
    this.acc = 0;
    const r = this.sim.result!;
    const outcome = finishRound(this.series, r.winner);
    this.stage.setSeries(outcome.series);
    if (!outcome.complete) {
      roundSplash(this, () => this.scene.restart({ chars: this.chars,skins:this.skins, level: this.level, series: outcome.series }));
      return;
    }
    track('match', 'VsAI', r.winner === null ? 'draw' : r.winner === 0 ? 'win' : 'lose', { level: this.level, char: this.chars[0] });
    this.registry.set('lastAward', awardMatch({ kind: 'vsai', win: r.winner === 0, botLevel: this.level }));
    matchResult(this, r.winner === null ? t('common.draw') : r.winner === 0 ? t('common.victory') : t('common.defeat'), {
      rematch: () => this.scene.restart({ chars: this.chars, skins:this.skins, level: this.level }),
      changeBoxer: () => startScreen(this, 'CharSelect', { mode: 'vsai' }),
      menu: () => startScreen(this, 'Menu'),
    }, outcome.series.wins, r.winner===null?undefined:{char:this.chars[r.winner],skin:this.skins[r.winner]}, r.winner===null?'draw':r.winner===0?'victory':'defeat');
  }
}
