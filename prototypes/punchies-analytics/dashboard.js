/** Fixed trusted endpoint. Tokens never go to user-provided URLs or storage. */
export const API='https://punchies-beta-analytics.tianz-88.workers.dev';
export function mountDashboard(doc=document,send=fetch){
 const node=id=>doc.getElementById(id);let offset=0,total=0,busy=false,epoch=0;
 const text=(id,value)=>node(id).textContent=String(value);
 const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:0;
 const date=value=>typeof value==='number'?new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',dateStyle:'medium',timeStyle:'short'}).format(new Date(value*1000)):'Unknown';
 const unlock=value=>value===null||value===undefined?'Unknown':Number(value)===1?'Unlocked':'Locked';
 const row=(parent,values)=>{const tr=doc.createElement('tr');for(const value of values){const td=doc.createElement('td');td.textContent=String(value);tr.append(td);}parent.append(tr);};
 const metrics=(id,values,label)=>{const root=node(id);root.replaceChildren();for(const value of values){const item=doc.createElement('div');item.className='metric-row';const name=doc.createElement('span');name.className='metric-label';name.textContent=String(label(value));const count=doc.createElement('strong');count.textContent=String(number(value.sessions??value.returning??value.events));item.append(name,count);root.append(item);}if(!values.length)root.textContent='No recorded events in this window.';};
 const lock=()=>{node('refresh').disabled=busy;node('previous').disabled=busy||offset===0;node('next').disabled=busy||offset+100>=total;};
 function clear(){epoch++;node('token').value='';node('report').hidden=true;for(const id of ['players','funnel','last-events','returns','results'])node(id).replaceChildren();text('status','Access cleared. No token or report is persisted.');offset=0;total=0;lock();}
 async function refresh(reset=true){
  if(busy)return;const token=node('token').value.trim();if(!token){text('status','Enter the private report token first.');return;}
  if(reset)offset=0;const days=node('days').value,id=++epoch;busy=true;lock();text('status','Fetching private report…');
  try{
   const options={headers:{Authorization:`Bearer ${token}`},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error'};
   const responses=await Promise.all([send(`${API}/v1/funnel?days=${days}`,options),send(`${API}/v1/players?days=${days}&limit=100&offset=${offset}`,options)]);
   if(responses.some(response=>!response.ok))throw new Error(responses.some(response=>response.status===401)?'auth':'request');
   const [funnel,players]=await Promise.all(responses.map(response=>response.json()));if(id!==epoch)return;
   const overview=funnel.overview??{};text('sessions',number(overview.sessions));text('profiles',number(overview.profiles));text('match-ends',number(overview.observedMatchEnds));text('completions',number(overview.observedSavedCompletions));text('latest',`Latest recorded event: ${date(overview.latestAt)} SGT`);
   const body=node('players');body.replaceChildren();for(const player of players.profiles??[])row(body,[player.pid,number(player.observedMatchEnds),number(player.observedSavedCompletions),player.reportedCompletedMatches===null?'Unknown':`${player.reportedCompletedMatches} / ${player.reportedWins}`,unlock(player.reportedRoxyUnlocked),unlock(player.reportedNadiaUnlocked),date(player.lastSeen)]);
   total=number(players.totalProfiles);text('page',total?`${offset+1}–${Math.min(offset+100,total)} of ${total} profiles`:'No profiles in this window');
   const steps=node('funnel');steps.replaceChildren();const maximum=Math.max(1,...(funnel.steps??[]).map(step=>number(step.sessions)));for(const step of funnel.steps??[]){const item=doc.createElement('div');item.className='metric-row';const name=doc.createElement('span');name.className='metric-label';name.textContent=String(step.event);const count=doc.createElement('span');count.textContent=`${number(step.sessions)} · drop-off ${number(step.dropoff)}`;item.append(name,count);const bar=doc.createElement('div');bar.className='bar';bar.style.width=`${number(step.sessions)/maximum*100}%`;steps.append(item,bar);}
   metrics('last-events',funnel.lastSessionEvents??[],value=>value.e);metrics('returns',funnel.nextDayReturns??[],value=>value.day);metrics('results',funnel.matchResults??[],value=>`${value.mode} · ${value.result}`);
   node('report').hidden=false;text('status',`Refreshed ${date(funnel.generatedAt)} SGT. Refresh manually for new data.`);
  }catch(error){if(id===epoch){node('report').hidden=true;text('status',error.message==='auth'?'Access denied. Check the report token.':'Report unavailable. Check the connection and deployed report routes.');}}finally{busy=false;lock();}
 }
 node('access').addEventListener('submit',event=>{event.preventDefault();void refresh();});node('clear').addEventListener('click',clear);node('previous').addEventListener('click',()=>{offset=Math.max(0,offset-100);void refresh(false);});node('next').addEventListener('click',()=>{offset+=100;void refresh(false);});lock();return {refresh,clear};
}
if(typeof document!=='undefined')mountDashboard();
