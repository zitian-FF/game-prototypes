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
import { TICK_RATE } from '../sim/tune';
import type { SimState } from '../sim/types';
import { SOURCE_LABEL } from '../input/devices';
import type { LocalInputs } from '../input/localSetup';

// Local VS: two players on one screen, each on their own input device
// (chosen in the menu's input popup). Only P1 can use touch.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;

export class LocalVsScene extends Phaser.Scene {
  private sim!: SimState;
  private stage!: FightStage;
  private inputs!: LocalInputs & { chars?: [string, string];skins?:[string,string]; series?: SeriesState };
  private acc = 0;
  private over = false;
  private series!: SeriesState;


  constructor() {
    super('LocalVs');
  }

  create(data: LocalInputs & { chars?: [string, string]; skins?:[string,string]; series?: SeriesState }): void {
    this.series = data.series ?? newSeries(tune.match.bestOf);

    applyCameraPixelRatio(this);
    this.built = false;
    const chars = data.chars ?? ['marco', 'marco'];
    whenGroupsReady(this, fighterGroups(chars as [string, string]), () => this.build(data));
  }

  private built = false;

  private build(data: LocalInputs & { chars?: [string, string]; skins?:[string,string]; series?: SeriesState }): void {
    this.built = true;
    this.inputs = data;
    this.acc = 0;
    this.over = false;
    const chars = data.chars ?? ['marco', 'marco'];
    this.sim = createSimState({ timed: true, showcase: this.series.roundNumber === 1, fighters: [{ char: chars[0] }, { char: chars[1] }] });
    const names: [string, string] = [t('match.p_name_source', { n: 1, name: charName(chars[0]), source: SOURCE_LABEL[data.p1] }), t('match.p_name_source', { n: 2, name: charName(chars[1]), source: SOURCE_LABEL[data.p2] })];
    this.stage = new FightStage(this, names, -1, data.p1 === 'touch',data.skins);
    this.stage.localVsRows = data.p1 === 'touch' ? [1] : [0, 1];
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
        const events = step(this.sim, [this.stage.sampleSource(this.inputs.p1), this.stage.sampleSource(this.inputs.p2)]);
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
      roundSplash(this, () => this.scene.restart({ ...this.inputs, series: outcome.series }));
      return;
    }
    track('match', 'LocalVs', r.winner === null ? 'draw' : 'finished');
    matchResult(this, r.winner === null ? t('common.draw') : t('match.p_victory', { n: r.winner + 1 }), {
      rematch: () => this.scene.restart({ ...this.inputs, series: undefined }),
      changeBoxer: () => startScreen(this, 'CharSelect', { mode: 'localvs', inputs: this.inputs }),
      menu: () => startScreen(this, 'Menu'),
    }, outcome.series.wins, r.winner===null?undefined:{char:this.sim.fighters[r.winner].char,skin:this.inputs.skins?.[r.winner]}, r.winner===null?'draw':'victory');
  }
}
