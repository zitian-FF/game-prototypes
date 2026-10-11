import type Phaser from 'phaser';

const FIRE_ATLAS='punchies:clash-fire-collision-v2';
const CELL=240,FRAMES=16;
export interface ClashFlames {root:Phaser.GameObjects.Container;left:Phaser.GameObjects.Image;right:Phaser.GameObjects.Image;flare:Phaser.GameObjects.Image}

/** Two opposing curled trails, not an upright wall of flames. Shared 3.52MiB atlas. */
export function clashFireImage(scene:Phaser.Scene):ClashFlames {
  if(!scene.textures.exists(FIRE_ATLAS)){
    const g=scene.make.graphics({x:0,y:0});
    const atlas=scene.textures.createCanvas(FIRE_ATLAS,CELL*4,CELL*4)!;
    for(let i=0;i<FRAMES;i++){
      if(i<12)drawClashFire(g,120,120,i*1000/12,1,true);else drawCollision(g,120,120,(i-12)/3);
      const scratch=FIRE_ATLAS+'-scratch';g.generateTexture(scratch,CELL,CELL);
      atlas.context.drawImage(scene.textures.get(scratch).getSourceImage() as HTMLCanvasElement,i%4*CELL,Math.floor(i/4)*CELL);
      scene.textures.remove(scratch);atlas.add(String(i),0,i%4*CELL,Math.floor(i/4)*CELL,CELL,CELL);
    }
    atlas.refresh();g.destroy();
  }
  const root=scene.add.container();
  const left=scene.add.image(0,0,FIRE_ATLAS,'0');
  const right=scene.add.image(0,0,FIRE_ATLAS,'6').setFlipX(true).setFlipY(true);
  const flare=scene.add.image(0,0,FIRE_ATLAS,'12').setVisible(false);
  root.add([left,right,flare]);return {root,left,right,flare};
}

export function animateClashFire(f:ClashFlames,x:number,y:number,ms:number,slideMs:number,exit:number,motion:boolean,span:number):void {
  const travel=motion?1-Math.pow(1-Math.min(1,ms/Math.max(1,slideMs)),3):1;
  const age=Math.max(0,ms-slideMs),impact=motion?Math.min(1,age/400):1;
  const distance=18+span*(1-travel)+exit*span*.6,scale=.68+travel*.22+exit*.45;
  const frame=String(motion?Math.floor(ms*12/1000)%12:0);
  f.root.setPosition(x,y).setAlpha(1-exit).setVisible(exit<1);
  f.left.setPosition(-distance,-5).setScale(scale).setRotation(-.16+impact*.12).setFrame(frame);
  f.right.setPosition(distance,5).setScale(scale).setRotation(-.16+impact*.12).setFrame(frame);
  const collision=travel===1&&age<400&&motion;
  f.flare.setVisible(collision).setScale(.65+impact*.85).setAlpha((1-impact)*.85)
    .setFrame(String(12+Math.min(3,Math.floor(impact*4))));
}

function polygon(g:Phaser.GameObjects.Graphics,points:number[][],x:number,y:number,scale:number,color:number,outline=false,alpha=1){
  const p:{x:number;y:number}[]=[];
  points.forEach(([dx,dy],i)=>{
    const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
    const tip=i%5===0,round=tip?.06:.28;
    const ax=dx+(prev[0]-dx)*round,ay=dy+(prev[1]-dy)*round;
    const bx=dx+(next[0]-dx)*round,by=dy+(next[1]-dy)*round;
    for(let j=0;j<=4;j++){const t=j/4,u=1-t;p.push({x:x+(u*u*ax+2*u*t*dx+t*t*bx)*scale,y:y+(u*u*ay+2*u*t*dy+t*t*by)*scale});}
  });
  g.fillStyle(color,alpha).fillPoints(p,true);
  if(outline)g.lineStyle(3*scale,0x562331,alpha).strokePoints(p,true);
}

/** Broad swooping crescent with hooked tips and a clear central negative space. */
export function drawClashFire(g:Phaser.GameObjects.Graphics,x:number,y:number,ms:number,scale:number,motion:boolean,reveal=1):void {
  g.clear();if(reveal<=0)return;
  const p=motion?ms*Math.PI*2/1000:0,w=Math.sin(p)*5,c=Math.cos(p)*4;
  const paint=(pts:number[][],color:number,outline=false,alpha=1)=>polygon(g,pts,x,y,scale,color,outline,alpha*reveal);
  paint([[-109,76],[-72,37],[-101,11],[-103,-25],[-87,-61],[-60,-83],[-17,-95],[26,-89],
    [58,-71],[85+w,-35],[100,-9],[62,-29],[68,-54],
    [35,-52],[-1,-50],[-31,-28],[-41,1],[-31,26],[-11,44],[-56,40],[-34,66],[-76,58]],0xdf3427,true);
  paint([[-96,63],[-65,32],[-87,7],[-88,-26],[-72,-54],[-40,-72],[0,-79],[35,-69],[55,-48],
    [79+w,-25],[48,-37],[26,-38],[-10,-38],[-33,-13],[-30,15],[-9,34],[-48,26],[-35,46],[-67,46]],0xff7f24);
  paint([[-70,30],[-74,5],[-73,-24],[-49,-52],[-17,-64],[18,-62],[42,-46],
    [23,-49],[-4,-47],[-33,-25],[-44,2],[-31,22],[-51,16]],0xffcb45);
  paint([[-63,-5],[-57,-28],[-33,-46],[-7,-51],[11,-48],[-20,-40],[-42,-21],[-48,1]],0xfff1b3);
  // Broken trailing tongues make the silhouette directional, rather than seven vertical spikes.
  paint([[-103,90],[-91,72],[-67,65],[-77,83],[-96,96]],0xff9a26,true);
  paint([[-100,-70],[-88,-87],[-67,-96],[-76,-78]],0xf15a25,true);
  for(let i=0;i<5;i++){
    const a=p*.28+i*1.05,dx=Math.cos(a)*98,dy=Math.sin(a)*97;
    paint([[dx-3,dy+3],[dx+c*.3,dy-7],[dx+4,dy-1],[dx+1,dy+5]],i%2?0xffd862:0xff8730,true,.65);
  }
}
function drawCollision(g:Phaser.GameObjects.Graphics,x:number,y:number,phase:number):void {
  g.clear();
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+.16,inner=18+phase*12,outer=86+Math.sin(i*4)*15;
    const point=(r:number,offset:number)=>[Math.cos(a+offset)*r,Math.sin(a+offset)*r];
    polygon(g,[point(inner,-.25),point(outer,0),point(inner,.25),point(inner*.55,0)],x,y,1,0xffbd39,true);
  }
  polygon(g,[[-42,4],[-26,-22],[-5,-20],[11,-42],[21,-17],[44,-8],[23,14],[17,39],[-8,21],[-37,26]],x,y,1,0xffed9a,true);
  polygon(g,[[-21,3],[-6,-15],[7,-8],[21,0],[6,19],[-13,15]],x,y,1,0xfff9df);
}
