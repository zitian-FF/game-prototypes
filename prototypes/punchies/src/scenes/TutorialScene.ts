import { startScreen } from '../ui/presentation';
import { t } from '../i18n';
import { track } from '../portal/analytics';
import Phaser from 'phaser';
import { store } from '../portal/store';
import { KEYS } from '../portal/keys';
import { titleButton } from '../ui/titleButton';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { createSimState, fatigueLevel, phaseOf, step } from '../sim/sim';
import { tune, TICK_RATE } from '../sim/tune';
import { maxHealth, maxStamina, stunThreshold } from '../sim/character';
import { NEUTRAL_INPUT, type FrameInput, type SimEvent, type SimState } from '../sim/types';
import { devices } from '../input/devices';
import { getNav, navRegister } from '../ui/menuNav';
import { artImage, fighterGroups, whenGroupsReady } from '../render/art';

// Step-by-step tutorial vs a scripted dummy. Each step reveals only the
// controls/HUD it needs, shows one instruction, and completes when the
// player actually does the thing. Progress is remembered on the device.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;
const SAVE_KEY = KEYS.tutorial;

type DummyMode = 'idle' | 'jabber' | 'crossBait' | 'whiffer';
type Action = 'move' | 'jab' | 'cross' | 'hook' | 'guard' | 'dodge' | 'upper';

interface Ctx {
  events: SimEvent[];
  sim: SimState;
  // Dummy was recovering from a punch before this tick.
  dummyWasRecovering: boolean;
  flags: Set<string>;
}

interface Step {
  title: string;
  text: (b: (a: Action) => string) => string;
  adds: string[];
  dummy: DummyMode;
  goal: number;
  hitboxes?: boolean;
  setup?: (s: SimState) => void;
  // Returns how much progress this tick made (or sets flags).
  track: (c: Ctx) => number;
}

const hits = (c: Ctx, pred: (e: Extract<SimEvent, { kind: 'hit' }>) => boolean) =>
  c.events.filter((e): e is Extract<SimEvent, { kind: 'hit' }> => e.kind === 'hit' && e.attacker === 0 && pred(e)).length;

