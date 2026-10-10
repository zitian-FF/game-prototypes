import Phaser from 'phaser';
import { availableLanguages, getLanguage, t } from '../i18n';
import { LANGUAGES } from '../i18n/languages';
import { chooseLanguage } from '../i18n/init';
import { isDebug } from '../debug/debugPanel';
import { loadingFinished } from '../portal/index';
import { audioSettingsPanel } from '../ui/audioSettingsPanel';
import { bindButtonFeedback, cartoonButton, cartoonPanel } from '../ui/cartoonChrome';
import { shopPreviewBalance, loadShopDraft, freeChests } from '../shop/draft';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { normalizeRoomCode, ROOM_ALPHABET } from '../net/roomCode';
import { devices, SOURCE_LABEL, type InputSource } from '../input/devices';
import { loadLocalInputs, P1_OPTIONS, P2_OPTIONS, saveLocalInputs } from '../input/localSetup';
import { getNav, navRegister } from '../ui/menuNav';
import { artImage, backdrop } from '../render/art';
import { pulseLogo, startScreen } from '../ui/presentation';
import { titleButton } from '../ui/titleButton';
import { inputLayoutEditor } from '../ui/inputLayoutEditor';
import { punchToken } from '../ui/punchToken';
import { ArenaArt } from '../render/arenaArt';
import { alignGymFloor } from '../render/gymPerspective';

export class MenuScene extends Phaser.Scene {
  private msg!: Phaser.GameObjects.Text;

  constructor(key = 'Menu') {
    super(key);
  }

