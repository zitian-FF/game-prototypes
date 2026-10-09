import assert from 'node:assert/strict';
import { i18nStub } from './lib-i18n-stub.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const buttons=new Map(), calls=[], copy=[];let shutdown;
const source={input:{enabled:true},scene:{isPaused:()=>calls.includes('pause'),resume:()=>calls.push('resume'),start:()=>calls.push('start')},events:{emit:()=>calls.push('forfeit')}};
class Base {openSettings(){calls.push('settings');}constructor(){this.scene={bringToTop:()=>calls.push('top'),pause:()=>calls.push('pause'),get:()=>source,stop:()=>{calls.push('close');shutdown?.();}};this.events={once:(_,fn)=>shutdown=fn};this.registry={remove:()=>calls.push('clear')};this.children={removeAll:()=>buttons.clear()};const item={setInteractive(){return this},setOrigin(){return this}};this.add={rectangle:()=>item,graphics:()=>({}),text:(_x,_y,label)=>{copy.push(label);return item;}};}openInputPopup(){calls.push('settings');}}
const mocks={'../i18n':i18nStub,'./MenuScene':{MenuScene:Base},'../render/pixelRatio':{applyCameraPixelRatio:()=>{},VIEW:{cx:422,cy:195,width:844,height:390},PIXEL_RATIO:1},'../ui/cartoonChrome':{cartoonPanel:()=>{}},'../ui/titleButton':{titleButton:(_s,_x,_y,_w,_h,label,fn)=>buttons.set(label,fn)},'../input/devices':{devices:{clear:()=>calls.push('inputClear')}}};
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/scenes/GameMenuScene.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>mocks[id]});
for(const multiplayer of [false,true]){
 calls.length=0;const menu=new exports.GameMenuScene();menu.create({source:multiplayer?'Match':'VsAI',multiplayer});
 assert.equal(calls[0],'top');assert.equal(calls.includes('pause'),!multiplayer);assert.equal(source.input.enabled,false);
 buttons.get('SETTINGS')();assert.ok(calls.includes('settings'));
 buttons.get('RETURN TO MAIN MENU')();assert.equal(copy.at(-1),multiplayer?i18nStub.t('pause.the_match_keeps_running_returning'):'Your current round will end.');assert.ok(!calls.includes('forfeit')&&!calls.includes('start'));
 buttons.get('CANCEL')();assert.ok(buttons.has('RESUME'));
 buttons.get('RETURN TO MAIN MENU')();buttons.get('RETURN')();
 assert.ok(calls.includes(multiplayer?'forfeit':'start'));assert.equal(source.input.enabled,true);assert.ok(!calls.includes('resume'),'confirmed exit must not resume a destroyed fight');
}
calls.length=0;const menu=new exports.GameMenuScene();menu.create({source:'Training',multiplayer:false});buttons.get('RETURN TO MAIN MENU')();assert.equal(copy.at(-1),'Your practice session will end.');buttons.get('CANCEL')();buttons.get('RESUME')();assert.ok(calls.includes('resume'));assert.equal(source.input.enabled,true);
console.log('Menu: foreground overlay, solo pause/resume, live multiplayer, settings, cancel, confirmed forfeit, and input restoration passed');
// The remote end must finish a forfeited series even while a round splash is running.
const netCalls=[];class Scene {constructor(){this.events={};this.time={removeAllEvents:()=>netCalls.push('cancelTimers')};this.add={text:(_x,_y,label)=>{netCalls.push(label);const t={setOrigin:()=>t,setDepth:()=>t};return t;}};}}
const matchExports={};const netMocks={'../i18n':i18nStub,'../portal/gameplay':{setGameplay(){},trackFightScene(){}},'../portal/analytics':{track(){}},phaser:{default:{Scene}},'./FightStage':{makeButton:()=>{}},'../ui/menuNav':{getNav:()=>({engage:()=>{}})},'../render/pixelRatio':{VIEW:{cx:422,cy:195},PIXEL_RATIO:1},'../ui/presentation':{startScreen:()=>netCalls.push('menu')},'../sim/tune':{restoreTune:()=>{},TICK_RATE:60}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/scenes/MatchScene.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:matchExports,require:id=>netMocks[id]??{},performance:{}});
const match=new matchExports.MatchScene();match.over=true;match.nextSeries={};match.cancelSplash=()=>netCalls.push('cancelSplash');match.waiting={setVisible:()=>{}};
match.opponentLeft(true);assert.ok(netCalls.includes('cancelSplash'));assert.ok(netCalls.includes('VICTORY · OPPONENT FORFEITED'));assert.equal(match.rematchLocal,false);assert.equal(match.advancing,true);
const count=netCalls.length;match.opponentLeft(false);assert.equal(netCalls.length,count);
netCalls.length=0;match.match={round:2,session:{forfeit:async()=>netCalls.push('forfeit'),leave:()=>netCalls.push('disconnect')}};await match.leave();assert.deepEqual(netCalls,['forfeit','disconnect','menu']);
console.log('Online forfeit: between-round cancellation, opponent victory, duplicate disconnect protection and send-before-leave passed');
