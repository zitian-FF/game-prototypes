interface SQL {exec<T=Record<string,unknown>>(sql:string,...args:unknown[]):Iterable<T>}
interface Ticket {ticket:string;player:string;joined:number;lease:number;rating:number;pair:string;rules:string}
interface Pair {id:string;a:string;b:string;room:string;nonce:string;expires:number;started:number;rules:string}
const first=<T>(rows:Iterable<T>)=>Array.from(rows)[0];
export const queueConfig={leaseMs:15000,pairTimeoutMs:45000,maxWaitMs:90000,initialGap:100,widenEveryMs:10000,widenBy:50,maxGap:500,maxQueued:512};
export class RankedQueue {
 constructor(private sql:SQL){
  sql.exec('CREATE TABLE IF NOT EXISTS ranked_queue(ticket TEXT PRIMARY KEY,player TEXT UNIQUE,joined INTEGER,lease INTEGER,rating INTEGER,pair TEXT)');
  sql.exec('CREATE TABLE IF NOT EXISTS ranked_pairs(id TEXT PRIMARY KEY,a TEXT,b TEXT,room TEXT,nonce TEXT,expires INTEGER,started INTEGER)');
  sql.exec('CREATE TABLE IF NOT EXISTS ranked_baselines(pair TEXT PRIMARY KEY,ratings TEXT NOT NULL)');
  for(const table of ['ranked_queue','ranked_pairs']){try{sql.exec('ALTER TABLE '+table+' ADD COLUMN rules TEXT NOT NULL DEFAULT \'legacy\'');}catch(e){if(!String(e).includes('duplicate column'))throw e;}}
 }
 private drop(pair:string){this.sql.exec('DELETE FROM ranked_queue WHERE pair=?',pair);this.sql.exec('DELETE FROM ranked_baselines WHERE pair=?',pair);this.sql.exec('DELETE FROM ranked_pairs WHERE id=?',pair);}
 private expire(now:number){
  for(const p of this.sql.exec<Pair>('SELECT * FROM ranked_pairs WHERE expires<=?',now))this.drop(p.id);
  for(const q of this.sql.exec<Ticket>('SELECT * FROM ranked_queue WHERE lease<=?',now)){
   const p=q.pair&&first(this.sql.exec<Pair>('SELECT * FROM ranked_pairs WHERE id=?',q.pair));
   if(p&&!p.started)this.drop(p.id);else this.sql.exec('DELETE FROM ranked_queue WHERE ticket=?',q.ticket);
  }
 }
 private response(q:Ticket,now:number){
  if(!q.pair)return {status:'waiting',queueProtocol:2,rules:q.rules,ticket:q.ticket,waitMs:now-q.joined};
  const p=first(this.sql.exec<Pair>('SELECT * FROM ranked_pairs WHERE id=?',q.pair));
  const baseline=p&&first(this.sql.exec<{ratings:string}>('SELECT ratings FROM ranked_baselines WHERE pair=?',p.id));
  const ratings=baseline?JSON.parse(baseline.ratings):null;
  const opponent=p&&(q.player===p.a?p.b:p.a);
  return p?{status:'paired',queueProtocol:2,rules:q.rules,ticket:q.ticket,pairId:p.id,room:p.room,nonce:p.nonce,opponent,role:q.player===p.a?'host':'guest',baseline:ratings?{local:ratings[q.player],opponent:ratings[opponent as string]}:null}:{status:'cancelled'};
 }
 authorize(id:string,opponent:string,pairId:string,rules='legacy'){const p=first(this.sql.exec<Pair>('SELECT * FROM ranked_pairs WHERE id=?',pairId));return !!p&&p.rules===rules&&p.expires>Date.now()&&((p.a===id&&p.b===opponent)||(p.b===id&&p.a===opponent));}
 cancelPair(id:string,pairId:string,rules:string):boolean {
  const p=first(this.sql.exec<Pair>('SELECT * FROM ranked_pairs WHERE id=?',pairId));
  if(!p||p.rules!==rules||![p.a,p.b].includes(id))return false;
  if(first(this.sql.exec('SELECT id FROM matches WHERE nonce=?',p.nonce)))return false;
  this.drop(p.id);return true;
 }
 action(action:string,id:string,ticket:unknown,now=Date.now(),rules='legacy'):object{
  this.expire(now);
  let q=first(this.sql.exec<Ticket>('SELECT * FROM ranked_queue WHERE player=?',id));
  if(q&&q.rules!==rules&&action==='join'){if(q.pair)this.drop(q.pair);else this.sql.exec('DELETE FROM ranked_queue WHERE ticket=?',q.ticket);q=first(this.sql.exec<Ticket>('SELECT * FROM ranked_queue WHERE player=?',id));}
  if(q&&q.rules!==rules&&action!=='cancel')return {status:'incompatible'};
  if(action==='join'){
   if(!q){
    if(Array.from(this.sql.exec('SELECT ticket FROM ranked_queue')).length>=queueConfig.maxQueued)return {status:'full'};
    const rating=first(this.sql.exec<{rating:number}>('SELECT rating FROM players WHERE id=?',id)).rating;
    this.sql.exec('INSERT INTO ranked_queue(ticket,player,joined,lease,rating,pair,rules) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),id,now,now+queueConfig.leaseMs,rating,'',rules);
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
   const candidates=Array.from(this.sql.exec<Ticket>('SELECT * FROM ranked_queue WHERE pair=?','')).filter(x=>x.player!==id&&x.rules===q.rules&&Math.abs(x.rating-q.rating)<=Math.max(gap(x),gap(q)));
   candidates.sort((a,b)=>Math.abs(a.rating-q.rating)-Math.abs(b.rating-q.rating)||a.joined-b.joined||a.ticket.localeCompare(b.ticket));
   const other=candidates[0];if(other){
    const [a,b]=[q,other].sort((x,y)=>x.joined-y.joined||x.ticket.localeCompare(y.ticket));
    const pair=crypto.randomUUID();this.sql.exec('INSERT INTO ranked_pairs(id,a,b,room,nonce,expires,started,rules) VALUES(?,?,?,?,?,?,0,?)',pair,a.player,b.player,crypto.randomUUID(),crypto.randomUUID(),now+queueConfig.pairTimeoutMs,rules);
    const rating=(id:string)=>first(this.sql.exec<{rating:number}>('SELECT rating FROM players WHERE id=?',id)).rating;
    this.sql.exec('INSERT INTO ranked_baselines VALUES(?,?)',pair,JSON.stringify({[a.player]:rating(a.player),[b.player]:rating(b.player)}));
    this.sql.exec('UPDATE ranked_queue SET pair=?,lease=? WHERE ticket IN (?,?)',pair,now+queueConfig.leaseMs,q.ticket,other.ticket);q.pair=pair;
   }
  }
  return this.response(q,now);
 }
}
