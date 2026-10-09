import { verticalRosterPick } from '../ui/rosterLayout';
import { loadShopDraft } from '../shop/draft';
import { t } from '../i18n';
import { availableFighters,ownedSkins,equippedSkin,skinName,skinItem } from '../shop/roster';
import { skinReady } from '../render/skins';
import { CharacterSelectView } from '../ui/CharacterSelectView';
import { startScreen } from '../ui/presentation';
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { applyCameraPixelRatio } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { charTune, punchCfg, CHARACTER_IDS, isCharId, type CharId } from '../sim/character';
import { loadCharPrefs, saveCharPrefs } from '../sim/charPrefs';
import { BOT_LEVELS, type BotLevel } from '../sim/bot';
import { applyTuneJson, restoreTune, snapshotTune, tune, validateTuneJson } from '../sim/tune';
import type { InputSource } from '../input/devices';
import type { LocalInputs } from '../input/localSetup';
import type { NetSession } from '../net/session';
import type { MatchData } from './LobbyScene';
import { backdrop, fighterGroups, prefetchGroups } from '../render/art';

// Character select. UI chrome only: it never touches the sim except to hand
// the chosen ids to the fight scene.
//
// Two sides (left = fighter 0, right = fighter 1). Each picks a card and
// locks it; FIGHT! starts once both are locked.
//   vsai:    one player picks both (theirs, then the AI's).
//   localvs: each side is driven by its own input device.
//   online:  each phone picks only its own side; the opponent's pick shows
//            as READY until the host starts the match.

type Mode = 'training' | 'vsai' | 'localvs' | 'online';

export interface CharSelectData {
  mode: Mode;
  inputs?: LocalInputs; // localvs
  session?: NetSession; // online
  localIdx?: 0 | 1; // online
  delay?: number; // online, host only (measured in the lobby)
  restoreTune?: string;
  nextRound?: number;
}

// Bar fill per stat: today's base tune sits at 80%. Each bar is the plain
// average of the multipliers behind it. Dash distance is the same for every
// fighter today (no per-character override), so it is left out of Speed.
const mean = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / xs.length;
function stats(id: CharId): [string, number][] {
  const c = charTune(id);
  const types = ['jab', 'cross', 'hook', 'uppercut'] as const;
  // Hand speed vs the unmodified base frames (Marco carries no frame deltas).
  let frames = 0;
  let base = 0;
  for (const t of types) {
    const p = tune.punches[t];
    base += p.startup + p.recovery;
    frames += Math.max(1, p.startup + c[t].startup) + Math.max(1, p.recovery + c[t].recovery);
  }
  // Reach includes the fighter's body proportions, relative to a unit-scale fighter.
  const reach = mean(types.map((t) => punchCfg(id, t).reach / (tune.punches[t].reach * tune.view.fighterScale)));
  return [
    [t('charselect.health'), c.hp],
    [t('charselect.endurance'), mean([c.stamina, c.stun])],
    [t('charselect.speed'), mean([c.speed, base / frames])],
    [t('charselect.power'), mean(types.map((t) => c[t].damage))],
    [t('charselect.reach'), reach],
  ];
}

interface Side {
  sel: number;
  locked: boolean;
  selected?:boolean;
  skin?:string;
  label: string;
  src: InputSource | 'any' | 'remote';
}

export class CharSelectScene extends Phaser.Scene {
  private data0!: CharSelectData;
  private sides: Side[] = [];
  private active = 0;
  private level: BotLevel = 'easy';
  private selectionView!: CharacterSelectView;
  private remotePick: CharId | null = null;
  // Online: the opponent has reached this screen (heard from them here).
  private peerHere = false;
  private remoteAvailable:CharId[]=['marco','mia','bruno'];
  private notice='';
  private handedOff = false;
  private prevPad: boolean[] = [];
  private stickAt = [0, 0];

  constructor() {
    super('CharSelect');
  }

