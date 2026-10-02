import Phaser from 'phaser';
import type { CombatLog, NodeKind, SquadType, TeamId, Tune, Vec } from 'arena-sim';
import type { ClientEvent, WireEnemyMarch, WireSquad, WireView } from 'firestorm-net';
import { BaseScene, DPR, logicalSize } from './base';
import { Ui } from '../ui/ui';
import { intents } from '../input/intents';
import { session } from '../net/session';
import { Iso, diamond } from '../render/iso';
import { bakeGround, paintFog, type Ground, type LavaTile } from '../render/ground';
import { FxSystem } from '../render/fx';
import { drawFlames, drawHq, drawNodeIcon, drawNodeStack, drawUnit } from '../render/icons';
import { clientTune } from '../clientTune';
import { COLORS, FONT, KIND_LABEL, SQUAD_LABEL, cssColor, shade, teamColor } from '../theme';

type Target = { kind: 'node'; id: string } | { kind: 'hq'; id: string; own: boolean };
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
  private lavaG!: Phaser.GameObjects.Graphics;
  private linesG!: Phaser.GameObjects.Graphics;
  private entG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private fx!: FxSystem;
  private lava: LavaTile[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private labelUsed = 0;
  private fogKey: string | null = null;

  private camX = 0;
  private camY = 0;
  private zoom = clientTune.camera.startZoom;

  private selectedSquad: string | null = null;
  private target: Target | null = null;
  private panel: Panel = 'none';
  private lastFrame = 0;
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
    this.fogKey = null;
    this.lastFrame = this.time.now;
  }

  // ------------------------------------------------------------------ setup

  private init(): void {
    const info = session.info!;
    this.tune = info.tune;
    this.mine = info.team;
    this.iso = new Iso(this.tune);
    this.ground = bakeGround(this, this.iso, info.map, this.tune, this.mine);
    this.lava = this.ground.lava;

    this.world = this.add.container(0, 0);
    this.world.add(this.add.image(0, 0, this.ground.groundKey).setOrigin(0, 0));
    this.lavaG = this.add.graphics();
    this.world.add(this.lavaG);
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
      this.ui.begin();
      const { w, h } = logicalSize();
      this.ui.rect(0, 0, w, h, 0x0b0709, 1);
      this.ui.text('Loading match...', w / 2, h / 2, { size: 18, align: 'center', color: COLORS.dim });
      this.drawVersion();
      this.ui.end();
      for (const e of events) if (e.type === 'primary') this.ui.click(e.x, e.y);
      return;
    }
    if (!this.ready) this.init();

    const simMs = session.simNow();
    const now = time / 1000;
    this.handleIntents(events, dt, view);
    this.handleEvents(view, now);
    this.fx.ambient(now);
    this.drawWorld(view, simMs, now);
    this.drawHud(view, simMs);
  }

  // ----------------------------------------------------------------- camera

  private screenToMap(x: number, y: number): Vec {
    return { x: (x - this.world.x) / this.zoom, y: (y - this.world.y) / this.zoom };
  }

  private applyCam(): void {
    const { w, h } = logicalSize();
    this.camX = Phaser.Math.Clamp(this.camX, 0, this.iso.pxW);
    this.camY = Phaser.Math.Clamp(this.camY, 0, this.iso.pxH);
    this.world.setPosition(w / 2 - this.camX * this.zoom, h / 2 - this.camY * this.zoom);
    this.world.setScale(this.zoom);
  }

  private zoomAt(steps: number, px: number, py: number): void {
    const { w, h } = logicalSize();
    const x = px < 0 ? w / 2 : px;
    const y = py < 0 ? h / 2 : py;
    const before = this.screenToMap(x, y);
    this.zoom = Phaser.Math.Clamp(this.zoom * Math.pow(clientTune.camera.zoomStep, steps), clientTune.camera.zoomMin, clientTune.camera.zoomMax);
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
        case 'primary':
          if (!this.ui.click(e.x, e.y)) this.target = this.pick(e.x, e.y, view);
          break;
        case 'secondary': {
          if (this.ui.covers(e.x, e.y)) break;
          const t = this.pick(e.x, e.y, view);
          if (t && this.selectedSquad) this.sendSquad(this.selectedSquad, t);
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
    for (const n of view.nodes) {
      const p = this.iso.p(n.pos.x, n.pos.y);
      consider(Math.hypot(m.x - p.x, m.y - (p.y - n.tier * clientTune.iso.cubeHeight * 0.6)), 34, { kind: 'node', id: n.id });
    }
    for (const h of view.hqs) {
      const p = this.iso.p(h.pos.x, h.pos.y);
      consider(Math.hypot(m.x - p.x, m.y - (p.y - 10)), 28, { kind: 'hq', id: h.id, own: true });
    }
    for (const h of view.enemyHqs) {
      const p = this.iso.p(h.pos.x, h.pos.y);
      consider(Math.hypot(m.x - p.x, m.y - (p.y - 10)), 28, { kind: 'hq', id: h.id, own: false });
    }
    return best ? (best as { d: number; t: Target }).t : null;
  }

  // ---------------------------------------------------------------- commands

  private targetBody(t: Target) {
    return t.kind === 'node' ? ({ kind: 'node', nodeId: t.id } as const) : ({ kind: 'hq', hqId: t.id } as const);
  }

  private sendSquad(squadId: string, t: Target): void {
    session.sendCommand({ type: 'march', squadId, target: this.targetBody(t) });
  }

  // ------------------------------------------------------------------ events

  private nodeLabel(view: WireView, id: string): string {
    const n = view.nodes.find((x) => x.id === id);
    return n ? `${KIND_LABEL[n.kind]} T${n.tier}` : 'a node';
  }

  private subjectPos(view: WireView, log: CombatLog): Vec | null {
    if (log.subject.kind === 'node') {
      const id = log.subject.nodeId;
      return view.nodes.find((n) => n.id === id)?.pos ?? null;
    }
    const id = log.subject.hqId;
    return view.hqs.find((h) => h.id === id)?.pos ?? view.enemyHqs.find((h) => h.id === id)?.pos ?? null;
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
        case 'turretPulse': {
          const n = view.nodes.find((x) => x.id === e.nodeId);
          if (n) this.fx.ring(n.pos.x, n.pos.y, now, 0xffd54a, 1.2, 2.4);
          break;
        }
        case 'garrisonRejected':
          session.toast(`Could not garrison: ${e.reason}`, 'bad');
          break;
        case 'matchEnded':
          break;
        default:
          break;
      }
    }
  }

  // ------------------------------------------------------------------- world

  private label(text: string, x: number, y: number, color: string, size = 11, align: 0 | 0.5 = 0.5): void {
    let t = this.labels[this.labelUsed];
    if (!t) {
      t = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#fff', resolution: DPR * 2, stroke: '#000', strokeThickness: 3 });
      this.world.add(t);
      this.labels[this.labelUsed] = t;
    }
    t.setText(text).setColor(color).setFontSize(size).setOrigin(align, 0).setPosition(x, y).setVisible(true);
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
    g.lineStyle(width, color, alpha);
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
      .filter((n) => n.owner === mine && n.visible)
      .map((n) => ({ x: n.pos.x, y: n.pos.y, r: this.tune.nodes[n.kind].visionRadiusCells * this.tune.map.cellSize }));
    const key = circles.map((c) => `${c.x},${c.y},${c.r}`).join(';');
    if (key !== this.fogKey) {
      this.fogKey = key;
      paintFog(this.ground, iso, circles);
    }

    // Lava breathes.
    const lg = this.lavaG;
    lg.clear();
    const pulse = clientTune.fx.lavaPulseSpeed;
    for (const t of this.lava) {
      const k = 0.5 + 0.5 * Math.sin(now * pulse + t.phase);
      const p = iso.p((t.cx + 0.5) * iso.cell, (t.cy + 0.5) * iso.cell);
      diamond(lg, p.x, p.y, iso.tw / 2 - 2, iso.th / 2 - 1, Phaser.Display.Color.GetColor(200 + k * 55, 50 + k * 60, 10), 0.85);
      diamond(lg, p.x, p.y, iso.tw / 4, iso.th / 4, Phaser.Display.Color.GetColor(255, 170 + k * 70, 60), 0.35 + k * 0.3);
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
    const hw = (iso.tw / 2) * clientTune.iso.cubeFootprint;

    // Nodes
    for (const n of view.nodes) {
      const p = iso.p(n.pos.x, n.pos.y);
      add(n.pos, () => {
        const col = n.owner === null ? COLORS.neutral : teamColor(n.owner, mine);
        const alpha = !n.explored ? 0.45 : n.visible ? 1 : clientTune.fog.hiddenNodeAlpha;
        diamond(g, p.x, p.y, iso.tw / 2 - 3, iso.th / 2 - 1.5, col, n.visible ? 0.4 : 0.18, shade(col, 1.2), 1);
        if (selNode === n.id) {
          const pulse = 0.5 + 0.5 * Math.sin(now * 6);
          diamond(g, p.x, p.y, iso.tw / 2 + 4, iso.th / 2 + 2, undefined, 1, 0xffffff, 2 + pulse);
        }
        const lift = drawNodeStack(g, p.x, p.y, n.tier, n.explored ? col : COLORS.neutral, hw, alpha);
        drawNodeIcon(g, n.kind, p.x, p.y - lift - 12, 1);
        if (n.garrisonCount !== undefined) {
          const own = n.owner === mine && n.visible;
          const txt = own ? `${n.garrisonCount}/${this.tune.garrison.maxSquads}` : `~${n.garrisonCount}`;
          const stale = !own && n.garrisonCountAsOfMs !== undefined ? ` (${Math.round((simMs - n.garrisonCountAsOfMs) / 1000)}s)` : '';
          this.label(txt + stale, p.x, p.y + iso.th / 2 + 2, own ? '#cfe9ff' : '#ffd08a', 11);
        }
      });
    }

    // HQs
    for (const h of view.hqs) {
      const p = iso.p(h.pos.x, h.pos.y);
      const isMe = h.id === info.hqId;
      add(h.pos, () => {
        if (selHq === h.id) diamond(g, p.x, p.y, 30, 15, undefined, 1, 0xffffff, 2);
        drawHq(g, p.x, p.y, COLORS.mine, 20);
        for (let i = 0; i < h.maxHp; i++) g.fillStyle(i < h.hp ? 0x7dff9b : 0x3a2a2a, 1).fillRect(p.x - h.maxHp * 4 + i * 8, p.y - 36, 6, 4);
        if (h.burning) drawFlames(g, p.x, p.y - 4, now, 1.7, 3);
        if (isMe) {
          const bob = Math.sin(now * 4) * 2;
          g.fillStyle(COLORS.self, 1).fillTriangle(p.x - 6, p.y - 52 + bob, p.x + 6, p.y - 52 + bob, p.x, p.y - 44 + bob);
        }
        if (isMe || this.zoom > 1.4) this.label(isMe ? 'YOU' : h.owner, p.x, p.y + 8, isMe ? '#8dffa8' : '#9fb3c8', 10);
      });
    }
    for (const h of view.enemyHqs) {
      const p = iso.p(h.pos.x, h.pos.y);
      add(h.pos, () => {
        if (selHq === h.id) diamond(g, p.x, p.y, 30, 15, undefined, 1, 0xffffff, 2);
        drawHq(g, p.x, p.y, COLORS.enemy, 20);
        if (h.burning) drawFlames(g, p.x, p.y - 4, now, 1.7, 5);
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
      if (s.march.purpose !== 'home') this.dashed(lines, p, to, mineSquad ? COLORS.self : COLORS.ally, now, mineSquad ? 0.95 : 0.6);
      add(pos, () => {
        const f = to.x >= p.x ? 1 : -1;
        if (this.selectedSquad === s.id) diamond(g, p.x, p.y, 22, 11, undefined, 1, COLORS.self, 2);
        drawUnit(g, s.type, p.x, p.y - 8, f, COLORS.mine, now, mineSquad ? 1 : 0.8);
        if (s.burning) drawFlames(g, p.x, p.y - 8, now, 1, s.id.length);
        if (mineSquad) g.fillStyle(0x000000, 0.6).fillRect(p.x - 12, p.y - 30, 24, 3).fillStyle(COLORS.self, 1).fillRect(p.x - 12, p.y - 30, 24 * (s.troops / s.maxTroops), 3);
      });
    }

    // Enemy marches: masked unless a scout has revealed them
    for (const m of view.enemyMarches as WireEnemyMarch[]) {
      const pos = marchPos(m.march, simMs);
      const p = iso.p(pos.x, pos.y);
      const to = iso.p(m.march.to.x, m.march.to.y);
      if (!m.burning) this.dashed(lines, p, to, COLORS.enemyLine, now, 0.85);
      add(pos, () => {
        const f = to.x >= p.x ? 1 : -1;
        if (m.revealed) {
          drawUnit(g, m.revealed.type, p.x, p.y - 8, f, COLORS.enemy, now);
          this.label(`${m.revealed.commander} ${m.revealed.effectivePower.toFixed(0)}`, p.x, p.y + 2, '#ffb08a', 10);
        } else {
          g.lineStyle(2, COLORS.enemy, 1);
          g.fillStyle(0x0c1016, 0.9);
          g.fillRoundedRect(p.x - 11, p.y - 22, 22, 18, 4);
          g.strokeRoundedRect(p.x - 11, p.y - 22, 22, 18, 4);
          this.label('?', p.x, p.y - 22, '#ff9a6a', 13);
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
      add(pos, () => drawUnit(g, 'scout', p.x, p.y - 30, to.x >= p.x ? 1 : -1, COLORS.mine, now, sc.owner === info.playerId ? 1 : 0.6));
    }

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.draw();
    this.fx.draw(this.fxG, now);
    for (let i = this.labelUsed; i < this.labels.length; i++) this.labels[i].setVisible(false);
    void ch;
  }

  // --------------------------------------------------------------------- HUD

  private nodeInfoLines(view: WireView, id: string): { title: string; lines: [string, string][] } | null {
    const n = view.nodes.find((x) => x.id === id);
    if (!n) return null;
    const tune = this.tune;
    const lines: [string, string][] = [];
    const owner = !n.explored ? 'Never seen' : n.owner === null ? 'Neutral' : n.owner === this.mine ? 'Your team' : 'Enemy';
    lines.push([n.visible ? owner : `${owner} (last known)`, n.owner === this.mine ? COLORS.good : n.owner === null ? COLORS.dim : COLORS.bad]);
    lines.push([`Score ${tune.scoring.tierPointsPerSecond[n.tier - 1]}/s, +${tune.scoring.garrisonPointsPerSecond}/s per garrisoned commander`, COLORS.text]);
    const k = tune.nodes[n.kind];
    const effects: string[] = [];
    if (k.attackPct) effects.push(`+${Math.round(k.attackPct * n.tier * 100)}% attack`);
    if (k.defensePct) effects.push(`+${Math.round(k.defensePct * n.tier * 100)}% defense`);
    if (k.speedPct) effects.push(`+${Math.round(k.speedPct * n.tier * 100)}% speed`);
    if (k.teleportCooldownReductionSeconds) effects.push(`-${k.teleportCooldownReductionSeconds * n.tier}s teleport cooldown`);
    if (n.kind === 'largeVision') effects.push(`${k.visionRadiusCells} cell vision`);
    if (n.kind === 'turret') effects.push(`${Math.round(tune.turret.damageFraction * 100)}% damage every ${tune.turret.pulseSeconds}s`);
    if (effects.length) lines.push([`Team bonus: ${effects.join(', ')}`, COLORS.warn]);
    if (n.garrisonCount !== undefined) {
      const own = n.owner === this.mine && n.visible;
      lines.push([own ? `Garrison ${n.garrisonCount} / ${tune.garrison.maxSquads}` : `Garrison ${n.garrisonCount} (scouted)`, COLORS.text]);
    } else lines.push(['Garrison unknown: send a scout', COLORS.dim]);
    return { title: `${KIND_LABEL[n.kind as NodeKind]}  Tier ${n.tier}`, lines };
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
    const activeReports = view.scoutReports.filter((r) => r.expiresAtMs > simMs).length;
    ui.button(w - 190, 4, 90, 26, `Scouts ${activeReports}`, { onClick: () => (this.panel = this.panel === 'scouts' ? 'none' : 'scouts'), active: this.panel === 'scouts', size: 12 });
    ui.button(w - 94, 4, 84, 26, `Logs ${view.combatLogs.length}`, { onClick: () => (this.panel = this.panel === 'logs' ? 'none' : 'logs'), active: this.panel === 'logs', size: 12 });

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
    this.drawTargetPanel(view, simMs, w);

    ui.text('Left click: inspect   Right click: send selected squad   Drag / WASD: pan   Wheel: zoom', w / 2, h - 18, { size: 11, align: 'center', color: COLORS.dim, alpha: 0.7 });

    // ---- end of match
    if (session.result) {
      ui.setLayer(2);
      ui.rect(0, 0, w, h, 0x000000, 0.65);
      ui.block(0, 0, w, h);
      const r = session.result;
      const won = r.winner === mine;
      const head = r.winner === 'draw' ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
      ui.text(head, w / 2, h / 2 - 90, { size: 56, bold: true, align: 'center', color: r.winner === 'draw' ? '#ffffff' : won ? '#7dff9b' : '#ff6a6a' });
      ui.text(`${fmtInt(r.points[mine])}  -  ${fmtInt(r.points[mine === 0 ? 1 : 0])}`, w / 2, h / 2 - 16, { size: 28, align: 'center', bold: true });
      ui.button(w / 2 - 100, h / 2 + 40, 200, 44, 'Back to menu', {
        onClick: () => {
          session.leave();
          this.go('Menu');
        },
        active: true,
        size: 16,
      });
    }
    void info;
    ui.end();
  }

  private squadStatus(s: WireSquad, view: WireView): string {
    if (s.state === 'hq') return 'At HQ';
    if (s.state === 'garrison') return `Garrisoned: ${s.nodeId ? this.nodeLabel(view, s.nodeId) : ''}`;
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
    ui.panel(px, py, pw, ph);
    if (hq) {
      const ready = hq.nextTeleportAtMs <= simMs;
      ui.text(`HQ  ${hq.hp}/${hq.maxHp}`, px + 10, py + 8, { size: 13, bold: true, color: hq.burning ? COLORS.warn : COLORS.text });
      ui.text(ready ? 'Teleport ready' : `Teleport ${fmtTime(hq.nextTeleportAtMs - simMs)}`, px + 110, py + 8, { size: 13, color: ready ? COLORS.good : COLORS.dim });
      const homeScouts = view.scouts.filter((s) => s.owner === info.playerId && s.state === 'home').length;
      const totalScouts = view.scouts.filter((s) => s.owner === info.playerId).length;
      ui.text(`Scouts ${homeScouts}/${totalScouts}`, px + pw - 10, py + 8, { size: 13, align: 'right', color: homeScouts > 0 ? COLORS.text : COLORS.dim });
    }
    ui.text(`Pool ${'  '}`, px + 10, py + 30, { size: 1, color: '#000000', alpha: 0 });
    squads.forEach((s, i) => {
      const y = py + 52 + i * rowH;
      const sel = this.selectedSquad === s.id;
      ui.rect(px + 6, y - 4, pw - 12, rowH - 4, sel ? 0x1f3a52 : 0x161c25, 1, sel ? COLORS.self : COLORS.panelEdge, 5);
      ui.region(px + 6, y - 4, pw - 12, rowH - 4, () => (this.selectedSquad = sel ? null : s.id));
      drawUnit(ui.gfx(), s.type, px + 32, y + 30, 1, COLORS.mine, this.time.now / 1000);
      ui.text(`${SQUAD_LABEL[s.type]}  P${s.power.toFixed(1)}  #${s.rank}`, px + 62, y, { size: 13, bold: true });
      ui.bar(px + 62, y + 20, 100, 8, s.troops / s.maxTroops, s.troops / s.maxTroops < 0.35 ? 0xff6a3d : 0x5dff8a);
      ui.text(`${Math.round(s.troops)}/${s.maxTroops}`, px + 168, y + 15, { size: 11, color: COLORS.dim });
      ui.text(this.squadStatus(s, view), px + 62, y + 32, { size: 11, color: COLORS.dim });
      if (s.state === 'hq') {
        ui.button(px + pw - 94, y + 2, 82, 22, s.defend ? 'Defend: ON' : 'Defend: OFF', {
          onClick: () => session.sendCommand({ type: 'setDefend', squadId: s.id, defend: !s.defend }),
          active: s.defend,
          size: 11,
        });
      } else if (s.state === 'march' && s.march && s.march.purpose !== 'home') {
        ui.button(px + pw - 94, y + 2, 82, 22, 'Recall', { onClick: () => session.sendCommand({ type: 'cancel', squadId: s.id }), size: 11, accent: COLORS.enemy });
      }
    });
  }

  private drawTargetPanel(view: WireView, simMs: number, w: number): void {
    const t = this.target;
    if (!t) return;
    const ui = this.ui;
    const info = session.info!;
    const pw = 310;
    const px = w - pw - 12;
    const py = 44;

    let title = '';
    let body: [string, string][] = [];
    let attackable = true;
    let report = undefined as undefined | (typeof view.scoutReports)[number];
    if (t.kind === 'node') {
      const d = this.nodeInfoLines(view, t.id);
      if (!d) return;
      title = d.title;
      body = d.lines;
      report = view.scoutReports.filter((r) => r.expiresAtMs > simMs && r.target.kind === 'node' && r.target.nodeId === t.id).sort((a, b) => b.takenAtMs - a.takenAtMs)[0];
    } else if (t.own) {
      const hq = view.hqs.find((x) => x.id === t.id);
      if (!hq) return;
      title = hq.id === info.hqId ? 'Your HQ' : `HQ of ${hq.owner} (ally)`;
      body = [[`HP ${hq.hp} / ${hq.maxHp}${hq.burning ? ' (burning)' : ''}`, hq.burning ? COLORS.warn : COLORS.text]];
      attackable = false;
    } else {
      const hq = view.enemyHqs.find((x) => x.id === t.id);
      if (!hq) return;
      title = 'Enemy HQ';
      body = [[hq.burning ? 'Burning: below full HP' : 'Intact', hq.burning ? COLORS.warn : COLORS.dim], ['Hit it when it is out in the field. HQs in a safe zone cannot be attacked.', COLORS.dim]];
      report = view.scoutReports.filter((r) => r.expiresAtMs > simMs && r.target.kind === 'hq' && r.target.hqId === t.id).sort((a, b) => b.takenAtMs - a.takenAtMs)[0];
    }

    const squads = view.squads.filter((s) => s.owner === info.playerId && s.state !== 'march' && s.troops > 0 && !(t.kind === 'node' && s.nodeId === t.id));
    const scoutHome = view.scouts.find((s) => s.owner === info.playerId && s.state === 'home');
    const hq = view.hqs.find((x) => x.id === info.hqId);
    const node = t.kind === 'node' ? view.nodes.find((n) => n.id === t.id) : undefined;
    const canTeleport = !!(node && node.owner === this.mine && node.visible && hq && hq.nextTeleportAtMs <= simMs && !(hq.location.kind === 'node' && hq.location.nodeId === node.id));

    const defenders = report && !report.empty ? report.defenders : [];
    const shown = defenders.slice(0, 8);
    const bodyH = body.length * 18;
    const reportH = report ? 22 + shown.length * 15 + (defenders.length > shown.length ? 15 : 0) : 0;
    const actionRows = (attackable ? squads.length : 0) + (attackable ? 1 : 0) + (canTeleport ? 1 : 0);
    const ph = 44 + bodyH + reportH + actionRows * 32 + 8;
    ui.panel(px, py, pw, ph);
    ui.text(title, px + 12, py + 10, { size: 15, bold: true });
    ui.button(px + pw - 30, py + 6, 22, 22, 'x', { onClick: () => (this.target = null), size: 12 });
    let y = py + 36;
    for (const [line, col] of body) {
      this.wrapText(line, px + 12, y, pw - 24, col);
      y += 18;
    }
    if (report) {
      ui.text(`Scouted ${Math.round((simMs - report.takenAtMs) / 1000)}s ago, expires ${fmtTime(report.expiresAtMs - simMs)}`, px + 12, y + 2, { size: 11, color: COLORS.warn });
      y += 22;
      for (const d of shown) {
        ui.text(`${SQUAD_LABEL[d.type]}  ${d.effectivePower.toFixed(1)}  ${d.commander}`, px + 20, y, { size: 11 });
        y += 15;
      }
      if (defenders.length > shown.length) {
        ui.text(`+${defenders.length - shown.length} more`, px + 20, y, { size: 11, color: COLORS.dim });
        y += 15;
      }
    }
    y += 4;
    if (attackable) {
      for (const s of squads) {
        const sel = this.selectedSquad === s.id;
        ui.button(px + 10, y, pw - 20, 28, `${t.kind === 'node' && node?.owner === this.mine ? 'Garrison' : 'Attack'} with ${SQUAD_LABEL[s.type]} P${s.power.toFixed(0)} (${Math.round(s.troops)})`, {
          onClick: () => {
            this.selectedSquad = s.id;
            this.sendSquad(s.id, t);
          },
          active: sel,
          size: 12,
        });
        y += 32;
      }
      ui.button(px + 10, y, pw - 20, 28, scoutHome ? 'Send scout' : 'No scout at home', { onClick: () => scoutHome && session.sendCommand({ type: 'scout', scoutIndex: scoutHome.index, target: this.targetBody(t) }), enabled: !!scoutHome, size: 12, accent: 0xbfe9ff });
      y += 32;
    }
    if (canTeleport && node) {
      ui.button(px + 10, y, pw - 20, 28, 'Teleport HQ here', { onClick: () => session.sendCommand({ type: 'teleport', nodeId: node.id }), size: 12, accent: COLORS.gold });
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
    const px = 12;
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
        ui.text(`${SQUAD_LABEL[d.type]}  ${d.effectivePower.toFixed(1)}  ${d.commander}`, px + 20, ly, { size: 11 });
        ly += 14;
      });
      y += need;
    }
  }

  private drawLogs(view: WireView, simMs: number, h: number): void {
    const ui = this.ui;
    const px = 12;
    const py = 44;
    const pw = 460;
    const ph = Math.min(460, h - 44 - 270);
    ui.panel(px, py, pw, ph);
    ui.text('Combat logs', px + 12, py + 10, { size: 15, bold: true });
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
      ui.text(`${a.commander} ${typeName(a.type)} P${a.power.toFixed(0)}  ${Math.round(a.troopsBefore)} > ${Math.round(a.troopsAfter)}`, px + 14, y + 19, { size: 11, color: cssColor(teamColor(a.team, this.mine)) });
      let ly = y + 33;
      for (const f of fights) {
        const d = f.defender;
        ui.text(`vs ${d.commander} ${typeName(d.type)} P${d.power.toFixed(0)}  ${Math.round(d.troopsBefore)} > ${Math.round(d.troopsAfter)}`, px + 22, ly, { size: 11, color: cssColor(teamColor(d.team, this.mine)) });
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
