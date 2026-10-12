import type Phaser from 'phaser';
import { VIEW } from '../render/pixelRatio';
import { reducedMotion } from './presentation';

const ATLAS='punchies:reward-result-accents-v1';
/** One shared 512x256 atlas (0.5MiB RGBA); normal blending and no post-processing. */
export function accentAtlas(scene:Phaser.Scene):string {
  if(scene.textures.exists(ATLAS))return ATLAS;
  const g=scene.make.graphics({x:0,y:0});
  const poly=(p:number[][],color:number,outline=true)=>{
    const points=p.map(([x,y])=>({x,y}));g.fillStyle(color).fillPoints(points,true);
    if(outline)g.lineStyle(3,0x18213d).strokePoints(points,true);
  };
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6+.12,r=93+(i%3)*8;
    const p=(radius:number,offset:number)=>[120+Math.cos(angle+offset)*radius,120+Math.sin(angle+offset)*radius];
    poly([p(36,-.13),p(r,-.055),p(r+7,0),p(r*.75,.045),p(37,.13)],0xffffff);
  }
  // Inked slash ends are deliberately uneven, without a rounded button frame.
  poly([[256,73],[305,42],[400,29],[483,9],[458,33],[377,52],[297,68]],0xffffff);
  poly([[270,85],[345,66],[412,59],[485,35],[451,62],[360,80]],0xffffff);
  poly([[287,65],[330,43],[412,29],[450,22],[410,39],[339,54]],0xfff1b5,false);
  poly([[268,130],[274,139],[280,142],[274,149],[268,159],[265,149],[257,144],[263,139]],0xffffff);
  poly([[290,132],[301,129],[305,148],[294,151]],0xffffff);
  poly([[342,161],[347,143],[353,137],[347,131],[342,113],[337,131],[330,137],[337,143]],0xffffff);
  g.generateTexture(ATLAS,512,256);g.destroy();
  const texture=scene.textures.get(ATLAS);
  texture.add('burst',0,0,0,240,240);texture.add('slash',0,256,0,240,96);
  texture.add('spark',0,256,128,28,34);texture.add('fleck',0,288,128,20,28);texture.add('glint',0,320,108,44,58);
  return ATLAS;
}

export function pullAccentPhase(age:number,motion:boolean){
  const t=Math.max(0,age),release=Math.max(0,Math.min(1,(t-180)/240));
  return {done:t>=750,release,chestAlpha:t<180?1:Math.max(0,1-(t-180)/90),
    burstAlpha:motion?(t<180?0:Math.max(0,1-(t-240)/450)):.32*Math.max(0,1-(t-500)/250),
    burstScale:motion?.65+release*.6:1,glintAlpha:motion&&t>=420?Math.max(0,Math.sin(Math.min(1,(t-420)/200)*Math.PI)):0};
}

