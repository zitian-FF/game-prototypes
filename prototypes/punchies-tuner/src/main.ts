import './style.css';
import { defaults,characters,names,punches,meta,get,set,parse,changes,effective,delta } from './model';
import {saveOpened,type TuneFile as Handle} from './fileIO';
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
function status(){const target=document.querySelector('#status');if(target)target.textContent=message;const dirty=document.querySelector('#dirty');if(dirty)dirty.textContent=`${changes(base,draft).length} edited values`;}
const format=(v:number)=>Number.isInteger(v)?String(v):String(Number(v.toFixed(4)));
const label=(s:string)=>({hp:'HP',stamina:'Stamina',stun:'Stun resistance',speed:'Move speed',regen:'Standing recovery',staminaCost:'Stamina cost',stunBuild:'Stun build',fatigueBars:'Fatigue bars',startup:'Startup',recovery:'Recovery',pushHit:'Hit push',pushBlock:'Block push'} as Record<string,string>)[s]??s.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
async function load(text:string,name:string,fileHandle:Handle|null){const next=parse(text);base=structuredClone(next);draft=next;source=name;handle=fileHandle;message=`Loaded ${name}. Nothing is uploaded to a server.`;remember();render();}
async function open(){
  const picker=(window as PickerWindow).showOpenFilePicker;
  if(picker){try{const [fileHandle]=await picker.call(window,{multiple:false,types:[{description:'Punchies tune JSON',accept:{'application/json':['.json']}}]});await load(await (await fileHandle.getFile()).text(),fileHandle.name,fileHandle);}catch(e){if((e as DOMException).name!=='AbortError')throw e;}return;}
  const input=el('input');input.type='file';input.accept='.json,application/json';input.onchange=()=>{const file=input.files?.[0];if(file)void file.text().then(text=>load(text,file.name,null)).catch(e=>{message=String(e);status();});};input.click();
}
function checkInputs(){for(const input of document.querySelectorAll<HTMLInputElement>('input'))if(input.validity.customError||input.validity.badInput||input.validity.rangeOverflow||input.validity.rangeUnderflow){input.reportValidity();throw Error('Correct the highlighted value before saving.');}}
function download(){checkInputs();const blob=new Blob([JSON.stringify(draft,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='tune.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message='Downloaded tune.json. The repository file changes only when you replace it or use Save to opened file.';status();}
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
  }else edit.append(el('span',['hitStun','blockStun','sourStun'].includes(key)?'Derived from push':'Shared'));
  const currentCell=el('td',format(current)),marcoCell=el('td',format(marco));tr.append(edit,currentCell,marcoCell);const diff=el('td',delta(current,marco));diff.className=current===marco?'neutral':current>marco?'positive':'negative';tr.append(diff);table.append(tr);
  refreshRows.push(()=>{const characterRow=!shared&&(section==='core'||(punches as readonly string[]).includes(section));const value=characterRow?effective(draft,selected,section,key):path?get(draft,path):current;const baseline=characterRow?effective(draft,'marco',section,key):value;currentCell.textContent=format(value);marcoCell.textContent=format(baseline);diff.textContent=delta(value,baseline);diff.className=value===baseline?'neutral':value>baseline?'positive':'negative';});
}
function makeTable(){const table=el('table');const head=el('thead'),tr=el('tr');for(const h of ['Property','Tune value','In game','Marco','Difference'])tr.append(el('th',h));head.append(tr);table.append(head);return table;}
function globalRows(table:HTMLTableElement,group:string,prefix=''){for(const key of Object.keys((draft as unknown as Record<string,Record<string,unknown>>)[group])){const path=`${group}.${key}`;if(typeof get(draft,path)==='number'&&meta[path])row(table,prefix+key,path,get(draft,path),get(draft,path));}}
function render(){
  refreshRows=[];
  app.replaceChildren();const header=el('header');const brand=el('div');brand.append(el('p','PUNCHIES / BALANCE WORKSHOP'),el('h1','Tune the next contender.'),el('p','Edit game values. Compare everyone against Marco.'));header.append(brand);
  const actions=el('div');actions.className='actions';actions.append(button('Open tune.json',open,'primary'),button('Save to opened file',save),button('Download JSON',download));header.append(actions);app.append(header);
  const strip=el('div');strip.className='source';strip.append(el('span',source));const dirty=el('strong');dirty.id='dirty';strip.append(dirty);app.append(strip);
  const note=el('p',message);note.id='status';note.setAttribute('role','status');app.append(note);
  const layout=el('div');layout.className='layout';const sidebar=el('aside');sidebar.append(el('h2','Fighters'));
  for(const char of characters)sidebar.append(button(names[char].name,()=>{selected=char;shared=false;render();},!shared&&selected===char?'selected':''));
  sidebar.append(button('Shared rules',()=>{shared=true;render();},shared?'selected':''));
  sidebar.append(el('p','Plus/minus means numerically higher/lower, not stronger/weaker. Lower startup frames are faster.'));
  sidebar.append(button('Restore saved draft',()=>{const saved=localStorage.getItem(storageKey);if(!saved)throw Error('No saved draft');const data=JSON.parse(saved);base=parse(JSON.stringify(data.base));draft=parse(JSON.stringify(data.draft));handle=null;source='Restored browser draft';message='Draft restored. Open a file before saving directly, or download this copy.';render();}));
  sidebar.append(button('Reset all edits',()=>{if(confirm('Reset all edits to the opened file?')){draft=structuredClone(base);remember();render();}}));layout.append(sidebar);
  const main=el('main');const heading=el('div');heading.className='section-heading';heading.append(el('h2',shared?'Shared rules':names[selected].name),el('span',shared?'Applies to every fighter':names[selected].style));main.append(heading);
  const nav=el('nav');nav.setAttribute('aria-label','Stat categories');for(const cat of ['core',...punches,'guard','dodge'])nav.append(button(cat==='core'?'Core':cat==='guard'?'Block':label(cat),()=>{section=cat;render();},section===cat?'selected':''));main.append(nav);
  const table=makeTable();
  if(shared){
    main.append(el('p','Shared values affect all fighters. Character multipliers and frame offsets are applied on top.'));
    if(section==='core')for(const group of ['health','stamina','stun','movement','fatigue','stars']){main.append(el('h3',label(group)));const t=makeTable();globalRows(t,group);main.append(t);}
    else if((punches as readonly string[]).includes(section)){main.append(el('p','Counters apply only to enabled punch startup or the late recovery of a missed punch. Guard release and dodge exposure are vulnerable, without a counter bonus.'));const hit=makeTable();globalRows(hit,'hit');main.append(hit);for(const key of Object.keys(draft.punches[section as typeof punches[number]])){const path=`punches.${section}.${key}`;row(table,key,path,get(draft,path),get(draft,path));}main.append(table);}
    else{globalRows(table,section);main.append(table);}
  }else if(section==='core'){
    main.append(el('p','Tune values are character multipliers. In-game values include the shared base.'));
    for(const key of ['hp','stamina','stun','speed','regen'])row(table,key,`characters.${selected}.${key}`,effective(draft,selected,'core',key),effective(draft,'marco','core',key));main.append(table);
  }else if((punches as readonly string[]).includes(section)){
    main.append(el('p','Tune values are multipliers, except startup/recovery (added frames) and fatigue bars (added bars). Reach includes actual character size. Uppercut damage uses Cross base damage × uppercut factor × character uppercut multiplier.'));
    const cfgKeys=['damage','staminaCost','reach','startup','recovery','stunBuild','pushHit','pushBlock','hitStun','blockStun','sourStun','fatigueBars','sourEarly','sweet','sour','whiffRecovery','hitRadius','staminaDamage','startReachFrac','fatigueSpeedPerBar','fatigueDamagePerBar'];
    for(const key of cfgKeys){const override=key==='pushHit'||key==='pushBlock'?'push':key;const path=`characters.${selected}.${section}.${override}`;row(table,key,meta[path]?path:null,effective(draft,selected,section,key),effective(draft,'marco',section,key));}main.append(table);
  }else{main.append(el('p','Block and dodge currently share the same rules for every fighter. Edits here apply to everyone; differences from Marco are therefore 0%.'));globalRows(table,section);main.append(table);}
  const changed=changes(base,draft);if(changed.length){const details=el('details');details.append(el('summary',`Review ${changed.length} edits`));const list=el('ul');for(const path of changed)list.append(el('li',`${path}: ${format(get(base,path))} → ${format(get(draft,path))}`));details.append(list);main.append(details);}
  layout.append(main);app.append(layout);const footer=el('footer','Files and drafts stay in this browser. No uploads, account access, or automatic GitHub commits. Save checks for conflicting edits.');app.append(footer);status();
}
window.addEventListener('beforeunload',event=>{if(changes(base,draft).length){event.preventDefault();event.returnValue='';}});
render();

