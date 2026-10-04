// Test-only browser hook captures Phaser's game instance. No production hook.
// PLAYWRIGHT_MODULE may point to the desktop's bundled Playwright package.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const url = process.env.PUNCHIES_URL || 'http://127.0.0.1:5173/game-prototypes/prototypes/punchies/';
const out = path.resolve(process.env.SCREENSHOT_DIR || '.cache/punchies-screenshots');
fs.mkdirSync(out, { recursive: true });
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1688, height: 780 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    let phaser;
    Object.defineProperty(window, 'Phaser', { configurable: true, get() { return phaser; }, set(v) {
      phaser = v;
      const Original = v.Game;
      v.Game = class extends Original { constructor(c) { super(c); window.__testGame = this; } };
    } });
  });
  const waitScene = key => page.waitForFunction(key => window.__testGame?.scene.getScenes(true).some(s => s.scene.key === key), key);
  const shot = name => page.screenshot({ path: path.join(out, `${name}.png`) });
  await page.goto(url);
  await waitScene('Menu');
  await shot('menu');
  const boot = await page.evaluate(() => {
    const game = window.__testGame;
    return { textures: game.textures.getTextureKeys().filter(k => k.startsWith('punchies:')).length,
      animations: Object.keys(game.anims.anims.entries).length,
      stamp: game.scene.getScene('Menu').children.list.filter(o => o.type === 'Text').some(o => /^\d{6}r\d{4}$/.test(o.text)) };
  });
  assert(boot.stamp, 'version stamp remains visible');
  const fallback = process.env.EXPECT_FALLBACK === '1';
  assert.equal(boot.animations, fallback ? 0 : 105, 'all folder-derived animations load');
  // Exercise real menu hit targets and roster locking.
  await page.mouse.click(420, 230); await waitScene('CharSelect');
  await shot('character-select');
  await page.mouse.click(844, 365); // Mia for player
  await page.mouse.click(1028, 365); // Bruno for CPU
  await page.mouse.click(968, 574); await waitScene('VsAI');
  await page.waitForTimeout(150);
  await shot('fight');
  await page.evaluate(() => window.__testGame.scene.getScene('VsAI').scene.start('Training'));
  await waitScene('Training');
  await shot('training');
  // Validate every packed action against an actual sprite, at its fixed origin.
  const poses = await page.evaluate(() => {
    const scene = window.__testGame.scene.getScene('Training');
    const { sim, stage } = scene;
    const f = sim.fighters[0], view = stage.views[0];
    const results = [];
    const looks = { marco: [0x3a78d0,0x2ec4d6,1], mia: [0xd04a4a,0xf06fae,.88], bruno:[0x3fa34d,0x9be84a,1.12] };
    for(const [id,[main,alt,scale]] of Object.entries(looks)) for(const color of [main,alt]) {
      f.char=id; f.punch=null; f.dodge=null; f.stunTimer=0; f.guarding=false; f.exhausted=false; f.lastBlow=null;
      view.setLook(color,scale,id==='mia');
      for(const action of ['idle','walk','jab','cross','hook_l','hook_r','uppercut','guard','perfect_guard','dodge','hit_light','hit_heavy','stunned','exhausted']) {
        f.punch=null;f.dodge=null;f.stunTimer=0;f.guarding=false;f.exhausted=false;f.lastBlow=null;
        if(['jab','cross','hook_l','hook_r','uppercut'].includes(action)) f.punch={type:action.startsWith('hook')?'hook':action,hand:action==='hook_l'?0:1,frame:7,startup:4,sourEarly:3,sweet:2,sour:2,recovery:8};
        if(action==='guard'||action==='perfect_guard') {f.guarding=true;f.guardFrames=action==='guard'?100:0;f.perfectEligible=true;}
        if(action==='dodge') f.dodge={frame:6,dx:1,dy:0};
        if(action.startsWith('hit')) {f.lastBlow={punch:action==='hit_heavy'?'cross':'jab',sweet:true};f.framesSinceHit=3;}
        if(action==='stunned')f.stunTimer=20;
        if(action==='exhausted')f.exhausted=true;
        view.drawArt(f,250,action==='walk');
        results.push({action,id,color,visible:view.sprite.visible,frame:view.sprite.frame.name,source:[view.sprite.frame.realWidth,view.sprite.frame.realHeight],scale:view.sprite.scaleX,origin:[view.sprite.originX,view.sprite.originY]});
      }
    }
    return results;
  });
  for(const p of poses) {
    assert.equal(p.visible,!fallback,`${p.id} ${p.action} sprite availability`);
    if(!fallback) {assert(p.frame.includes(`_${p.action}/`),`${p.id} selects ${p.action}`);assert.deepEqual(p.source,[256,256]);assert.deepEqual(p.origin,[.5,.5]);}
  }
  // Fresh training state; exercise keyboard movement, guard and real punches.
  await page.evaluate(() => window.__testGame.scene.getScene('Training').scene.restart()); await waitScene('Training');
  await page.keyboard.down('d'); await page.waitForTimeout(170); await page.keyboard.up('d');
  await page.keyboard.down('Shift'); await page.waitForTimeout(80); await shot('guard'); await page.keyboard.up('Shift');
  await page.keyboard.press('j'); await page.waitForTimeout(50); await shot('jab');
  await page.evaluate(() => { const s=window.__testGame.scene.getScene('Training');s.sim.fighters[1].health=0;s.sim.result={winner:0,reason:'ko',ko:{loser:1,style:'fly',dx:1,dy:0}}; });
  await page.waitForTimeout(800); await shot('ko');
  await page.evaluate(() => {const s=window.__testGame.scene.getScene('Training');s.scene.start('VsAI',{chars:['mia','bruno'],level:'easy'});});await waitScene('VsAI');
  await page.waitForTimeout(3400);
  await page.evaluate(()=>{const s=window.__testGame.scene.getScene('VsAI');s.sim.result={winner:0,reason:'time'};s.showResult();});
  await shot('results');
  await page.evaluate(()=>window.__testGame.scene.getScene('VsAI').scene.start('Tutorial',{restart:true}));await waitScene('Tutorial');await shot('tutorial');
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);await shot('mobile-tutorial');
  // Lobby presentation only: mock TURN and relay sockets to avoid creating
  // a public test room or claiming a two-peer network playtest.
  await page.route('https://mp-net-turn-relay.tianz-88.workers.dev/**', route => route.fulfill({json:{iceServers:[]}}));
  await page.routeWebSocket(/wss:\/\//, () => {});
  await page.evaluate(()=>window.__testGame.scene.getScene('Tutorial').scene.start('Lobby',{role:'host'}));await waitScene('Lobby');
  await page.waitForFunction(()=>window.__testGame.scene.getScene('Lobby').children.list.some(o=>o.type==='Image' && o.texture.key.startsWith('qr-')));
  await shot('online-lobby');
  await page.goto(`${url}?debug=1`);await waitScene('Menu');
  assert(await page.locator('.tp-dfwv').count()>0, 'Tweakpane debug panel remains available');await shot('debug');
  assert.deepEqual(errors,[], 'no browser boot/runtime errors');
  console.log(JSON.stringify({boot,poseChecks:poses.length,errors,screenshots:out,fallback},null,2));
  await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
