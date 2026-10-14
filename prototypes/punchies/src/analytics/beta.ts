import {ITCH_BETA_EDITION} from '../edition';
import {KEYS} from '../portal/keys';
import {store} from '../portal/store';
import {VERSION_STAMP} from '../version.generated';
import {BetaAnalyticsClient} from './client';
import {durationBucket,validProps,type WireEvent} from './schema';
declare const __PUNCHIES_EDITION__:string;
let client:BetaAnalyticsClient|null=null,matchStart=0,matchCount=0,sessionStart=0,listenersStarted=false;
/** Called only after ArtBoot is ready. Other editions initialize no IDs, listeners or timers. */
export function bootBetaAnalytics():void{
 if(typeof __PUNCHIES_EDITION__==='undefined'||__PUNCHIES_EDITION__!=='itchbeta'||client)return;
 const endpoint=import.meta.env.VITE_PUNCHIES_ANALYTICS_URL??'';
 if(!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/v1\/events$/.test(endpoint)&&!/^http:\/\/(localhost|127\.0\.0\.1):\d+\/v1\/events$/.test(endpoint))return;
 const dnt=navigator.doNotTrack==='1'||(window as Window&{doNotTrack?:string}).doNotTrack==='1';
 client=new BetaAnalyticsClient({edition:'itchbeta',endpoint,build:VERSION_STAMP,dnt,search:location.search,now:()=>performance.now(),id:()=>crypto.randomUUID(),read:()=>KEYS.betaAnalytics?store.getItem(KEYS.betaAnalytics):null,write:value=>{if(KEYS.betaAnalytics)store.setItem(KEYS.betaAnalytics,value);},send:async(body,beacon)=>{
  if(beacon&&navigator.sendBeacon)return navigator.sendBeacon(endpoint,new Blob([body],{type:'text/plain'}));
  const response=await fetch(endpoint,{method:'POST',body,headers:{'Content-Type':'text/plain'},keepalive:true,credentials:'omit',referrerPolicy:'no-referrer'});return response.ok;
 }});client.boot();startListeners();
}
function startListeners():void{
 if(!client?.enabled||listenersStarted)return;listenersStarted=true;sessionStart=performance.now();
 client.event('boot_done',{load:performance.now()<2000?'fast':performance.now()<6000?'medium':'slow',input:matchMedia('(pointer:coarse)').matches?'touch':'desktop',viewport:innerWidth<600?'small':innerWidth<1000?'medium':'large'});
 if(!client.enabled)return;
 window.setInterval(()=>void client?.flush(),10000);
 window.addEventListener('pagehide',()=>{client?.event('session_end',{duration:durationBucket(performance.now()-sessionStart)});void client?.flush(true);});
 window.addEventListener('error',()=>client?.event('error',{type:'runtime'}));
 window.addEventListener('unhandledrejection',()=>client?.event('error',{type:'promise'}));
 let frames=0,start=performance.now(),reported=0;
 const sample=()=>{if(!client?.enabled)return;frames++;const age=performance.now()-start;if(age>=10000){if(!document.hidden&&reported<3){client.event('perf',{fps:frames*1000/age<30?'low':frames*1000/age<50?'medium':'high'});reported++;}frames=0;start=performance.now();}if(reported<3)requestAnimationFrame(sample);};requestAnimationFrame(sample);
}
export function analyticsEnabled():boolean{return client?.enabled??false;}
export function setAnalyticsOptout(value:boolean):void{if(typeof __PUNCHIES_EDITION__==='undefined'||__PUNCHIES_EDITION__!=='itchbeta')return;client?.setOptout(value);if(!value)startListeners();}
const mode=(value:string)=>(({VsAI:'vsai',LocalVs:'localvs',Online:'online',Match:'online',Training:'training',Tutorial:'tutorial'} as Record<string,string>)[value]??value);
/** Only allowlisted events reach the collector; existing arbitrary portal calls are not serialized. */
export function betaTrack(category:string,what:string,action:string,props:Record<string,string|number|boolean>={}):void{
 if(typeof __PUNCHIES_EDITION__==='undefined'||__PUNCHIES_EDITION__!=='itchbeta'||!client)return;
 let e='',p:WireEvent['p']={};
 if(category==='beta'&&action==='event'){e=what;p=props;}
 else if(category==='firstrun'){
  if(what==='fight'&&action==='start')e='firstfight_start';
  else if(action==='hit'){e='firstfight_hit';p={punch:what};}
  else if(action==='done'){e='firstfight_done';p={result:what};}
 }else if(category==='tutorial'&&action==='reached'){const match=/^(modern|classic)_step_(\d+)$/.exec(what);if(match){e='tutorial_step';p={control:match[1],step:Number(match[2])};}}
 else if(category==='tutorial'&&action==='complete')e='tutorial_done';
 else if(category==='match'&&['win','lose','draw','finished','quit','disconnect'].includes(action)){e='match_end';p={mode:mode(what),result:action==='finished'&&typeof props.result==='string'?props.result:action,duration:durationBucket(performance.now()-matchStart)};}
 if(e==='match_start'){matchStart=performance.now();matchCount++;if(matchCount===2)client.event('second_match_start',{mode:p.mode});}
 if(validProps(e,p))client.event(e,p);
}
