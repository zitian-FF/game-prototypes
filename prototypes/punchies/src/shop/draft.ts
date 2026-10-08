import config from './draft-config.json';
export { config as shopConfig };
export type ShopKind = 'fighters' | 'skins';
export interface ShopItem { id:string; name:string; kind:ShopKind; boxer:'marco'|'mia'|'bruno'|null; accent:number; description:string; skinType?:'palette'|'unique'; portraitKey?:string; rigGroup?:string; }
export const WELCOME_FIGHTER='fighter-four';
export const SHOP_ITEMS:ShopItem[]=[
  {id:WELCOME_FIGHTER,name:'THE FOURTH FIGHTER',kind:'fighters',boxer:null,accent:0xffcf45,description:'Guaranteed welcome fighter. Identity, artwork and stats pending.'},
  {id:'fighter-five',name:'THE ROOKIE',kind:'fighters',boxer:null,accent:0x56c7ef,description:'Fighter pool placeholder. Portrait, rig and balanced stats pending.'},
  {id:'fighter-six',name:'THE SOUTHPAW',kind:'fighters',boxer:null,accent:0xb299fa,description:'Fighter pool placeholder. Portrait, rig and balanced stats pending.'},
  {id:'skin-marco',name:'MARCO · NIGHT SHIFT',kind:'skins',boxer:'marco',accent:0x899df5,description:'Palette study for both portrait and rig. Final skin artwork pending.'},
  {id:'skin-mia',name:'MIA · SCARLET SPARK',kind:'skins',boxer:'mia',accent:0xf781a3,description:'Palette study for both portrait and rig. Final skin artwork pending.'},
  {id:'skin-bruno',name:'BRUNO · OLD GOLD',kind:'skins',boxer:'bruno',accent:0xf4c55a,description:'Palette study for both portrait and rig. Final skin artwork pending.'},
  {id:'skin-marco-unique',name:'MARCO · RISING STAR',kind:'skins',boxer:'marco',accent:0xffcf45,skinType:'unique',portraitKey:'portrait_marco_rising_star',rigGroup:'marco_rising_star',description:'Same Marco stats. Unique portrait and complete rig sprite set pending.'},
  {id:'skin-mia-unique',name:'MIA · RING CAPTAIN',kind:'skins',boxer:'mia',accent:0xc19ffa,skinType:'unique',portraitKey:'portrait_mia_ring_captain',rigGroup:'mia_ring_captain',description:'Same Mia stats. Unique portrait and complete rig sprite set pending.'},
  {id:'skin-bruno-unique',name:'BRUNO · OLD CHAMP',kind:'skins',boxer:'bruno',accent:0x69e7bb,skinType:'unique',portraitKey:'portrait_bruno_old_champ',rigGroup:'bruno_old_champ',description:'Same Bruno stats. Unique portrait and complete rig sprite set pending.'},
];
SHOP_ITEMS.forEach(item=>{if(item.kind==='skins'&&!item.skinType)item.skinType='palette';});
export interface ShopDraftState {version:1; tokens:number; welcomeClaimed:boolean; owned:string[]; adDay:string; adsToday:number; offerDay?:string; offerIds?:string[]; offerSchema?:number; purchasedDay?:string; purchasedChests?:ShopKind[];}
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
  return {version:1,tokens:s.tokens!,welcomeClaimed:claimed,owned,adDay:shopDay(now),adsToday:s.adDay===shopDay(now)?Math.min(s.adsToday!,config.dailyAdLimit):0,offerDay:s.offerDay,offerIds:Array.isArray(s.offerIds)?s.offerIds.filter(id=>SHOP_ITEMS.some(item=>item.id===id)):undefined,offerSchema:s.offerSchema,purchasedDay:shopDay(now),purchasedChests:s.purchasedDay===shopDay(now)&&Array.isArray(s.purchasedChests)?[...new Set(s.purchasedChests.filter(k=>k==='skins'||k==='fighters'))]:[]};
}
export function welcomePull(state:ShopDraftState):ShopResult{
  if(state.welcomeClaimed)return {ok:false,reason:'Welcome fighter already claimed.',state};
  if(state.tokens<config.welcomeCost)return {ok:false,reason:'Not enough tokens.',state};
  return {ok:true,item:SHOP_ITEMS[0],state:{...state,tokens:state.tokens-config.welcomeCost,welcomeClaimed:true,owned:[...state.owned,WELCOME_FIGHTER]}};
}
export function availablePool(state:ShopDraftState,kind:ShopKind):ShopItem[]{return SHOP_ITEMS.filter(i=>i.kind===kind&&i.id!==WELCOME_FIGHTER&&!state.owned.includes(i.id));}
/** Freeze today's offers so buying an item cannot reroll the storefront. */
export function refreshDailyOffers(state:ShopDraftState,now=Date.now()):ShopDraftState{
  const s=normalizeShopDraft(state,now),day=shopDay(now);
  if(s.offerDay===day&&s.offerIds&&s.offerSchema===2)return s;
  const seed=Math.floor(now/86400000);
  const pick=(kind:ShopKind,count:number)=>{const pool=availablePool(s,kind);if(!pool.length)return [];const start=((seed%pool.length)+pool.length)%pool.length;return Array.from({length:Math.min(count,pool.length)},(_,i)=>pool[(start+i)%pool.length].id);};
  const skins=availablePool(s,'skins');
  const pickSkins=(unique:boolean,count:number)=>{const pool=skins.filter(i=>(i.skinType==='unique')===unique);if(!pool.length)return [];const start=((seed%pool.length)+pool.length)%pool.length;return Array.from({length:Math.min(count,pool.length)},(_,i)=>pool[(start+i)%pool.length].id);};
  // Preserve the one-unique/two-palette mix. Exhausted categories shrink the pool.
  return {...s,offerDay:day,offerSchema:2,offerIds:[...pickSkins(true,1),...pickSkins(false,2),...pick('fighters',1)]};
}
export function dailyOffers(state:ShopDraftState,kind:ShopKind):ShopItem[]{return (state.offerIds??[]).map(id=>SHOP_ITEMS.find(i=>i.id===id)!).filter(i=>i&&i.kind===kind);}
export function chestRewards(state:ShopDraftState,kind:ShopKind):{item:ShopItem;probability:number}[]{
  const pool=dailyOffers(state,kind).filter(i=>!state.owned.includes(i.id));
  return pool.map(item=>({item,probability:1/pool.length}));
}
export function buyDailyChest(state:ShopDraftState,kind:ShopKind,random:number,now=Date.now()):ShopResult{
  const s=refreshDailyOffers(state,now);
  if(!s.welcomeClaimed)return {ok:false,reason:'Claim the welcome fighter first.',state:s};
  if(s.purchasedChests?.includes(kind))return {ok:false,reason:'This chest has already been opened today.',state:s};
  const pool=chestRewards(s,kind);
  if(!pool.length)return {ok:false,reason:'All rewards in this chest are owned.',state:s};
  const cost=kind==='skins'?config.skinPullCost:config.fighterPullCost;
  if(s.tokens<cost)return {ok:false,reason:`Need ${cost-s.tokens} more tokens.`,state:s};
  const roll=Number.isFinite(random)?Math.max(0,Math.min(.999999,random)):0;
  const item=pool[Math.floor(roll*pool.length)].item;
  return {ok:true,item,state:{...s,tokens:s.tokens-cost,owned:[...s.owned,item.id],purchasedChests:[...(s.purchasedChests??[]),kind]}};
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
