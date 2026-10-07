import config from './draft-config.json';
export { config as shopConfig };
export type ShopKind = 'fighters' | 'skins';
export interface ShopItem { id:string; name:string; kind:ShopKind; boxer:'marco'|'mia'|'bruno'|null; accent:number; description:string; }
export const WELCOME_FIGHTER='fighter-four';
export const SHOP_ITEMS:ShopItem[]=[
  {id:WELCOME_FIGHTER,name:'THE FOURTH FIGHTER',kind:'fighters',boxer:null,accent:0xffcf45,description:'Guaranteed welcome fighter. Identity, artwork and stats pending.'},
  {id:'fighter-five',name:'THE ROOKIE',kind:'fighters',boxer:null,accent:0x56c7ef,description:'Fighter pool placeholder. Portrait, rig and balanced stats pending.'},
  {id:'fighter-six',name:'THE SOUTHPAW',kind:'fighters',boxer:null,accent:0xb299fa,description:'Fighter pool placeholder. Portrait, rig and balanced stats pending.'},
  {id:'skin-marco',name:'MARCO · NIGHT SHIFT',kind:'skins',boxer:'marco',accent:0x899df5,description:'Palette study for both portrait and rig. Final skin artwork pending.'},
  {id:'skin-mia',name:'MIA · SCARLET SPARK',kind:'skins',boxer:'mia',accent:0xf781a3,description:'Palette study for both portrait and rig. Final skin artwork pending.'},
  {id:'skin-bruno',name:'BRUNO · OLD GOLD',kind:'skins',boxer:'bruno',accent:0xf4c55a,description:'Palette study for both portrait and rig. Final skin artwork pending.'},
];
export interface ShopDraftState {version:1; tokens:number; welcomeClaimed:boolean; owned:string[]; adDay:string; adsToday:number;}
export type ShopResult={ok:true;state:ShopDraftState;item?:ShopItem}|{ok:false;reason:string;state:ShopDraftState};
export const shopDay=(now=Date.now())=>new Date(now).toISOString().slice(0,10);
export function newShopDraft(now=Date.now()):ShopDraftState{return {version:1,tokens:config.welcomeGiftTokens,welcomeClaimed:false,owned:[],adDay:shopDay(now),adsToday:0};}
export function normalizeShopDraft(value:unknown,now=Date.now()):ShopDraftState{
  if(!value||typeof value!=='object')return newShopDraft(now);
  const s=value as Partial<ShopDraftState>;
  if(s.version!==1||!Number.isSafeInteger(s.tokens)||s.tokens!<0||typeof s.welcomeClaimed!=='boolean'||!Array.isArray(s.owned)||!Number.isSafeInteger(s.adsToday)||s.adsToday!<0||typeof s.adDay!=='string')return newShopDraft(now);
  const claimed=s.welcomeClaimed||s.owned.includes(WELCOME_FIGHTER);
  const owned=[...new Set(s.owned.filter(id=>SHOP_ITEMS.some(item=>item.id===id)))];
  if(claimed&&!owned.includes(WELCOME_FIGHTER))owned.push(WELCOME_FIGHTER);
  return {version:1,tokens:s.tokens!,welcomeClaimed:claimed,owned,adDay:shopDay(now),adsToday:s.adDay===shopDay(now)?Math.min(s.adsToday!,config.dailyAdLimit):0};
}
export function welcomePull(state:ShopDraftState):ShopResult{
  if(state.welcomeClaimed)return {ok:false,reason:'Welcome fighter already claimed.',state};
  if(state.tokens<config.welcomeCost)return {ok:false,reason:'Not enough tokens.',state};
  return {ok:true,item:SHOP_ITEMS[0],state:{...state,tokens:state.tokens-config.welcomeCost,welcomeClaimed:true,owned:[...state.owned,WELCOME_FIGHTER]}};
}
export function availablePool(state:ShopDraftState,kind:ShopKind):ShopItem[]{return SHOP_ITEMS.filter(i=>i.kind===kind&&i.id!==WELCOME_FIGHTER&&!state.owned.includes(i.id));}
export function regularPull(state:ShopDraftState,kind:ShopKind,random:number):ShopResult{
  if(!state.welcomeClaimed)return {ok:false,reason:'Try your guaranteed welcome pull first.',state};
  const pool=availablePool(state,kind),cost=kind==='fighters'?config.fighterPullCost:config.skinPullCost;
  if(!pool.length)return {ok:false,reason:'This preview collection is complete.',state};
  if(state.tokens<cost)return {ok:false,reason:`Need ${cost-state.tokens} more tokens.`,state};
  const item=pool[Math.min(pool.length-1,Math.floor(Math.max(0,Math.min(.999999,Number.isFinite(random)?random:0))*pool.length))];
  return {ok:true,item,state:{...state,tokens:state.tokens-cost,owned:[...state.owned,item.id]}};
}
export function previewAdReward(state:ShopDraftState,now=Date.now()):ShopResult{
  const s=normalizeShopDraft(state,now);
  if(!s.welcomeClaimed)return {ok:false,reason:'Claim the welcome fighter first.',state:s};
  if(s.adsToday>=config.dailyAdLimit)return {ok:false,reason:'Daily preview limit reached. Resets at 00:00 UTC.',state:s};
  return {ok:true,state:{...s,tokens:s.tokens+config.adRewardTokens,adsToday:s.adsToday+1}};
}
const KEY='punchies:shop-preview:v1';
export function shopPreviewBalance():number{try{const raw=localStorage.getItem(KEY);return raw?normalizeShopDraft(JSON.parse(raw)).tokens:0;}catch{return 0;}}
export function loadShopDraft():ShopDraftState{try{return normalizeShopDraft(JSON.parse(localStorage.getItem(KEY)??'null'));}catch{return newShopDraft();}}
export function saveShopDraft(s:ShopDraftState):boolean{try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch{return false;}}
