import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={},store=new Map(),config=JSON.parse(fs.readFileSync('prototypes/punchies/src/shop/draft-config.json','utf8'));
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/shop/draft.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date:class extends Date{static now(){return Date.parse('2026-10-08T12:00:00Z');}},Set,Number,Math,JSON,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},require:p=>p.includes('paletteCatalog')?{PALETTES:JSON.parse(fs.readFileSync('prototypes/punchies/src/render/paletteCatalog.ts','utf8').split('= ')[1].replace(/;\s*$/,''))}:p.includes('skinPalette')?{STARTER_SKINS:['skin-marco-cyan','skin-mia-violet','skin-bruno-gold']}:p.includes('portal/store')?{store:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}}:p.includes('portal/keys')?{KEYS:{shop:'punchies:shop-preview:v1'}}:{default:config}});
const d=exports,day=Date.parse('2026-10-08T12:00:00Z');
const empty={...d.newShopDraft(day),tokens:0};assert(d.previewAdReward(empty,day).ok);
let s=d.refreshDailyOffers(d.newShopDraft(day),day);
assert.equal(d.buyDailyChest(s,'skins',0,day).ok,false);assert(d.availablePool(s,'fighters').some(i=>i.boxer==='tee'),'Tee is a normal fighter chest reward');
const offers=d.dailyOffers(s,'skins');assert.equal(offers.length,3);assert.equal(offers.filter(i=>i.skinType==='unique').length,1);assert(d.chestRewards(s,'skins').every(r=>r.probability===1/3));
assert.equal(d.buyDailyChest(s,'skins',0,day).ok,false,'insufficient funds');
for(let i=0;i<config.dailyAdLimit;i++)s=d.previewAdReward(s,day).state;
assert.equal(s.tokens,5);assert.equal(d.previewAdReward(s,day).ok,false);
const ids=JSON.stringify(s.offerIds);
for(const [roll,index] of [[0,0],[1/3,1],[2/3,2],[.99999,2]]){const result=d.buyDailyChest(s,'skins',roll,day);assert(result.ok);assert.equal(result.item.id,offers[index].id);assert.equal(result.state.tokens,0);assert.equal(d.buyDailyChest({...result.state,tokens:100},'skins',0,day).ok,false);assert.equal(JSON.stringify(d.refreshDailyOffers(result.state,day).offerIds),ids);}
const skin=d.buyDailyChest(s,'skins',0,day);const fighter=d.buyDailyChest({...skin.state,tokens:10},'fighters',.99,day);assert(fighter.ok);assert.equal(fighter.item.id,d.dailyOffers(s,'fighters')[0].id);assert.equal(fighter.state.tokens,0);assert.equal(d.buyDailyChest({...fighter.state,tokens:100},'fighters',0,day).ok,false);
const next=d.refreshDailyOffers(fighter.state,day+86400000);assert.equal(next.purchasedChests.length,0);assert.equal(next.adsToday,0);assert(!next.offerIds.includes(skin.item.id));assert.equal(d.previewAdReward(next,day+86400000).state.tokens,1);
for(const type of ['palette','unique']){const owned=d.SHOP_ITEMS.filter(i=>i.kind==='skins'&&i.skinType===type).map(i=>i.id);const depleted=d.refreshDailyOffers({...s,owned:[d.WELCOME_FIGHTER,...owned]},day+86400000);const rewards=d.chestRewards(depleted,'skins');assert.equal(rewards.length,type==='palette'?1:2);assert(rewards.every(r=>r.probability===1/rewards.length));}
const done=d.refreshDailyOffers({...s,owned:d.SHOP_ITEMS.map(i=>i.id)},day+86400000);assert.equal(done.offerIds.length,0);assert.equal(d.buyDailyChest({...done,tokens:100},'skins',0,day+86400000).ok,false);
d.saveShopDraft(fighter.state);assert(d.loadShopDraft().owned.includes(fighter.item.id));assert(d.normalizeShopDraft(JSON.parse(store.get("punchies:shop-preview:v1")),day).purchasedChests.includes("skins"));
assert(d.SHOP_ITEMS.filter(i=>i.skinType==='unique').every(i=>i.boxer&&i.portraitKey&&i.rigGroup));
// First launch gift: Rising Star once, plus one free skin chest that does not use the daily chest.
{
  const day2=Date.parse('2026-10-09T12:00:00Z');
  const g=d.grantFirstGift(d.newShopDraft(day2));
  assert.equal(g.item.id,'skin-marco-unique');assert(g.state.owned.includes('skin-marco-unique'));assert.equal(g.state.freeSkinChest,true);
  assert.equal(d.grantFirstGift(g.state).item,undefined,'the gift is granted only once');
  const ownedBefore=g.state.owned.length;
  const free=d.buyDailyChest(g.state,'skins',0,day2);
  assert(free.ok&&free.state.tokens===0&&free.state.freeSkinChest===false&&free.state.owned.length===ownedBefore+1,'the free chest costs nothing and is used once');
  assert(!(free.state.purchasedChests??[]).includes('skins'),'the free chest does not use the daily chest');
  assert.equal(d.buyDailyChest(free.state,'skins',0,day2).ok,false,'the next skin chest costs tokens again');
  assert.equal(d.normalizeShopDraft(JSON.parse(JSON.stringify(g.state)),day2).freeSkinChest,true,'the flag survives a save and load');
}
console.log('Shop chests: 33/33/33 skin rolls, one unique, 100% fighter, per-chest daily locks, independent purchases, reload persistence, next-day reset, 50/50 and 100% depleted odds, insufficient funds and full collection passed');
