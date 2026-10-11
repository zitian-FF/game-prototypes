import { PALETTES } from '../render/paletteCatalog';
import { store } from '../portal/store';
import { KEYS } from '../portal/keys';
import type { CharId } from '../sim/character';
import config from './draft-config.json';
export { config as shopConfig };
export type ShopKind = 'fighters' | 'skins';
export interface ShopItem { id:string; name:string; kind:ShopKind; boxer:CharId|null; accent:number; description:string; skinType?:'palette'|'unique'; portraitKey?:string; rigGroup?:string; artPending?:boolean; /** Earned on the level track only: never in a chest or the daily offers. */ earnOnly?:boolean; }
// G.P. Tee. The id is the old welcome gift id, kept so existing saves stay valid. He is now a normal fighter chest reward.
export const WELCOME_FIGHTER='fighter-four';
export const SHOP_ITEMS:ShopItem[]=[
  {id:'fighter-roxy',name:'ROXY',kind:'fighters',boxer:'roxy',accent:0xff761d,description:'Short orange hair, navy kit and orange gloves. Provisional stats.'},
  {id:'fighter-nadia',name:'NADIA',kind:'fighters',boxer:'nadia',accent:0x7622bf,description:'Petite determined rising star, silver bun, violet kit and emerald gloves. Provisional stats.'},
  {id:'fighter-captain',name:'CAPTAIN EAGLE',kind:'fighters',boxer:'captain',accent:0xffce54,description:'Visored racer with eagle helmet, gold scarf and asymmetric armour. Provisional stats.'},
  {id:WELCOME_FIGHTER,name:'G.P. TEE',kind:'fighters',boxer:'tee',accent:0xee3159,description:'Explosive power and speed, low HP, stamina and stun resistance.'},
  {id:'fighter-longan',name:'LONGAN',kind:'fighters',boxer:'longan',accent:0x628958,description:'Tall Southeast Asian fighter with ivory handwraps and longan motifs. Provisional stats.'},
  {id:'skin-marco-mcclassic',name:'MARCO · McCLASSIC',kind:'skins',boxer:'marco',accent:0x35ba39,skinType:'unique',portraitKey:'portrait_marco_mcclassic',rigGroup:'marco_mcclassic',description:'Helmet-free Marco in a black top, green kit and gloves. Same Marco stats.'},
  {id:'fighter-tyke',name:'TYKE MAISON',kind:'fighters',boxer:'tyke',accent:0xf4c832,description:'Heavyweight champion with gold gloves and lightning ink. Stats are provisional.'},
  {id:'fighter-dragon',name:'DRAGON',kind:'fighters',boxer:'dragon',accent:0xef3340,description:'Blindfolded karate fighter with padded fingerless gloves. Stats are provisional.'},
  {id:'skin-marco-unique',name:'MARCO · RISING STAR',kind:'skins',boxer:'marco',accent:0xffcf45,skinType:'unique',portraitKey:'portrait_marco_rising_star',rigGroup:'marco_rising_star',description:'Blue and gold, ready for the spotlight. Same Marco stats.'},
  {id:'skin-mia-flaming-kunoichi',name:'MIA · FLAMING KUNOICHI',kind:'skins',boxer:'mia',accent:0xef3340,skinType:'unique',portraitKey:'portrait_mia_flaming_kunoichi',rigGroup:'mia_flaming_kunoichi',description:'Mia in red ninja robes with simple half gloves. Same Mia stats.'},
  {id:'skin-mia-unique',name:'MIA · RING CAPTAIN',kind:'skins',boxer:'mia',accent:0xc19ffa,skinType:'unique',portraitKey:'portrait_mia_ring_captain',rigGroup:'mia_ring_captain',artPending:true,description:'Same Mia stats. Unique portrait and complete rig sprite set pending.'},
  {id:'skin-bruno-unique',name:'BRUNO · OLD CHAMP',kind:'skins',boxer:'bruno',accent:0x69e7bb,skinType:'unique',portraitKey:'portrait_bruno_old_champ',rigGroup:'bruno_old_champ',artPending:true,description:'Same Bruno stats. Unique portrait and complete rig sprite set pending.'},
];
SHOP_ITEMS.push(...Object.entries(PALETTES).map(([id, p]): ShopItem => ({ id, name: p.boxer.toUpperCase() + ' · ' + p.name.toUpperCase(), kind: 'skins', boxer: p.boxer as CharId, accent: p.gloves, skinType: 'palette', description: 'Cosmetic palette for portrait and rig. Original fighter stats.' })));
SHOP_ITEMS.forEach(item=>{if(item.kind==='skins'&&!item.skinType)item.skinType='palette';});
export interface ShopDraftState {version:1; freeSkinChests?:number; freeFighterChests?:number; freeSkinChest?:boolean; firstGiftDone?:boolean; tokens:number; welcomeClaimed:boolean; owned:string[]; adDay:string; adsToday:number; offerDay?:string; offerIds?:string[]; offerSchema?:number; purchasedDay?:string; purchasedChests?:ShopKind[];}
export type ShopResult={ok:true;state:ShopDraftState;item?:ShopItem}|{ok:false;reason:string;reasonKey?:string;reasonParams?:Record<string,number>;state:ShopDraftState};
export const shopDay=(now=Date.now())=>new Date(now).toISOString().slice(0,10);
export function newShopDraft(now=Date.now()):ShopDraftState{return {version:1,tokens:config.welcomeGiftTokens,welcomeClaimed:false,owned:[],adDay:shopDay(now),adsToday:0};}
export function normalizeShopDraft(value:unknown,now=Date.now()):ShopDraftState{
  if(!value||typeof value!=='object')return newShopDraft(now);
  const s=value as Partial<ShopDraftState>;
  if(s.version!==1||!Number.isSafeInteger(s.tokens)||s.tokens!<0||typeof s.welcomeClaimed!=='boolean'||!Array.isArray(s.owned)||!Number.isSafeInteger(s.adsToday)||s.adsToday!<0||typeof s.adDay!=='string')return newShopDraft(now);
  const claimed=s.welcomeClaimed||s.owned.includes(WELCOME_FIGHTER);
  const owned=[...new Set(s.owned.filter(id=>SHOP_ITEMS.some(item=>item.id===id)))];
  if(claimed&&!owned.includes(WELCOME_FIGHTER))owned.push(WELCOME_FIGHTER);
  return {version:1,freeSkinChests:Math.max(Number.isSafeInteger(s.freeSkinChests)&&s.freeSkinChests!>0?s.freeSkinChests!:0,s.freeSkinChest===true?1:0),freeFighterChests:Number.isSafeInteger(s.freeFighterChests)&&s.freeFighterChests!>0?s.freeFighterChests!:0,firstGiftDone:s.firstGiftDone===true,tokens:s.tokens!,welcomeClaimed:claimed,owned,adDay:shopDay(now),adsToday:s.adDay===shopDay(now)?Math.min(s.adsToday!,config.dailyAdLimit):0,offerDay:s.offerDay,offerIds:Array.isArray(s.offerIds)?s.offerIds.filter(id=>SHOP_ITEMS.some(item=>item.id===id)):undefined,offerSchema:s.offerSchema,purchasedDay:shopDay(now),purchasedChests:s.purchasedDay===shopDay(now)&&Array.isArray(s.purchasedChests)?[...new Set(s.purchasedChests.filter(k=>k==='skins'||k==='fighters'))]:[]};
}
/** First launch gift: the Rising Star skin, plus one free skin chest. Granted once. */
export const FIRST_GIFT_SKIN='skin-marco-unique';
export function grantFirstGift(state:ShopDraftState):{state:ShopDraftState;item?:ShopItem}{
  if(state.firstGiftDone)return {state};
  const item=SHOP_ITEMS.find(i=>i.id===FIRST_GIFT_SKIN);
  const owned=state.owned.includes(FIRST_GIFT_SKIN)?state.owned:[...state.owned,FIRST_GIFT_SKIN];
  return {state:{...state,owned,firstGiftDone:true,freeSkinChests:(state.freeSkinChests??0)+1},item};
}
/** Milestone reward: one free chest of this kind, opened from the Shop without tokens or the daily limit. */
export function grantVoucher(state:ShopDraftState,kind:ShopKind):ShopDraftState{
  return kind==='skins'?{...state,freeSkinChests:(state.freeSkinChests??0)+1}:{...state,freeFighterChests:(state.freeFighterChests??0)+1};
}
/** Milestone reward: own this skin. Returns null when the skin does not exist yet (art pending) or is already owned. */
export function grantSkin(state:ShopDraftState,id:string):ShopDraftState|null{
  if(!SHOP_ITEMS.some(i=>i.id===id&&i.kind==='skins')||state.owned.includes(id))return null;
  return {...state,owned:[...state.owned,id]};
}
export function freeChests(state:ShopDraftState,kind:ShopKind):number{return (kind==='skins'?state.freeSkinChests:state.freeFighterChests)??0;}
/** The three starting boxers plus every fighter the player has pulled. */
export const STARTING_BOXERS:string[]=['marco','mia','bruno'];
export function ownedBoxers(state:ShopDraftState):string[]{
  return [...STARTING_BOXERS,...SHOP_ITEMS.filter(i=>i.kind==='fighters'&&i.boxer&&state.owned.includes(i.id)).map(i=>i.boxer as string)];
}
/** Skins only appear for fighters the player owns; fighters and skins already owned never repeat; earn-only items never appear. */
export function availablePool(state:ShopDraftState,kind:ShopKind):ShopItem[]{
  const boxers=ownedBoxers(state);
  return SHOP_ITEMS.filter(i=>i.kind===kind&&!i.earnOnly&&!i.artPending&&!state.owned.includes(i.id)&&(kind!=='skins'||(i.boxer!==null&&boxers.includes(i.boxer))));
}
/** Freeze today's offers so buying an item cannot reroll the storefront. */
export function refreshDailyOffers(state:ShopDraftState,now=Date.now()):ShopDraftState{
  const s=normalizeShopDraft(state,now),day=shopDay(now);
  if(s.offerDay===day&&s.offerIds&&s.offerSchema===8)return s;
  const seed=Math.floor(now/86400000);
  const pick=(kind:ShopKind,count:number)=>{const pool=availablePool(s,kind);if(!pool.length)return [];const start=((seed%pool.length)+pool.length)%pool.length;return Array.from({length:Math.min(count,pool.length)},(_,i)=>pool[(start+i)%pool.length].id);};
  const skins=availablePool(s,'skins');
  const pickSkins=(unique:boolean,count:number)=>{const pool=skins.filter(i=>(i.skinType==='unique')===unique);if(!pool.length)return [];const start=((seed%pool.length)+pool.length)%pool.length;return Array.from({length:Math.min(count,pool.length)},(_,i)=>pool[(start+i)%pool.length].id);};
  // Preserve the one-unique/two-palette mix. Exhausted categories shrink the pool.
  return {...s,offerDay:day,offerSchema:8,offerIds:[...pickSkins(true,1),...pickSkins(false,2),...pick('fighters',1)]};
}
export function dailyOffers(state:ShopDraftState,kind:ShopKind):ShopItem[]{const boxers=ownedBoxers(state);return (state.offerIds??[]).map(id=>SHOP_ITEMS.find(i=>i.id===id)!).filter(i=>i&&!i.artPending&&i.kind===kind&&(kind!=='skins'||(i.boxer!==null&&boxers.includes(i.boxer))));}
export function chestRewards(state:ShopDraftState,kind:ShopKind):{item:ShopItem;probability:number}[]{
  const pool=dailyOffers(state,kind).filter(i=>!state.owned.includes(i.id));
  return pool.map(item=>({item,probability:1/pool.length}));
}
export function buyDailyChest(state:ShopDraftState,kind:ShopKind,random:number,now=Date.now()):ShopResult{
  const s=refreshDailyOffers(state,now);
  const freeCount=(kind==='skins'?s.freeSkinChests:s.freeFighterChests)??0;
  const free=freeCount>0;
  if(!free&&s.purchasedChests?.includes(kind))return {ok:false,reason:'This chest has already been opened today.',reasonKey:'shop.err.chest_opened',state:s};
  const pool=chestRewards(s,kind);
  if(!pool.length)return {ok:false,reason:'All rewards in this chest are owned.',reasonKey:'shop.err.all_owned',state:s};
  const cost=kind==='skins'?config.skinPullCost:config.fighterPullCost;
  if(!free&&s.tokens<cost)return {ok:false,reason:`Need ${cost-s.tokens} more tokens.`,reasonKey:'shop.err.need_tokens',reasonParams:{n:cost-s.tokens},state:s};
  const roll=Number.isFinite(random)?Math.max(0,Math.min(.999999,random)):0;
  const item=pool[Math.floor(roll*pool.length)].item;
  if(free)return {ok:true,item,state:{...s,...(kind==='skins'?{freeSkinChests:freeCount-1}:{freeFighterChests:freeCount-1}),owned:[...s.owned,item.id]}};
  return {ok:true,item,state:{...s,tokens:s.tokens-cost,owned:[...s.owned,item.id],purchasedChests:[...(s.purchasedChests??[]),kind]}};
}
export function previewAdReward(state:ShopDraftState,now=Date.now()):ShopResult{
  const s=normalizeShopDraft(state,now);
  if(s.adsToday>=config.dailyAdLimit)return {ok:false,reason:'Daily preview limit reached. Resets at 00:00 UTC.',reasonKey:'shop.err.daily_limit',state:s};
  return {ok:true,state:{...s,tokens:s.tokens+config.adRewardTokens,adsToday:s.adsToday+1}};
}
const KEY=KEYS.shop;
export function shopPreviewBalance():number{try{const raw=store.getItem(KEY);return raw?normalizeShopDraft(JSON.parse(raw)).tokens:0;}catch{return 0;}}
export function loadShopDraft():ShopDraftState{try{return normalizeShopDraft(JSON.parse(store.getItem(KEY)??'null'));}catch{return newShopDraft();}}
export function saveShopDraft(s:ShopDraftState):boolean{try{store.setItem(KEY,JSON.stringify(s));return true;}catch{return false;}}