  create(data: CharSelectData): void {
    applyCameraPixelRatio(this);
    backdrop(this, 0.14, 'character_select_background');
    this.data0 = data;
    if (data.mode === 'online' && data.localIdx === 1) {
      this.data0 = { ...data, restoreTune: data.restoreTune ?? snapshotTune() };
    }
    this.handedOff = false;
    this.remotePick = null;
    this.peerHere = false;this.notice='';this.remoteAvailable=['marco','mia','bruno'];
    this.active = 0;
    this.prevPad = [];
    const prefs = loadCharPrefs();
    const idx = (id: CharId) => CHARACTER_IDS.indexOf(id);
    this.level = prefs.level;
    if (data.mode === 'training') {
      this.sides = [
        {sel:idx(prefs.p1),locked:false,label:t('common.you'),src:'any'},
        {sel:0,locked:true,label:t('common.dummy'),src:'remote'},
      ];
    } else if (data.mode === 'vsai') {
      this.sides = [
        { sel: idx(prefs.p1), locked: false, label: t('common.you'), src: 'any' },
        { sel: idx(prefs.ai), locked: false, label: 'AI', src: 'any' },
      ];
    } else if (data.mode === 'localvs') {
      const inp = data.inputs!;
      this.sides = [
        { sel: idx(prefs.p1), locked: false, label: 'P1', src: inp.p1 },
        { sel: idx(prefs.p2), locked: false, label: 'P2', src: inp.p2 },
      ];
    } else {
      const me = data.localIdx ?? 0;
      this.sides = [0, 1].map((i) =>
        i === me
          ? { sel: idx(prefs.p1), locked: false, label: t('common.you'), src: 'any' as const }
          : { sel: 0, locked: false, label: t('common.opponent'), src: 'remote' as const },
      );
      this.active = me;
      this.setupNet();
    }

    this.sides.forEach((side,i)=>{side.selected=false;const id=CHARACTER_IDS[side.sel],saved=equippedSkin(loadShopDraft(),id,prefs.skins[this.prefSide(i)]?.[id]);side.skin=skinReady(this,id,saved)?saved:'default';});
    this.selectionView = new CharacterSelectView(this, {
      skin:(s,d)=>this.cycleSkin(s,d),
      card: (i) => this.tapCard(i), panel: (i) => this.tapPanel(i),
      format: () => this.cycleFormat(),
      action: () => this.fightButton(), back: () => this.back(-1, true),
      level: (d) => this.cycleLevel(d),
    });
    this.bindKeys();
    this.events.once('shutdown', () => {
      if (data.mode === 'online' && !this.handedOff) {
        data.session?.leave();
        if (this.data0.restoreTune) restoreTune(this.data0.restoreTune);
      }
    });
    addVersionStamp(this);
  }

  private cycleFormat(): void {
    if (this.data0.mode === 'training' || (this.data0.mode === 'online' && this.data0.localIdx !== 0)) return;
    tune.match.bestOf = tune.match.bestOf === 3 ? 1 : 3;
    sfx.uiSelect();
  }

  private hint(): string {
    if (this.data0.mode === 'localvs') return t('charselect.each_player_picks_and_confirms');
    if (this.data0.mode === 'online') return t('charselect.pick_your_boxer_then_ready');
    return t('charselect.pick_a_boxer_then_confirm');
  }

  // ---- input --------------------------------------------------------------

  private bindKeys(): void {
    const onKey = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
  }

  // Which side a key belongs to: in Local VS each keyboard half drives its
  // own side; otherwise every key drives the active side.
  private keySide(code: string): number {
    if (this.data0.mode !== 'localvs') return this.active;
    const kb2 = code.startsWith('Arrow') || code.startsWith('Numpad') || code === 'Enter' || code === 'Backspace';
    const want: InputSource = kb2 ? 'kb2' : 'kb1';
    const s = this.sides.findIndex((x) => x.src === want);
    // A side on touch / a pad still takes the other keyboard half's keys
    // only if no side owns that half.
    return s;
  }