const STEPS: Step[] = [
  {
    get title() { return t('tutorial.move'); },
    text: (b) => t('tutorial.move_text', { btn: b('move') }),
    adds: ['stick'],
    dummy: 'idle',
    goal: 1,
    track: (c) => {
      const [p, d] = c.sim.fighters;
      return Math.hypot(p.x - d.x, p.y - d.y) < 80 ? 1 : 0;
    },
  },
  {
    get title() { return t('common.jab'); },
    text: (b) => t('tutorial.jab_text', { btn: b('jab') }),
    adds: ['jab'],
    dummy: 'idle',
    goal: 2,
    track: (c) => hits(c, (e) => e.punch === 'jab'),
  },
  {
    get title() { return t('common.cross'); },
    text: (b) => t('tutorial.cross_text', { btn: b('cross') }),
    adds: ['cross'],
    dummy: 'idle',
    goal: 2,
    track: (c) => hits(c, (e) => e.punch === 'cross'),
  },
  {
    get title() { return t('tutorial.range_sweet_vs_sour'); },
    text: () => t('tutorial.your_fist_travels_out_too'),
    adds: [],
    dummy: 'idle',
    goal: 1,
    hitboxes: true,
    track: (c) => hits(c, (e) => e.sweet && e.damage > 0),
  },
  {
    get title() { return t('common.hook'); },
    text: (b) => t('tutorial.hook_text', { btn: b('hook') }),
    adds: ['hook'],
    dummy: 'idle',
    goal: 1,
    track: (c) => hits(c, (e) => e.punch === 'hook'),
  },
  {
    get title() { return t('common.guard'); },
    text: (b) => t('tutorial.guard_text', { btn: b('guard') }),
    adds: ['guard'],
    dummy: 'jabber',
    goal: 3,
    track: (c) => c.events.filter((e) => e.kind === 'block' && e.attacker === 1).length,
  },
  {
    get title() { return t('common.perfect_guard'); },
    text: () => t('tutorial.perfect_guard_text', { perfect: tune.guard.perfectFrames, penalty: tune.guard.penaltyFrames }),
    adds: [],
    dummy: 'jabber',
    goal: 1,
    track: (c) => c.events.filter((e) => e.kind === 'perfectGuard' && e.attacker === 1).length,
  },
  {
    get title() { return t('common.dodge'); },
    text: (b) => t('tutorial.dodge_text', { btn: b('dodge') }),
    adds: ['dodge'],
    dummy: 'jabber',
    goal: 2,
    track: (c) => {
      const me = c.sim.fighters[0];
      const dodging = me.dodge !== null || me.postDodgeVulnerable > 0 || me.dashBuff > 0;
      return c.events.filter((e) => (e.kind === 'dodged' && e.attacker === 1) || (e.kind === 'whiff' && e.attacker === 1 && dodging)).length;
    },
  },
  {
    get title() { return t('tutorial.dodge_power_up'); },
    text: () => t('tutorial.right_after_a_dodge_you'),
    adds: [],
    dummy: 'idle',
    goal: 1,
    track: (c) => hits(c, (e) => e.buffed),
  },
  {
    get title() { return t('common.stamina'); },
    text: () => t('tutorial.the_blue_bar_is_stamina'),
    adds: ['stamina'],
    dummy: 'idle',
    goal: 1,
    track: (c) => (c.sim.fighters[0].stamina < maxStamina(c.sim.fighters[0]) * 0.5 ? 1 : 0),
  },
  {
    get title() { return t('tutorial.health_face_vs_body'); },
    text: () => t('tutorial.green_is_health_hits_that'),
    adds: ['health'],
    dummy: 'idle',
    goal: 2,
    hitboxes: true,
    track: (c) => {
      let n = 0;
      for (const e of c.events) {
        if (e.kind !== 'hit' || e.attacker !== 0 || e.damage <= 0) continue;
        const key = e.row === 'vulnerable' ? 'face' : 'body';
        if (!c.flags.has(key)) {
          c.flags.add(key);
          n++;
        }
      }
      return n;
    },
  },
  {
    get title() { return t('tutorial.punish'); },
    text: () => t('tutorial.anyone_recovering_from_a_punch'),
    adds: [],
    dummy: 'whiffer',
    goal: 1,
    track: (c) => (c.dummyWasRecovering ? hits(c, (e) => e.damage > 0) : 0),
  },
  {
    get title() { return t('tutorial.counter'); },
    text: () => t('tutorial.hit_someone_while_they_are'),
    adds: [],
    dummy: 'crossBait',
    goal: 1,
    track: (c) => hits(c, (e) => e.counter),
  },
  {
    get title() { return t('tutorial.stars_uppercut'); },
    text: (b) => t('tutorial.stars_text', { btn: b('upper') }),
    adds: ['uppercut'],
    dummy: 'idle',
    goal: 1,
    track: (c) => hits(c, (e) => e.punch === 'uppercut'),
  },
  {
    get title() { return t('common.stun'); },
    text: () => t('tutorial.taking_hits_fills_the_stun'),
    adds: ['stun'],
    dummy: 'idle',
    goal: 1,
    setup: (s) => {
      s.fighters[1].stun = stunThreshold(s.fighters[1]) * 0.75;
    },
    track: (c) => c.events.filter((e) => e.kind === 'stunned' && e.fighter === 1).length,
  },
  {
    get title() { return t('tutorial.fatigue'); },
    text: () => t('tutorial.repeating_one_punch_tires_it'),
    adds: ['fatigue'],
    dummy: 'idle',
    goal: 1,
    track: (c) => {
      const f = c.sim.fighters[0];
      return fatigueLevel(f, 'jab') >= 2 || fatigueLevel(f, 'cross') >= 2 || fatigueLevel(f, 'hook') >= 2 ? 1 : 0;
    },
  },
  {
    get title() { return t('tutorial.put_it_together'); },
    text: () => t('tutorial.everything_is_on_knock_the'),
    adds: ['timer'],
    dummy: 'jabber',
    goal: 1,
    setup: (s) => {
      s.fighters[1].health = maxHealth(s.fighters[1]) * 0.35;
    },
    track: (c) => c.events.filter((e) => e.kind === 'ko' && e.loser === 1).length,
  },
];

