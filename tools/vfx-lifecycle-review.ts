import Phaser from 'phaser';
import {initPortal} from '../prototypes/punchies/src/portal/index';
import {initLanguage} from '../prototypes/punchies/src/i18n/init';
import {t} from '../prototypes/punchies/src/i18n';
import {prefetchGroups,whenGroupsReady} from '../prototypes/punchies/src/render/art';
import {updateRenderScale} from '../prototypes/punchies/src/render/pixelRatio';
await initPortal();await initLanguage();
if(new URLSearchParams(location.search).has('buffer2')){Object.defineProperty(window,'devicePixelRatio',{value:2});updateRenderScale();}
const {game}=await import('../prototypes/punchies/src/boot');
const params=new URLSearchParams(location.search),wanted=Number(params.get('cycles')??0);
const cycleTrace:object[]=[];let phase='enter',current=0,entered=0,hitFrame=0;
const activate=(scene:Phaser.Scene,label:string)=>{
 const text=scene.children.list.find(o=>(o as Phaser.GameObjects.Text).text===label);
 const hit=text?.getData('bg');if(!hit)return false;
 hit.emit('pointerdown');hit.emit('pointerup');return true;
};
game.events.on(Phaser.Core.Events.POST_RENDER,()=>{
 if(!wanted||phase==='done')return;
 const choices=params.has('normal')?['VsAI','LocalVs']:['Training','VsAI','Survival'];
 const key=choices[current%choices.length];
 const source=game.scene.getScene(key) as any;
 if(phase==='enter'&&game.scene.isActive('Menu')){
  phase='loading';const menu=game.scene.getScene('Menu');whenGroupsReady(menu,['zombie','marco','mia','dummy'],()=>{menu.scene.start(key,{char:'marco',skin:'default',chars:['marco','mia'],skins:['default','default'],level:'easy',p1:'touch',p2:'kb2'});phase='wait';entered=performance.now();});
 }else if(phase==='wait'&&source.scene.isActive()&&source.stage?.fx?.sparks?.diagnostics().sparkCapacity===8&&source.built!==false&&performance.now()-entered>2200&&(!source.sim||source.sim.tick>source.sim.fightStartTick+20)){
  const sim=source.sim??source.displayPair(source.run.enemies[0]);
  source.stage.handleEvents([{kind:'hit',attacker:0,x:sim.fighters[1].x,y:sim.fighters[1].y,punch:'cross',sweet:true,counter:false,row:'normal',damage:5,buffed:false}],sim);
  phase='hit';hitFrame=0;
 }else if(phase==='hit'){
  if(++hitFrame<2)return;
  const pool=source.stage.fx.sparks,live=pool.pool.filter((b:any)=>b.duration>0);
  cycleTrace.push({cycle:current+1,scene:key,objects:source.children.list.length,world:source.stage.persp.world.list.length,updateListeners:source.events.listenerCount('update'),
   ...pool.diagnostics(),sparkVisible:live.every((b:any)=>b.g.visible&&b.g.parentContainer===source.stage.persp.world&&b.g.commandBuffer.length>0)});
  if(++current>=wanted){phase='done';source.scene.pause();document.querySelector('#vfx-status')!.textContent=JSON.stringify({actualMenuCycles:cycleTrace});return;}
  source.scene.launch('GameMenu',{source:key,multiplayer:key==='LocalVs'});phase='menu';
 }else if(phase==='menu'&&game.scene.isActive('GameMenu')){
  if(activate(game.scene.getScene('GameMenu'),t('pause.return_to_main_menu_2')))phase='confirm';
 }else if(phase==='confirm'&&game.scene.isActive('GameMenu')){
  if(activate(game.scene.getScene('GameMenu'),t('pause.return')))phase='enter';
 }
});
const captured=new WeakSet<object>();
game.events.on(Phaser.Core.Events.POST_RENDER,()=>{
 for(const scene of game.scene.getScenes(true)){
  const pool=(scene as any).stage?.fx?.sparks;
  if(new URLSearchParams(location.search).has('freezeHit')&&pool?.diagnostics().activeSparks>0&&!captured.has(pool)){
   captured.add(pool);scene.scene.pause();
   document.querySelector('#vfx-status')!.textContent=JSON.stringify({capturedRealHit:scene.scene.key,...pool.diagnostics()});
  }
 }
});
document.querySelector('#training')!.addEventListener('click',()=>{
 const source=game.scene.getScenes(false).find(s=>s.scene.isPaused()&&['Training','Survival','VsAI'].includes(s.scene.key))??game.scene.getScenes(true).find(s=>!['ArtBoot','ScreenTransition'].includes(s.scene.key));
 source?.scene.start('Training',{char:'marco',skin:'default'});
});
document.querySelector('#boxing')!.addEventListener('click',()=>{
 const source=game.scene.getScenes(true).find(s=>!['ArtBoot','ScreenTransition'].includes(s.scene.key));
 source?.scene.start('VsAI',{chars:['marco','mia'],skins:['default','default'],level:'easy'});
});
document.querySelector('#pause')!.addEventListener('click',()=>{
 const source=game.scene.getScenes(false).find(s=>['VsAI','LocalVs','Training','Survival'].includes(s.scene.key)&&(s.scene.isActive()||s.scene.isPaused()));
 if(source&&source.scene.key!=='GameMenu')source.scene.launch('GameMenu',{source:source.scene.key,multiplayer:false});
});
// Real production scenes and UI routes; only scheduling/diagnostics differ.
game.events.once('ready',()=>{
 prefetchGroups(['zombie']);
 game.loop.stop();game.loop.forceSetTimeOut=true;game.loop.start(game.step.bind(game));
 game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();
});
setInterval(()=>{
 const data=game.scene.getScenes(true).filter(s=>!['ArtBoot','ScreenTransition'].includes(s.scene.key)).map(s=>{
  const stage=(s as any).stage,pool=stage?.fx?.sparks;
  return {scene:s.scene.key,tick:(s as any).sim?.tick,go:(s as any).sim?.fightStartTick,objects:s.children.list.length,world:stage?.persp?.world?.list.length,
   ...pool?.diagnostics(),sparkObjects:pool?.pool?.map((b:any)=>({visible:b.g.visible,alive:!!b.g.scene,parent:!!b.g.parentContainer,alpha:b.g.alpha,age:b.age,duration:b.duration})),tweens:s.tweens.getTweens().length};
 });
 if(data.length&&phase!=='done')document.querySelector('#vfx-status')!.textContent=JSON.stringify(data);
},100);