  private onKey(e: KeyboardEvent): void {
    if(e.repeat && e.code==='KeyF')return;
    const c = e.code;
    // Format belongs to the shared match, independent of keyboard half.
    if(c==='KeyF') { this.cycleFormat(); return; }
    const s = this.keySide(c);
    if (s < 0) return;
    if (c === 'ArrowUp' || c === 'KeyW') this.moveVertical(s, -1);
    else if (c === 'ArrowDown' || c === 'KeyS') this.moveVertical(s, 1);
    else if(c==='KeyQ')this.cycleLevel(-1);
    else if(c==='KeyE')this.cycleLevel(1);
    else if (c === 'ArrowLeft' || c === 'KeyA') this.move(s, -1);
    else if (c === 'ArrowRight' || c === 'KeyD') this.move(s, 1);
    else if (['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'Numpad1'].includes(c)) this.confirm(s);
    else if (['Escape', 'Backspace', 'Numpad0'].includes(c)) this.back(s);
  }

  private pollPads(): void {
    let pads: (Gamepad | null)[] = [];
    try {
      pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    } catch {
      return;
    }
    pads.slice(0, 2).forEach((p, i) => {
      if (!p) return;
      let s = this.active;
      if (this.data0.mode === 'localvs') s = this.sides.findIndex((x) => x.src === (i === 0 ? 'pad1' : 'pad2'));
      if (s < 0) return;
      const edge = (n: number) => {
        const k = i * 32 + n;
        const now = !!p.buttons[n]?.pressed;
        const was = this.prevPad[k];
        this.prevPad[k] = now;
        return now && !was;
      };
      if (edge(3)) this.cycleFormat();
      if (edge(12)) this.moveVertical(s,-1);
      if (edge(13)) this.moveVertical(s,1);
      if(edge(4))this.cycleLevel(-1);if(edge(5))this.cycleLevel(1);
      if (edge(14)) this.move(s, -1);
      if (edge(15)) this.move(s, 1);
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      if (Math.abs(ax) > 0.6 && this.time.now - this.stickAt[i] > 220) {
        this.stickAt[i] = this.time.now;
        this.move(s, Math.sign(ax));
      } else if(Math.abs(ay)>0.6 && this.time.now-this.stickAt[i]>220){
        this.stickAt[i]=this.time.now;
        this.moveVertical(s,Math.sign(ay));
      }
      if (edge(0) || edge(2)) this.confirm(s);
      if (edge(1)) this.back(s);
      if (edge(9)) this.confirm(s);
    });
  }

  private moveVertical(s:number,d:number):void {
    if(!this.editable(s)||this.sides[s].selected)return;
    const current=this.sides[s].sel,next=verticalRosterPick(current,d,CHARACTER_IDS.length);
    if(next!==current)this.move(s,next-current);
  }

  private cycleLevel(d: number): void {
    if (this.data0.mode !== 'vsai') return;
    const i = (BOT_LEVELS.indexOf(this.level) + d + BOT_LEVELS.length) % BOT_LEVELS.length;
    this.level = BOT_LEVELS[i];
    saveCharPrefs({ level: this.level });
  }

  private editable(s: number): boolean {
    return this.sides[s].src !== 'remote' && !(this.data0.mode==='training' && s===1);
  }

  private move(s: number, d: number): void {
    const side = this.sides[s];
    if (!this.editable(s)) return;
    if(side.selected){this.cycleSkin(s,d);return;}
    side.sel = (side.sel + d + CHARACTER_IDS.length) % CHARACTER_IDS.length;
    sfx.uiSelect();
    side.skin=this.preferredSkin(s);this.notice='';
    if(this.data0.mode==='online')this.sendPick();
  }

  private confirm(s: number): void {
    if (this.bothLocked()) {
      this.fight();
      return;
    }
    const side = this.sides[s];
    if (!this.editable(s)) return;
    if(!this.available(s)){sfx.denied();this.notice=t('charselect.locked_fighter_daily_chest');return;}
    sfx.uiConfirm();
    if(!side.selected){side.selected=true;this.notice=t('common.left_right_chooses_a_skin');return;}
    if (side.locked) {
      // vsai: confirming on a locked side moves on to the other one.
      if (this.data0.mode === 'vsai') this.active = 1 - s;
      return;
    }
    side.locked = true;
    if (this.data0.mode === 'vsai' && !this.sides[1 - s].locked) this.active = 1 - s;
    if (this.data0.mode === 'online') this.sendPick();
  }

  // Unlock the side's pick; with nothing to unlock, leave the screen.
  private back(s: number, button = false): void {
    if (button && s < 0) {
      // BACK button: unlock the most recent editable lock, else leave.
      const locked = [1, 0].find((i) => this.editable(i) && this.sides[i].locked);
      if (locked === undefined) return this.leave();
      return this.back(locked);
    }
    const side = this.sides[s];
    if (!this.editable(s)) return;
    if (side.locked) {
      side.locked = false;side.selected=false;
      if (this.data0.mode === 'vsai') this.active = s;
      if (this.data0.mode === 'online') this.sendPick();
      return;
    }
    if(side.selected){side.selected=false;return;}
    if (this.data0.mode === 'vsai' && s === 1 && this.sides[0].locked) {
      this.sides[0].locked = false;this.sides[0].selected=false;
      this.active = 0;
      return;
    }
    this.leave();
  }

  private tapCard(i: number): void {
    // Touch drives the active side (vsai / online) or a touch player in
    // Local VS (only P1 can be on touch).
    let s = this.active;
    if (this.data0.mode === 'localvs') s = this.sides.findIndex((x) => x.src === 'touch');
    if (s < 0 || !this.editable(s)) return;
    const side = this.sides[s];
    if (side.locked) side.locked = false;
    side.sel = i;side.selected=this.available(s);side.skin=this.preferredSkin(s);this.notice=this.available(s)?t('common.left_right_chooses_a_skin'):t('charselect.locked_fighter_daily_chest');
    if (this.available(s)) sfx.uiSelect(); else sfx.denied();
    // Online: tapping only selects (and un-readies); READY locks it in.
    if (this.data0.mode === 'online') {
      this.sendPick();
      return;
    }
  }

  private tapPanel(s: number): void {
    if (this.data0.mode !== 'vsai' || !this.editable(s)) return;
    this.active = s;
    // Focus a confirmed card without changing its boxer.
  }

  private prefSide(s:number):string{return this.data0.mode==='online'?'p1':this.data0.mode==='vsai'&&s===1?'ai':s===0?'p1':'p2';}
  private available(s:number):boolean{return (this.sides[s].src==='remote'?this.remoteAvailable:availableFighters(loadShopDraft())).includes(CHARACTER_IDS[this.sides[s].sel]);}
  private preferredSkin(s:number):string {
    const id=CHARACTER_IDS[this.sides[s].sel];
    const saved=equippedSkin(loadShopDraft(),id,loadCharPrefs().skins[this.prefSide(s)]?.[id]);
    return skinReady(this,id,saved)?saved:'default';
  }
  private skinChoices(s:number):string[]{const id=CHARACTER_IDS[this.sides[s].sel];return ownedSkins(loadShopDraft(),id).filter(skin=>skinReady(this,id,skin));}
  private skins():[string,string]{return this.sides.map((side,s)=>side.src==='remote'?side.skin??'default':equippedSkin(loadShopDraft(),CHARACTER_IDS[side.sel],side.skin)) as [string,string];}
  private cycleSkin(s:number,d:number):void{
    if(!this.editable(s)||!this.available(s)||!this.sides[s].selected)return;
    const choices=this.skinChoices(s),side=this.sides[s];side.skin=choices[(Math.max(0,choices.indexOf(side.skin??'default'))+d+choices.length)%choices.length];
    if (choices.length > 1) sfx.uiSelect();
    const prefs=loadCharPrefs(),slot=this.prefSide(s);saveCharPrefs({skins:{...prefs.skins,[slot]:{...prefs.skins[slot],[CHARACTER_IDS[side.sel]]:side.skin}}});
    if(this.data0.mode==='online')this.sendPick();
  }

  private bothLocked(): boolean {
    if (this.data0.mode === 'online') {
      const me = this.data0.localIdx ?? 0;
      return this.sides[me].locked && this.remotePick !== null;
    }
    return this.sides[0].locked && this.sides[1].locked;
  }

  private picks(): [CharId, CharId] {
    return [CHARACTER_IDS[this.sides[0].sel], CHARACTER_IDS[this.sides[1].sel]];
  }

  private leave(): void {
    startScreen(this, 'Menu');
  }

  // Online: the button is READY / UNREADY for your own pick.
  private fightButton(): void {
    if (this.data0.mode !== 'online') {
      if (this.bothLocked()) this.fight();
      else if (this.data0.mode === 'localvs') {
        const touch = this.sides.findIndex((side) => side.src === 'touch');
        if (touch >= 0) this.confirm(touch);
      } else this.confirm(this.active);
      return;
    }
    const me = this.data0.localIdx ?? 0;
    if (this.sides[me].locked) this.back(me);
    else this.confirm(me);
  }

  private fight(): void {
    if (this.data0.mode==='training') {
      if (!this.bothLocked() || !this.available(0)) return;
      const char=this.picks()[0],skin=this.skins()[0],prefs=loadCharPrefs();
      saveCharPrefs({p1:char,skins:{...prefs.skins,p1:{...prefs.skins.p1,[char]:skin}}});
      startScreen(this,'Training',{char,skin});
      return;
    }
    if (!this.bothLocked() || this.sides.some((_,s)=>!this.available(s))) return;
    const [a, b] = this.picks();
    if (this.data0.mode === 'vsai') {
      saveCharPrefs({ p1: a, ai: b, level: this.level });
      startScreen(this, 'VsAI', { chars: [a, b],skins:this.skins(), level: this.level });
    } else if (this.data0.mode === 'localvs') {
      saveCharPrefs({ p1: a, p2: b });
      startScreen(this, 'LocalVs', { ...this.data0.inputs!, chars: [a, b],skins:this.skins() });
    } else if (this.data0.localIdx === 0) {
      this.hostStart();
    }
  }

  // ---- online -------------------------------------------------------------

  private setupNet(): void {
    const s = this.data0.session!;
    s.onCtl = (m) => {
      if (m.k === 'ping') s.send({ k: 'pong', t: m.t });
      if (m.k === 'format' && this.data0.localIdx === 1) tune.match.bestOf = m.bestOf === 1 ? 1 : 3;
      if (m.k === 'pick') {
        this.peerHere = true;
        this.remoteAvailable=Array.isArray(m.available)?m.available.filter(isCharId):['marco','mia','bruno'];
        this.remotePick = isCharId(m.char)&&this.remoteAvailable.includes(m.char) ? m.char : null;
        const other = 1 - (this.data0.localIdx ?? 0);
        if(isCharId(m.hover))this.sides[other].sel=CHARACTER_IDS.indexOf(m.hover);
        const id=this.remotePick??CHARACTER_IDS[this.sides[other].sel];this.sides[other].skin=typeof m.skin==='string'&&skinItem(id,m.skin)?m.skin:'default';
        this.sides[other].locked = this.remotePick !== null;
        if (this.remotePick) this.sides[other].sel = CHARACTER_IDS.indexOf(this.remotePick);
        if (this.data0.localIdx === 0 && this.bothLocked()) this.hostStart();
      }
      if (m.k === 'start' && this.data0.localIdx === 1) {
        const check = validateTuneJson(m.tune);
        if (!check.ok) {
          s.leave();
          startScreen(this, 'Menu', { message: t('charselect.host_sent_invalid_settings') });
          return;
        }
        const restore = this.data0.restoreTune ?? snapshotTune();
        applyTuneJson(m.tune);
        this.handOff({ session: s, localIdx: 1, delay: m.delay, round: m.round, restoreTune: restore, chars: m.chars,skins:m.skins });
      }
    };
    s.onPeerLeft = () => startScreen(this, 'Menu', { message: t('charselect.opponent_left') });
    // Heartbeat: keep re-sending our status, so a message sent while the
    // other phone was still in the lobby (measuring ping) is never lost.
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.sendPick() });
    this.sendPick();
  }

