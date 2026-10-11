import type Phaser from 'phaser';
import {FighterView} from './FighterView';
import {mainLook} from './characterLook';
import {tune} from '../sim/tune';
import type {Fighter} from '../sim/types';
import type {SurvivalEnemy,SurvivalEvent} from '../survival/types';
type Pt={x:number;y:number};
type Death=Extract<SurvivalEvent,{kind:'kill'}>;
const SPAWN_MS=180,FLY_MS=360,FADE_MS=180,MAX_VIEWS=24;

/** Ray meets an inset red rope; flight never leaves the playable world bounds. */
export function deathRopePoint(p:Pt,d:Pt,ring=tune.ring):Pt {
 const margin=18,left=ring.left+margin,right=ring.right-margin,top=ring.top+margin,bottom=ring.bottom-margin;
 const x=Math.max(left,Math.min(right,p.x)),y=Math.max(top,Math.min(bottom,p.y));
 const len=Math.hypot(d.x,d.y),dx=len>.0001?d.x/len:1,dy=len>.0001?d.y/len:0;
 let distance=Infinity;
 if(dx>0)distance=Math.min(distance,(right-x)/dx);else if(dx<0)distance=Math.min(distance,(left-x)/dx);
 if(dy>0)distance=Math.min(distance,(bottom-y)/dy);else if(dy<0)distance=Math.min(distance,(top-y)/dy);
 return {x:Math.max(left,Math.min(right,x+dx*Math.max(0,distance))),y:Math.max(top,Math.min(bottom,y+dy*Math.max(0,distance)))};
}
interface Active {view:FighterView;born:number}
interface Flight {view:FighterView;fighter:Fighter;from:Pt;to:Pt;born:number}
export class SurvivalViews {
 private active=new Map<string,Active>();private spare:FighterView[]=[];private flights:Flight[]=[];
 private allocated=0;
 constructor(private scene:Phaser.Scene,private createView:(color:number)=>FighterView){
  scene.events.once('shutdown',()=>{this.active.clear();this.spare=[];this.flights=[];this.allocated=0;});
 }
 private release(view:FighterView){view.reset();this.spare.push(view);}
 private acquire():FighterView {
  if(!this.spare.length&&this.allocated>=MAX_VIEWS){
   const oldest=this.flights.shift();if(oldest)this.release(oldest.view);
  }
  const view=this.spare.pop();if(view){view.reset();return view;}
  if(this.allocated>=MAX_VIEWS)throw new Error('Survival render pool exceeded active enemy contract');
  const fresh=this.createView(0x9dbc61);this.allocated++;return fresh;
 }
 private configure(view:FighterView,kind:SurvivalEnemy['kind'],visualId:string,char:Fighter['char']){
  const look=mainLook(char);view.visualId=visualId;view.skin='default';
  view.setLook(kind==='zombie'?0x9dbc61:look.color,look.scale,kind==='boss'&&look.ponytail);
 }
 kill(event:Death,now:number):void {
  // Removed from the active map immediately; only the detached snapshot flies.
  const current=this.active.get(event.enemyId);this.active.delete(event.enemyId);
  const view=current?.view??this.acquire();view.reset();
  this.configure(view,event.enemyKind,event.visualId,event.fighter.char);
  view.presentationLimp=true;
  const fighter=structuredClone(event.fighter);fighter.punch=null;fighter.dodge=null;
  fighter.pushFrames=0;fighter.stunTimer=0;fighter.health=1;fighter.guarding=false;fighter.exhausted=false;
  this.flights.push({view,fighter,from:event.position,to:deathRopePoint(event.position,event.direction),born:now});
 }
 flash(id:string,now:number,zone:'head'|'body'){this.active.get(id)?.view.flash(0xffffff,now,tune.view.flashMs,zone);}
 draw(enemies:SurvivalEnemy[],now:number):void {
  const ids=new Set(enemies.map(e=>e.id));
  for(const [id,a] of this.active)if(!ids.has(id)){this.active.delete(id);this.release(a.view);}
  for(const enemy of enemies){
   let a=this.active.get(enemy.id);
   if(!a){const view=this.acquire();this.configure(view,enemy.kind,enemy.visualId,enemy.fighter.char);a={view,born:now};this.active.set(enemy.id,a);}
   a.view.draw(enemy.fighter,now,false);a.view.setPresentationAlpha(Math.min(1,(now-a.born)/SPAWN_MS));
  }
  for(let i=this.flights.length-1;i>=0;i--){
   const f=this.flights[i],age=Math.max(0,now-f.born);
   if(age>=FLY_MS+FADE_MS){this.flights.splice(i,1);this.release(f.view);continue;}
   const u=Math.min(1,age/FLY_MS),ease=1-Math.pow(1-u,2);
   f.fighter.x=f.from.x+(f.to.x-f.from.x)*ease;f.fighter.y=f.from.y+(f.to.y-f.from.y)*ease;
   f.view.draw(f.fighter,now,false);f.view.setPresentationAlpha(age<FLY_MS?1:1-(age-FLY_MS)/FADE_MS);
  }
 }
 diagnostics(){return {enemyViews:this.allocated,activeEnemyViews:this.active.size,defeatViews:this.flights.length,spareEnemyViews:this.spare.length,maxEnemyViews:MAX_VIEWS};}
}
