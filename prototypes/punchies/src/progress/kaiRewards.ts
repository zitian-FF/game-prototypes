import type {ProgressConfig,ProgressState,Reward} from './rules';
import {levelFromXp} from './rules';
/** Only this approved new content is eligible for retrospective grants. */
export const KAI_MILESTONES=[
 {level:6,id:'fighter-kai',kind:'fighter',name:'Kai'},
 {level:14,id:'skin-kai-kangaroo-turquoise',kind:'skin',name:'KAI · KANGAROO TURQUOISE'},
 {level:22,id:'skin-kai-grabber-green',kind:'skin',name:'KAI · GRABBER GREEN'},
 {level:32,id:'skin-kai-panda-pink',kind:'skin',name:'KAI · PANDA PINK'},
] as const;
export function pendingKaiRewards(cfg:ProgressConfig,state:ProgressState,owned:readonly string[],ready:(id:string)=>boolean):Reward[]{
 const level=levelFromXp(cfg,state.totalXp);
 return KAI_MILESTONES.filter(m=>level>=m.level&&!owned.includes(m.id)&&ready(m.id)).map(({kind,id})=>({kind,id}));
}