  create(data: { message?: string }): void {
    loadingFinished();
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
    const logo = artImage(this, 'logo', menuX, top + 25, w + 10, 86);
    if (logo) pulseLogo(this, logo);
    if (!logo) this.add
      .text(menuX, top + 33, 'PUNCHIES', { fontFamily: 'Arial', fontSize: '40px', fontStyle: 'bold', color: '#fff1d1', stroke: '#101b32', strokeThickness: 6, resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    titleButton(this, menuX, top + 105, w, 45, t('common.single_player'), () => startScreen(this, 'CharSelect', { mode: 'vsai' }), true);
    const category = (y: number, label: string) => {
      this.add.text(menuX,y,label,{fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#a6c5e8',resolution:PIXEL_RATIO}).setOrigin(0.5);
      const g=this.add.graphics().lineStyle(1,0x789ecb,0.65);
      g.beginPath().moveTo(menuX-w/2+6,y).lineTo(menuX-38,y).moveTo(menuX+38,y).lineTo(menuX+w/2-6,y).strokePath();
    };
    const half=(w-12)/2;
    category(top+147,t('common.versus'));
    titleButton(this,menuX-(half+12)/2,top+177,half,38,t('menu.local_vs'),()=>startScreen(this,'CharSelect',{mode:'localvs',inputs:loadLocalInputs()}),false,130,'red');
    titleButton(this,menuX+(half+12)/2,top+177,half,38,t('common.online'),()=>this.openOnlinePopup(),false,130,'blue');
    category(top+213,t('menu.practice'));
    titleButton(this,menuX-(half+12)/2,top+243,half,38,t('common.training'),()=>startScreen(this,'CharSelect',{mode:'training'}),false,130,'purple');
    titleButton(this,menuX+(half+12)/2,top+243,half,38,t('menu.tutorial'),()=>startScreen(this,'Tutorial'),false,130,'teal');
    titleButton(this,menuX-(half+12)/2,top+294,half,27,t('common.settings'),()=>this.openSettings());
    const shopX = menuX + (half + 12) / 2;
    const shop = titleButton(this,shopX,top+294,half,27,t('menu.shop'),()=>this.openShop(),false,130,'green');
    shop.setX(shopX - half * 0.22);
    const balanceX = shopX + half * 0.26;
    this.add.graphics().setDepth(131).fillStyle(0x081b24,0.75)
      .fillRoundedRect(balanceX-22,top+284,44,20,9);
    punchToken(this,balanceX-10,top+294,8,132);
      // The unpublished shop branch displays its isolated local preview balance.
      this.add.text(balanceX+9,top+294,String(shopPreviewBalance()),{fontFamily:'Arial',fontSize:'12px',fontStyle:'bold',color:'#fff7e6',resolution:PIXEL_RATIO})
      .setOrigin(0.5).setDepth(132);

    const shopState = loadShopDraft();
    if (freeChests(shopState, 'skins') + freeChests(shopState, 'fighters') > 0) {
      // A free chest is waiting in the Shop: a small red badge on the button corner.
      const bx = shopX + half / 2 - 2, by = top + 283;
      this.add.graphics().setDepth(133).fillStyle(0xe8283c).fillCircle(bx, by, 8).lineStyle(2, 0xffffff).strokeCircle(bx, by, 8);
      this.add.text(bx, by, '!', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO }).setOrigin(0.5).setDepth(134);
    }

    this.msg = this.add
      .text(menuX, top + 320, data?.message ?? '', { fontFamily: 'Arial', fontSize: '11px', color: '#ff8a7a', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    addVersionStamp(this);
    // Language picker on the landing screen. Only shown once a second language has translations (always in debug, to test).
    if (availableLanguages(isDebug()).length > 1) {
      const current = LANGUAGES.find((l) => l.code === getLanguage())?.native ?? getLanguage();
      titleButton(this, VIEW.right - 62, VIEW.top + 24, 104, 28, current, () => this.openLanguagePopup(), false, 130);
    }
  }

  private openLanguagePopup(): void {
    const p = this.popup(t('menu.language'));
    availableLanguages(isDebug()).forEach((lang, i) => {
      const x = VIEW.cx + (i % 2 === 0 ? -90 : 90);
      const y = VIEW.cy - 45 + Math.floor(i / 2) * 38;
      const pick = titleButton(this, x, y, 160, 30, lang.native, () => {
        p.close();
        void chooseLanguage(lang.code).then(() => startScreen(this, 'Menu'));
      }, false, 402, lang.code === getLanguage() ? 'green' : 'default');
      p.items.push(pick, pick.getData('bg'));
    });
  }

  private popup(title: string, onBack?: () => void): { items: Phaser.GameObjects.GameObject[]; close(): void } {
    const items: Phaser.GameObjects.GameObject[] = [];
    items.push(this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x071020,0.8).setDepth(400).setInteractive());
    const panel=this.add.graphics().setDepth(401);
    panel.fillStyle(0x13253e).fillRoundedRect(VIEW.cx-190,VIEW.cy-115,380,230,18);
    panel.lineStyle(2,0x8ba4c7).strokeRoundedRect(VIEW.cx-190,VIEW.cy-115,380,230,18);
    items.push(panel,this.add.text(VIEW.cx,VIEW.cy-80,title,{fontFamily:'Arial',fontSize:'22px',fontStyle:'bold',color:'#fff1d1',resolution:PIXEL_RATIO}).setOrigin(0.5).setDepth(402));
    const close=()=>items.forEach(o=>o.destroy());
    getNav(this).modalBack(items[0] as Phaser.GameObjects.Rectangle, ()=>{close();onBack?.();});
    items.push(this.add.text(VIEW.cx,VIEW.cy+105,t('ui.back_hint'),{fontFamily:'Arial',fontSize:12,color:'#dbe9fa',resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(402));
    const back=titleButton(this,VIEW.cx,VIEW.cy+78,140,30,t('common.back'),()=>{close();onBack?.();},false,402,'default','back');
    items.push(back,back.getData('bg'));
    return {items,close};
  }

  private openCredits(): void {
    const p=this.popup(t('common.credits'),()=>this.openSettings());
    p.items.push(this.add.text(VIEW.cx,VIEW.cy-5,t('menu.designed_and_produced_by_tiantian'),
      {fontFamily:'Arial',fontSize:'15px',align:'center',color:'#dbe9fa',resolution:PIXEL_RATIO}).setOrigin(0.5).setDepth(402));
  }

  private openShop(): void { startScreen(this, 'Shop'); }

  protected openSettings(): void { audioSettingsPanel(this, () => this.openInputPopup(), () => this.openCredits()); }

  private openOnlinePopup(): void {
    const p=this.popup(t('common.online'));
    const host=titleButton(this,VIEW.cx,VIEW.cy-25,250,38,t('menu.host_game'),()=>{p.close();startScreen(this,'Lobby',{role:'host'});},false,402);
    const join=titleButton(this,VIEW.cx,VIEW.cy+24,250,38,t('menu.join_with_code'),()=>{p.close();this.join();},false,402);
    p.items.push(host,host.getData('bg'),join,join.getData('bg'));
  }

  // Local VS input picker: cycle each player's device. Remembered on this
  // device. Only P1 can use touch; P1 and P2 can't share a device.
  protected openInputPopup(): void {
    const v = loadLocalInputs();
    const items: Phaser.GameObjects.GameObject[] = [];
    const D = 400;
    const txt = (x: number, y: number, label: string, size = 15, color = '#dbe9fa') => {
      const text = this.add.text(x,y,label,{fontFamily:'Arial',fontSize:size,fontStyle:'bold',color,align:'center',resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(D+2);
      items.push(text);return text;
    };
    const btn = (x: number, y: number, w: number, label: string, onTap: () => void) => {
      const text=titleButton(this,x,y,w,32,label,onTap,false,D+1);
      items.push(text,text.getData('bg'));return text;
    };
    items.push(this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x071020,.85).setDepth(D).setInteractive());
    const panel=this.add.graphics().setDepth(D+1);cartoonPanel(panel,VIEW.cx-300,VIEW.cy-180,600,360,0x28517d,15);items.push(panel);
    txt(VIEW.cx,VIEW.cy-155,t('menu.settings_local_inputs'),22,'#fff1d1');

    const cycle = (list: InputSource[], cur: InputSource, other: InputSource) => {
      let i = list.indexOf(cur);
      for (let n = 0; n < list.length; n++) {
        i = (i + 1) % list.length;
        if (list[i] !== other) return list[i];
      }
      return cur;
    };
    txt(VIEW.cx - 130, VIEW.cy - 116, t('common.player_1'), 12, '#7fb3ff');
    const p1 = btn(VIEW.cx + 40, VIEW.cy - 116, 220, '', () => {
      v.p1 = cycle(P1_OPTIONS, v.p1, v.p2);
      refresh();
    });
    txt(VIEW.cx - 130, VIEW.cy - 76, t('common.player_2'), 12, '#ff8a7a');
    const p2 = btn(VIEW.cx + 40, VIEW.cy - 76, 220, '', () => {
      v.p2 = cycle(P2_OPTIONS, v.p2, v.p1);
      refresh();
    });
    const pads = txt(VIEW.cx, VIEW.cy - 43, '', 14, '#dbe9fa');
    btn(VIEW.cx, VIEW.cy - 3, 340, t('layouts.edit_touch'), () => inputLayoutEditor(this, 'touch'));
    for (const [profile, x, y] of [['kb1', -145, 39], ['kb2', 145, 39], ['pad1', -145, 81], ['pad2', 145, 81]] as const) {
      btn(VIEW.cx + x, VIEW.cy + y, 280, t('layouts.edit_title', { device: t('layouts.' + profile) }), () => inputLayoutEditor(this, profile));
    }
    txt(VIEW.cx, VIEW.cy + 155, t('ui.back_hint'), 12);
    const refresh = () => {
      p1.setText(`< ${SOURCE_LABEL[v.p1]} >`);
      p2.setText(`< ${SOURCE_LABEL[v.p2]} >`);
      saveLocalInputs(v);
    };
    const padTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => pads.setText(t('menu.controllers_connected', { n: devices.connectedPads() })),
    });
    padTimer.callback?.();
    const close = () => { padTimer.remove();items.forEach(o=>o.destroy()); };
    const done = () => { close();this.openSettings(); };
    getNav(this).modalBack(items[0] as Phaser.GameObjects.Rectangle, done);
    btn(VIEW.cx - 70,VIEW.cy + 120,120,t('common.credits'),()=>{close();this.openCredits();});
    btn(VIEW.cx + 70,VIEW.cy + 120,120,t('menu.done'),done);
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
        .text(x, y, s, { fontFamily: 'Arial', fontSize: `${size}px`, fontStyle: 'bold', color, resolution: PIXEL_RATIO })
        .setOrigin(0.5)
        .setDepth(D + 2);
      items.push(t);
      return t;
    };
    const key = (x: number, y: number, w: number, h: number, label: string, onTap: () => void, fill = 0x47739d) => {
      const chrome=this.add.graphics().setDepth(D+1);items.push(chrome);
      const bg=this.add.rectangle(x,y,w,h,0,0).setDepth(D+1).setInteractive();
      const text = txt(x, y, label, 16, '#ffffff');
      bindButtonFeedback(bg, state => {
        chrome.clear();
        cartoonButton(chrome,x-w/2,y-h/2+(state==='pressed'?2:0),w,h,fill,6);
        if(state==='hover')chrome.fillStyle(0xffffff,.1).fillRoundedRect(x-w/2,y-h/2,w,h,6);
        text.y=y+(state==='pressed'?2:0);
      });
      bg.on('pointerup', () => { if(bg.getData('buttonReleasedInside'))onTap(); });
      navRegister(this, bg, onTap);
      items.push(bg);
      return text;
    };

    items.push(this.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x000000, 0.8).setDepth(D).setInteractive());
    const panel=this.add.graphics().setDepth(D);cartoonPanel(panel,VIEW.cx-205,VIEW.cy-165,410,330,0x28517d,15);items.push(panel);
    txt(VIEW.cx, VIEW.cy - 128, t('menu.enter_room_code'), 22, '#ffd24a');

    const slots: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < 3; i++) {
      const x = VIEW.cx + (i - 1) * 46;
      items.push(this.add.rectangle(x, VIEW.cy - 92, 38, 44, 0x0c0f15, 1).setStrokeStyle(2, 0x5a6378).setDepth(D + 1));
      slots.push(txt(x, VIEW.cy - 92, '', 26, '#ffffff'));
    }
    const status = txt(VIEW.cx, VIEW.cy - 60, '', 14, '#ff8a7a');

    const nav = getNav(this);
    nav.textEntry = true;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      nav.textEntry = false;
      window.removeEventListener('keydown', onKey);
      this.events.off('shutdown', close);
      for (const o of items) o.destroy();
    };
    nav.modalBack(items[0] as Phaser.GameObjects.Rectangle, close);
    txt(VIEW.cx,VIEW.cy+152,t('ui.back_hint'),12,'#dbe9fa');
    const submit = () => {
      const c = normalizeRoomCode(code);
      if (!c) {
        status.setText(t('menu.enter_all_3_characters'));
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

    // QWERTY with the digits on top, minus the look-alikes (0/O, 1/I/L) that
    // room codes never use. Four rows of eight; DEL ends the bottom row.
    const rows = ['23456789', 'QWERTYUP', 'ASDFGHJK', 'ZXCVBNM'];
    const kw = 42;
    const kh = 30;
    const rowY = (r: number) => VIEW.cy - 24 + r * (kh + 4);
    const colX = (c: number) => VIEW.cx + (c - 3.5) * (kw + 4);
    rows.forEach((row, r) => [...row].forEach((ch, c) => key(colX(c), rowY(r), kw, kh, ch, () => type(ch))));
    key(colX(7), rowY(3), kw, kh, t('menu.del'), back, 0x3a2a2a);
    key(VIEW.cx - 70, VIEW.cy + 124, 120, 30, t('common.cancel'), close, 0x3a2a2a);
    key(VIEW.cx + 70, VIEW.cy + 124, 120, 30, t('menu.join'), submit, 0x2a4a34);

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || this.input.enabled === false) return;
      if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') close();
      else {
        const ch = e.key.toUpperCase().replace('O', '0');
        if (ch.length === 1 && ROOM_ALPHABET.includes(ch)) type(ch);
      }
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', close);
  }
}
