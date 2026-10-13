import type Phaser from 'phaser';
import {skinTexture} from './skins';
import {FighterView} from './FighterView';
import {mainLook} from './characterLook';
import {arenaCombat} from '../sim/sim';
import {NEUTRAL_INPUT} from '../sim/types';
const CELL=256,KEY='punchies:code-x-tee-shadow-v1';
export interface CodeXSheet {dark:string;cyan:string;purple:string;pivotX:number;pivotY:number}
/** Bake only twice from the existing Tee rig; never run a puppet for a shadow frame. */
export function codeXShadowSheet(scene:Phaser.Scene):CodeXSheet|null {
  const saved=scene.registry.get(KEY) as CodeXSheet|undefined;
  if(saved&&[saved.dark,saved.cyan,saved.purple].every(k=>scene.textures.exists(k)))return saved;
  if(!['head','torso','glove_left','glove_right','boot_left','boot_right'].every(part=>scene.textures.exists(skinTexture(scene,'tee','default',`part_tee_${part}`))))return null;
  const texture=scene.textures.addDynamicTexture(KEY,CELL*2,CELL)!;
  const look=mainLook('tee'),view=new FighterView(scene,look.color);view.skin='default';view.setLook(look.color,look.scale,look.ponytail);
  const f=arenaCombat.createFighter(CELL/2,CELL/2,{char:'tee'});
  f.fx=1;f.fy=0;f.guarding=true;
  try{
    view.draw(f,0,false);const puppet=(view as any).puppet;
    if(!puppet.visible){scene.textures.remove(KEY);return null;}
    const parts=view.objects.filter(o=>{const d=(o as any).depth;return d>=9&&d<=10.6;}).sort((a,b)=>(a as any).depth-(b as any).depth);
    const boxes:Phaser.Geom.Rectangle[]=[];
    const collect=()=>{for(const o of parts){const image=o as Phaser.GameObjects.Image;if(image.visible&&image.type==='Image')boxes.push(image.getBounds());}};
    collect();texture.draw(parts.filter(o=>(o as any).visible));
    f.guarding=false;arenaCombat.processInput({tick:0,timed:false,hitstop:0,fightStartTick:0,result:null,fighters:[f,arenaCombat.createFighter(200,128,{char:'marco'})]},0,{...NEUTRAL_INPUT,cross:true},[]);
    if(!f.punch)throw new Error('CODE X cross pose unavailable');
    f.punch.frame=f.punch.startup+f.punch.sourEarly+Math.floor(f.punch.sweet/2);view.draw(f,0,false);
    const pivot={x:puppet.gloveR.x,y:puppet.gloveR.y};collect();parts.sort((a,b)=>(a as any).depth-(b as any).depth);texture.beginDraw();for(const o of parts){const p=o as Phaser.GameObjects.Image;if(p.visible)texture.batchDraw(o,p.x+CELL,p.y);}texture.endDraw();
    const left=Math.max(0,Math.floor(Math.min(...boxes.map(b=>b.left))-12)),top=Math.max(0,Math.floor(Math.min(...boxes.map(b=>b.top))-12));
    const right=Math.min(CELL,Math.ceil(Math.max(...boxes.map(b=>b.right))+12)),bottom=Math.min(CELL,Math.ceil(Math.max(...boxes.map(b=>b.bottom))+12)),width=Math.max(1,right-left),height=Math.max(1,bottom-top);
    const frames=(t:Phaser.Textures.Texture)=>{t.add('guard',0,left,top,width,height);t.add('cross',0,CELL+left,top,width,height);};
    frames(texture);
    const result:CodeXSheet={dark:KEY,cyan:KEY,purple:KEY,pivotX:(pivot.x-left)/width,pivotY:(pivot.y-top)/height};
    if(scene.game.renderer.type===1){
      // Canvas ignores sprite tint-fill. Bake three alpha-mask colours once instead.
      const source=texture.getSourceImage() as HTMLCanvasElement;
      for(const [name,color] of [['dark','#1b2446'],['cyan','#71cef4'],['purple','#b795ef']] as const){
        const key=KEY+':'+name,t=scene.textures.createCanvas(key,CELL*2,CELL)!;
        t.context.drawImage(source,0,0);t.context.globalCompositeOperation='source-in';t.context.fillStyle=color;t.context.fillRect(0,0,CELL*2,CELL);t.context.globalCompositeOperation='source-over';frames(t);t.refresh();result[name]=key;
      }
      scene.textures.remove(KEY);
    }
    scene.registry.set(KEY,result);return result;
  }catch(error){scene.textures.remove(KEY);throw error;}
  finally{view.objects.forEach(o=>o.destroy());}
}
export function codeXTrailTexture(scene:Phaser.Scene):string {
  const key='punchies:code-x-trail-v1';if(scene.textures.exists(key))return key;
  const t=scene.textures.createCanvas(key,128,8)!,ctx=t.context,g=ctx.createLinearGradient(0,0,128,0);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.25)');g.addColorStop(1,'rgba(255,255,255,.85)');ctx.fillStyle=g;ctx.fillRect(0,0,128,8);t.refresh();return key;
}
