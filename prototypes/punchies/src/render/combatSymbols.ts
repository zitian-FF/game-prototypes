import type Phaser from 'phaser';
import { reducedMotion } from '../ui/presentation';

const ATLAS='punchies:combat-symbols-v1';
/** Shared 32KiB atlas; normal-blend outlined marks rather than floating labels. */
export function combatSymbolAtlas(scene:Phaser.Scene):string {
  if(scene.textures.exists(ATLAS))return ATLAS;
  const g=scene.make.graphics({x:0,y:0});
  const paint=(p:number[][],color:number,width=2)=>{
    const points=p.map(([x,y])=>({x,y}));g.fillStyle(color).fillPoints(points,true);
    if(width)g.lineStyle(width,0x15213c).strokePoints(points,true);
  };
  const star=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,r=i%2?6:13;return [16+Math.cos(a)*r,16+Math.sin(a)*r];});
  paint(star,0xffc844);paint(star.map(([x,y])=>[16+(x-16)*.63,16+(y-16)*.63]),0xffefb1,0);
  paint([[11,11],[15,8],[17,13],[13,15]],0xfff9df,0);
  // Two visibly separated bolt sections, with only three muted debris flecks.
  paint([[53,12],[69,4],[85,6],[72,17],[79,17],[68,23],[62,18]],0xc5bca3,1.5);
  paint([[81,23],[93,19],[99,22],[88,32],[108,29],[95,37],[79,33],[88,26]],0xa79b88,1.5);
  for(const [x,y] of [[106,9],[52,31],[112,35]])paint([[x-2,y],[x,y-3],[x+2,y],[x,y+3]],0xc7c0b1,1);
  g.generateTexture(ATLAS,128,64);g.destroy();
  const texture=scene.textures.get(ATLAS);texture.add('sweet-star',0,0,0,32,32);texture.add('charge-lost-bolt',0,48,0,68,40);
  return ATLAS;
}
interface SymbolSlot {image:Phaser.GameObjects.Image;kind:'sweet'|'chargeLost';age:number;life:number;x:number;y:number;serial:number;motion:boolean}

/** Eight single-star slots + four lost-charge slots, all ring-world depth69. */
export class CombatSymbols {
  private pool:SymbolSlot[]=[];private serial=0;private disposed=false;
  constructor(private scene:Phaser.Scene){
    const atlas=combatSymbolAtlas(scene);
    for(let i=0;i<12;i++)this.pool.push({image:scene.add.image(0,0,atlas,i<8?'sweet-star':'charge-lost-bolt').setDepth(69).setVisible(false),kind:i<8?'sweet':'chargeLost',age:0,life:0,x:0,y:0,serial:0,motion:true});
    scene.events.on('update',this.update,this);scene.events.once('shutdown',this.destroy,this);
  }
  sweet(x:number,y:number){this.show('sweet',x,y-4);}
  chargeLost(x:number,y:number){this.show('chargeLost',x,y-24);}
  private show(kind:SymbolSlot['kind'],x:number,y:number){
    if(this.disposed)return;const candidates=this.pool.filter(s=>s.kind===kind);
    const slot=candidates.find(s=>!s.life)??candidates.reduce((a,b)=>a.serial<b.serial?a:b);
    Object.assign(slot,{x,y,age:0,life:kind==='sweet'?320:240,serial:++this.serial,motion:!reducedMotion()});
    slot.image.setPosition(x,y).setRotation(0).setVisible(true);this.draw(slot);
  }
  private update(_time:number,delta:number){for(const s of this.pool){if(!s.life)continue;s.age+=Math.max(0,delta);if(s.age>=s.life){s.life=0;s.image.setVisible(false);}else this.draw(s);}}
  private draw(s:SymbolSlot){const t=Math.min(1,s.age/s.life);
    if(s.kind==='sweet')s.image.setPosition(s.x,s.y-(s.motion?24*(1-Math.pow(1-t,2)):0)).setScale(s.motion?.58+.12*Math.sin(Math.min(1,t*3)*Math.PI):.65).setAlpha(Math.min(1,(1-t)*1.6));
    else s.image.setScale(s.motion?.55+t*.2:.6).setAlpha((1-t)*.7).setRotation(s.motion?-.12+t*.18:0);
  }
  diagnostics(){return {symbolCapacity:this.pool.length,activeSweetStars:this.pool.filter(s=>s.kind==='sweet'&&s.life>0).length,activeChargeLossBolts:this.pool.filter(s=>s.kind==='chargeLost'&&s.life>0).length,symbolWorldParented:this.pool.filter(s=>!!s.image.parentContainer).length,symbolTweens:0};}
  destroy(){if(this.disposed)return;this.disposed=true;this.scene.events.off('update',this.update,this);this.scene.events.off('shutdown',this.destroy,this);for(const s of this.pool)s.image.destroy();this.pool=[];}
}