/** At most 11 additional display objects; all removed before the name/ack stage. */
export class PullAccents {
  private root:Phaser.GameObjects.Container;private age=0;private disposed=false;private motion=!reducedMotion();
  private burst:Phaser.GameObjects.Image;private chest:Phaser.GameObjects.Image|null;
  private front=false;private originX=0;private originY=0;
  private glint:Phaser.GameObjects.Image;private sparks:Phaser.GameObjects.Image[]=[];
  constructor(private scene:Phaser.Scene,parent:Phaser.GameObjects.Container,x:number,y:number,legendary:boolean,chestKey:string|null){
    this.originX=x;this.originY=y;
    const atlas=accentAtlas(scene);this.root=scene.add.container(x,y);parent.add(this.root);
    this.burst=scene.add.image(0,0,atlas,'burst');
    if(legendary)this.burst.setTint(0xffdf85,0xffd1f6,0xbde9ff,0xffefa4);else this.burst.setTint(0xd398ff);
    this.root.add(this.burst);
    this.chest=chestKey&&scene.textures.exists(chestKey)?scene.add.image(0,0,chestKey).setDisplaySize(126,110):null;
    if(this.chest)this.root.add(this.chest);
    for(let i=0;i<6;i++){
      const spark=scene.add.image(0,0,atlas,'spark').setScale(.35).setTint(legendary?[0xffd469,0xc5efff,0xf3bdff][i%3]:0xd4acff);
      this.sparks.push(spark);this.root.add(spark);
    }
    this.glint=scene.add.image(120,-80,atlas,'glint').setScale(.45);this.root.add(this.glint);
    scene.events.on('update',this.advance,this);scene.events.once('shutdown',this.destroy,this);this.draw();
  }
  bringHighlightForward(parent:Phaser.GameObjects.Container){this.root.remove(this.glint);parent.add(this.glint);this.front=true;this.draw();}
  private advance(_time:number,delta:number){this.age+=Math.max(0,delta);this.draw();}
  private draw(){
    if(this.disposed)return;const p=pullAccentPhase(this.age,this.motion);
    if(p.done){this.destroy();return;}
    const size=Math.min(1.75,VIEW.height*.88/240);
    this.burst.setScale(size*p.burstScale).setAlpha(p.burstAlpha).setVisible(p.burstAlpha>0);
    if(this.chest){this.chest.setAlpha(this.motion?p.chestAlpha:0);if(this.motion){const k=Math.min(1,this.age/180);this.chest.setScale(126/this.chest.width*(1+k*.07),110/this.chest.height*(1-k*.14));}}
    this.sparks.forEach((s,i)=>{const a=i*Math.PI/3+.2,r=60+p.release*VIEW.height*.28;s.setPosition(Math.cos(a)*r,Math.sin(a)*r).setAlpha(this.motion?p.burstAlpha*.85:0).setRotation(a+.4*p.release);});
    this.glint.setPosition((this.front?this.originX:0)+VIEW.height*.22+Math.max(0,this.age-420)*.13,(this.front?this.originY:0)-80+Math.max(0,this.age-420)*.15).setAlpha(p.glintAlpha);
  }
  destroy(){if(this.disposed)return;this.disposed=true;this.scene.events.off('update',this.advance,this);this.scene.events.off('shutdown',this.destroy,this);this.root.destroy(true);if(this.front)this.glint.destroy();}
}

/** One short landing slash + six corner flecks; never delays result buttons. */
export class VictoryAccent {
  private root:Phaser.GameObjects.Container;private slash:Phaser.GameObjects.Image;private flecks:Phaser.GameObjects.Image[]=[];
  private age=0;private disposed=false;private motion=!reducedMotion();
  constructor(private scene:Phaser.Scene,private x:number,private y:number,width:number){
    const atlas=accentAtlas(scene);this.root=scene.add.container(x,y).setDepth(149);this.root.name='punchies-victory-accent';
    this.slash=scene.add.image(0,0,atlas,'slash').setTint(0xffcc72).setDisplaySize(Math.min(width+45,VIEW.width*.46),74);this.root.add(this.slash);
    for(let i=0;i<6;i++){const fleck=scene.add.image(0,0,atlas,'fleck').setScale(.4).setTint([0xffd469,0xe76483,0x70cdfa][i%3]);this.flecks.push(fleck);this.root.add(fleck);}
    scene.events.on('update',this.advance,this);scene.events.once('shutdown',this.destroy,this);this.draw();
  }
  private advance(_time:number,delta:number){this.age+=Math.max(0,delta);this.draw();}
  private draw(){
    if(this.disposed)return;if(this.age>=700){this.destroy();return;}
    const t=this.age/700,impact=Math.min(1,this.age/180);
    this.slash.setAlpha(Math.max(0,1-this.age/300)*.65);
    this.slash.setVisible(this.age<300);
    this.slash.setCrop(0,0,this.slash.width*(this.motion?(.45+.55*impact):1),this.slash.height);
    this.flecks.forEach((f,i)=>{const side=i<3?-1:1,j=i%3;
      f.setPosition((side<0?VIEW.left+25+j*23:VIEW.right-25-j*23)-this.x+side*Math.sin(t*3+j)*12,VIEW.top+25+j*11-this.y+t*65)
        .setRotation(j*.6+(this.motion?t*2:0)).setAlpha(this.motion?(1-t)*.7:0);
    });
  }
  destroy(){if(this.disposed)return;this.disposed=true;this.scene.events.off('update',this.advance,this);this.scene.events.off('shutdown',this.destroy,this);this.root.destroy(true);}
}
