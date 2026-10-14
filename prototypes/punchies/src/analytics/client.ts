import {MAX_BYTES,MAX_EVENTS,MAX_SESSION_EVENTS,byteSize,uuid,validProps,type Batch,type WireEvent} from './schema';
export interface AnalyticsRuntime {
 edition:string;endpoint:string;build:string;dnt:boolean;search:string;now:()=>number;id:()=>string;
 read:()=>string|null;write:(value:string)=>void;send:(body:string,beacon:boolean)=>Promise<boolean>;
}
/** Runtime-independent queue. Failed batches retain the original (sid,n) identifiers. */
export class BetaAnalyticsClient {
 private queue:WireEvent[]=[];private sid='';private pid='';private started=0;private n=0;private ready=false;private optedOut=false;private sending=false;
 constructor(private runtime:AnalyticsRuntime){}
 get enabled(){return this.ready&&!this.optedOut&&!this.runtime.dnt&&new URLSearchParams(this.runtime.search).get('noanalytics')!=='1'&&this.runtime.edition==='itchbeta'&&!!this.runtime.endpoint;}
 boot(){
  if(this.ready||this.runtime.edition!=='itchbeta'||!this.runtime.endpoint||this.runtime.dnt||new URLSearchParams(this.runtime.search).get('noanalytics')==='1')return;
  try{const saved=JSON.parse(this.runtime.read()??'null');if(saved?.optout===true){this.optedOut=true;return;}this.pid=uuid(saved?.pid)?saved.pid:this.runtime.id();this.sid=this.runtime.id();if(!uuid(this.pid)||!uuid(this.sid))return;this.runtime.write(JSON.stringify({pid:this.pid,optout:false}));this.started=this.runtime.now();this.ready=true;}catch{/* blocked storage: no persistent tracking fallback */}
 }
 setOptout(value:boolean){this.optedOut=value;this.queue=[];try{const saved=JSON.parse(this.runtime.read()??'null');this.runtime.write(JSON.stringify({...uuid(saved?.pid)?{pid:saved.pid}:{},optout:value}));}catch{}if(!value&&!this.ready)this.boot();}
 event(e:string,p:WireEvent['p']={}){
  if(!this.enabled||this.n>=MAX_SESSION_EVENTS||!validProps(e,p))return;
  const event={n:this.n+1,t:Math.max(0,Math.min(86400000,Math.round(this.runtime.now()-this.started))),e,p:{...p}};
  if(byteSize(JSON.stringify(this.batch([event])))>MAX_BYTES)return;
  this.n++;this.queue.push(event);if(this.queue.length>=MAX_EVENTS)void this.flush();
 }
 private batch(events:WireEvent[]):Batch{return {v:1,edition:'itchbeta',build:this.runtime.build,sid:this.sid,pid:this.pid,events};}
 async flush(beacon=false):Promise<void>{
  if(!this.enabled||this.sending||!this.queue.length)return;this.sending=true;
  try{while(this.enabled&&this.queue.length){const events:WireEvent[]=[];for(const event of this.queue){if(events.length===MAX_EVENTS||byteSize(JSON.stringify(this.batch([...events,event])))>MAX_BYTES)break;events.push(event);}if(!events.length){this.queue.shift();continue;}const accepted=await this.runtime.send(JSON.stringify(this.batch(events)),beacon);if(!accepted)break;this.queue.splice(0,events.length);if(beacon)break;}}catch{/* retry on next timer; never reject into gameplay */}finally{this.sending=false;}
 }
}
