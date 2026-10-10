import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { EventEmitter } from 'node:events';
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({CHARACTER_IDS:Object.keys(JSON.parse(fs.readFileSync('prototypes/punchies/tune.json','utf8')).characters)})});return exports;}
const {rosterSlots,rosterIds,horizontalRosterPick,verticalRosterPick}=load('prototypes/punchies/src/ui/rosterLayout.ts');
const slots=rosterSlots();assert.equal(slots.length,30);assert.equal(new Set(slots.map(p=>`${p.x},${p.y}`)).size,30);
const live=Object.keys(JSON.parse(fs.readFileSync('prototypes/punchies/tune.json','utf8')).characters);
for(let i=0;i<live.length;i++)for(const d of [-1,1]){const next=verticalRosterPick(i,d);assert(next>=0&&next<live.length,'Future slots must never receive selection');}
const future=rosterIds([...new Set([...live,'roxy','nadia'])]);assert.equal(future[0],'tee');assert.equal(JSON.stringify(future.slice(3,8)),JSON.stringify(['marco','mia','bruno','roxy','nadia']));assert.equal(new Set(future.filter(Boolean)).size,new Set([...live,'roxy','nadia']).size);
assert.equal(horizontalRosterPick(3,1),0);assert.equal(verticalRosterPick(3,1),1);
const {bindButtonFeedback}=load('prototypes/punchies/src/ui/cartoonChrome.ts');
const hit=new EventEmitter(),events=new EventEmitter(),data={};hit.scene={events};hit.input={enabled:true};hit.setData=(k,v)=>{data[k]=v;};const states=[];
bindButtonFeedback(hit,s=>states.push(s));assert.equal(states.at(-1),'idle');
hit.emit('pointerover');assert.equal(states.at(-1),'hover');hit.emit('pointerdown');assert.equal(states.at(-1),'pressed');hit.emit('pointerup');assert.equal(data.buttonReleasedInside,true);
hit.emit('pointerdown');hit.emit('pointerout');hit.emit('pointerup');assert.equal(data.buttonReleasedInside,false,'Dragging out cancels activation');
hit.input.enabled=false;events.emit('update');assert.equal(states.at(-1),'disabled');hit.emit('destroy');assert.equal(events.listenerCount('update'),0);
console.log('Roster grid: 30 unique slots, safe vertical navigation, button feedback/cancel/disable/cleanup passed');
