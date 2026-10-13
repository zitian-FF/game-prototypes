import type Phaser from 'phaser';
import type {Fighter,CodeXState} from '../sim/types';
import {codeXTrackPosition,CODE_X_TIMING} from '../sim/codeX';
import {reducedMotion} from '../ui/presentation';
import {codeXShadowSheet,codeXTrailTexture,type CodeXSheet} from './codeXShadowSheet';
interface TrackView {guard:Phaser.GameObjects.Image;cross:Phaser.GameObjects.Image;rim:Phaser.GameObjects.Image;ghosts:Phaser.GameObjects.Image[];trail:Phaser.GameObjects.Image;objects:Phaser.GameObjects.Image[]}
/** Two tracks per actor, max two actors. No fake entities, contacts or wall-clock motion. */
export class CodeXShadows {
  private views:TrackView[][]=[];private sheet:CodeXSheet|null=null;private disposed=false;private activeTracks=0;
  constructor(private scene:Phaser.Scene){const trail=codeXTrailTexture(scene);
    for(let actor=0;actor<2;actor++){const pair:TrackView[]=[];for(let i=0;i<2;i++){
      const image=(depth:number)=>scene.add.image(0,0,'__DEFAULT').setDepth(depth).setVisible(false);
      const guard=image(13),cross=image(13),rim=image(12.9),ghosts=[image(12.8),image(12.8)],line=scene.add.image(0,0,trail).setDepth(12.7).setOrigin(1,.5).setVisible(false);
      pair.push({guard,cross,rim,ghosts,trail:line,objects:[guard,cross,rim,...ghosts,line]});
    }this.views.push(pair);}scene.events.once('shutdown',this.destroy,this);
  }
  draw(fighters:readonly Fighter[],finished=false){if(this.disposed)return;this.activeTracks=0;
    const active=finished?[]:fighters.filter(f=>f.health>0&&f.codeX).slice(0,2);
    if(active.length&&!this.sheet)this.sheet=codeXShadowSheet(this.scene);
    for(let actor=0;actor<2;actor++)for(let i=0;i<2;i++){
      const v=this.views[actor][i],f=active[actor];if(!f?.codeX||!this.sheet){v.objects.forEach(o=>o.setVisible(false));continue;}
      this.drawTrack(v,f.codeX,i as 0|1,this.sheet);this.activeTracks++;
    }
  }
  private drawTrack(v:TrackView,state:CodeXState,index:0|1,sheet:CodeXSheet){
    const track=state.tracks[index],frame=state.frame,pos=codeXTrackPosition(track,frame),angle=Math.atan2(track.endY-track.startY,track.endX-track.startX),motion=!reducedMotion();
    const palette=index?0xb795ef:0x71cef4,key=index?sheet.purple:sheet.cyan;
    const recovery=Math.max(0,frame-track.startFrame-CODE_X_TIMING.dash),arrival=Math.max(0,Math.min(1,(frame-track.startFrame+3)/3)),fade=arrival*Math.max(0,1-recovery/4);
    const windup=Math.max(0,Math.min(1,(frame-track.startFrame+4)/4));
    const base=pos.phase==='telegraph'?.35:.82;
    for(const [image,texture,pose] of [[v.guard,sheet.dark,'guard'],[v.cross,sheet.dark,'cross'],[v.rim,key,'cross']] as const)image.setTexture(texture,pose).setOrigin(sheet.pivotX,sheet.pivotY).setPosition(pos.x,pos.y).setRotation(angle).setVisible(fade>0);
    v.guard.setTintFill(0x1b2446).setScale(1).setAlpha(base*fade*(1-windup));v.cross.setTintFill(0x1b2446).setScale(1).setAlpha(base*fade*windup);
    v.rim.setFrame(windup<.5?'guard':'cross').setTintFill(palette).setScale(1.025).setAlpha((pos.phase==='telegraph'?.42:.32)*fade);
    v.ghosts.forEach((g,j)=>{const p=codeXTrackPosition(track,Math.max(track.startFrame,frame-(j+1)*2));g.setTexture(key,'cross').setOrigin(sheet.pivotX,sheet.pivotY).setPosition(p.x,p.y).setRotation(angle).setTintFill(palette).setAlpha((j?.09:.15)*fade).setVisible(motion&&pos.phase==='dash');});
    const distance=Math.hypot(pos.x-track.startX,pos.y-track.startY);
    v.trail.setPosition(pos.x,pos.y).setRotation(angle).setTint(palette).setDisplaySize(Math.max(1,distance),motion?4:2).setAlpha((motion?.28:.14)*fade).setVisible(distance>0&&fade>0);
  }
  diagnostics(){return {codeXTrackCapacity:4,codeXActiveTracks:this.activeTracks,codeXObjects:this.disposed?0:24,codeXBaked:!!this.sheet,codeXWorldParented:this.views.flatMap(v=>v.flatMap(t=>t.objects)).filter(o=>!!o.parentContainer).length,codeXPuppetFrames:0};}
  destroy(){if(this.disposed)return;this.disposed=true;this.activeTracks=0;this.scene.events.off('shutdown',this.destroy,this);this.views.flatMap(v=>v.flatMap(t=>t.objects)).forEach(o=>o.destroy());this.views=[];}
}
