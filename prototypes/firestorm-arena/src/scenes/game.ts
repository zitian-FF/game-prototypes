import Phaser from 'phaser';
import type { CombatLog, PlayerScore, SquadType, TeamId, Tune, Vec } from 'arena-sim';
import type { ClientEvent, WireEnemyMarch, WireSquad, WireView } from 'firestorm-net';
import { BaseScene, bufferScale, isTouch, logicalSize } from './base';
import { Ui } from '../ui/ui';
import { intents } from '../input/intents';
import { session } from '../net/session';
import { Iso, square } from '../render/iso';
import { bakeGround, drawDecor, paintFog, type Ground } from '../render/ground';
import { FxSystem } from '../render/fx';
import { OUTLINE, drawCache, drawFlames, drawHospital, drawHq, drawLock, drawMissile, drawPortal, drawNodeIcon, drawNodeStack, drawPowerSword, drawQuestion, drawRefinery, drawSilo, drawTurret, drawUnit, unitHeight } from '../render/icons';
import { clientTune } from '../clientTune';
import { COLORS, FONT, SQUAD_LABEL, cssColor, fmtPower, nodeName, shade, teamColor } from '../theme';

type Target = { kind: 'node'; id: string } | { kind: 'hq'; id: string; own: boolean } | { kind: 'cache'; id: string };
type Panel = 'none' | 'logs' | 'scouts';

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtInt = (n: number): string => Math.floor(n).toLocaleString('en-US');