// Button names for the device the player is using right now.
function binder(): (a: Action) => string {
  const d = devices.lastDevice;
  const press = (key: string) => t('tutorial.press_key', { key });
  const tap = (name: string) => t('tutorial.tap_button', { button: name });
  const names: Record<'touch' | 'keyboard' | 'gamepad', Record<Action, string>> = {
    touch: { move: t('tutorial.the_joystick_left_side'), jab: tap(t('common.jab')), cross: tap(t('common.cross')), hook: tap(t('common.hook')), guard: t('common.guard'), dodge: tap(t('common.dodge')), upper: tap(t('common.upper')) },
    keyboard: { move: 'W A S D', jab: press('J'), cross: press('K'), hook: press('L'), guard: 'Shift', dodge: press('Space'), upper: press('I') },
    gamepad: { move: t('tutorial.the_left_stick'), jab: press('X'), cross: press('Y'), hook: press('B'), guard: 'RB', dodge: press('A'), upper: press('LB') },
  };
  return (a) => names[d][a];
}

function loadStep(): number {
  try {
    const v = JSON.parse(store.getItem(SAVE_KEY) ?? '{}') as { step?: number };
    return typeof v.step === 'number' && v.step >= 0 && v.step < STEPS.length ? v.step : 0;
  } catch {
    return 0;
  }
}

function saveStep(step: number | null): void {
  try {
    if (step === null) store.removeItem(SAVE_KEY);
    else { store.setItem(SAVE_KEY, JSON.stringify({ step })); track('tutorial', `step_${step + 1}`, 'reached'); }
  } catch {
    /* storage unavailable */
  }
}

export class TutorialScene extends Phaser.Scene {
  private sim!: SimState;
  private stage!: FightStage;
  private acc = 0;
  private idx = 0;
  private progress = 0;
  private flags = new Set<string>();
  private doneAt = 0;
  private finished = false;
  private dummyCooldown = 0;
  private title!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private tick!: Phaser.GameObjects.Text;

  constructor() {
    super('Tutorial');
  }

  create(data?: { restart?: boolean }): void {
    applyCameraPixelRatio(this);
    this.built = false;
    // Both fighters are default boxers here, so the second wears the alt look.
    whenGroupsReady(this, fighterGroups(['marco', 'marco']), () => this.build(data));
  }

  private built = false;

