import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { createSimState, fatigueLevel, phaseOf, step } from '../sim/sim';
import { tune, TICK_RATE } from '../sim/tune';
import { maxHealth, maxStamina, stunThreshold } from '../sim/character';
import { NEUTRAL_INPUT, type FrameInput, type SimEvent, type SimState } from '../sim/types';
import { devices } from '../input/devices';
import { getNav, navRegister } from '../ui/menuNav';

// Step-by-step tutorial vs a scripted dummy. Each step reveals only the
// controls/HUD it needs, shows one instruction, and completes when the
// player actually does the thing. Progress is remembered on the device.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;
const SAVE_KEY = 'punchies:tutorial:v1';

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
    title: 'MOVE',
    text: (b) => `Move toward the dummy with ${b('move')}.`,
    adds: ['stick'],
    dummy: 'idle',
    goal: 1,
    track: (c) => {
      const [p, d] = c.sim.fighters;
      return Math.hypot(p.x - d.x, p.y - d.y) < 80 ? 1 : 0;
    },
  },
  {
    title: 'JAB',
    text: (b) => `Jab: your fastest, lightest punch. ${b('jab')} to land 2 jabs.`,
    adds: ['jab'],
    dummy: 'idle',
    goal: 2,
    track: (c) => hits(c, (e) => e.punch === 'jab'),
  },
  {
    title: 'CROSS',
    text: (b) => `Cross: slower but heavier, and the longest reach. ${b('cross')} to land 2 crosses.`,
    adds: ['cross'],
    dummy: 'idle',
    goal: 2,
    track: (c) => hits(c, (e) => e.punch === 'cross'),
  },
  {
    title: 'RANGE: SWEET vs SOUR',
    text: () => 'Your fist travels out. Too close = SOUR (weak). At full extension = SWEET. Step back a little and land a SWEET hit.',
    adds: [],
    dummy: 'idle',
    goal: 1,
    hitboxes: true,
    track: (c) => hits(c, (e) => e.sweet && e.damage > 0),
  },
  {
    title: 'HOOK',
    text: (b) => `Hook: short reach, made for close range. Get close and ${b('hook')} to land a hook.`,
    adds: ['hook'],
    dummy: 'idle',
    goal: 1,
    track: (c) => hits(c, (e) => e.punch === 'hook'),
  },
  {
    title: 'GUARD',
    text: (b) => `The dummy attacks now. Hold ${b('guard')} to block 3 jabs. Blocking costs stamina, never health.`,
    adds: ['guard'],
    dummy: 'jabber',
    goal: 3,
    track: (c) => c.events.filter((e) => e.kind === 'block' && e.attacker === 1).length,
  },
  {
    title: 'PERFECT GUARD',
    text: () => 'Raise guard just as a punch lands for a PERFECT GUARD: it staggers them. Mashing won\'t work; let go, then time it.',
    adds: [],
    dummy: 'jabber',
    goal: 1,
    track: (c) => c.events.filter((e) => e.kind === 'perfectGuard' && e.attacker === 1).length,
  },
  {
    title: 'DODGE',
    text: (b) => `${b('dodge')} to slip punches. The stick picks the direction; no direction = step back. Avoid 2 punches.`,
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
    title: 'DODGE POWER-UP',
    text: () => 'Right after a dodge you glow yellow: your next punch does 1.5x damage. Dodge toward the dummy and punch straight away for a POWER! hit.',
    adds: [],
    dummy: 'idle',
    goal: 1,
    track: (c) => hits(c, (e) => e.buffed),
  },
  {
    title: 'STAMINA',
    text: () => 'The blue bar is stamina. Punches, dodges and guarding spend it. At 0 you are exhausted: Vulnerable and slow to recover. Punch until it is below half.',
    adds: ['stamina'],
    dummy: 'idle',
    goal: 1,
    track: (c) => (c.sim.fighters[0].stamina < maxStamina(c.sim.fighters[0]) * 0.5 ? 1 : 0),
  },
  {
    title: 'HEALTH: FACE vs BODY',
    text: () => 'Green is health. Hits that reach the FACE (inner circle) do full damage; the body only takes part. Land one face hit and one body hit (from max range).',
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
    title: 'PUNISH',
    text: () => 'Anyone recovering from a punch, especially a miss, is Vulnerable. The dummy will whiff: step in and hit it while it recovers.',
    adds: [],
    dummy: 'whiffer',
    goal: 1,
    track: (c) => (c.dummyWasRecovering ? hits(c, (e) => e.damage > 0) : 0),
  },
  {
    title: 'COUNTER',
    text: () => 'Hit someone while they are STARTING a punch = COUNTER (x1.5 damage). The dummy throws slow crosses: beat one with a Cross or Hook.',
    adds: [],
    dummy: 'crossBait',
    goal: 1,
    track: (c) => hits(c, (e) => e.counter),
  },
  {
    title: 'STARS & UPPERCUT',
    text: (b) => `Sweet hits earn stars (dots on UPPER). At 3 you glow yellow and the Uppercut is ready: ${b('upper')}. It can't be blocked. Land one.`,
    adds: ['uppercut'],
    dummy: 'idle',
    goal: 1,
    track: (c) => hits(c, (e) => e.punch === 'uppercut'),
  },
  {
    title: 'STUN',
    text: () => 'Taking hits fills the stun meter (thin bar). Full = stunned: open to anything. The dummy is nearly there. Finish it!',
    adds: ['stun'],
    dummy: 'idle',
    goal: 1,
    setup: (s) => {
      s.fighters[1].stun = stunThreshold(s.fighters[1]) * 0.75;
    },
    track: (c) => c.events.filter((e) => e.kind === 'stunned' && e.fighter === 1).length,
  },
  {
    title: 'FATIGUE',
    text: () => 'Repeating one punch tires it: red bars fill, it gets slower and weaker ("tired"). Mix it up! Throw the same punch until 2 bars light up.',
    adds: ['fatigue'],
    dummy: 'idle',
    goal: 1,
    track: (c) => {
      const f = c.sim.fighters[0];
      return fatigueLevel(f, 'jab') >= 2 || fatigueLevel(f, 'cross') >= 2 || fatigueLevel(f, 'hook') >= 2 ? 1 : 0;
    },
  },
  {
    title: 'PUT IT TOGETHER',
    text: () => 'Everything is on. Knock the dummy out!',
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
  const names: Record<'touch' | 'keyboard' | 'gamepad', Record<Action, string>> = {
    touch: { move: 'the joystick (left side)', jab: 'Tap JAB', cross: 'Tap CROSS', hook: 'Tap HOOK', guard: 'GUARD', dodge: 'Tap DODGE', upper: 'tap UPPER' },
    keyboard: { move: 'W A S D', jab: 'Press J', cross: 'Press K', hook: 'Press L', guard: 'Shift', dodge: 'Press Space', upper: 'press I' },
    gamepad: { move: 'the left stick', jab: 'Press X', cross: 'Press Y', hook: 'Press B', guard: 'RB', dodge: 'Press A', upper: 'press LB' },
  };
  return (a) => names[d][a];
}

