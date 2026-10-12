import type Phaser from 'phaser';
import { reducedMotion } from './presentation';

export interface SuperMeterBounds {x:number;y:number;width:number;height:number}
const ATLAS='punchies:super-meter-lightning-v1';
/** Eight pre-baked gold/cream bolt frames, shared96KiB atlas across both meters. */
export function superLightningAtlas(scene:Phaser.Scene):string {
  if(scene.textures.exists(ATLAS))return ATLAS;
  const g=scene.make.graphics({x:0,y:0}),atlas=scene.textures.createCanvas(ATLAS,512,48)!;
  for(let i=0;i<8;i++){
    g.clear();const p=[{x:4,y:12},{x:24,y:5+i%3},{x:43,y:15},{x:58,y:7},{x:77,y:17-i%3},{x:101,y:6},{x:124,y:12}];
    for(const [width,color] of [[7,0x16203a],[4.5,0xffc943],[1.6,0xfff3b8]]){
      g.lineStyle(width,color);for(let j=1;j<p.length;j++)g.lineBetween(p[j-1].x,p[j-1].y,p[j].x,p[j].y);
    }
    const scratch=ATLAS+'-scratch';g.generateTexture(scratch,128,24);
    atlas.context.drawImage(scene.textures.get(scratch).getSourceImage() as HTMLCanvasElement,i%4*128,Math.floor(i/4)*24);
    scene.textures.remove(scratch);atlas.add(String(i),0,i%4*128,Math.floor(i/4)*24,128,24);
  }
  atlas.refresh();g.destroy();return ATLAS;
}
/** Two short perimeter wisps; meter text/socket interior is a protected rectangle. */
export class SuperMeterLightning {
  private root:Phaser.GameObjects.Container;private bolts:Phaser.GameObjects.Image[];private ready=false;private age=0;private disposed=false;
  constructor(private scene:Phaser.Scene,private bounds:SuperMeterBounds,depth=91){
    const atlas=superLightningAtlas(scene);this.root=scene.add.container().setDepth(depth).setVisible(false);
    this.bolts=[scene.add.image(0,0,atlas,'0'),scene.add.image(0,0,atlas,'4').setFlipX(true)];this.root.add(this.bolts);
    this.setBounds(bounds);scene.events.on('update',this.update,this);scene.events.once('shutdown',this.destroy,this);
  }
  setBounds(bounds:SuperMeterBounds){if(this.disposed)return;this.bounds={...bounds};const {x,y,width,height}=bounds;
    this.bolts.forEach((b,i)=>b.setPosition(i?x+width+5:x-5,y+height*.5).setDisplaySize(Math.min(20,height*.75),5).setRotation(Math.PI*.5));
  }
  setReady(ready:boolean){if(this.disposed||ready===this.ready)return;if(ready&&!this.ready)this.age=0;this.ready=ready;this.root.setVisible(ready);if(ready)this.draw();}
  private update(_time:number,delta:number){if(!this.ready||this.disposed)return;this.age+=Math.max(0,delta);this.draw();}
  private draw(){const motion=!reducedMotion(),frame=motion?Math.floor(this.age/90)%8:0;
    this.bolts.forEach((b,i)=>b.setFrame(String(motion?(frame+i*4)%8:0)).setAlpha(motion?.8+Math.sin(this.age*.006)*.12:.65));
  }
  diagnostics(){return {superLightningReady:this.ready,superLightningObjects:this.disposed?0:3,superLightningTweens:0};}
  destroy(){if(this.disposed)return;this.disposed=true;this.ready=false;this.scene.events.off('update',this.update,this);this.scene.events.off('shutdown',this.destroy,this);this.root.destroy(true);}
}
