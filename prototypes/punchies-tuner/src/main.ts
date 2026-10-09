import './style.css';
import { defaults,characters,names,punches,meta,get,set,parse,changes,effective,delta,mergeSave,baseVersion,archetypeValue,setArchetype,archetypeChanges,saveChanges } from './model';
import {perceivedStats,perceivedStatKeys,statBarFill} from '../../punchies/src/sim/perceivedStats';
import english from '../../punchies/src/i18n/locales/en.json';
import {saveOpened,type TuneFile as Handle} from './fileIO';
import {detectLocalMode,localRequest,type GitHubLoad,type GitHubSave,type BuildRun} from './githubIO';
let githubMode=false,github:GitHubLoad|null=null,busy=false;
let commitLink:string|null=null,buildRuns:BuildRun[]=[];
type PickerWindow=Window&{showOpenFilePicker?: (options:unknown)=>Promise<Handle[]>};
let base=defaults(),draft=defaults(),handle:Handle|null=null;
let selected:typeof characters[number]='mia',section='core',shared=false;
let source='Bundled game tune.json',message='Open your local tune.json to save directly, or download a tuned copy.';
const storageKey='punchies:tuner:draft:v1';
const app=document.querySelector<HTMLDivElement>('#app')!;
let refreshRows:(()=>void)[]=[];
function el<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string){const node=document.createElement(tag);if(text)node.textContent=text;return node;}
function button(text:string,action:()=>void|Promise<void>,className=''){const b=el('button',text);b.className=className;b.onclick=()=>{void Promise.resolve(action()).catch(e=>{message=e instanceof Error?e.message:String(e);status();});};return b;}
function remember(){try{localStorage.setItem(storageKey,JSON.stringify({base,draft}));}catch{/* Editing still works if storage is unavailable. */}}
function status(){const target=document.querySelector('#status');if(target)target.textContent=message;const dirty=document.querySelector('#dirty');if(dirty)dirty.textContent=`${saveChanges(base,draft).length} edited values`;}
const format=(v:number)=>Number.isInteger(v)?String(v):String(Number(v.toFixed(4)));
const label=(s:string)=>({hp:'HP',stamina:'Stamina',stun:'Stun resistance',speed:'Move speed',regen:'Standing recovery',staminaCost:'Stamina cost',stunBuild:'Stun build',fatigueBars:'Fatigue bars',startup:'Startup',recovery:'Recovery',pushHit:'Hit push',pushBlock:'Block push'} as Record<string,string>)[s]??s.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
async function load(text:string,name:string,fileHandle:Handle|null){const next=parse(text);base=structuredClone(next);draft=next;source=name;handle=fileHandle;github=null;commitLink=null;buildRuns=[];message=`Loaded ${name}. Nothing is uploaded to a server.`;remember();render();}
async function githubAction(action:()=>Promise<void>){
  if(busy)return;busy=true;render();
  try{await action();}finally{busy=false;render();}
}
async function loadLatest(){
  if(saveChanges(base,draft).length&&!confirm('Replace your current edits with the latest GitHub file? Download JSON first if you want to keep this draft.'))return;
  await githubAction(async()=>{const result=await localRequest<GitHubLoad>('load',{});const doc=parse(JSON.stringify(result.doc));github=result;base=structuredClone(doc);draft=doc;handle=null;commitLink=null;buildRuns=[];source=`GitHub ${result.repo} / ${result.branch} · file ${result.sha.slice(0,7)}`;message='Loaded latest from GitHub. Save commits reviewed edits to this branch and triggers normal CI/deployments.';remember();});
}
async function saveGitHub(){
  checkInputs();if(!github)throw Error('Load latest from GitHub before saving. Download your draft first if needed.');
  await githubAction(async()=>{const {balanceWorkshop:metadata,...values}=draft;const payload={...values,...(metadata?.archetypes?{balanceWorkshop:{archetypes:metadata.archetypes}}:{})};const result=await localRequest<GitHubSave>('save',{session:github!.session,draft:payload});const doc=parse(JSON.stringify(result.doc));base=structuredClone(doc);draft=doc;github!.doc=doc;github!.sha=result.sha;commitLink=result.commit?.url??null;buildRuns=[];source=`GitHub ${github!.repo} / ${github!.branch} · file ${result.sha.slice(0,7)}`;message=result.commit?`Saved ${result.edited.length} values in commit ${result.commit.sha.slice(0,7)}. CI/deployments may be queued; click Check build status.`:'GitHub already contains these edits. No commit created.';remember();});
}
async function checkBuilds(){if(!github)return;await githubAction(async()=>{const result=await localRequest<{runs:BuildRun[]}>('status',{session:github!.session});buildRuns=result.runs;message=buildRuns.length?'Latest workflow status for your saved commit.':'No workflow runs found yet for the saved commit. Check again shortly; deployment is not confirmed.';});}
async function open(){
  const picker=(window as PickerWindow).showOpenFilePicker;
  if(picker){try{const [fileHandle]=await picker.call(window,{multiple:false,types:[{description:'Punchies tune JSON',accept:{'application/json':['.json']}}]});await load(await (await fileHandle.getFile()).text(),fileHandle.name,fileHandle);}catch(e){if((e as DOMException).name!=='AbortError')throw e;}return;}
  const input=el('input');input.type='file';input.accept='.json,application/json';input.onchange=()=>{const file=input.files?.[0];if(file)void file.text().then(text=>load(text,file.name,null)).catch(e=>{message=String(e);status();});};input.click();
}
function checkInputs(){for(const input of document.querySelectorAll<HTMLInputElement>('input'))if(input.validity.customError||input.validity.badInput||input.validity.rangeOverflow||input.validity.rangeUnderflow){input.reportValidity();throw Error('Correct the highlighted value before saving.');}}
function download(){checkInputs();const exported=mergeSave(base,draft,base);const blob=new Blob([JSON.stringify(exported,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='tune.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message='Downloaded tune.json, including a Base revision if its values changed. The repository file changes only when you replace it or use Save.';status();}
async function save(){
  checkInputs();
  if(!handle){message='Open your local tune.json first. You can also download the current draft.';status();return;}
  const merged=await saveOpened(handle,base,draft);
  base=structuredClone(merged);draft=merged;message=`Saved ${handle.name}. Unrelated file changes were preserved. Commit/sync the file to update the game build.`;remember();render();
}
function row(table:HTMLTableElement,key:string,path:string|null,current:number,marco:number){
  const tr=el('tr'),title=el('th',label(key));title.scope='row';const desc=path?meta[path]?.desc:'';if(desc){const small=el('small',desc);title.append(small);}tr.append(title);
  const edit=el('td');if(path){const range=meta[path],input=el('input');input.type='number';input.value=format(get(draft,path));input.min=String(range.min);input.max=String(range.max);input.step=String(range.step||'any');input.setAttribute('aria-label',`${section} ${label(key)} tune value`);
    input.oninput=()=>{try{if(input.value==='')throw Error('Enter a number');set(draft,path,Number(input.value));input.setCustomValidity('');remember();refreshRows.forEach(fn=>fn());status();}catch(e){input.setCustomValidity(String(e));message=String(e);status();}};input.onchange=()=>{if(input.validationMessage)input.reportValidity();};edit.append(input);
    const reset=button('↶',()=>{set(draft,path,get(base,path));remember();render();},'reset');reset.title='Reset this value to the opened file';reset.setAttribute('aria-label',`Reset ${label(key)}`);edit.append(reset);
  }else edit.append(el('span','Shared'));
  if(shared){tr.append(edit);table.append(tr);return;}
  const currentCell=el('td',format(current)),marcoCell=el('td',format(marco));tr.append(edit,currentCell,marcoCell);const diff=el('td',delta(current,marco));diff.className=current===marco?'neutral':current>marco?'positive':'negative';tr.append(diff);table.append(tr);
  refreshRows.push(()=>{const characterRow=!shared&&(section==='core'||(punches as readonly string[]).includes(section));const value=characterRow?effective(draft,selected,section,key):path?get(draft,path):current;const baseline=characterRow?effective(draft,'marco',section,key):value;currentCell.textContent=format(value);marcoCell.textContent=format(baseline);diff.textContent=delta(value,baseline);diff.className=value===baseline?'neutral':value>baseline?'positive':'negative';});
}
function makeTable(){const table=el('table');const head=el('thead'),tr=el('tr');for(const h of shared?['Property','Raw value']:['Property','Tune value','In game','Marco','Difference'])tr.append(el('th',h));head.append(tr);table.append(head);return table;}
function renderPerceivedStats(main:HTMLElement){
  const id=shared?'base':selected,key=`char.${id}.nick`;
  const field=el('div');field.className='archetype-field';const title=el('label','Character archetype');title.htmlFor='archetype';
  const input=el('input');input.id='archetype';input.type='text';input.maxLength=80;input.value=archetypeValue(draft,key);input.setAttribute('aria-label','Character archetype');
  const caption=el('p',input.value);caption.className='archetype-preview';
  input.oninput=()=>{try{setArchetype(draft,key,input.value);input.setCustomValidity('');caption.textContent=archetypeValue(draft,key);remember();status();}catch(e){input.setCustomValidity(String(e));message=String(e);status();}};
  field.append(title,input,el('small',`Localisation key: ${key}`));main.append(field);
  const chart=el('section');chart.className='perceived-chart';chart.setAttribute('aria-label','Perceived character stats');chart.append(el('h3','Game stat preview'),caption);
  for(const stat of perceivedStatKeys){
    const row=el('div');row.className=`stat-bar stat-${stat}`;const name=(english as Record<string,string>)[`charselect.${stat}`];row.append(el('strong',name));
    const track=el('div');track.className='stat-track';track.setAttribute('role','meter');track.setAttribute('aria-label',name);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
    const fill=el('span');fill.className='stat-fill';const marker=el('span');marker.className='base-marker';marker.title='Base benchmark: 80%';track.append(fill,marker);const value=el('span');value.className='stat-percent';row.append(track,value);chart.append(row);
    const refresh=()=>{const ratio=perceivedStats(draft,id)[stat],percent=statBarFill(ratio)*100;fill.style.width=`${percent}%`;value.textContent=`${Number(percent.toFixed(1))}%`;track.setAttribute('aria-valuenow',String(percent));track.setAttribute('aria-valuetext',`${Number(percent.toFixed(1))}% fill; ${Number((ratio*100).toFixed(1))}% of Base`);};refresh();refreshRows.push(refresh);
  }
  chart.append(el('p','Base = 80% on every bar. Uses the game’s display formulas; bars cap at 100%. These are perceived ratings, not raw combat stats.'));main.append(chart);
}
function renderBaseHistory(main:HTMLElement){
  const history=draft.balanceWorkshop?.baseHistory;
  main.append(el('h3',`Base history · v${baseVersion(draft)}`));
  if(!history){main.append(el('p','No Base revisions recorded yet. The first Base save stores the previous values as v0 and records v1.'));return;}
  main.append(el('p','Each saved Base change records its previous and new raw values. Fighter-only edits do not create a Base version.'));
  for(const revision of [...history.versions].reverse()){
    const details=el('details');details.append(el('summary',`v${revision.version-1} → v${revision.version} · ${new Date(revision.savedAt).toLocaleString()} · ${revision.changes.length} changes`));
    const table=el('table'),head=el('tr');for(const title of ['Property','Previous raw value','New raw value'])head.append(el('th',title));table.append(head);
    for(const change of revision.changes){const tr=el('tr');tr.append(el('th',change.path),el('td',format(change.before)),el('td',format(change.after)));table.append(tr);}details.append(table);main.append(details);
  }
  const initial=el('details');initial.append(el('summary','v0 · Initial Base values'));const list=el('ul');for(const [path,value] of Object.entries(history.initial))list.append(el('li',`${path}: ${format(value)}`));initial.append(list);main.append(initial);
}
function globalRows(table:HTMLTableElement,group:string,prefix=''){for(const key of Object.keys((draft as unknown as Record<string,Record<string,unknown>>)[group])){const path=`${group}.${key}`;if(typeof get(draft,path)==='number'&&meta[path])row(table,prefix+key,path,get(draft,path),get(draft,path));}}
function render(){
  refreshRows=[];
  app.replaceChildren();const header=el('header');const brand=el('div');brand.append(el('p','PUNCHIES / BALANCE WORKSHOP'),el('h1','Tune the next contender.'),el('p','Edit game values. Compare everyone against Marco.'));header.append(brand);
  const actions=el('div');actions.className='actions';actions.append(button('Open tune.json',open,'primary'),button('Save to opened file',save),button('Download JSON',download));header.append(actions);app.append(header);
  if(githubMode){actions.prepend(button('Load latest',loadLatest,'primary'),button('Save to GitHub',saveGitHub),button('Check build status',checkBuilds));}
  const strip=el('div');strip.className='source';strip.append(el('span',source));const dirty=el('strong');dirty.id='dirty';strip.append(dirty);app.append(strip);
  const note=el('p',message);note.id='status';note.setAttribute('role','status');app.append(note);
  if(commitLink){const link=el('a','View saved commit');link.href=commitLink;link.target='_blank';link.rel='noopener';app.append(link);}
  for(const run of buildRuns){const p=el('p'),link=el('a',`${run.name}: ${run.conclusion??run.status}`);link.href=run.url;link.target='_blank';link.rel='noopener';p.append(link);app.append(p);}
  const layout=el('div');layout.className='layout';const sidebar=el('aside');sidebar.append(el('h2','Fighters'));
  sidebar.append(button('Base',()=>{shared=true;render();},shared?'selected':''));
  for(const char of characters)sidebar.append(button(names[char].name,()=>{selected=char;shared=false;if(section==='history')section='core';render();},!shared&&selected===char?'selected':''));
  sidebar.append(el('p','Plus/minus means numerically higher/lower, not stronger/weaker. Lower startup frames are faster.'));
  sidebar.append(button('Restore saved draft',()=>{const saved=localStorage.getItem(storageKey);if(!saved)throw Error('No saved draft');const data=JSON.parse(saved);base=parse(JSON.stringify(data.base));draft=parse(JSON.stringify(data.draft));handle=null;github=null;commitLink=null;buildRuns=[];source='Restored browser draft';message='Draft restored. Open a file before saving directly, or download this copy. GitHub saves require Load latest first.';render();}));
  sidebar.append(button('Reset all edits',()=>{if(confirm('Reset all edits to the opened file?')){draft=structuredClone(base);remember();render();}}));layout.append(sidebar);
  const main=el('main');const heading=el('div');heading.className='section-heading';heading.append(el('h2',shared?`Base · v${baseVersion(draft)}`:names[selected].name),el('span',shared?'Raw starting values for every fighter':names[selected].style));main.append(heading);
  renderPerceivedStats(main);
  const nav=el('nav');nav.setAttribute('aria-label','Stat categories');for(const cat of ['core',...punches,'guard','dodge',...(shared?['history']:[])])nav.append(button(cat==='core'?'Core':cat==='guard'?'Block':label(cat),()=>{section=cat;render();},section===cat?'selected':''));main.append(nav);
  const table=makeTable();
  if(shared&&section==='history'){renderBaseHistory(main);}
  else if(shared){
    main.append(el('p','Base contains the shared raw game values. Every fighter applies its multipliers and frame offsets to these values. Ratios are shown as their stored decimals; no percentage comparison is used here.'));
    if(section==='core')for(const group of ['health','stamina','stun','movement','body','hit','fatigue','stars']){main.append(el('h3',label(group)));const t=makeTable();globalRows(t,group);main.append(t);}
    else if((punches as readonly string[]).includes(section)){for(const key of Object.keys(draft.punches[section as typeof punches[number]])){const path=`punches.${section}.${key}`;row(table,key,path,get(draft,path),get(draft,path));}main.append(table);}
    else{globalRows(table,section);main.append(table);}
    renderBaseHistory(main);
  }else if(section==='core'){
    main.append(el('p','Tune values are character multipliers. In-game values include the shared base.'));
    for(const key of ['hp','stamina','stun','speed','regen'])row(table,key,`characters.${selected}.${key}`,effective(draft,selected,'core',key),effective(draft,'marco','core',key));main.append(table);
  }else if((punches as readonly string[]).includes(section)){
    main.append(el('p','Tune values are multipliers, except startup/recovery (added frames) and fatigue bars (added bars). Reach includes actual character size. Uppercut damage uses Cross base damage × uppercut factor × character uppercut multiplier.'));
    const cfgKeys=['damage','staminaCost','reach','startup','recovery','stunBuild','pushHit','pushBlock','fatigueBars','sourEarly','sweet','sour','whiffRecovery','hitRadius','staminaDamage','startReachFrac','fatigueSpeedPerBar','fatigueDamagePerBar'];
    for(const key of cfgKeys){const override=key==='pushHit'||key==='pushBlock'?'push':key;const path=`characters.${selected}.${section}.${override}`;row(table,key,meta[path]?path:null,effective(draft,selected,section,key),effective(draft,'marco',section,key));}main.append(table);
  }else{main.append(el('p','Block and dodge currently share the same rules for every fighter. Edits here apply to everyone; differences from Marco are therefore 0%.'));globalRows(table,section);main.append(table);}
  const changed=changes(base,draft),texts=archetypeChanges(base,draft);if(changed.length+texts.length){const details=el('details');details.append(el('summary',`Review ${changed.length+texts.length} edits`));const list=el('ul');for(const path of changed)list.append(el('li',`${path}: ${format(get(base,path))} → ${format(get(draft,path))}`));for(const key of texts)list.append(el('li',`${key}: ${archetypeValue(base,key)} → ${archetypeValue(draft,key)}`));details.append(list);main.append(details);}
  layout.append(main);app.append(layout);const footer=el('footer',githubMode?'Local GitHub mode: Load latest reads GitHub; Save to GitHub commits edited values using this PC’s GitHub CLI account. Normal CI/deployment follows. Credentials stay on the server.':'Files and drafts stay in this browser. No uploads, account access, or automatic GitHub commits. Save checks for conflicting edits.');app.append(footer);status();
  if(busy){for(const control of app.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button'))control.disabled=true;note.textContent='Contacting GitHub…';}
}
window.addEventListener('beforeunload',event=>{if(saveChanges(base,draft).length){event.preventDefault();event.returnValue='';}});
render();
void detectLocalMode().then(enabled=>{githubMode=enabled;if(enabled){message='Local GitHub mode ready. Load latest before editing. Save to GitHub commits your edits and triggers normal CI/deployments.';render();}});

