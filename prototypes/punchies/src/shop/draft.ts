import { store } from '../portal/store';
import { KEYS } from '../portal/keys';
import type { CharId } from '../sim/character';
import config from './draft-config.json';
export { config as shopConfig };
export type ShopKind = 'fighters' | 'skins';
export interface ShopItem { id:string; name:string; kind:ShopKind; boxer:CharId|null; accent:number; description:string; skinType?:'palette'|'unique'; portraitKey?:string; rigGroup?:string; }
// G.P. Tee. The id is the old welcome gift id, kept so existing saves stay valid. He is now a normal fighter chest reward.
export const WELCOME_FIGHTER='fighter-four';
export const SHOP_ITEMS:ShopItem[]=[
  {id:WELCOME_FIGHTER,name:'G.P. TEE',kind:'fighters',boxer:'tee',accent:0xee3159,description:'Explosive power and speed, low HP, stamina and stun resistance.'},
  {id:'fighter-longan',name:'LONGAN',kind:'fighters',boxer:'longan',accent:0x628958,description:'Tall Southeast Asian fighter with ivory handwraps and longan motifs. Provisional stats.'},
  {id:'skin-marco-mcclassic',name:'MARCO · McCLASSIC',kind:'skins',boxer:'marco',accent:0x35ba39,skinType:'unique',portraitKey:'portrait_marco_mcclassic',rigGroup:'marco_mcclassic',description:'Helmet-free Marco in a black top, green kit and gloves. Same Marco stats.'},
  {id:'fighter-tyke',name:'TYKE MAISON',kind:'fighters',boxer:'tyke',accent:0xf4c832,description:'Heavyweight champion with gold gloves and lightning ink. Stats are provisional.'},
  {id:'fighter-dragon',name:'DRAGON',kind:'fighters',boxer:'dragon',accent:0xef3340,description:'Blindfolded karate fighter with padded fingerless gloves. Stats are provisional.'},
  {id:'skin-marco-cyan',name:'MARCO · CYAN RUSH',kind:'skins',boxer:'marco',accent:0x16cde3,description:'Alternate skin: black hair, cyan kit, original skin tone.'},
  {id:'skin-mia-violet',name:'MIA · VIOLET RESOLVE',kind:'skins',boxer:'mia',accent:0x9a36dd,description:'Alternate skin: brunette hair and violet kit.'},
  {id:'skin-bruno-gold',name:'BRUNO · GOLDEN VETERAN',kind:'skins',boxer:'bruno',accent:0xf4c832,description:'Alternate skin: tanner skin and yellow kit.'},
  {id:'skin-marco',name:'MARCO · NIGHT SHIFT',kind:'skins',boxer:'marco',accent:0x899df5,description:'Selectable alternate palette for portrait and rig.'},
  {id:'skin-mia',name:'MIA · SCARLET SPARK',kind:'skins',boxer:'mia',accent:0xf781a3,description:'Selectable alternate palette for portrait and rig.'},
  {id:'skin-bruno',name:'BRUNO · OLD GOLD',kind:'skins',boxer:'bruno',accent:0xf4c55a,description:'Selectable alternate palette for portrait and rig.'},
  {id:'skin-marco-unique',name:'MARCO · RISING STAR',kind:'skins',boxer:'marco',accent:0xffcf45,skinType:'unique',portraitKey:'portrait_marco_rising_star',rigGroup:'marco_rising_star',description:'Same Marco stats. Unique portrait and complete rig sprite set pending.'},
  {id:'skin-mia-flaming-kunoichi',name:'MIA · FLAMING KUNOICHI',kind:'skins',boxer:'mia',accent:0xef3340,skinType:'unique',portraitKey:'portrait_mia_flaming_kunoichi',rigGroup:'mia_flaming_kunoichi',description:'Mia in red ninja robes with simple half gloves. Same Mia stats.'},
  {id:'skin-mia-unique',name:'MIA · RING CAPTAIN',kind:'skins',boxer:'mia',accent:0xc19ffa,skinType:'unique',portraitKey:'portrait_mia_ring_captain',rigGroup:'mia_ring_captain',description:'Same Mia stats. Unique portrait and complete rig sprite set pending.'},
  {id:'skin-bruno-unique',name:'BRUNO · OLD CHAMP',kind:'skins',boxer:'bruno',accent:0x69e7bb,skinType:'unique',portraitKey:'portrait_bruno_old_champ',rigGroup:'bruno_old_champ',description:'Same Bruno stats. Unique portrait and complete rig sprite set pending.'},
];
SHOP_ITEMS.forEach(item=>{if(item.kind==='skins'&&!item.skinType)item.skinType='palette';});
export interface ShopDraftState {version:1; freeSkinChest?:boolean; firstGiftDone?:boolean; tokens:number; welcomeClaimed:boolean; owned:string[]; adDay:string; adsToday:number; offerDay?:string; offerIds?:string[]; offerSchema?:number; purchasedDay?:string; purchasedChests?:ShopKind[];}
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
  return {version:1,freeSkinChest:s.freeSkinChest===true,firstGiftDone:s.firstGiftDone===true,tokens:s.tokens!,welcomeClaimed:claimed,owned,adDay:shopDay(now),adsToday:s.adDay===shopDay(now)?Math.min(s.adsToday!,config.dailyAdLimit):0,offerDay:s.offerDay,offerIds:Array.isArray(s.offerIds)?s.offerIds.filter(id=>SHOP_ITEMS.some(item=>item.id===id)):undefined,offerSchema:s.offerSchema,purchasedDay:shopDay(now),purchasedChests:s.purchasedDay===shopDay(now)&&Array.isArray(s.purchasedChests)?[...new Set(s.purchasedChests.filter(k=>k==='skins'||k==='fighters'))]:[]};
}
/** First launch gift: the Rising Star skin, plus one free skin chest. Granted once. */
export const FIRST_GIFT_SKIN='skin-marco-unique';
export function grantFirstGift(state:ShopDraftState):{state:ShopDraftState;item?:ShopItem}{
  if(state.firstGiftDone)return {state};
  const item=SHOP_ITEMS.find(i=>i.id===FIRST_GIFT_SKIN);
  const owned=state.owned.includes(FIRST_GIFT_SKIN)?state.owned:[...state.owned,FIRST_GIFT_SKIN];
  return {state:{...state,owned,firstGiftDone:true,freeSkinChest:true},item};
}
export function availablePool(state:ShopDraftState,kind:ShopKind):ShopItem[]{return SHOP_ITEMS.filter(i=>i.kind===kind&&!state.owned.includes(i.id));}
/** Freeze today's offers so buying an item cannot reroll the storefront. */
export function refreshDailyOffers(state:ShopDraftState,now=Date.now()):ShopDraftState{
  const s=normalizeShopDraft(state,now),day=shopDay(now);
  if(s.offerDay===day&&s.offerIds&&s.offerSchema===5)return s;
  const seed=Math.floor(now/86400000);
  const pick=(kind:ShopKind,count:number)=>{const pool=availablePool(s,kind);if(!pool.length)return [];const start=((seed%pool.length)+pool.length)%pool.length;return Array.from({length:Math.min(count,pool.length)},(_,i)=>pool[(start+i)%pool.length].id);};
  const skins=availablePool(s,'skins');
  const pickSkins=(unique:boolean,count:number)=>{const pool=skins.filter(i=>(i.skinType==='unique')===unique);if(!pool.length)return [];const start=((seed%pool.length)+pool.length)%pool.length;return Array.from({length:Math.min(count,pool.length)},(_,i)=>pool[(start+i)%pool.length].id);};
  // Preserve the one-unique/two-palette mix. Exhausted categories shrink the pool.
  return {...s,offerDay:day,offerSchema:5,offerIds:[...pickSkins(true,1),...pickSkins(false,2),...pick('fighters',1)]};
}
export function dailyOffers(state:ShopDraftState,kind:ShopKind):ShopItem[]{return (state.offerIds??[]).map(id=>SHOP_ITEMS.find(i=>i.id===id)!).filter(i=>i&&i.kind===kind);}
export function chestRewards(state:ShopDraftState,kind:ShopKind):{item:ShopItem;probability:number}[]{
  const pool=dailyOffers(state,kind).filter(i=>!state.owned.includes(i.id));
  return pool.map(item=>({item,probability:1/pool.length}));
}
export function buyDailyChest(state:ShopDraftState,kind:ShopKind,random:number,now=Date.now()):ShopResult{
  const s=refreshDailyOffers(state,now);
  const free=kind==='skins'&&s.freeSkinChest===true;
  if(!free&&s.purchasedChests?.includes(kind))return {ok:false,reason:'This chest has already been opened today.',reasonKey:'shop.err.chest_opened',state:s};
  const pool=chestRewards(s,kind);
  if(!pool.length)return {ok:false,reason:'All rewards in this chest are owned.',reasonKey:'shop.err.all_owned',state:s};
  const cost=kind==='skins'?config.skinPullCost:config.fighterPullCost;
  if(!free&&s.tokens<cost)return {ok:false,reason:`Need ${cost-s.tokens} more tokens.`,reasonKey:'shop.err.need_tokens',reasonParams:{n:cost-s.tokens},state:s};
  const roll=Number.isFinite(random)?Math.max(0,Math.min(.999999,random)):0;
  const item=pool[Math.floor(roll*pool.length)].item;
  if(free)return {ok:true,item,state:{...s,freeSkinChest:false,owned:[...s.owned,item.id]}};
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