function loadStep(): number {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}') as { step?: number };
    return typeof v.step === 'number' && v.step >= 0 && v.step < STEPS.length ? v.step : 0;
  } catch {
    return 0;
  }
}

function saveStep(step: number | null): void {
  try {
    if (step === null) localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, JSON.stringify({ step }));
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
    this.acc = 0;
    this.finished = false;
    this.sim = createSimState({ timed: false, fighters: [{}, { infiniteStamina: true }] });
    this.stage = new FightStage(this, ['YOU', 'DUMMY'], 0);
    this.stage.hideInfoButton();
    makeButton(this, VIEW.cx - 40, VIEW.top + 46, 64, 'SKIP', () => this.advance());
    makeButton(this, VIEW.cx + 40, VIEW.top + 46, 64, 'EXIT', () => this.scene.start('Menu'));

    const panelY = tune.ring.top + 30;
    this.add.rectangle(VIEW.cx, panelY, 540, 56, 0x000000, 0.72).setStrokeStyle(1, 0x5a6378).setDepth(140);
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
      .text(VIEW.cx, VIEW.cy + 10, 'NICE!', { fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', color: '#7fe08a', stroke: '#000000', strokeThickness: 5, resolution: PIXEL_RATIO })
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
    saveStep(null);
    this.stage.reveal(null);
    getNav(this).engage();
    this.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x000000, 0.8).setDepth(290).setInteractive();
    this.add
      .text(VIEW.cx, VIEW.cy - 60, 'TUTORIAL COMPLETE', { fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: '#ffd24a', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(291);
    const btn = (x: number, label: string, key: string) => {
      const bg = this.add.rectangle(x, VIEW.cy + 10, 150, 38, 0x2a3140, 1).setStrokeStyle(1, 0x7fb3ff).setDepth(291).setInteractive();
      bg.on('pointerdown', () => this.scene.start(key));
      navRegister(this, bg, () => this.scene.start(key));
      this.add.text(x, VIEW.cy + 10, label, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', resolution: PIXEL_RATIO }).setOrigin(0.5).setDepth(292);
    };
    btn(VIEW.cx - 165, 'TRAINING', 'Training');
    btn(VIEW.cx, 'SINGLE PLAYER', 'VsAI');
    btn(VIEW.cx + 165, 'MENU', 'Menu');
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
    this.stage.pollDevices();
    const st = STEPS[this.idx];
    this.title.setText(`STEP ${this.idx + 1}/${STEPS.length} · ${st.title}${st.goal > 1 ? `   ${this.progress}/${st.goal}` : ''}`);
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
