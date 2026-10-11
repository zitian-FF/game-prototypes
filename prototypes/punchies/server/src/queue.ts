interface SQL {exec<T=Record<string,unknown>>(sql:string,...args:unknown[]):Iterable<T>}
interface Ticket {ticket:string;player:string;joined:number;lease:number;rating:number;pair:string}
interface Pair {id:string;a:string;b:string;room:string;nonce:string;expires:number;started:number}
const first=<T>(rows:Iterable<T>)=>Array.from(rows)[0];
export const queueConfig={leaseMs:15000,pairTimeoutMs:45000,maxWaitMs:90000,initialGap:100,widenEveryMs:10000,widenBy:50,maxGap:500,maxQueued:512};
export class RankedQueue {
 constructor(private sql:SQL){
  sql.exec('CREATE TABLE IF NOT EXISTS ranked_queue(ticket TEXT PRIMARY KEY,player TEXT UNIQUE,joined INTEGER,lease INTEGER,rating INTEGER,pair TEXT)');
  sql.exec('CREATE TABLE IF NOT EXISTS ranked_pairs(id TEXT PRIMARY KEY,a TEXT,b TEXT,room TEXT,nonce TEXT,expires INTEGER,started INTEGER)');
 }
 private drop(pair:string){this.sql.exec('DELETE FROM ranked_queue WHERE pair=?',pair);this.sql.exec('DELETE FROM ranked_pairs WHERE id=?',pair);}
 private expire(now:number){
  for(const p of this.sql.exec<Pair>('SELECT * FROM ranked_pairs WHERE expires<=?',now))this.drop(p.id);
  for(const q of this.sql.exec<Ticket>('SELECT * FROM ranked_queue WHERE lease<=?',now)){
   const p=q.pair&&first(this.sql.exec<Pair>('SELECT * FROM ranked_pairs WHERE id=?',q.pair));
   if(p&&!p.started)this.drop(p.id);else this.sql.exec('DELETE FROM ranked_queue WHERE ticket=?',q.ticket);
  }
 }
 private response(q:Ticket,now:number){
  if(!q.pair)return {status:'waiting',ticket:q.ticket,waitMs:now-q.joined};
  const p=first(this.sql.exec<Pair>('SELECT * FROM ranked_pairs WHERE id=?',q.pair));
  return p?{status:'paired',ticket:q.ticket,pairId:p.id,room:p.room,nonce:p.nonce,opponent:q.player===p.a?p.b:p.a,role:q.player===p.a?'host':'guest'}:{status:'cancelled'};
 }
 authorize(id:string,opponent:string,pairId:string){const p=first(this.sql.exec<Pair>('SELECT * FROM ranked_pairs WHERE id=?',pairId));return !!p&&p.expires>Date.now()&&((p.a===id&&p.b===opponent)||(p.b===id&&p.a===opponent));}
 action(action:string,id:string,ticket:unknown,now=Date.now()):object{
  this.expire(now);
  let q=first(this.sql.exec<Ticket>('SELECT * FROM ranked_queue WHERE player=?',id));
  if(action==='join'){
   if(!q){
    if(Array.from(this.sql.exec('SELECT ticket FROM ranked_queue')).length>=queueConfig.maxQueued)return {status:'full'};
    const rating=first(this.sql.exec<{rating:number}>('SELECT rating FROM players WHERE id=?',id)).rating;
    this.sql.exec('INSERT INTO ranked_queue VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,now,now+queueConfig.leaseMs,rating,'');
    q=first(this.sql.exec<Ticket>('SELECT * FROM ranked_queue WHERE player=?',id));
   }
  }else if(!q||q.ticket!==ticket)return {status:'cancelled'};
  if(action==='cancel'){
   const p=q.pair&&first(this.sql.exec<Pair>('SELECT * FROM ranked_pairs WHERE id=?',q.pair));
   if(p&&!p.started)this.drop(p.id);else this.sql.exec('DELETE FROM ranked_queue WHERE ticket=?',q.ticket);
   return {status:'cancelled'};
  }
  if(action==='complete'){
   if(q.pair)this.sql.exec('UPDATE ranked_pairs SET started=1,expires=? WHERE id=?',now+600000,q.pair);
   this.sql.exec('DELETE FROM ranked_queue WHERE ticket=?',q.ticket);return {status:'complete'};
  }
  if(!q.pair&&now-q.joined>=queueConfig.maxWaitMs){this.sql.exec('DELETE FROM ranked_queue WHERE ticket=?',q.ticket);return {status:'timeout'};}
  this.sql.exec('UPDATE ranked_queue SET lease=? WHERE ticket=?',now+queueConfig.leaseMs,q.ticket);
  if(!q.pair){
   const gap=(x:Ticket)=>Math.min(queueConfig.maxGap,queueConfig.initialGap+Math.floor((now-x.joined)/queueConfig.widenEveryMs)*queueConfig.widenBy);
   const candidates=Array.from(this.sql.exec<Ticket>('SELECT * FROM ranked_queue WHERE pair=?','')).filter(x=>x.player!==id&&Math.abs(x.rating-q.rating)<=Math.max(gap(x),gap(q)));
   candidates.sort((a,b)=>Math.abs(a.rating-q.rating)-Math.abs(b.rating-q.rating)||a.joined-b.joined||a.ticket.localeCompare(b.ticket));
   const other=candidates[0];if(other){
    const [a,b]=[q,other].sort((x,y)=>x.joined-y.joined||x.ticket.localeCompare(y.ticket));
    const pair=crypto.randomUUID();this.sql.exec('INSERT INTO ranked_pairs VALUES(?,?,?,?,?,?,0)',pair,a.player,b.player,crypto.randomUUID(),crypto.randomUUID(),now+queueConfig.pairTimeoutMs);
    this.sql.exec('UPDATE ranked_queue SET pair=?,lease=? WHERE ticket IN (?,?)',pair,now+queueConfig.leaseMs,q.ticket,other.ticket);q.pair=pair;
   }
  }
  return this.response(q,now);
 }
}