  private build(data?: { restart?: boolean }): void {
    this.built = true;
    this.acc = 0;
    this.finished = false;
    this.sim = createSimState({ timed: false, fighters: [{}, { infiniteStamina: true }] });
    this.stage = new FightStage(this, [t('common.you'), t('common.dummy')], 0);
    this.stage.hideInfoButton();
    makeButton(this, VIEW.cx - 40, VIEW.top + 46, 64, t('tutorial.skip'), () => this.advance());
    makeButton(this, VIEW.cx + 40, VIEW.top + 46, 64, t('tutorial.exit'), () => startScreen(this, 'Menu'));

    const panelY = tune.ring.top + 30;
    this.add.rectangle(VIEW.cx, panelY, 540, 56, 0x000000, 0.72).setStrokeStyle(1, 0x5a6378).setDepth(140);
    artImage(this, 'ui_prompt', VIEW.cx, panelY, 540, 56, 140);
    this.title = this.add
      .text(VIEW.cx, panelY - 18, '', { fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#ffd24a', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(141);
    this.body = this.add
      .text(VIEW.cx, panelY + 6, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 520 },
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(141);
    this.tick = this.add
      .text(VIEW.cx, VIEW.cy + 10, t('tutorial.nice'), { fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', color: '#7fe08a', stroke: '#000000', strokeThickness: 5, resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(145)
      .setVisible(false);
    addVersionStamp(this);

    this.startStep(data?.restart ? 0 : loadStep());
  }

  private revealed(upTo: number): Set<string> | null {
    const parts = new Set<string>();
    for (let i = 0; i <= upTo; i++) for (const a of STEPS[i].adds) parts.add(a);
    return upTo === STEPS.length - 1 ? null : parts;
  }

  private startStep(i: number): void {
    this.idx = i;
    this.progress = 0;
    this.flags.clear();
    this.doneAt = 0;
    this.tick.setVisible(false);
    saveStep(i);
    const st = STEPS[i];
    const [me, dummy] = this.sim.fighters;
    me.health = maxHealth(me);
    me.stamina = maxStamina(me);
    me.exhausted = false;
    dummy.health = maxHealth(dummy);
    dummy.stun = 0;
    dummy.stars = 0;
    dummy.anchored = st.dummy === 'idle';
    this.dummyCooldown = 60;
    st.setup?.(this.sim);
    this.stage.reveal(this.revealed(i));
    this.stage.forceHitboxes = st.hitboxes === true;
  }

  private advance(): void {
    if (this.idx + 1 >= STEPS.length) this.finish();
    else this.startStep(this.idx + 1);
  }

  private finish(): void {
    this.finished = true;
    track('tutorial', 'all', 'complete');
    saveStep(null);
    this.stage.reveal(null);
    getNav(this).engage();
    this.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x000000, 0.8).setDepth(290).setInteractive();
    this.add
      .text(VIEW.cx, VIEW.cy - 60, t('tutorial.tutorial_complete'), { fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: '#ffd24a', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(291);
    const btn=(x:number,label:string,key:string,accent:'default'|'purple'='default')=>titleButton(this,x,VIEW.cy+10,150,38,label,()=>startScreen(this,key),false,291,accent);
    btn(VIEW.cx - 165, t('common.training'), 'Training', 'purple');
    btn(VIEW.cx, t('common.single_player'), 'VsAI');
    btn(VIEW.cx + 165, t('common.menu'), 'Menu');
  }

  // Scripted dummy for the current step.
  private dummyInput(): FrameInput {
    const st = STEPS[this.idx];
    const [me, d] = this.sim.fighters;
    const dx = me.x - d.x;
    const dy = me.y - d.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toward = (k: number): FrameInput => ({ ...NEUTRAL_INPUT, mx: Math.round((dx / dist) * 100 * k), my: Math.round((dy / dist) * 100 * k) });
    if (this.dummyCooldown > 0) this.dummyCooldown--;
    const ready = this.dummyCooldown === 0 && !d.punch && !d.dodge;
    switch (st.dummy) {
      case 'idle':
        return NEUTRAL_INPUT;
      case 'jabber':
        if (dist > 70) return toward(0.6);
        if (ready) {
          this.dummyCooldown = 80;
          return { ...NEUTRAL_INPUT, jab: true };
        }
        return NEUTRAL_INPUT;
      case 'crossBait':
        if (dist > 72) return toward(0.6);
        if (ready) {
          this.dummyCooldown = 110;
          return { ...NEUTRAL_INPUT, cross: true };
        }
        return NEUTRAL_INPUT;
      case 'whiffer':
        // Keeps just outside its own reach and throws crosses that miss.
        if (dist < 95) return toward(-0.6);
        if (dist > 115) return toward(0.6);
        if (ready) {
          this.dummyCooldown = 100;
          return { ...NEUTRAL_INPUT, cross: true };
        }
        return NEUTRAL_INPUT;
    }
  }

  update(time: number, delta: number): void {
    if (!this.built) return;
    this.stage.pollDevices();
    const st = STEPS[this.idx];
    this.title.setText(t('tutorial.step_progress', { n: this.idx + 1, total: STEPS.length, title: st.title }) + (st.goal > 1 ? `   ${this.progress}/${st.goal}` : ''));
    this.body.setText(st.text(binder()));

    if (!this.finished) {
      this.acc = Math.min(this.acc + delta, STEP_MS * MAX_STEPS_PER_FRAME);
      while (this.acc >= STEP_MS) {
        this.acc -= STEP_MS;
        const d = this.sim.fighters[1];
        const dummyWasRecovering = d.punch !== null && phaseOf(d.punch) === 'recovery';
        const events = step(this.sim, [this.stage.sampleLocal(), this.dummyInput()]);
        this.stage.handleEvents(events, this.sim);
        // The tutorial never lets the player lose, and only the final step
        // lets the dummy go down.
        const me = this.sim.fighters[0];
        if (me.health < maxHealth(me) * 0.5) me.health = maxHealth(me);
        if (this.sim.result && this.idx !== STEPS.length - 1) this.sim.result = null;
        if (d.health <= 0 && this.idx !== STEPS.length - 1) d.health = maxHealth(d);
        if (!this.doneAt) {
          this.progress = Math.min(st.goal, this.progress + st.track({ events, sim: this.sim, dummyWasRecovering, flags: this.flags }));
          if (this.progress >= st.goal) {
            this.doneAt = time + 900;
            this.tick.setVisible(true).setScale(1.4);
            this.tweens.add({ targets: this.tick, scale: 1, duration: 150 });
          }
        }
      }
      if (this.doneAt && time >= this.doneAt) this.advance();
    }
    this.stage.draw(this.sim, time);
  }
}