  private sendPick(): void {
    const me = this.data0.localIdx ?? 0;
    const side = this.sides[me];
    if (me === 0) this.data0.session?.send({ k: 'format', bestOf: tune.match.bestOf === 1 ? 1 : 3 });
    this.data0.session?.send({ k: 'pick', char: side.locked ? CHARACTER_IDS[side.sel] : null,hover:CHARACTER_IDS[side.sel],skin:side.skin,available:availableFighters(loadShopDraft()) });
    if (side.locked) saveCharPrefs({ p1: CHARACTER_IDS[side.sel] });
    if (!this.peerHere) return;
    if (me === 0 && this.bothLocked()) this.hostStart();
  }

  private hostStart(): void {
    if (this.handedOff) return;
    const s = this.data0.session!;
    const chars = this.picks();
    const delay = this.data0.delay ?? tune.net.inputDelayFrames;
    const round = this.data0.nextRound ?? 1;
    s.send({ k: 'start', round, delay, tune: JSON.stringify(tune), chars,skins:this.skins() });
    this.handOff({ session: s, localIdx: 0, delay, round, chars,skins:this.skins() });
  }

  private handOff(data: MatchData): void {
    this.handedOff = true;
    startScreen(this, 'Match', data);
  }

  // ---- presentation -------------------------------------------------------

