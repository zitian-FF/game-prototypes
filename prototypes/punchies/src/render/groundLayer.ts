import Phaser from 'phaser';
import { tune } from '../sim/tune';
import { pose } from './art';

// What touches the floor under a boxer: the separate feet layer from the art
// (`<body key>_feet`, same canvas and registration as the body) plus a soft
// ground shadow. Both sit below the body in screen Y so the body reads as
// standing above the floor under the ring tilt. The shadow always falls the
// same way, whichever way the boxer faces. Presentation only: hitboxes stay
// on the body at the sim position.
export class GroundLayer {
  private shadow: Phaser.GameObjects.Graphics;
  private feet: Phaser.GameObjects.Image;
  private indicator: {color:number;label:string}|null=null;
  private label: Phaser.GameObjects.Text;

  // Below the body sprites (depth 10 and 11), above the ring floor.
  constructor(scene: Phaser.Scene, private bodyRadius: number, depth = 9) {
    this.shadow = scene.add.graphics().setDepth(depth);
    this.feet = scene.add.image(0, 0, '__DEFAULT').setDepth(depth).setVisible(false);
    this.label=scene.add.text(0,0,'',{fontFamily:'Arial Black, Arial',fontSize:9,color:'#ffffff',stroke:'#10223c',strokeThickness:2}).setOrigin(.5).setDepth(depth+.05).setVisible(false);
  }
  setIndicator(color:number,label:string):void{this.indicator={color,label};}
  private drawShadow(x:number,y:number,scale:number,alpha:number):void{
    const v=tune.view,g=this.shadow,r=this.bodyRadius*scale;
    g.clear();
    if(this.indicator){
      g.fillStyle(this.indicator.color,1);
      g.fillEllipse(x,y+v.shadowOffsetY,r*2.65,r*2.3);
      const labelWidth=this.indicator.label==='P(COM)'?40:22;
      g.fillRoundedRect(x-labelWidth/2,y+v.shadowOffsetY+r*1.3-6,labelWidth,12,4);
      this.label.setText(this.indicator.label).setPosition(x,y+v.shadowOffsetY+r*1.3).setAlpha(alpha).setVisible(true);
    }else{
      g.fillStyle(0x000000,v.shadowAlpha*alpha);
      g.fillEllipse(x,y+v.shadowOffsetY,r*2.3*v.shadowSize,r*1.5*v.shadowSize);
      this.label.setVisible(false);
    }
  }

  // bodyKey: the body animation key, e.g. "marco_walk". scale: the boxer's
  // character scale (the sprite is drawn at half size times this).
  draw(bodyKey: string, progress: number, x: number, y: number, rotation: number, scale: number, alpha: number): void {
    const v = tune.view;
    this.drawShadow(x,y,scale,alpha);
    if (pose(this.feet, `${bodyKey}_feet`, progress)) {
      this.feet.setPosition(x, y + v.feetOffsetY).setScale(scale / 2).setRotation(rotation).setAlpha(alpha);
    }
  }

  // Just the ground shadow (the puppet draws its own feet).
  shadowOnly(x: number, y: number, scale: number, alpha: number): void {
    this.drawShadow(x,y,scale,alpha);
    this.feet.setVisible(false);
  }

  hide(): void {
    this.shadow.clear();
    this.label.setVisible(false);
    this.feet.setVisible(false);
  }
}
