import type {ShopDraftState} from './draft';
declare const __PUNCHIES_STAGING__:boolean;
/** Literal compile-time branch: the allowance is erased from production output. */
export function stagingShopAllowance(state:ShopDraftState):ShopDraftState {
 if(typeof __PUNCHIES_STAGING__!=='undefined'&&__PUNCHIES_STAGING__===true)return {...state,tokens:999};
 return state;
}
