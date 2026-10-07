import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={},store=new Map(),config=JSON.parse(fs.readFileSync('prototypes/punchies/src/shop/draft-config.json','utf8'));
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/shop/draft.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Date,Set,Number,Math,JSON,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},require:()=>({default:config})});
const d=exports,day=Date.parse('2026-10-08T12:00:00Z');
let s=d.newShopDraft(day);assert.equal(s.tokens,1);assert.equal(d.regularPull(s,'skins',0).ok,false);const welcome=d.welcomePull(s);assert.equal(welcome.item.id,d.WELCOME_FIGHTER);s=welcome.state;assert.equal(s.tokens,0);assert.equal(d.welcomePull(s).ok,false);assert.equal(d.regularPull(s,'fighters',0).ok,false);
for(let i=0;i<config.dailyAdLimit;i++)s=d.previewAdReward(s,day).state;
assert.equal(s.tokens,config.dailyAdLimit*config.adRewardTokens);assert.equal(d.previewAdReward(s,day).ok,false);
const next=d.previewAdReward(s,day+86400000);assert.equal(next.state.adsToday,1);assert.equal(next.state.tokens,s.tokens+config.adRewardTokens);
s={...s,tokens:1000};const original=s.owned.slice();for(const kind of ['fighters','skins']){let pool=d.availablePool(s,kind);const count=pool.length;for(let i=0;i<count;i++){const r=d.regularPull(s,kind,1);assert(r.ok);assert(!s.owned.includes(r.item.id));s=r.state;}assert.equal(d.regularPull(s,kind,0).ok,false);}
assert.equal(JSON.stringify(original),JSON.stringify([d.WELCOME_FIGHTER]));assert.equal(new Set(s.owned).size,s.owned.length);d.saveShopDraft(s);assert.equal(d.loadShopDraft().tokens,s.tokens);assert(d.loadShopDraft().welcomeClaimed);assert.equal(d.normalizeShopDraft({tokens:-1},day).tokens,1);
console.log('Shop: fixed one-time welcome, separate costs, insufficient funds, daily cap/reset, unique rewards, persistence and malformed-save recovery passed');
