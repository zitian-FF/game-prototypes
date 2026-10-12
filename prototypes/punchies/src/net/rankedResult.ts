import type {WireProfile} from '../progress/alias';
import type {RatingResult} from './rating';
import type {RankedIdentity,RankedPlayers} from '../ui/rankedIdentityCapsule';

export function rankedPlayers(profiles:[WireProfile|null,WireProfile|null],localIdx:0|1,configured:boolean,baseline?:{local:number;opponent:number}|null):RankedPlayers {
  return profiles.map((profile,i)=>({profile,rating:!configured?{phase:'unavailable'}:
    baseline?{phase:'available',rating:i===localIdx?baseline.local:baseline.opponent}:{phase:'pending'}})) as RankedPlayers;
}
/** One pinned match result. Reports once; subsequent polls only read status. */
export function rankedResultBinding(options:{players:RankedPlayers;localIdx:0|1;configured:boolean;match:Promise<string|null>;
  report:(id:string)=>Promise<RatingResult|null>;status:(id:string)=>Promise<RatingResult|null>;
  schedule:(callback:()=>void)=>()=>void}) {
  let players=options.players,disposed=false,cancel:(()=>void)|undefined,polls=0;
  const listeners=new Set<(players:RankedPlayers)=>void>();
  const publish=(result:RatingResult|null)=>{
    if(disposed)return;
    players=players.map((player,i):RankedIdentity=>{
      const snapshot=result?.state==='settled'?result.outcome?.[i===options.localIdx?'local':'opponent']:undefined;
      return {profile:player.profile,...(snapshot?{snapshot}:{}),rating:snapshot?{phase:'settled',rating:snapshot.after,delta:snapshot.delta}:
        {phase:!result||result.state==='settled'?'unavailable':result.state==='expired'?'expired':'pending'}};
    }) as RankedPlayers;
    for(const listener of listeners)listener(players);
  };
  const poll=async(id:string)=>{
    if(disposed)return;
    const result=await options.status(id).catch(()=>null);publish(result);
    if(!disposed&&result?.state==='pending'&&++polls<8)cancel=options.schedule(()=>void poll(id));
  };
  if(options.configured)void (async()=>{
    const id=await options.match.catch(()=>null);if(!id){publish(null);return;}
    // Preserve the legitimate completed-match report even if its UI closes.
    const result=await options.report(id).catch(()=>null);publish(result);
    if(!disposed&&result?.state==='pending')cancel=options.schedule(()=>void poll(id));
  })();
  return {get players(){return players;},subscribe(update:(players:RankedPlayers)=>void){
    if(disposed)return ()=>{};listeners.add(update);update(players);
    return ()=>{listeners.delete(update);if(!listeners.size){disposed=true;cancel?.();}};
  },dispose(){disposed=true;listeners.clear();cancel?.();}};
}
