import {betaView} from '../../progress/beta';
import type {ProgressView,ProgressState,MatchAward,MatchOutcome,Reward,RewardLadderStep} from '../../progress/rules';
/** API compatibility without any economy/progression storage or rewards. */
export const loadProgress=():ProgressState=>({version:1,totalXp:0,day:'',xpToday:0,matches:betaView().completed,wins:betaView().wins,rewardedLevel:1,titleId:null});
export const catchUpKaiRewards=():Reward[]=>[];
export const progressionLadder=():RewardLadderStep[]=>[];
export const setTitle=(_id:string)=>false;
export const progressView=():ProgressView=>({level:1,xp:0,xpToNext:0,maxed:true,xpToday:0,capToday:0,capReached:false,title:'',unlockedTitles:[],nextRewards:[],matches:betaView().completed,wins:betaView().wins});
export const awardMatch=(_outcome:MatchOutcome):MatchAward&{grantedRewards:Reward[]}=>({state:loadProgress(),xpGained:0,capped:false,levelUps:[],grantedRewards:[]});
