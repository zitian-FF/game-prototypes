import type {ShopDraftState,ShopItem,ShopKind} from '../../shop/draft';
export type {ShopDraftState,ShopItem,ShopKind} from '../../shop/draft';
export const SHOP_ITEMS:ShopItem[]=[];
export const WELCOME_FIGHTER='';
export const loadShopDraft=():ShopDraftState=>({version:1,tokens:0,welcomeClaimed:false,owned:[],adDay:'',adsToday:0});
export const saveShopDraft=(_state:ShopDraftState)=>false;
export const freeChests=(_state:ShopDraftState,_kind:ShopKind)=>0;
export const shopPreviewBalance=()=>0;
