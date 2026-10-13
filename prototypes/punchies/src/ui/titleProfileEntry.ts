import type Phaser from 'phaser';
import {t} from '../i18n';
import {VIEW,PIXEL_RATIO} from '../render/pixelRatio';
import {getAlias,getProfileAvatar} from '../progress/profile';
import {progressView} from '../progress/progress';
import {titleName} from '../progress/titles';
import {xpFraction} from './progressionModel';
import {avatarImage} from './profileAvatar';
import {whenGroupsReady} from '../render/art';
import {titleButton} from './titleButton';
/** One standard interactive region with passive owned identity inside it. */
export function titleProfileEntry(scene:Phaser.Scene,open:()=>void){
 const width=260,height=72,left=VIEW.right-16-width,top=VIEW.top+12,depth=130;
 const button=titleButton(scene,left+width/2,top+height/2,width,height,'',open,false,depth),hit=button.getData('bg') as Phaser.GameObjects.Rectangle;
 hit.setData('label',t('profile.heading'));
 const content=scene.add.container().setDepth(depth+2),g=scene.add.graphics();content.add(g);
 const text=(x:number,y:number,size:number,color:string)=>{const label=scene.add.text(x,y,'',{fontFamily:'Arial, sans-serif',fontSize:size,fontStyle:'bold',color,resolution:PIXEL_RATIO,padding:{left:2,right:3,top:1,bottom:1}}).setOrigin(0,.5);content.add(label);return label;};
 const alias=text(left+86,top+21,16,'#fff7e6'),identity=text(left+86,top+40,10,'#dfcfff');
 const arrow=text(left+width-24,top+37,23,'#fff7e6').setText('›');
 let portrait:Phaser.GameObjects.Image|null=null,alive=true,generation=0;
 const fit=(label:Phaser.GameObjects.Text,max:number)=>{label.setScale(1);label.setScale(Math.min(1,max/Math.max(1,label.width)));};
 const refresh=()=>{
  const token=++generation,a=getProfileAvatar(),v=progressView();
  alias.setText(getAlias());fit(alias,136);
  identity.setText(t('profile.level',{level:v.level})+' · '+titleName(v.title));fit(identity,136);
  g.clear().fillStyle(0x10233c).fillRoundedRect(left+11,top+8,64,56,9);
  g.fillStyle(0x14243b).fillRoundedRect(left+86,top+51,132,6,3);
  const fill=132*xpFraction(v);if(fill>0)g.fillStyle(0x5bd6e9).fillRoundedRect(left+86,top+51,Math.max(2,fill),6,3);
  const draw=()=>{if(!alive||token!==generation)return;portrait?.destroy();portrait=avatarImage(scene,a,left+43,top+36,60,48,0);if(portrait)content.add(portrait);};
  draw();whenGroupsReady(scene,[a.fighter],draw);
 };
 hit.on('pointerdown',()=>content.setY(2));hit.on('pointerup',()=>content.setY(0));hit.on('pointerout',()=>content.setY(0));
 scene.events.on('resume',refresh);scene.events.once('shutdown',()=>{alive=false;generation++;scene.events.off('resume',refresh);});
 refresh();return {hit,content,refresh,alias,identity,arrow};
}
