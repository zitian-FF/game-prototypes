import {webStorage} from '../../portal/web';
import type {Portal} from '../../portal/types';
export const portal:Portal={id:'web',init:async()=>{},loadingFinished(){},gameplay(){},locale:()=>null,storage:webStorage(),ads:{available:false,kind:'real',showRewarded:async()=> 'unavailable'}};
