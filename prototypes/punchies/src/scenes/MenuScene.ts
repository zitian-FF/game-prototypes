import Phaser from 'phaser';
import { shopPreviewBalance } from '../shop/draft';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { makeButton } from './FightStage';
import { normalizeRoomCode, ROOM_ALPHABET } from '../net/roomCode';
import { addFullscreenButton } from '../ui/fullscreen';
import { devices, SOURCE_LABEL, type InputSource } from '../input/devices';
import { loadLocalInputs, P1_OPTIONS, P2_OPTIONS, saveLocalInputs } from '../input/localSetup';
import { syncTuneFromGitHub, tuneSource } from '../sim/tune';
import { debugUnlocked } from '../debug/debugPanel';
import { getNav, navRegister } from '../ui/menuNav';
import { artImage, backdrop } from '../render/art';
import { pulseLogo, startScreen } from '../ui/presentation';
import { titleButton } from '../ui/titleButton';
import { punchToken } from '../ui/punchToken';
import { ArenaArt } from '../render/arenaArt';
import { alignGymFloor } from '../render/gymPerspective';

export class MenuScene extends Phaser.Scene {
  private msg!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(data: { message?: string }): void {
    applyCameraPixelRatio(this);
    const gym=backdrop(this, 0, 'gym_background');
    alignGymFloor(this,gym);
    const props=artImage(this,'gym_props',VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,-8);
    if(props) props.setScale(Math.min(VIEW.width/props.width,VIEW.height/props.height));
    const ringW=Math.min(VIEW.width*0.45,VIEW.height*0.93*1299/1211);
    ArenaArt.create(this)?.displayTitle(VIEW.left+VIEW.width*0.665,VIEW.cy,ringW,ringW*1211/1299);
    const menuX = VIEW.left + VIEW.width * 0.26;
    const top = VIEW.cy - 155;
    const w = Math.min(290, VIEW.width * 0.34);
    const logo = artImage(this, 'logo', menuX, top + 33, w + 10, 86);
    if (logo) pulseLogo(this, logo);
    if (!logo) this.add
      .text(menuX, top + 33, 'PUNCHIES', { fontFamily: 'Arial', fontSize: '40px', fontStyle: 'bold', color: '#fff1d1', stroke: '#101b32', strokeThickness: 6, resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    titleButton(this, menuX, top + 105, w, 45, 'SINGLE PLAYER', () => startScreen(this, 'CharSelect', { mode: 'vsai' }), true);
    const category = (y: number, label: string) => {
      this.add.text(menuX,y,label,{fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#a6c5e8',resolution:PIXEL_RATIO}).setOrigin(0.5);
      const g=this.add.graphics().lineStyle(1,0x789ecb,0.65);
      g.beginPath().moveTo(menuX-w/2+6,y).lineTo(menuX-38,y).moveTo(menuX+38,y).lineTo(menuX+w/2-6,y).strokePath();
    };
    const half=(w-12)/2;
    category(top+147,'VERSUS');
    titleButton(this,menuX-(half+12)/2,top+177,half,38,'LOCAL VS',()=>startScreen(this,'CharSelect',{mode:'localvs',inputs:loadLocalInputs()}));
    titleButton(this,menuX+(half+12)/2,top+177,half,38,'ONLINE',()=>this.openOnlinePopup());
    category(top+213,'PRACTICE');
    titleButton(this,menuX-(half+12)/2,top+243,half,38,'TRAINING',()=>startScreen(this,'Training'));
    titleButton(this,menuX+(half+12)/2,top+243,half,38,'TUTORIAL',()=>startScreen(this,'Tutorial'));
    titleButton(this,menuX-(half+12)/2,top+294,half,27,'SETTINGS',()=>this.openInputPopup());
    const shopX = menuX + (half + 12) / 2;
    const shop = titleButton(this,shopX,top+294,half,27,'SHOP',()=>this.openShop(),false,130,'green');
    shop.setX(shopX - half * 0.22);
    const balanceX = shopX + half * 0.26;
    this.add.graphics().setDepth(131).fillStyle(0x081b24,0.75)
      .fillRoundedRect(balanceX-22,top+284,44,20,9);
    punchToken(this,balanceX-10,top+294,8,132);
      // The unpublished shop branch displays its isolated local preview balance.
      this.add.text(balanceX+9,top+294,String(shopPreviewBalance()),{fontFamily:'Arial',fontSize:'12px',fontStyle:'bold',color:'#fff7e6',resolution:PIXEL_RATIO})
      .setOrigin(0.5).setDepth(132);
    if (debugUnlocked()) {
    const tuneLabel = this.add
      .text(VIEW.right - 16, VIEW.bottom - 44, `tune: ${tuneSource()}`, { fontFamily: 'monospace', fontSize: '10px', color: '#888888', resolution: PIXEL_RATIO })
      .setOrigin(1, 0.5);
    const syncBtn = makeButton(this, VIEW.right - 70, VIEW.bottom - 20, 120, 'SYNC TUNE', () => {
      if (syncBtn.text === 'SYNCING...') return;
      syncBtn.setText('SYNCING...');
      void syncTuneFromGitHub().then((r) => {
        if (!this.scene.isActive()) return;
        syncBtn.setText('SYNC TUNE');
        tuneLabel.setText(r.ok ? `tune: ${tuneSource()} (${r.applied} values)` : `sync failed: ${r.error} (still ${tuneSource()})`);
      });
    });
    }
    addFullscreenButton(this, VIEW.right - 24, VIEW.top + 24);
    this.msg = this.add
      .text(menuX, top + 320, data?.message ?? '', { fontFamily: 'Arial', fontSize: '11px', color: '#ff8a7a', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    addVersionStamp(this);
  }

  private popup(title: string, onBack?: () => void): { items: Phaser.GameObjects.GameObject[]; close(): void } {
    const items: Phaser.GameObjects.GameObject[] = [];
    items.push(this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x071020,0.8).setDepth(300).setInteractive());
    const panel=this.add.graphics().setDepth(301);
    panel.fillStyle(0x13253e).fillRoundedRect(VIEW.cx-190,VIEW.cy-115,380,230,18);
    panel.lineStyle(2,0x8ba4c7).strokeRoundedRect(VIEW.cx-190,VIEW.cy-115,380,230,18);
    items.push(panel,this.add.text(VIEW.cx,VIEW.cy-80,title,{fontFamily:'Arial',fontSize:'22px',fontStyle:'bold',color:'#fff1d1',resolution:PIXEL_RATIO}).setOrigin(0.5).setDepth(302));
    const close=()=>items.forEach(o=>o.destroy());
    const back=titleButton(this,VIEW.cx,VIEW.cy+78,140,30,'BACK',()=>{close();onBack?.();},false,302);
    items.push(back,back.getData('bg'));
    return {items,close};
  }

  private openCredits(): void {
    const p=this.popup('CREDITS',()=>this.openInputPopup());
    p.items.push(this.add.text(VIEW.cx,VIEW.cy-5,'Created and designed by ZeeTea.\n\nBuilt together with Claudia and G.P. Tea.',
      {fontFamily:'Arial',fontSize:'15px',align:'center',color:'#dbe9fa',resolution:PIXEL_RATIO}).setOrigin(0.5).setDepth(302));
  }

  private openShop(): void { startScreen(this, 'Shop'); }

  private openOnlinePopup(): void {
    const p=this.popup('ONLINE');
    const host=titleButton(this,VIEW.cx,VIEW.cy-25,250,38,'HOST GAME',()=>{p.close();startScreen(this,'Lobby',{role:'host'});},false,302);
    const join=titleButton(this,VIEW.cx,VIEW.cy+24,250,38,'JOIN WITH CODE',()=>{p.close();this.join();},false,302);
    p.items.push(host,host.getData('bg'),join,join.getData('bg'));
  }

  // Local VS input picker: cycle each player's device. Remembered on this
  // device. Only P1 can use touch; P1 and P2 can't share a device.
  private openInputPopup(): void {
    const v = loadLocalInputs();
    const items: Phaser.GameObjects.GameObject[] = [];
    const D = 300;
    const txt = (x: number, y: number, s: string, size = 12, color = '#dddddd') => {
      const t = this.add
        .text(x, y, s, { fontFamily: 'monospace', fontSize: `${size}px`, color, align: 'center', resolution: PIXEL_RATIO })
        .setOrigin(0.5)
        .setDepth(D + 2);
      items.push(t);
      return t;
    };
    const btn = (x: number, y: number, w: number, label: string, onTap: () => void) => {
      const bg = this.add.rectangle(x, y, w, 30, 0x2a3140, 1).setStrokeStyle(1, 0x7fb3ff).setDepth(D + 1).setInteractive();
      bg.on('pointerdown', onTap);
      navRegister(this, bg, onTap);
      items.push(bg);
      return txt(x, y, label, 12, '#ffffff');
    };
    items.push(this.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x000000, 0.75).setDepth(D).setInteractive());
    items.push(this.add.rectangle(VIEW.cx, VIEW.cy, 440, 280, 0x151922, 1).setStrokeStyle(2, 0x5a6378).setDepth(D));
    txt(VIEW.cx, VIEW.cy - 118, 'SETTINGS · LOCAL INPUTS', 15, '#ffd24a');

    const cycle = (list: InputSource[], cur: InputSource, other: InputSource) => {
      let i = list.indexOf(cur);
      for (let n = 0; n < list.length; n++) {
        i = (i + 1) % list.length;
        if (list[i] !== other) return list[i];
      }
      return cur;
    };
    txt(VIEW.cx - 130, VIEW.cy - 76, 'PLAYER 1', 12, '#7fb3ff');
    const p1 = btn(VIEW.cx + 40, VIEW.cy - 76, 220, '', () => {
      v.p1 = cycle(P1_OPTIONS, v.p1, v.p2);
      refresh();
    });
    txt(VIEW.cx - 130, VIEW.cy - 36, 'PLAYER 2', 12, '#ff8a7a');
    const p2 = btn(VIEW.cx + 40, VIEW.cy - 36, 220, '', () => {
      v.p2 = cycle(P2_OPTIONS, v.p2, v.p1);
      refresh();
    });
    const pads = txt(VIEW.cx, VIEW.cy + 2, '', 11, '#8a90a0');
    txt(
      VIEW.cx,
      VIEW.cy + 50,
      'WASD: move  J/K/L jab/cross/hook  I upper  Space dodge  Shift guard\n' +
        'ARROWS: move  Num1/2/3 jab/cross/hook  Num5 upper  Num0 dodge  NumEnter guard\n' +
        'CONTROLLER: stick  X/Y/B jab/cross/hook  A dodge  RB/RT guard  LB/LT upper',
      9,
      '#aab0bc',
    );
    const refresh = () => {
      p1.setText(`< ${SOURCE_LABEL[v.p1]} >`);
      p2.setText(`< ${SOURCE_LABEL[v.p2]} >`);
      saveLocalInputs(v);
    };
    const padTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => pads.setText(`Controllers connected: ${devices.connectedPads()} (press a button to wake one)`),
    });
    padTimer.callback?.();
    btn(VIEW.cx - 70, VIEW.cy + 108, 120, 'CREDITS', () => {
      padTimer.remove();
      for (const o of items) o.destroy();
      this.openCredits();
    });
    btn(VIEW.cx + 70, VIEW.cy + 108, 120, 'DONE', () => {
      padTimer.remove();
      for (const o of items) o.destroy();
    });
    refresh();
  }

  // In-canvas code entry with its own keypad (a native prompt() dialog
  // swallows touch-end on Android and leaves the joystick stuck). Only
  // characters that can appear in a room code are offered. A physical
  // keyboard can type too.
  private join(): void {
    const items: Phaser.GameObjects.GameObject[] = [];
    const D = 300;
    let code = '';
    const txt = (x: number, y: number, s: string, size: number, color: string) => {
      const t = this.add
        .text(x, y, s, { fontFamily: 'monospace', fontSize: `${size}px`, fontStyle: 'bold', color, resolution: PIXEL_RATIO })
        .setOrigin(0.5)
        .setDepth(D + 2);
      items.push(t);
      return t;
    };
    const key = (x: number, y: number, w: number, h: number, label: string, onTap: () => void, fill = 0x2a3140) => {
      const bg = this.add.rectangle(x, y, w, h, fill, 1).setStrokeStyle(1, 0x7fb3ff).setDepth(D + 1).setInteractive();
      const tap = () => {
        bg.setFillStyle(0x4a5a78);
        this.time.delayedCall(90, () => bg.active && bg.setFillStyle(fill));
        onTap();
      };
      bg.on('pointerdown', tap);
      navRegister(this, bg, tap);
      items.push(bg);
      return txt(x, y, label, 13, '#ffffff');
    };

    items.push(this.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x000000, 0.8).setDepth(D).setInteractive());
    items.push(this.add.rectangle(VIEW.cx, VIEW.cy, 400, 300, 0x151922, 1).setStrokeStyle(2, 0x5a6378).setDepth(D));
    txt(VIEW.cx, VIEW.cy - 128, 'ENTER ROOM CODE', 14, '#ffd24a');

    const slots: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < 3; i++) {
      const x = VIEW.cx + (i - 1) * 46;
      items.push(this.add.rectangle(x, VIEW.cy - 92, 38, 44, 0x0c0f15, 1).setStrokeStyle(2, 0x5a6378).setDepth(D + 1));
      slots.push(txt(x, VIEW.cy - 92, '', 26, '#ffffff'));
    }
    const status = txt(VIEW.cx, VIEW.cy - 60, '', 10, '#ff8a7a');

    getNav(this).textEntry = true;
    const close = () => {
      getNav(this).textEntry = false;
      window.removeEventListener('keydown', onKey);
      for (const o of items) o.destroy();
    };
    const submit = () => {
      const c = normalizeRoomCode(code);
      if (!c) {
        status.setText('enter all 3 characters');
        return;
      }
      close();
      startScreen(this, 'Lobby', { role: 'guest', code: c });
    };
    const type = (ch: string) => {
      if (code.length >= 3) return;
      code += ch;
      status.setText('');
      refresh();
    };
    const back = () => {
      code = code.slice(0, -1);
      refresh();
    };
    const refresh = () => {
      slots.forEach((s, i) => s.setText(code[i] ?? ''));
    };

    // 31 characters + DEL on an 8 x 4 grid.
    const cols = 8;
    const kw = 42;
    const kh = 30;
    const keys = [...ROOM_ALPHABET];
    keys.forEach((ch, i) => {
      const x = VIEW.cx + ((i % cols) - (cols - 1) / 2) * (kw + 4);
      const y = VIEW.cy - 24 + Math.floor(i / cols) * (kh + 4);
      key(x, y, kw, kh, ch, () => type(ch));
    });
    const di = keys.length;
    key(VIEW.cx + ((di % cols) - (cols - 1) / 2) * (kw + 4), VIEW.cy - 24 + Math.floor(di / cols) * (kh + 4), kw, kh, 'DEL', back, 0x3a2a2a);
    key(VIEW.cx - 70, VIEW.cy + 124, 120, 30, 'CANCEL', close, 0x3a2a2a);
    key(VIEW.cx + 70, VIEW.cy + 124, 120, 30, 'JOIN', submit, 0x2a4a34);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') close();
      else {
        const ch = e.key.toUpperCase().replace('O', '0');
        if (ch.length === 1 && ROOM_ALPHABET.includes(ch)) type(ch);
      }
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
  }
}
