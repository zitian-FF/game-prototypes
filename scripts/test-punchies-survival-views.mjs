import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import EventEmitter from 'eventemitter3';
const exports={},ring={left:250,right:594,top:95,bottom:325};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/survivalViews.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,structuredClone,require:p=>p.includes('characterLook')?{mainLook:()=>({color:1,scale:1})}:{tune:{ring,view:{flashMs:110}}}});
for(let i=0;i<360;i++){const d={x:Math.cos(i),y:Math.sin(i)},p=exports.deathRopePoint({x:422,y:210},d,ring);assert(p.x>=268&&p.x<=576&&p.y>=113&&p.y<=307);assert(Math.abs((p.x-422)*d.y-(p.y-210)*d.x)<.0001,'flight follows final hit');}
const events=new EventEmitter(),created=[];
const factory=()=>{const v={reset(){this.hidden=true;this.presentationLimp=false;},setLook(){},clear(){},flash(){},draw(f){this.hidden=false;this.position={x:f.x,y:f.y};},setPresentationAlpha(a){assert(a>=0&&a<=1);this.alpha=a;}};created.push(v);return v;};
const pool=new exports.SurvivalViews({events},factory);
const enemy=(id)=>({id,kind:'zombie',visualId:'zombie',fighter:{char:'marco',x:422,y:210,health:5}});
let list=Array.from({length:12},(_,i)=>enemy(String(i)));pool.draw(list,0);
assert(created.every(v=>v.alpha===0),'spawn begins transparent');pool.draw(list,180);assert(created.every(v=>v.alpha===1));
for(let batch=0;batch<200;batch++){
 for(const e of list)pool.kill({kind:'kill',enemyId:e.id,enemyKind:'zombie',visualId:'zombie',fighter:e.fighter,position:{x:422,y:210},direction:{x:1,y:0}},200+batch*10);
 list=Array.from({length:12},(_,i)=>enemy(`${batch+1}:${i}`));pool.draw(list,201+batch*10);
 assert.equal(pool.diagnostics().activeEnemyViews,12);assert(created.length<=24,'spawn/death churn bounded');
}
pool.draw([],5000);assert.equal(pool.diagnostics().defeatViews,0);assert.equal(pool.diagnostics().activeEnemyViews,0);
assert(created.every(v=>v.hidden),'complete visual reset on release');events.emit('shutdown');assert.equal(pool.diagnostics().enemyViews,0);
console.log('PASS: rope direction/bounds, spawn fade, 2400 kill/spawn churn <=24 views, fade completion/reset/shutdown');