  update(): void {
    this.pollPads();
    const chars = this.picks();
    prefetchGroups(fighterGroups(chars));
    const online = this.data0.mode === 'online';
    const local = this.data0.mode === 'localvs';
    const ready = this.bothLocked();
    const me = this.data0.localIdx ?? 0;
    this.selectionView.render({
      training:this.data0.mode==='training',
      bestOf: tune.match.bestOf,
      formatEditable: this.data0.mode !== 'online' || this.data0.localIdx === 0,
      panels: this.sides.map((side, s) => ({
        dummy:this.data0.mode==='training'&&s===1,
        id: chars[s], label: side.label === 'AI' ? t('common.opponent') : side.label,
        cursor:side.src!=='remote'||this.peerHere,available:this.available(s),selected:!!side.selected,skin:side.skin??'default',skinName:skinName(chars[s],side.skin??'default'),skinIndex:Math.max(0,this.skinChoices(s).indexOf(side.skin??'default'))+1,skinCount:this.skinChoices(s).length,
        hidden: side.src === 'remote', locked: side.locked,
        focused: !ready && (local ? !side.locked : this.active === s),
        status: this.data0.mode==='training'&&s===1?'':side.src === 'remote'
          ? (!this.peerHere ? t('charselect.waiting_for_opponent') : side.locked ? t('common.ready') : t('charselect.choosing_boxer'))
          : !this.available(s)?t('charselect.locked_shop_daily_chest'):side.locked ? t('charselect.locked_in_left_right_skins') : side.selected?t('charselect.left_right_skins_confirm_to'):'',
        stats: stats(chars[s]),
      })),
      step: ready ? 2 : this.data0.mode==='training'?(this.sides[0].selected?1:0):online ? (this.sides[me].locked ? 1 : 0) : local ? (this.sides[0].locked ? 1 : 0) : this.active,
      steps: this.data0.mode==='training'?[t('common.your_boxer'),t('common.ready'),t('common.training')]:local ? [t('common.player_1'), t('common.player_2'), t('common.fight')] : online ? [t('common.your_boxer'), t('common.ready'), t('common.fight')] : [t('common.your_boxer'), t('common.opponent'), t('common.fight')],
      action: online ? (this.sides[me].locked ? t('charselect.unready') : this.sides[me].selected?t('charselect.ready'):t('charselect.select_boxer'))
        : ready ? (this.data0.mode==='training'?t('training.start'):t('charselect.fight')) : local
          ? (this.sides.some((side) => side.src === 'touch')
            ? (this.sides[0].locked ? t('charselect.waiting_for_p2') : t('common.confirm_boxer')) : t('charselect.confirm_on_device'))
          : this.active === 0 ? t('common.confirm_boxer') : t('charselect.confirm_opponent'),
      level: this.data0.mode === 'vsai' ? t(`level.${this.level}`).toUpperCase() : null,
      hint:this.notice||this.hint(),
    });
  }
}