function lerpVec(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function marchPos(m: { from: Vec; to: Vec; startMs: number; arriveMs: number }, simMs: number): Vec {
  const span = Math.max(1, m.arriveMs - m.startMs);
  return lerpVec(m.from, m.to, Math.min(1, Math.max(0, (simMs - m.startMs) / span)));
}

export class GameScene extends BaseScene {
  private iso!: Iso;
  private tune!: Tune;
  private mine: TeamId = 0;
  private ready = false;

  private world!: Phaser.GameObjects.Container;
  private ground!: Ground;
  private linesG!: Phaser.GameObjects.Graphics;
  private entG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private fx!: FxSystem;
  private labels: Phaser.GameObjects.Text[] = [];
  private labelUsed = 0;
  /** Combat result text that rises and fades over a fight (map position, start in seconds). */
  private floaters: { text: string; color: string; size: number; x: number; y: number; start: number }[] = [];
  private fogKey: string | null = null;

  private camX = 0;
  private camY = 0;
  private zoom = clientTune.camera.startZoom;

  private selectedSquad: string | null = null;
  private target: Target | null = null;
  private panel: Panel = 'none';
  private lastFrame = 0;
  private confirmEnd = false;
  private loadStartedAt = 0;
  /** Last left/right facing per unit, so a unit that stops keeps looking where it was going. */
  private facing = new Map<string, 1 | -1>();
  private loadFrames = 0;
  private missiles: { from: Vec; to: Vec; startMs: number; arriveMs: number; own: boolean }[] = [];
  private mapRect = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    super('Game');
  }

  create(): void {
    this.setup();
    intents.textMode = false;
    this.ready = false;
    this.target = null;
    this.selectedSquad = null;
    this.panel = 'none';
    this.confirmEnd = false;
    this.loadStartedAt = this.time.now;
    this.loadFrames = 0;
    this.missiles = [];
    this.labels = [];
    this.labelUsed = 0;
    this.floaters = [];
    this.facing = new Map();
    this.fogKey = null;
    this.lastFrame = this.time.now;
  }

  // ------------------------------------------------------------------ setup

  /** Not called `init`: Phaser calls Scene.init itself, before the first state has arrived. */
  private buildWorld(): void {
    const info = session.info!;
    this.tune = info.tune;
    this.mine = info.team;
    this.iso = new Iso(this.tune);
    this.ground = bakeGround(this, this.iso);

    this.world = this.add.container(0, 0);
    // The floor is one small block of tiles repeated across the map, with vector overlays on top.
    const floor = this.add.tileSprite(0, 0, this.iso.pxW, this.iso.pxH, this.ground.tileKey).setOrigin(0, 0);
    floor.setTileScale(1 / this.ground.tileScale);
    this.world.add(floor);
    const decor = this.add.graphics();
    drawDecor(decor, this.iso, info.map, this.mine);
    this.world.add(decor);
    this.world.add(this.add.image(0, 0, this.ground.fogKey).setOrigin(0, 0).setScale(1 / this.ground.fogScale));
    this.linesG = this.add.graphics();
    this.entG = this.add.graphics();
    this.fxG = this.add.graphics();
    this.world.add([this.linesG, this.entG, this.fxG]);
    this.fx = new FxSystem(this.iso);

    const hq = session.view!.hqs.find((h) => h.id === info.hqId);
    const c = hq ? this.iso.p(hq.pos.x, hq.pos.y) : { x: this.iso.pxW / 2, y: this.iso.pxH / 2 };
    this.camX = c.x;
    this.camY = c.y;
    this.ready = true;
  }

  // ----------------------------------------------------------------- update

  update(time: number): void {
    const dt = Math.min(0.1, (time - this.lastFrame) / 1000);
    this.lastFrame = time;
    if (session.status === 'idle' && !session.info) {
      this.go('Menu');
      return;
    }
    const events = intents.drain();
    const view = session.view;
    if (!session.info || !view) {
      this.drawLoading(0.25, 'Waiting for the match...');
      return;
    }
    if (!this.ready) {
      // Show the loading screen for a couple of frames before the heavy map bake blocks the thread.
      if (this.loadFrames++ < 2) {
        this.drawLoading(0.6, 'Building the map...');
        return;
      }
      this.buildWorld();
    }

    const simMs = session.simNow();
    const now = time / 1000;
    this.handleIntents(events, dt, view);
    if (!session.info || !session.view) return; // an order above may have left the match
    this.handleEvents(view, now);
    this.fx.ambient(now);
    this.drawWorld(view, simMs, now);
    this.drawHud(view, simMs);
  }

  // --------------------------------------------------------------- loading

  /** Full-screen loading screen used before the world exists. */
  private drawLoading(progress: number, label: string): void {
    const ui = this.ui;
    const { w, h } = logicalSize();
    ui.begin();
    this.loadingPanel(w, h, progress, label);
    this.drawVersion();
    ui.end();
  }

  private loadingPanel(w: number, h: number, progress: number, label: string): void {
    const ui = this.ui;
    ui.rect(0, 0, w, h, 0x0b0709, 1);
    ui.rect(0, h * 0.72, w, h * 0.28, 0x2a0d05, 0.7);
    ui.rect(0, h * 0.72, w, 3, 0xff6a2a, 0.8);
    ui.block(0, 0, w, h);
    const cx = w / 2;
    const dots = '.'.repeat(1 + (Math.floor(Date.now() / 400) % 3));
    ui.text('FIRESTORM ARENA', cx, h / 2 - 150, { size: 36, bold: true, align: 'center', color: '#ff8a3d' });
    ui.text(label + dots, cx, h / 2 - 96, { size: 15, align: 'center', color: COLORS.dim });
    ui.bar(cx - 160, h / 2 - 66, 320, 8, progress, 0xff8a3d);
  }

  /** Shown over the finished game for a moment: which team you are on and the squads you were dealt. */
  private drawLoadedOverlay(view: WireView, w: number, h: number, progress: number): void {
    const ui = this.ui;
    const info = session.info!;
    ui.setLayer(3);
    this.loadingPanel(w, h, progress, 'Deploying');
    const cx = w / 2;
    const teamName = `Team ${info.team + 1}`;
    ui.text(`You are on ${teamName}, ${Math.round(info.tune.match.durationSeconds / 60)} minute match`, cx, h / 2 - 34, { size: 15, bold: true, align: 'center', color: cssColor(COLORS.mine) });
    ui.text('Your squads', cx, h / 2 - 6, { size: 12, align: 'center', color: COLORS.dim });
    const mine = view.squads.filter((s) => s.owner === info.playerId);
    mine.forEach((s, i) => {
      const y = h / 2 + 16 + i * 30;
      drawUnit(ui.gfx(), s.type, cx - 150, y + 26, 1, COLORS.mine, this.time.now / 1000, 1, { shadow: false, moving: false });
      const w1 = ui.text(`${SQUAD_LABEL[s.type]}  Power`, cx - 120, y + 2, { size: 14, bold: true });
      drawPowerSword(ui.gfx(), cx - 120 + w1 + 12, y + 10);
      ui.text(fmtPower(s.power), cx - 120 + w1 + 22, y + 2, { size: 14, bold: true, color: '#ffd54a' });
      ui.text(`${Math.round(s.troops)} troops`, cx + 150, y + 3, { size: 12, align: 'right', color: COLORS.dim });
    });
    ui.setLayer(0);
  }

  // ----------------------------------------------------------------- camera

  private screenToMap(x: number, y: number): Vec {
    return { x: (x - this.world.x) / this.zoom, y: (y - this.world.y) / this.zoom };
  }

  /** Zoomed out as far as the whole map fitting the screen, never past it. */
  private minZoom(): number {
    const { w, h } = logicalSize();
    return Math.max(clientTune.camera.zoomMin, Math.min(w / this.iso.pxW, h / this.iso.pxH));
  }

  private applyCam(): void {
    const { w, h } = logicalSize();
    this.zoom = Phaser.Math.Clamp(this.zoom, this.minZoom(), clientTune.camera.zoomMax);
    this.camX = Phaser.Math.Clamp(this.camX, 0, this.iso.pxW);
    this.camY = Phaser.Math.Clamp(this.camY, 0, this.iso.pxH);
    this.world.setPosition(w / 2 - this.camX * this.zoom, h / 2 - this.camY * this.zoom);
    this.world.setScale(this.zoom);
  }

  /** Centre the camera on a squad's current position and zoom in to the focus level. */
  private focusSquad(s: WireSquad, view: WireView, simMs: number): void {
    let pos: Vec | undefined = s.march ? marchPos(s.march, simMs) : s.pos;
    if (!pos && s.nodeId) pos = view.nodes.find((n) => n.id === s.nodeId)?.pos;
    if (!pos && s.hqId) pos = view.hqs.find((h) => h.id === s.hqId)?.pos;
    if (!pos) pos = view.hqs.find((h) => h.id === session.info?.hqId)?.pos;
    if (!pos) return;
    const p = this.iso.p(pos.x, pos.y);
    this.camX = p.x;
    this.camY = p.y;
    this.zoom = Math.max(this.zoom, clientTune.camera.focusZoom);
  }

  private zoomAt(steps: number, px: number, py: number): void {
    this.zoomBy(Math.pow(clientTune.camera.zoomStep, steps), px, py);
  }

  private zoomBy(factor: number, px: number, py: number): void {
    const { w, h } = logicalSize();
    const x = px < 0 ? w / 2 : px;
    const y = py < 0 ? h / 2 : py;
    const before = this.screenToMap(x, y);
    this.zoom = Phaser.Math.Clamp(this.zoom * factor, this.minZoom(), clientTune.camera.zoomMax);
    this.camX = before.x - (x - w / 2) / this.zoom;
    this.camY = before.y - (y - h / 2) / this.zoom;
  }

  // ----------------------------------------------------------------- intents

  private handleIntents(events: ReturnType<typeof intents.drain>, dt: number, view: WireView): void {
    this.camX += (intents.move.x * clientTune.camera.panSpeed * dt) / this.zoom;
    this.camY += (intents.move.y * clientTune.camera.panSpeed * dt) / this.zoom;
    for (const e of events) {
      switch (e.type) {
        case 'drag':
          if (!this.ui.covers(e.startX, e.startY)) {
            this.camX -= e.dx / this.zoom;
            this.camY -= e.dy / this.zoom;
          }
          break;
        case 'zoom':
          if (!this.ui.covers(intents.pointer.x, intents.pointer.y)) this.zoomAt(e.steps, e.x, e.y);
          break;
        case 'pinch':
          this.zoomBy(e.factor, e.x, e.y);
          break;
        case 'primary':
          if (!this.ui.click(e.x, e.y)) this.target = this.pick(e.x, e.y, view);
          break;
        case 'secondary': {
          if (this.ui.covers(e.x, e.y)) break;
          const t = this.pick(e.x, e.y, view);
          const sel = view.squads.find((q) => q.id === this.selectedSquad);
          if (t && sel && sel.state !== 'hq') session.toast('Squads in the field can only return to HQ', 'bad');
          else if (t && sel) this.sendSquad(sel.id, t);
          else if (t) this.target = t;
          break;
        }
        case 'pause':
          if (this.panel !== 'none') this.panel = 'none';
          else if (this.target) this.target = null;
          else this.selectedSquad = null;
          break;
        default:
          break;
      }
    }
    this.applyCam();
  }

  private pick(px: number, py: number, view: WireView): Target | null {
    const m = this.screenToMap(px, py);
    let best: { d: number; t: Target } | null = null;
    const consider = (d: number, r: number, t: Target) => {
      if (d < r && (!best || d / r < best.d)) best = { d: d / r, t };
    };
    for (const c of view.caches) {
      const p = this.iso.p(c.pos.x, c.pos.y);
      consider(Math.hypot(m.x - p.x, m.y - (p.y - 8)), 22, { kind: 'cache', id: c.id });
    }
    for (const n of view.nodes) {
      const p = this.iso.p(n.pos.x, n.pos.y);
      consider(Math.hypot(m.x - p.x, m.y - (p.y - n.tier * clientTune.iso.cubeHeight * 0.6)), 34, { kind: 'node', id: n.id });
    }
    for (const h of view.hqs) {
      const p = this.iso.p(h.pos.x, h.pos.y);
      consider(Math.hypot(m.x - p.x, m.y - (p.y - 10)), 22, { kind: 'hq', id: h.id, own: true });
    }
    for (const h of view.enemyHqs) {
      const p = this.iso.p(h.pos.x, h.pos.y);
      consider(Math.hypot(m.x - p.x, m.y - (p.y - 10)), 22, { kind: 'hq', id: h.id, own: false });
    }
    return best ? (best as { d: number; t: Target }).t : null;
  }

  // ---------------------------------------------------------------- commands

  private targetBody(t: Target) {
    if (t.kind === 'cache') return { kind: 'cache', cacheId: t.id } as const;
    return t.kind === 'node' ? ({ kind: 'node', nodeId: t.id } as const) : ({ kind: 'hq', hqId: t.id } as const);
  }

  private sendSquad(squadId: string, t: Target): void {
    if (t.kind === 'cache') {
      session.toast('Only a scout can collect a cache', 'bad');
      return;
    }
    session.sendCommand({ type: 'march', squadId, target: t.kind === 'node' ? { kind: 'node', nodeId: t.id } : { kind: 'hq', hqId: t.id } });
  }

  // ------------------------------------------------------------------ events

  private nodeLabel(view: WireView, id: string): string {
    const n = view.nodes.find((x) => x.id === id);
    return n ? nodeName(n.kind, n.tier) : 'a node';
  }

  private subjectPos(view: WireView, log: CombatLog): Vec | null {
    if (log.subject.kind === 'node') {
      const id = log.subject.nodeId;
      return view.nodes.find((n) => n.id === id)?.pos ?? null;
    }
    const id = log.subject.hqId;
    return view.hqs.find((h) => h.id === id)?.pos ?? view.enemyHqs.find((h) => h.id === id)?.pos ?? null;
  }

  /**
   * After a fight the victor shows one combined number of troops defeated (like -23123) and every defeated
   * commander shows "Defeated". Both rise and fade (drawFloaters).
   */
  private combatFloaters(log: CombatLog, pos: Vec, now: number): void {
    const mine = this.mine;
    const lostByDefenders = log.fights.reduce((a, f) => a + Math.max(0, f.defender.troopsBefore - f.defender.troopsAfter), 0);
    const lostByAttacker = Math.max(0, log.attacker.troopsBefore - log.attacker.troopsAfter);
    const attackerWon = log.attacker.troopsAfter > 0;
    const victorTeam = attackerWon ? log.attacker.team : (log.fights[log.fights.length - 1]?.defender.team ?? log.attacker.team);
    const defeated = [...(attackerWon ? [] : [log.attacker]), ...log.fights.map((f) => f.defender).filter((d) => d.troopsAfter <= 0)];
    const victorColor = victorTeam === mine ? '#7dff9b' : '#ff7a5a';
    const p = this.iso.p(pos.x, pos.y);
    const number = attackerWon ? lostByDefenders : lostByAttacker;
    this.floaters.push({ text: `-${fmtInt(Math.round(number))}`, color: victorColor, size: 18, x: p.x, y: p.y - 44, start: now });
    defeated.slice(0, 3).forEach((d, i) => {
      this.floaters.push({ text: 'Defeated', color: d.team === mine ? '#ff9a6a' : '#9fb3c8', size: 13, x: p.x, y: p.y - 22 + i * 15, start: now });
    });
    void lostByAttacker;
  }

  private drawFloaters(now: number): void {
    const { floatSeconds, floatRise } = clientTune.fx;
    this.floaters = this.floaters.filter((f) => now - f.start < floatSeconds);
    for (const f of this.floaters) {
      const k = (now - f.start) / floatSeconds;
      const alpha = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      this.label(f.text, f.x, f.y - floatRise * k, f.color, f.size, 0.5, alpha);
    }
  }

  private handleEvents(view: WireView, now: number): void {
    const events = session.pendingEvents;
    if (events.length === 0) return;
    session.pendingEvents = [];
    const mine = this.mine;
    for (const e of events as ClientEvent[]) {
      switch (e.type) {
        case 'combat': {
          const pos = this.subjectPos(view, e.log);
          if (pos) this.fx.combat(pos.x, pos.y, now);
          const where = e.log.subject.kind === 'node' ? this.nodeLabel(view, e.log.subject.nodeId) : 'an HQ';
          if (pos) this.combatFloaters(e.log, pos, now);
          const mineAttack = e.log.attacker.team === mine;
          if (mineAttack && e.log.outcome === 'captured') session.toast(`Captured ${where}`, 'good');
          else if (mineAttack && e.log.outcome === 'attackerDefeated') session.toast(`Defeated attacking ${where}`, 'bad');
          else if (mineAttack && e.log.outcome === 'capReached') session.toast(`Attack on ${where} ran out of steam`, 'info');
          else if (!mineAttack && e.log.outcome === 'captured') session.toast(`${where} fell to the enemy`, 'bad');
          else if (!mineAttack && e.log.outcome === 'attackerDefeated') session.toast(`Held ${where}`, 'good');
          break;
        }
        case 'combatFx':
          this.fx.combat(e.pos.x, e.pos.y, now);
          break;
        case 'nodeCaptured': {
          const n = view.nodes.find((x) => x.id === e.nodeId);
          if (n) this.fx.ring(n.pos.x, n.pos.y, now, teamColor(e.team, mine), 1.1, 1.3);
          break;
        }
        case 'hqDamaged': {
          const h = view.hqs.find((x) => x.id === e.hqId) ?? view.enemyHqs.find((x) => x.id === e.hqId);
          if (h) this.fx.ring(h.pos.x, h.pos.y, now, 0xff4a1c, 1, 1.2);
          if (e.hqId === session.info?.hqId) session.toast(`Your HQ was hit (${e.hp} left)`, 'bad');
          break;
        }
        case 'hqDefeated':
          if (e.hqId === session.info?.hqId) session.toast('Your HQ was defeated and sent home', 'bad');
          break;
        case 'teleportFx':
          this.fx.teleport(e.from, e.to, now, e.own ? COLORS.mine : COLORS.enemy);
          break;
        case 'missileLaunched':
          this.missiles.push({ from: e.from, to: e.to, startMs: e.startMs, arriveMs: e.arriveMs, own: e.own });
          break;
        case 'garrisonRejected':
        case 'hqGarrisonRejected':
          // Teammates' rejected squads reach you too; only tell the commander it happened to.
          if (view.squads.find((q) => q.id === e.squadId)?.owner !== session.info?.playerId) break;
          session.toast(`Could not garrison: ${e.reason === 'nodeFull' ? 'it is full' : 'you already have a squad there'}`, 'bad');
          break;
        case 'cacheCollected': {
          const p = this.iso.p(e.at.x, e.at.y);
          this.fx.ring(e.at.x, e.at.y, now, e.team === mine ? 0xffd54a : COLORS.enemy, 0.8, 0.8);
          this.floaters.push({ text: `+${fmtInt(Math.round(e.amount))}`, color: e.team === mine ? '#ffe08a' : '#ff9a7a', size: 16, x: p.x, y: p.y - 30, start: now });
          const where = this.nodeLabel(view, e.nodeId);
          if (e.team === mine) session.toast(`Your scouts banked ${fmtInt(Math.round(e.amount))} points from a cache at ${where}`, 'good');
          else session.toast(`${e.commander} banked ${fmtInt(Math.round(e.amount))} points from a cache at ${where}`, 'bad');
          break;
        }
        case 'poolLost':
          if (e.amount <= 0) break;
          if (e.team === mine) session.toast(`Lost ${this.nodeLabel(view, e.nodeId)}: its ${fmtInt(Math.round(e.amount))} point pool dropped as ${e.caches} caches. Scouts can win it back`, 'bad');
          else session.toast(`${this.nodeLabel(view, e.nodeId)} taken: its ${fmtInt(Math.round(e.amount))} point pool dropped as ${e.caches} caches. Send scouts`, 'good');
          break;
        case 'poolOpened':
          if (view.nodes.find((n) => n.id === e.nodeId)?.owner === mine) session.toast(`Score pool open at ${this.nodeLabel(view, e.nodeId)}: hold the node to keep it`, 'info');
          break;
        case 'nodesUnlocked':
          session.toast(e.tier >= 4 ? 'Nuclear Silo unlocked: it can be captured now' : 'Missile Turrets unlocked: they can be captured now', 'good');
          break;
        case 'matchEnded':
          break;
        default:
          break;
      }
    }
  }

  // ------------------------------------------------------------------- world

  protected onDprChanged(): void {
    for (const t of this.labels) t.setResolution(bufferScale() * 2);
  }

  private label(text: string, x: number, y: number, color: string, size = 11, align: 0 | 0.5 = 0.5, alpha = 1): void {
    let t = this.labels[this.labelUsed];
    if (!t) {
      t = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#fff', resolution: bufferScale() * 2, stroke: '#000', strokeThickness: 3 });
      this.world.add(t);
      this.labels[this.labelUsed] = t;
    }
    t.setText(text).setColor(color).setFontSize(size).setOrigin(align, 0).setPosition(x, y).setAlpha(alpha).setVisible(true);
    this.labelUsed++;
  }

  private dashed(g: Phaser.GameObjects.Graphics, a: Vec, b: Vec, color: number, now: number, alpha = 1, width = clientTune.lines.width): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const { dashLength, gapLength, flowSpeed } = clientTune.lines;
    const period = dashLength + gapLength;
    const ux = dx / len;
    const uy = dy / len;
    // Order and march lines are background information: scale them all down so they never drown the map.
    g.lineStyle(width, color, Math.min(1, alpha * clientTune.lines.strength));
    let s = -((now * flowSpeed) % period) + period;
    s -= period;
    g.beginPath();
    for (; s < len; s += period) {
      const s0 = Math.max(0, s);
      const s1 = Math.min(len, s + dashLength);
      if (s1 <= s0) continue;
      g.moveTo(a.x + ux * s0, a.y + uy * s0);
      g.lineTo(a.x + ux * s1, a.y + uy * s1);
    }
    g.strokePath();
  }

  private drawWorld(view: WireView, simMs: number, now: number): void {
    const iso = this.iso;
    const mine = this.mine;
    const info = session.info!;
    const ch = clientTune.iso.cubeHeight;

    // Fog follows which nodes are ours.
    const circles = view.nodes
      // Our nodes light their surroundings, and a Portal Nexus lights its 8 cells for everyone.
      .filter((n) => (n.owner === mine && n.visible) || n.kind === 'portal')
      .map((n) => ({ x: n.pos.x, y: n.pos.y, r: this.tune.nodes[n.kind].visionRadiusCells * this.tune.map.cellSize }));
    const key = circles.map((c) => `${c.x},${c.y},${c.r}`).join(';');
    if (key !== this.fogKey) {
      this.fogKey = key;
      paintFog(this.ground, iso, circles);
    }

    this.labelUsed = 0;
    const lines = this.linesG;
    const g = this.entG;
    lines.clear();
    g.clear();
    this.fxG.clear();

    type Item = { d: number; draw: () => void };
    const items: Item[] = [];
    const add = (pos: Vec, draw: () => void) => items.push({ d: iso.depth(pos.x, pos.y), draw });

    const selNode = this.target?.kind === 'node' ? this.target.id : null;
    const selHq = this.target?.kind === 'hq' ? this.target.id : null;
    const hw = clientTune.iso.artHalfWidth;
    const US = clientTune.iso.unitScale;

    // Nodes
    for (const n of view.nodes) {
      const p = iso.p(n.pos.x, n.pos.y);
      add(n.pos, () => {
        const col = n.owner === null ? COLORS.neutral : teamColor(n.owner, mine);
        // Out of sight nodes are darkened, never faded: solid colours only.
        const dim = !n.explored ? 0.5 : n.visible ? 1 : clientTune.fog.hiddenNodeAlpha;
        square(g, p.x, p.y, iso.tile / 2 - 4, shade(col, n.visible ? 0.4 : 0.22), 1, shade(col, n.visible ? 1.2 : 0.7), 1);
        if (selNode === n.id) {
          square(g, p.x, p.y, iso.tile / 2 + 2, undefined, 1, Math.sin(now * 6) > 0 ? 0xffffff : 0xffd54a, OUTLINE);
        }
        const locked = n.unlocksAtMs !== undefined && simMs < n.unlocksAtMs;
        const base = shade(n.explored ? col : COLORS.neutral, locked ? Math.min(dim, 0.55) : dim);
        if (n.kind === 'portal') {
          drawPortal(g, p.x, p.y, now, hw * 1.05);
        } else if (n.kind === 'points' && n.tier >= 4) {
          drawSilo(g, p.x, p.y, base, hw * 1.1);
        } else if (n.kind === 'points' && n.tier >= 2) {
          drawRefinery(g, p.x, p.y, base, hw * 1.1, now);
        } else if (n.kind === 'turret') {
          drawTurret(g, p.x, p.y, base, hw * 1.05);
        } else if (n.kind === 'hospital') {
          drawHospital(g, p.x, p.y, base, hw * 1.05);
        } else {
          const lift = drawNodeStack(g, p.x, p.y, n.tier, base, hw);
          drawNodeIcon(g, n.kind, p.x, p.y - lift - 12, 1);
        }
        if (locked) {
          drawLock(g, p.x, p.y - 34, 1);
          this.label(`Opens in ${fmtTime((n.unlocksAtMs ?? 0) - simMs)}`, p.x, p.y + iso.tile / 2 + 2, '#ffd08a', 11);
        }
        if (n.poolOpen) this.label(`Pool ${fmtInt(n.pool ?? 0)}`, p.x, p.y + iso.tile / 2 + 16, '#ffe08a', 11);
        else if (n.settlesAtMs !== undefined) this.label(`Settles in ${fmtTime(n.settlesAtMs - simMs)}`, p.x, p.y + iso.tile / 2 + 16, '#9fd0ff', 10);
        if (n.garrisonCount !== undefined) {
          const own = n.owner === mine && n.visible;
          const txt = own ? `${n.garrisonCount}/${this.tune.garrison.maxSquads}` : `~${n.garrisonCount}`;
          const stale = !own && n.garrisonCountAsOfMs !== undefined ? ` (${Math.round((simMs - n.garrisonCountAsOfMs) / 1000)}s)` : '';
          this.label(txt + stale, p.x, p.y + iso.tile / 2 + 2, own ? '#cfe9ff' : '#ffd08a', 11);
        }
      });
    }

    // Score caches inside our vision.
    for (const c of view.caches) {
      const p = iso.p(c.pos.x, c.pos.y);
      add(c.pos, () => {
        if (this.target?.kind === 'cache' && this.target.id === c.id) square(g, p.x, p.y, 20, undefined, 1, 0xffffff, OUTLINE);
        drawCache(g, p.x, p.y, now);
        this.label(fmtInt(c.value), p.x, p.y + 10, '#ffe08a', 10);
      });
    }

    // HQs
    for (const h of view.hqs) {
      const p = iso.p(h.pos.x, h.pos.y);
      const isMe = h.id === info.hqId;
      add(h.pos, () => {
        if (selHq === h.id) square(g, p.x, p.y, iso.tile / 2 - 6, undefined, 1, 0xffffff, OUTLINE);
        drawHq(g, p.x, p.y, COLORS.mine, 17, 1, now);
        for (let i = 0; i < h.maxHp; i++) g.fillStyle(i < h.hp ? 0x7dff9b : 0x3a2a2a, 1).fillRect(p.x - h.maxHp * 4 + i * 8, p.y - 40, 6, 4);
        if (h.burning) drawFlames(g, p.x, p.y - 8, now, 1.6, 3);
        if (isMe) {
          const bob = Math.sin(now * 4) * 2;
          g.fillStyle(COLORS.self, 1).fillTriangle(p.x - 6, p.y - 54 + bob, p.x + 6, p.y - 54 + bob, p.x, p.y - 46 + bob);
        }
        this.label(isMe ? 'YOU' : h.owner, p.x, p.y + 8, isMe ? '#8dffa8' : '#9fb3c8', 10);
      });
    }
    for (const h of view.enemyHqs) {
      const p = iso.p(h.pos.x, h.pos.y);
      add(h.pos, () => {
        if (selHq === h.id) square(g, p.x, p.y, iso.tile / 2 - 6, undefined, 1, 0xffffff, OUTLINE);
        drawHq(g, p.x, p.y, COLORS.enemy, 17, 1, now);
        this.label(h.owner, p.x, p.y + 8, '#ff9a7a', 10);
        if (h.burning) drawFlames(g, p.x, p.y - 8, now, 1.6, 5);
      });
    }

    // Marching own-team squads
    const squadScreen = (s: WireSquad): Vec => (s.march ? marchPos(s.march, simMs) : s.pos ?? { x: 0, y: 0 });
    for (const s of view.squads) {
      if (s.state !== 'march' || !s.march) continue;
      const pos = squadScreen(s);
      const p = iso.p(pos.x, pos.y);
      const to = iso.p(s.march.to.x, s.march.to.y);
      const mineSquad = s.owner === info.playerId;
      if (s.march.purpose !== 'home') this.dashed(lines, p, to, mineSquad ? COLORS.self : COLORS.ally, now, mineSquad ? 0.95 : 0.3);
      add(pos, () => {
        const f = this.face(s.id, p.x, to.x);
        const hgt = unitHeight(s.type) * US;
        if (this.selectedSquad === s.id) g.lineStyle(OUTLINE, COLORS.self, 1).strokeEllipse(p.x, p.y, 40, 22);
        drawUnit(g, s.type, p.x, p.y, f, mineSquad ? COLORS.mine : shade(COLORS.mine, 0.8), now, 1, { scale: US });
        if (!mineSquad) this.label(s.owner, p.x, p.y - hgt - 18, '#9fd0ff', 11);
        if (s.burning) drawFlames(g, p.x, p.y - hgt * 0.4, now, 1, s.id.length);
        if (mineSquad) g.fillStyle(0x000000, 0.6).fillRect(p.x - 12, p.y - hgt - 8, 24, 3).fillStyle(COLORS.self, 1).fillRect(p.x - 12, p.y - hgt - 8, 24 * (s.troops / s.maxTroops), 3);
      });
    }

    // Enemy marches are public: the unit shows while it is inside our vision, a question mark while it is in fog.
    const inSight = (pos: Vec): boolean => circles.some((c) => Math.hypot(pos.x - c.x, pos.y - c.y) <= c.r);
    for (const m of view.enemyMarches as WireEnemyMarch[]) {
      const pos = marchPos(m.march, simMs);
      const p = iso.p(pos.x, pos.y);
      const to = iso.p(m.march.to.x, m.march.to.y);
      if (!m.burning) this.dashed(lines, p, to, COLORS.enemyLine, now, 0.85);
      add(pos, () => {
        if (inSight(pos)) {
          drawUnit(g, m.type, p.x, p.y, this.face(m.id, p.x, to.x), COLORS.enemy, now, 1, { scale: US });
          // The commander's name is public while we can see the unit; power needs a scout.
          this.label(m.owner, p.x, p.y - unitHeight(m.type) * US - 18, '#ffb08a', 11);
          if (m.revealed) this.label(`Power ${fmtPower(m.revealed.effectivePower)}`, p.x, p.y + 2, '#ffb08a', 10);
        } else {
          drawQuestion(g, p.x, p.y, COLORS.enemy, 1);
        }
        if (m.burning) drawFlames(g, p.x, p.y - 8, now, 1, 9);
      });
    }

    // Scouts
    for (const sc of view.scouts) {
      if (sc.state === 'home' || !sc.from || !sc.to || sc.startMs === undefined || sc.arriveMs === undefined) continue;
      const pos = marchPos({ from: sc.from, to: sc.to, startMs: sc.startMs, arriveMs: sc.arriveMs }, simMs);
      const p = iso.p(pos.x, pos.y);
      const to = iso.p(sc.to.x, sc.to.y);
      if (sc.owner === info.playerId && sc.state === 'out') this.dashed(lines, p, to, 0xbfe9ff, now, 0.6, 1.5);
      add(pos, () => drawUnit(g, 'scout', p.x, p.y, this.face(`scout:${sc.owner}#${sc.index}`, p.x, to.x), sc.owner === info.playerId ? COLORS.mine : shade(COLORS.mine, 0.75), now, 1, { scale: US }));
    }

    // Enemy scouts inside our vision, with the commander's name.
    for (const sc of view.enemyScouts) {
      const pos = marchPos({ from: sc.from, to: sc.to, startMs: sc.startMs, arriveMs: sc.arriveMs }, simMs);
      const p = iso.p(pos.x, pos.y);
      const to = iso.p(sc.to.x, sc.to.y);
      add(pos, () => {
        drawUnit(g, 'scout', p.x, p.y, this.face(`escout:${sc.owner}#${sc.index}`, p.x, to.x), COLORS.enemy, now, 1, { scale: US });
        this.label(sc.owner, p.x, p.y - unitHeight('scout') * US - 18, '#ffb08a', 11);
      });
    }

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.draw();
    this.drawMissiles(simMs, now);
    this.fx.draw(this.fxG, now);
    this.drawFloaters(now);
    for (let i = this.labelUsed; i < this.labels.length; i++) this.labels[i].setVisible(false);
    void ch;
  }

  /** Billboard facing from the screen-space direction of travel; keeps the last one when not moving. */
  private face(id: string, fromX: number, toX: number): 1 | -1 {
    const d = toX - fromX;
    if (Math.abs(d) > 1) this.facing.set(id, d > 0 ? 1 : -1);
    return this.facing.get(id) ?? 1;
  }

  /** Turret missiles: fast arcing shots from a turret to a node, with a smoke trail. */
  private drawMissiles(simMs: number, now: number): void {
    const g = this.fxG;
    this.missiles = this.missiles.filter((m) => {
      const t = (simMs - m.startMs) / Math.max(1, m.arriveMs - m.startMs);
      if (t >= 1) {
        this.fx.impact(m.to.x, m.to.y, now);
        return false;
      }
      if (t < 0) return true;
      const a = this.iso.p(m.from.x, m.from.y);
      const b = this.iso.p(m.to.x, m.to.y);
      const pos = (k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(Math.PI * k) * 90 - 18 });
      const head = pos(t);
      const tail = pos(Math.max(0, t - 0.04));
      const col = m.own ? COLORS.mine : COLORS.enemy;
      // Smoke puffs behind it, shrinking with age (solid greys, no fading).
      for (let k = 1; k <= 6; k++) {
        const q = pos(Math.max(0, t - k * 0.018));
        g.fillStyle(k < 3 ? 0xb8bcc4 : 0x8a8f98, 1).fillCircle(q.x, q.y, Math.max(1, 4.2 - k * 0.55));
      }
      const ahead = pos(Math.min(1, t + 0.01));
      drawMissile(g, head.x, head.y, Math.atan2(ahead.y - tail.y, ahead.x - tail.x), col, now, 1);
      return true;
    });
  }

  // --------------------------------------------------------------------- HUD

  private nodeInfoLines(view: WireView, id: string): { title: string; lines: [string, string][] } | null {
    const n = view.nodes.find((x) => x.id === id);
    if (!n) return null;
    const tune = this.tune;
    const lines: [string, string][] = [];
    if (n.kind === 'portal') {
      return {
        title: nodeName(n.kind, n.tier),
        lines: [
          ['Neutral. It cannot be captured and has no garrison.', COLORS.dim],
          ['Any HQ of either team can teleport here (8 slots around it).', COLORS.text],
          ['Both teams see the 8 cells around it, so HQs that land here are in plain view.', COLORS.warn],
        ],
      };
    }
    const owner = n.owner === null ? 'Neutral' : n.owner === this.mine ? 'Your team' : 'Enemy';
    lines.push([owner, n.owner === this.mine ? COLORS.good : n.owner === null ? COLORS.dim : COLORS.bad]);
    lines.push([`Score ${tune.scoring.tierPointsPerSecond[n.tier - 1]}/s, +${tune.scoring.garrisonPointsPerSecond}/s per garrisoned commander`, COLORS.text]);
    const k = tune.nodes[n.kind];
    const effects: string[] = [];
    if (k.attackPct) effects.push(`+${Math.round(k.attackPct * n.tier * 100)}% attack for your team`);
    if (k.defensePct) effects.push(`+${Math.round(k.defensePct * n.tier * 100)}% defense for your team`);
    if (k.speedPct) effects.push(`+${Math.round(k.speedPct * n.tier * 100)}% march speed for your team`);
    if (k.teleportCooldownReductionSeconds) effects.push(`-${k.teleportCooldownReductionSeconds * n.tier}s teleport cooldown`);
    if (k.poolRegenPerSecond) effects.push(`every ally regains ${k.poolRegenPerSecond * n.tier} reserve troops a second`);
    if (n.kind === 'largeVision') effects.push(`reveals ${k.visionRadiusCells} cells around it`);
    if (n.kind === 'turret') {
      const t = tune.turret;
      effects.push(`every ${t.pulseSeconds}s fires a missile at each enemy Missile Turret and Nuclear Silo, taking ${Math.round(t.damageFraction * 100)}% of max troops from every garrisoned squad`);
    }
    if (effects.length) lines.push([`Holding it: ${effects.join('; ')}`, COLORS.warn]);
    if (n.poolOpen) lines.push([`Score pool ${fmtInt(n.pool ?? 0)}: counts for the holder. If the node is taken, it drops as caches that any scout can bank.`, COLORS.warn]);
    else if (n.settlesAtMs !== undefined) lines.push([`Pool opens in ${fmtTime(n.settlesAtMs - session.simNow())}: until then its points are permanent.`, COLORS.dim]);
    if (n.garrisonCount !== undefined) {
      const own = n.owner === this.mine && n.visible;
      lines.push([own ? `Garrison ${n.garrisonCount} / ${tune.garrison.maxSquads}` : `Garrison ${n.garrisonCount} (scouted)`, COLORS.text]);
    } else lines.push(['Garrison unknown: send a scout', COLORS.dim]);
    return { title: `${nodeName(n.kind, n.tier)}  T${n.tier}`, lines };
  }

  private drawHud(view: WireView, simMs: number): void {
    const ui: Ui = this.ui;
    const { w, h } = logicalSize();
    const info = session.info!;
    const mine = this.mine;
    ui.begin();

    // ---- scoreboard
    ui.rect(0, 0, w, 34, 0x000000, 0.55);
    const remain = this.tune.match.durationSeconds * 1000 - simMs;
    const mineP = view.points[mine];
    const theirP = view.points[mine === 0 ? 1 : 0];
    ui.text(`YOU  ${fmtInt(mineP)}`, w / 2 - 90, 7, { size: 17, bold: true, color: cssColor(COLORS.mine), align: 'right' });
    ui.text(fmtTime(remain), w / 2, 7, { size: 17, bold: true, align: 'center' });
    ui.text(`${fmtInt(theirP)}  ENEMY`, w / 2 + 90, 7, { size: 17, bold: true, color: cssColor(COLORS.enemy) });
    this.drawVersion();
    // Leave (anyone) or end the room (host), with a confirm step.
    const endLabel = session.isHost ? 'End room' : 'Leave';
    if (!this.confirmEnd) {
      ui.button(84, 5, 74, 24, endLabel, { onClick: () => (this.confirmEnd = true), size: 11 });
    } else {
      ui.text(session.isHost ? 'End for everyone?' : 'Leave the match?', 84, 10, { size: 12, color: COLORS.warn });
      ui.button(214, 5, 44, 24, 'Yes', {
        onClick: () => {
          session.finish();
          this.go('Menu');
        },
        size: 11,
        accent: COLORS.enemy,
      });
      ui.button(262, 5, 44, 24, 'No', { onClick: () => (this.confirmEnd = false), size: 11 });
    }
    // Square buttons on the left edge, middle of the screen.
    const activeReports = view.scoutReports.filter((r) => r.expiresAtMs > simMs).length;
    const sq = (y: number, label: string, count: number, which: Panel) => {
      const on = this.panel === which;
      ui.rect(8, y, 56, 56, on ? COLORS.mine : 0x1a212b, 1, on ? COLORS.mine : COLORS.panelEdge, 6);
      ui.text(label, 36, y + 9, { size: 12, bold: true, align: 'center', color: on ? '#08111a' : COLORS.text });
      ui.text(String(count), 36, y + 27, { size: 18, bold: true, align: 'center', color: on ? '#08111a' : count > 0 ? COLORS.warn : COLORS.dim });
      ui.region(8, y, 56, 56, () => (this.panel = on ? 'none' : which));
    };
    // Middle of the edge, but never under the squad panel (it grows with the number of squads).
    const ownSquads = view.squads.filter((q) => q.owner === session.info!.playerId).length;
    const squadTop = h - (62 + ownSquads * 56) - 34 - 30;
    const by = Math.max(40, Math.min(h / 2 - 62, squadTop - 8 - 118));
    sq(by, 'Scouts', activeReports, 'scouts');
    sq(by + 62, 'Logs', view.combatLogs.length, 'logs');

    // ---- toasts
    const nowWall = Date.now();
    session.toasts = session.toasts.filter((t) => t.until > nowWall);
    session.toasts.forEach((t, i) => {
      const col = t.kind === 'good' ? COLORS.good : t.kind === 'bad' ? COLORS.bad : COLORS.text;
      const tw = Math.max(200, t.text.length * 7.2 + 24);
      ui.rect(w / 2 - tw / 2, 42 + i * 28, tw, 24, 0x000000, 0.7, undefined, 5);
      ui.text(t.text, w / 2, 46 + i * 28, { size: 13, align: 'center', color: col });
    });
    if (session.status === 'reconnecting') ui.text('Connection lost, reconnecting...', w / 2, h / 2, { size: 18, align: 'center', color: COLORS.warn, bold: true });

    this.drawSquadPanel(view, simMs, h);
    this.drawMinimap(view, w, h);
    if (this.panel === 'logs') this.drawLogs(view, simMs, h);
    if (this.panel === 'scouts') this.drawScouts(view, simMs, h);
    this.drawTargetPanel(view, simMs, w, h);

    ui.text(isTouch() ? 'Tap: inspect   Hold: send selected squad   Drag: pan   Pinch: zoom' : 'Left click: inspect   Right click: send selected squad   Drag / WASD: pan   Wheel: zoom', w / 2, h - 18, { size: 11, align: 'center', color: COLORS.dim, alpha: 0.7 });

    // ---- loading overlay for the first moments
    const loaded = (this.time.now - this.loadStartedAt) / 1000;
    if (loaded < clientTune.hud.loadingSeconds) this.drawLoadedOverlay(view, w, h, 0.6 + 0.4 * (loaded / clientTune.hud.loadingSeconds));

    // ---- end of match
    if (session.result) {
      ui.setLayer(2);
      ui.rect(0, 0, w, h, 0x000000, 0.8);
      ui.block(0, 0, w, h);
      const r = session.result;
      const won = r.winner === mine;
      const head = r.winner === 'draw' ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
      const top = Math.max(16, h / 2 - 300);
      ui.text(head, w / 2, top, { size: 48, bold: true, align: 'center', color: r.winner === 'draw' ? '#ffffff' : won ? '#7dff9b' : '#ff6a6a' });
      ui.text(`${fmtInt(r.points[mine])}  -  ${fmtInt(r.points[mine === 0 ? 1 : 0])}`, w / 2, top + 60, { size: 24, align: 'center', bold: true });
      this.drawLeaderboard(r.leaderboard ?? [], w, top + 104, h);
      ui.button(w / 2 - 100, Math.min(h - 60, top + 104 + 38 + 12 * 26 + 18), 200, 40, 'Back to menu', {
        onClick: () => {
          session.finish();
          this.go('Menu');
        },
        active: true,
        size: 16,
      });
    }
    void info;
    ui.end();
  }

  /** Individual leaderboard (vanity only): the top 10 and, if outside it, your own row. */
  private drawLeaderboard(rows: PlayerScore[], w: number, y0: number, _h: number): void {
    const ui = this.ui;
    const me = session.info!.playerId;
    const pw = Math.min(640, w - 24);
    const px = Math.round((w - pw) / 2);
    const rowH = 26;
    const shown = rows.slice(0, 10);
    const mineIdx = rows.findIndex((r) => r.id === me);
    const extra = mineIdx >= 10 ? 1 : 0;
    ui.panel(px, y0, pw, 38 + (shown.length + extra) * rowH + 8, 0.95);
    ui.text('Commander leaderboard', px + 12, y0 + 8, { size: 14, bold: true });
    const nameX = px + 44;
    const colX = { troops: px + pw - 330, nodes: px + pw - 268, garrison: px + pw - 205, hqs: px + pw - 150, caches: px + pw - 95, score: px + pw - 14 };
    const head = (t: string, x: number) => ui.text(t, x, y0 + 11, { size: 10, color: COLORS.dim, align: 'right' });
    head('Troops', colX.troops);
    head('Nodes', colX.nodes);
    head('Garrison s', colX.garrison);
    head('HQs', colX.hqs);
    head('Caches', colX.caches);
    head('Score', colX.score);
    const line = (r: PlayerScore, rank: number, y: number) => {
      const you = r.id === me;
      if (you) ui.rect(px + 6, y - 2, pw - 12, rowH - 2, 0x24323f, 1);
      ui.text(`${rank}`, px + 14, y + 3, { size: 12, color: COLORS.dim });
      ui.text(r.id, nameX, y + 3, { size: 13, bold: you, color: cssColor(r.team === this.mine ? COLORS.mine : COLORS.enemy) });
      ui.text(fmtInt(r.troopsDefeated), colX.troops, y + 3, { size: 12, align: 'right' });
      ui.text(String(r.nodesCaptured), colX.nodes, y + 3, { size: 12, align: 'right' });
      ui.text(String(Math.round(r.garrisonSeconds)), colX.garrison, y + 3, { size: 12, align: 'right' });
      ui.text(String(r.hqsDowned), colX.hqs, y + 3, { size: 12, align: 'right' });
      ui.text(fmtInt(r.cachePoints ?? 0), colX.caches, y + 3, { size: 12, align: 'right' });
      ui.text(fmtInt(r.score), colX.score, y + 3, { size: 13, bold: true, align: 'right', color: '#ffd54a' });
    };
    shown.forEach((r, i) => line(r, i + 1, y0 + 34 + i * rowH));
    if (extra) line(rows[mineIdx], mineIdx + 1, y0 + 34 + shown.length * rowH);
  }

  private squadStatus(s: WireSquad, view: WireView): string {
    if (s.state === 'hq') return 'At HQ';
    if (s.state === 'garrison') return `Garrisoned: ${s.nodeId ? this.nodeLabel(view, s.nodeId) : ''}`;
    if (s.state === 'hqGarrison') {
      const h = view.hqs.find((x) => x.id === s.hqId);
      return `Garrisoned at HQ of ${h?.owner ?? 'an ally'}`;
    }
    if (s.burning) return 'Defeated, limping home';
    if (s.march?.purpose === 'home') return 'Returning to HQ';
    return 'Marching';
  }

  private drawSquadPanel(view: WireView, simMs: number, h: number): void {
    const ui = this.ui;
    const info = session.info!;
    const squads = view.squads.filter((s) => s.owner === info.playerId);
    const hq = view.hqs.find((x) => x.id === info.hqId);
    const rowH = 56;
    const pw = 340;
    const ph = 62 + squads.length * rowH;
    const px = 12;
    const py = h - ph - 34;

    // Total troops above the panel: in the squads, and what is left in reserve.
    const inSquads = squads.reduce((a, q) => a + q.troops, 0);
    ui.panel(px, py - 30, pw, 26, 0.92);
    ui.text(`Troops ${fmtInt(inSquads)}`, px + 10, py - 25, { size: 13, bold: true });
    if (hq) ui.text(`Reserve ${fmtInt(hq.pool)} / ${fmtInt(hq.poolMax)}`, px + pw - 10, py - 25, { size: 13, align: 'right', color: hq.pool < hq.poolMax * 0.25 ? COLORS.warn : COLORS.dim });

    ui.panel(px, py, pw, ph);
    if (hq) {
      const ready = hq.nextTeleportAtMs <= simMs;
      ui.text(`HQ  ${hq.hp}/${hq.maxHp}`, px + 10, py + 8, { size: 13, bold: true, color: hq.burning ? COLORS.warn : COLORS.text });
      ui.text(ready ? 'Teleport ready' : `Teleport ${fmtTime(hq.nextTeleportAtMs - simMs)}`, px + 110, py + 8, { size: 13, color: ready ? COLORS.good : COLORS.dim });
      const homeScouts = view.scouts.filter((s) => s.owner === info.playerId && s.state === 'home').length;
      const totalScouts = view.scouts.filter((s) => s.owner === info.playerId).length;
      ui.text(`Scouts ${homeScouts}/${totalScouts}`, px + pw - 10, py + 8, { size: 13, align: 'right', color: homeScouts > 0 ? COLORS.text : COLORS.dim });
    }
    squads.forEach((s, i) => {
      const y = py + 36 + i * rowH;
      const sel = this.selectedSquad === s.id;
      ui.rect(px + 6, y - 4, pw - 12, rowH - 4, sel ? 0x1f3a52 : 0x161c25, 1, sel ? COLORS.self : COLORS.panelEdge, 5);
      ui.region(px + 6, y - 4, pw - 12, rowH - 4, () => {
        // First tap selects; tapping the selected squad again flies the camera to where it is now.
        if (sel) this.focusSquad(s, view, simMs);
        else this.selectedSquad = s.id;
      });
      drawUnit(ui.gfx(), s.type, px + 32, y + 38, 1, COLORS.mine, this.time.now / 1000, 1, { shadow: false, moving: false });
      // "Tank  Power [sword] 62.5M  #12"
      const w1 = ui.text(`${SQUAD_LABEL[s.type]}  Power`, px + 62, y, { size: 13, bold: true });
      drawPowerSword(ui.gfx(), px + 62 + w1 + 8, y + 8);
      ui.text(fmtPower(s.power), px + 62 + w1 + 16, y, { size: 13, bold: true, color: '#ffd54a' });
      ui.bar(px + 62, y + 20, 100, 8, s.troops / s.maxTroops, s.troops / s.maxTroops < 0.35 ? 0xff6a3d : 0x5dff8a);
      ui.text(`${Math.round(s.troops)}/${s.maxTroops}`, px + 168, y + 15, { size: 11, color: COLORS.dim });
      ui.text(this.squadStatus(s, view), px + 62, y + 32, { size: 11, color: COLORS.dim });
      if (s.state === 'hq') {
        ui.button(px + pw - 94, y + 2, 82, 22, s.defend ? 'Defend: ON' : 'Defend: OFF', {
          onClick: () => session.sendCommand({ type: 'setDefend', squadId: s.id, defend: !s.defend }),
          active: s.defend,
          size: 11,
        });
      } else if (s.state === 'garrison' || s.state === 'hqGarrison' || (s.state === 'march' && s.march && s.march.purpose !== 'home')) {
        ui.button(px + pw - 104, y + 2, 92, 22, 'Return to HQ', { onClick: () => session.sendCommand({ type: 'cancel', squadId: s.id }), size: 11, accent: COLORS.enemy });
      }
    });
  }

  /** Everything the inspector and the order panel need about the selected target. */
  private targetData(view: WireView, simMs: number) {
    const t = this.target;
    if (!t) return null;
    const info = session.info!;
    let title = '';
    let body: [string, string][] = [];
    let attackable = true;
    let allyHq = false;
    let report: (typeof view.scoutReports)[number] | undefined;
    if (t.kind === 'cache') {
      const c = view.caches.find((x) => x.id === t.id);
      if (!c) return null;
      title = 'Score cache';
      body = [
        [`Worth ${fmtInt(c.value)} points, fixed`, '#ffe08a'],
        [`Dropped from the pool of ${this.nodeLabel(view, c.nodeId)} when it changed hands, from ${c.from === this.mine ? 'your team' : 'the enemy team'}.`, COLORS.dim],
        ['Any scout can collect it. The points are added to its team score for good the moment it touches.', COLORS.dim],
      ];
    } else if (t.kind === 'node') {
      const d = this.nodeInfoLines(view, t.id);
      if (!d) return null;
      title = d.title;
      body = d.lines;
      const nv = view.nodes.find((x) => x.id === t.id);
      if (nv?.kind === 'portal') attackable = true; // the order panel offers the teleport
      if (nv?.unlocksAtMs !== undefined && simMs < nv.unlocksAtMs) {
        body = [[`Locked: opens in ${fmtTime(nv.unlocksAtMs - simMs)} (${nv.tier === 4 ? 'at 50%' : 'at 75%'} of the clock left)`, COLORS.warn], ...body];
        attackable = false;
      }
      report = view.scoutReports.filter((r) => r.expiresAtMs > simMs && r.target.kind === 'node' && r.target.nodeId === t.id).sort((a, b) => b.takenAtMs - a.takenAtMs)[0];
    } else if (t.own) {
      const hq = view.hqs.find((x) => x.id === t.id);
      if (!hq) return null;
      title = hq.id === info.hqId ? 'Your HQ' : `HQ of ${hq.owner} (ally)`;
      body = [[`HP ${hq.hp} / ${hq.maxHp}${hq.burning ? ' (burning)' : ''}`, hq.burning ? COLORS.warn : COLORS.text]];
      body.push([`Allied garrison ${hq.garrisonCount} / ${this.tune.garrison.maxSquads}`, COLORS.text]);
      if (hq.id !== info.hqId) {
        body.push(['Garrison a squad here to help defend it, like at a node.', COLORS.dim]);
        allyHq = hq.location.kind !== 'safe';
      }
      attackable = allyHq;
    } else {
      const hq = view.enemyHqs.find((x) => x.id === t.id);
      if (!hq) return null;
      title = 'Enemy HQ';
      body = [[hq.burning ? 'Burning: below full HP' : 'Intact', hq.burning ? COLORS.warn : COLORS.dim], ['Hit it when it is out in the field. HQs in a safe zone cannot be attacked.', COLORS.dim]];
      report = view.scoutReports.filter((r) => r.expiresAtMs > simMs && r.target.kind === 'hq' && r.target.hqId === t.id).sort((a, b) => b.takenAtMs - a.takenAtMs)[0];
    }
    const mine = view.squads.filter((s) => s.owner === info.playerId);
    const node = t.kind === 'node' ? view.nodes.find((n) => n.id === t.id) : undefined;
    const hq = view.hqs.find((x) => x.id === info.hqId);
    return {
      t,
      title,
      body,
      attackable,
      portal: node?.kind === 'portal',
      allyHq,
      cache: t.kind === 'cache',
      report,
      node,
      atHq: mine.filter((s) => s.state === 'hq' && s.troops > 0),
      here: t.kind === 'node' ? mine.filter((s) => s.state === 'garrison' && s.nodeId === t.id) : mine.filter((s) => s.state === 'hqGarrison' && s.hqId === t.id),
      scoutHome: view.scouts.find((s) => s.owner === info.playerId && s.state === 'home'),
      canTeleport: !!(node && ((node.owner === this.mine && node.visible) || node.kind === 'portal') && hq && hq.nextTeleportAtMs <= simMs && !(hq.location.kind === 'node' && hq.location.nodeId === node.id)),
    };
  }

  /** Greedy word wrap by character count. */
  private wrap(text: string, maxChars: number): string[] {
    const out: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      if ((line + ' ' + word).trim().length > maxChars && line) {
        out.push(line);
        line = word;
      } else line = (line + ' ' + word).trim();
    }
    if (line) out.push(line);
    return out;
  }

  /** Bottom centre: what is selected. Its orders sit to the right (drawOrderPanel). */
  private drawTargetPanel(view: WireView, simMs: number, w: number, h: number): void {
    const d = this.targetData(view, simMs);
    if (!d) return;
    const ui = this.ui;
    const pw = 340;
    const gap = 8;
    const ow = 290;
    const total = pw + gap + ow;
    // Centre the pair, but slide it clear of the squad panel on the left when the window is narrow.
    const squadRight = 560;
    const px = Math.round(Math.max((w - total) / 2, Math.min(squadRight, w - total - 8)));
    const bottom = h - 34;

    const lines: { text: string; color: string }[] = [];
    for (const [text, color] of d.body) for (const l of this.wrap(text, 50)) lines.push({ text: l, color });
    const defenders = d.report && !d.report.empty ? d.report.defenders : [];
    const shown = defenders.slice(0, 6);
    const reportH = d.report ? 22 + shown.length * 15 + (defenders.length > shown.length ? 15 : 0) : 0;
    // Both panels share one height so the pair reads as a single, aligned group.
    const ph = Math.max(40 + lines.length * 16 + reportH + 8, this.orderHeight(d));
    const py = bottom - ph;

    ui.panel(px, py, pw, ph);
    ui.text(d.title, px + 12, py + 10, { size: 15, bold: true });
    ui.button(px + pw - 30, py + 6, 22, 22, 'x', { onClick: () => (this.target = null), size: 12 });
    let y = py + 34;
    for (const l of lines) {
      ui.text(l.text, px + 12, y, { size: 12, color: l.color });
      y += 16;
    }
    if (d.report) {
      ui.text(`Scouted ${Math.round((simMs - d.report.takenAtMs) / 1000)}s ago, expires ${fmtTime(d.report.expiresAtMs - simMs)}`, px + 12, y + 2, { size: 11, color: COLORS.warn });
      y += 22;
      for (const q of shown) {
        ui.text(`${SQUAD_LABEL[q.type]}  Power ${fmtPower(q.effectivePower)}  ${q.commander}`, px + 20, y, { size: 11 });
        y += 15;
      }
      if (defenders.length > shown.length) ui.text(`+${defenders.length - shown.length} more`, px + 20, y, { size: 11, color: COLORS.dim });
    }

    this.drawOrderPanel(d, px + pw + gap, ow, bottom, ph);
  }

  /** Natural height of the orders panel for the current target. */
  private orderHeight(d: NonNullable<ReturnType<GameScene['targetData']>>): number {
    if (!d.attackable || d.portal || d.cache) return 40 + 32 + 6;
    const rows = d.atHq.length + d.here.length + (d.allyHq ? 0 : 1) + (d.canTeleport ? 1 : 0) + (d.atHq.length === 0 ? 1 : 0);
    return 40 + rows * 32 + 6;
  }

  private drawOrderPanel(d: NonNullable<ReturnType<GameScene['targetData']>>, ox: number, ow: number, bottom: number, fixedH: number): void {
    const ui = this.ui;
    const t = d.t;
    const ownNode = d.node?.owner === this.mine || d.allyHq;
    if (!d.attackable) {
      const oh = fixedH;
      ui.panel(ox, bottom - oh, ow, oh);
      ui.text('Orders', ox + 12, bottom - oh + 10, { size: 14, bold: true });
      const locked = d.node?.unlocksAtMs !== undefined && d.node.unlocksAtMs > session.simNow();
      const msg = locked ? 'Locked. Orders open when the node unlocks.' : 'No orders for this target.';
      ui.text(msg, ox + 12, bottom - oh + 36, { size: 12, color: COLORS.dim });
      return;
    }
    if (d.portal) {
      const oh = fixedH;
      ui.panel(ox, bottom - oh, ow, oh);
      ui.text('Orders', ox + 12, bottom - oh + 10, { size: 14, bold: true });
      const nid = d.node!.id;
      ui.button(ox + 10, bottom - oh + 34, ow - 20, 28, d.canTeleport ? 'Teleport HQ here' : 'HQ cannot teleport yet', {
        onClick: () => session.sendCommand({ type: 'teleport', nodeId: nid }),
        enabled: d.canTeleport,
        size: 12,
        accent: COLORS.gold,
      });
      return;
    }
    if (d.cache) {
      const sc = d.scoutHome;
      const oh = fixedH;
      ui.panel(ox, bottom - oh, ow, oh);
      ui.text('Orders', ox + 12, bottom - oh + 10, { size: 14, bold: true });
      ui.button(ox + 10, bottom - oh + 34, ow - 20, 28, sc ? 'Send scout to collect' : 'No scout at home', {
        onClick: () => sc && session.sendCommand({ type: 'scout', scoutIndex: sc.index, target: this.targetBody(t) }),
        enabled: !!sc,
        size: 12,
        accent: 0xffd54a,
      });
      return;
    }
    const oh = fixedH;
    const oy = bottom - oh;
    ui.panel(ox, oy, ow, oh);
    ui.text('Orders', ox + 12, oy + 10, { size: 14, bold: true });
    let y = oy + 34;
    for (const s of d.atHq) {
      ui.button(ox + 10, y, ow - 20, 28, `${ownNode ? 'Garrison' : 'Attack'}: ${SQUAD_LABEL[s.type]}  ${fmtPower(s.power)}`, {
        onClick: () => {
          this.selectedSquad = s.id;
          this.sendSquad(s.id, t);
        },
        active: this.selectedSquad === s.id,
        size: 12,
      });
      y += 32;
    }
    if (d.atHq.length === 0) {
      ui.text('No squad at HQ. Return one first.', ox + 12, y + 6, { size: 12, color: COLORS.dim });
      y += 32;
    }
    for (const s of d.here) {
      ui.button(ox + 10, y, ow - 20, 28, `Return to HQ: ${SQUAD_LABEL[s.type]}  ${fmtPower(s.power)}`, { onClick: () => session.sendCommand({ type: 'cancel', squadId: s.id }), size: 12, accent: COLORS.enemy });
      y += 32;
    }
    const sc = d.scoutHome;
    if (!d.allyHq) {
      ui.button(ox + 10, y, ow - 20, 28, sc ? 'Send scout' : 'No scout at home', {
        onClick: () => sc && session.sendCommand({ type: 'scout', scoutIndex: sc.index, target: this.targetBody(t) }),
        enabled: !!sc,
        size: 12,
        accent: 0xbfe9ff,
      });
      y += 32;
    }
    if (d.canTeleport && d.node) {
      const nid = d.node.id;
      ui.button(ox + 10, y, ow - 20, 28, 'Teleport HQ here', { onClick: () => session.sendCommand({ type: 'teleport', nodeId: nid }), size: 12, accent: COLORS.gold });
    }
  }

  /** Draw one line, truncating rather than overflowing the panel. */
  private wrapText(line: string, x: number, y: number, maxW: number, color: string): void {
    const maxChars = Math.floor(maxW / 6.4);
    this.ui.text(line.length > maxChars ? line.slice(0, maxChars - 1) + '...' : line, x, y, { size: 12, color });
  }

  private drawScouts(view: WireView, simMs: number, h: number): void {
    const ui = this.ui;
    const info = session.info!;
    const px = 76;
    const py = 44;
    const pw = 400;
    const ph = Math.min(430, h - 44 - 270);
    ui.panel(px, py, pw, ph);
    ui.text('Scout reports', px + 12, py + 10, { size: 15, bold: true });
    ui.button(px + pw - 30, py + 6, 22, 22, 'x', { onClick: () => (this.panel = 'none'), size: 12 });
    let y = py + 36;
    for (const sc of view.scouts.filter((s) => s.owner === info.playerId)) {
      const st = sc.state === 'home' ? 'home' : sc.state === 'out' ? `outbound ${fmtTime((sc.arriveMs ?? simMs) - simMs)}` : `returning ${fmtTime((sc.arriveMs ?? simMs) - simMs)}`;
      ui.text(`Scout ${sc.index + 1}: ${st}`, px + 12, y, { size: 11, color: sc.state === 'home' ? COLORS.good : COLORS.warn });
      y += 15;
    }
    y += 6;
    const reports = view.scoutReports.filter((r) => r.expiresAtMs > simMs).sort((a, b) => b.takenAtMs - a.takenAtMs);
    if (reports.length === 0) ui.text('No live reports. Scout a node or enemy HQ.', px + 12, y, { size: 12, color: COLORS.dim });
    for (const r of reports) {
      const need = 22 + Math.min(r.defenders.length, 6) * 14 + 8;
      if (y + need > py + ph) break;
      const name = r.target.kind === 'node' ? this.nodeLabel(view, r.target.nodeId) : 'Enemy HQ';
      ui.rect(px + 8, y, pw - 16, need - 4, 0x161c25, 1, COLORS.panelEdge, 4);
      ui.region(px + 8, y, pw - 16, need - 4, () => {
        if (r.target.kind === 'node') {
          const nid = r.target.nodeId;
          const n = view.nodes.find((x) => x.id === nid);
          if (n) {
            const p = this.iso.p(n.pos.x, n.pos.y);
            this.camX = p.x;
            this.camY = p.y;
          }
          this.target = { kind: 'node', id: nid };
        }
      });
      ui.text(name, px + 14, y + 3, { size: 12, bold: true });
      ui.text(`${fmtTime(r.expiresAtMs - simMs)}`, px + pw - 14, y + 3, { size: 12, align: 'right', color: COLORS.warn });
      let ly = y + 20;
      if (r.empty) ui.text('HQ already gone', px + 20, ly, { size: 11, color: COLORS.dim });
      r.defenders.slice(0, 6).forEach((d) => {
        ui.text(`${SQUAD_LABEL[d.type]}  Power ${fmtPower(d.effectivePower)}  ${d.commander}`, px + 20, ly, { size: 11 });
        ly += 14;
      });
      y += need;
    }
  }

  private drawLogs(view: WireView, simMs: number, h: number): void {
    const ui = this.ui;
    const px = 76;
    const py = 44;
    const pw = 460;
    const ph = Math.min(460, h - 44 - 270);
    ui.panel(px, py, pw, ph);
    ui.text('Logs', px + 12, py + 10, { size: 15, bold: true });
    ui.button(px + pw - 30, py + 6, 22, 22, 'x', { onClick: () => (this.panel = 'none'), size: 12 });
    let y = py + 36;
    if (view.combatLogs.length === 0) ui.text('No fights yet.', px + 12, y, { size: 12, color: COLORS.dim });
    const OUTCOME: Record<CombatLog['outcome'], string> = {
      captured: 'Captured',
      attackerDefeated: 'Attacker defeated',
      capReached: 'Attack capped',
      hqDamaged: 'HQ damaged',
      hqDefeated: 'HQ defeated',
      noDefenders: 'Taken, no defenders',
    };
    const typeName = (t: SquadType) => SQUAD_LABEL[t];
    for (const log of view.combatLogs.slice(0, clientTune.hud.logsMax)) {
      const fights = log.fights.slice(0, 3);
      const need = 34 + fights.length * 14 + (log.fights.length > fights.length ? 14 : 0) + 6;
      if (y + need > py + ph) break;
      const where = log.subject.kind === 'node' ? this.nodeLabel(view, log.subject.nodeId) : 'HQ';
      const good = (log.attacker.team === this.mine) === (log.outcome === 'captured' || log.outcome === 'hqDamaged' || log.outcome === 'hqDefeated' || log.outcome === 'noDefenders');
      ui.rect(px + 8, y, pw - 16, need - 4, 0x161c25, 1, COLORS.panelEdge, 4);
      ui.text(`${fmtTime(log.timeMs)}  ${where}`, px + 14, y + 3, { size: 12, bold: true });
      ui.text(OUTCOME[log.outcome], px + pw - 14, y + 3, { size: 12, align: 'right', bold: true, color: good ? COLORS.good : COLORS.bad });
      const a = log.attacker;
      ui.text(`${a.commander} ${typeName(a.type)} Power ${fmtPower(a.power)}  ${Math.round(a.troopsBefore)} > ${Math.round(a.troopsAfter)}`, px + 14, y + 19, { size: 11, color: cssColor(teamColor(a.team, this.mine)) });
      let ly = y + 33;
      for (const f of fights) {
        const d = f.defender;
        ui.text(`vs ${d.commander} ${typeName(d.type)} Power ${fmtPower(d.power)}  ${Math.round(d.troopsBefore)} > ${Math.round(d.troopsAfter)}`, px + 22, ly, { size: 11, color: cssColor(teamColor(d.team, this.mine)) });
        ly += 14;
      }
      if (log.fights.length > fights.length) ui.text(`+${log.fights.length - fights.length} more fights`, px + 22, ly, { size: 11, color: COLORS.dim });
      y += need;
    }
  }

  private drawMinimap(view: WireView, w: number, h: number): void {
    const ui = this.ui;
    const mw = clientTune.hud.minimapWidth;
    const mh = Math.round((mw * this.iso.rows) / this.iso.cols);
    const mx = w - mw - 12;
    const my = h - mh - 34;
    this.mapRect = { x: mx, y: my, w: mw, h: mh };
    ui.panel(mx - 4, my - 4, mw + 8, mh + 8, 0.92);
    ui.rect(mx, my, mw, mh, 0x1a1210, 1);
    const sx = mw / (this.iso.cols * this.iso.cell);
    const sy = mh / (this.iso.rows * this.iso.cell);
    const g = ui.gfx();
    const info = session.info!;
    info.map.safeZones.forEach((z, team) => {
      g.fillStyle(teamColor(team as TeamId, this.mine), 0.3).fillRect(mx + z.origin.cx * this.iso.cell * sx, my + z.origin.cy * this.iso.cell * sy, z.cols * this.iso.cell * sx, z.rows * this.iso.cell * sy);
    });
    for (const n of view.nodes) {
      if (n.owner === this.mine && n.visible) {
        g.fillStyle(COLORS.mine, 0.12).fillCircle(mx + n.pos.x * sx, my + n.pos.y * sy, this.tune.nodes[n.kind].visionRadiusCells * this.iso.cell * sx);
      }
    }
    for (const n of view.nodes) {
      const col = n.owner === null ? COLORS.neutral : teamColor(n.owner, this.mine);
      const r = 2 + n.tier * 0.8;
      g.fillStyle(col, n.visible ? 1 : 0.55).fillRect(mx + n.pos.x * sx - r / 2, my + n.pos.y * sy - r / 2, r, r);
    }
    for (const q of view.hqs) g.fillStyle(q.id === info.hqId ? COLORS.self : COLORS.mine, 1).fillCircle(mx + q.pos.x * sx, my + q.pos.y * sy, q.id === info.hqId ? 3 : 2);
    for (const q of view.enemyHqs) g.fillStyle(COLORS.enemy, 1).fillCircle(mx + q.pos.x * sx, my + q.pos.y * sy, 2);
    const simMs = session.simNow();
    for (const m of view.enemyMarches) {
      const p = marchPos(m.march, simMs);
      g.fillStyle(COLORS.enemyLine, 1).fillCircle(mx + p.x * sx, my + p.y * sy, 1.6);
    }
    // View window: the four screen corners back in world space.
    const corners = [
      this.screenToMap(0, 0),
      this.screenToMap(w, 0),
      this.screenToMap(w, h),
      this.screenToMap(0, h),
    ].map((c) => this.iso.unproject(c.x, c.y));
    g.lineStyle(1, 0xffffff, 0.8);
    g.beginPath();
    corners.forEach((c, i) => {
      const x = Phaser.Math.Clamp(mx + c.x * sx, mx, mx + mw);
      const y = Phaser.Math.Clamp(my + c.y * sy, my, my + mh);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.closePath();
    g.strokePath();
    ui.region(mx, my, mw, mh, (px, py) => {
      const wx = ((px - mx) / mw) * this.iso.cols * this.iso.cell;
      const wy = ((py - my) / mh) * this.iso.rows * this.iso.cell;
      const p = this.iso.p(wx, wy);
      this.camX = p.x;
      this.camY = p.y;
    });
  }
}
