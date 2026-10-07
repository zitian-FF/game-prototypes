import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { artKey, backdrop, fighterGroups, whenGroupsReady } from '../render/art';
import { FighterView } from '../render/FighterView';
import { mainLook } from '../render/characterLook';
import { createSimState } from '../sim/sim';
import { startScreen } from '../ui/presentation';
import { punchToken } from '../ui/punchToken';
import { navRegister } from '../ui/menuNav';
import { SHOP_ITEMS, availablePool, loadShopDraft, saveShopDraft, shopConfig, welcomePull, regularPull, previewAdReward, type ShopDraftState, type ShopKind, type ShopResult } from '../shop/draft';

/** Unpublished economy prototype. It never grants production unlocks or calls an ad provider. */
export class ShopScene extends Phaser.Scene {
  private state!:ShopDraftState;
  private kind:ShopKind='fighters';
  private root!:Phaser.GameObjects.Container;
  private notice='Costs, rewards and fighters are configurable placeholders.';
  private generation=0;
  constructor(){super('Shop');}
  create(){applyCameraPixelRatio(this);backdrop(this,.78,'gym_background');this.state=loadShopDraft();this.persist();this.render();}
  private persist(){if(!saveShopDraft(this.state))this.notice='Storage unavailable: this preview will not persist after closing.';}
  private text(x:number,y:number,label:string,size=14,color='#fff3da'){
    const t=this.add.text(x,y,label,{fontFamily:'Arial',fontSize:size,fontStyle:'bold',color,resolution:PIXEL_RATIO});this.root.add(t);return t;
  }
  private panel(x:number,y:number,w:number,h:number,color=0x17273e){const g=this.add.graphics();g.fillStyle(color,.97).fillRoundedRect(x,y,w,h,14).lineStyle(2,0x345777).strokeRoundedRect(x,y,w,h,14);this.root.add(g);return g;}
  private button(x:number,y:number,w:number,label:string,fn:()=>void,enabled=true){
    const g=this.add.graphics();g.fillStyle(enabled?0x167547:0x26374a).fillRoundedRect(x,y,w,32,9).lineStyle(1,enabled?0x71ebaf:0x526276).strokeRoundedRect(x,y,w,32,9);this.root.add(g);
    this.text(x+w/2,y+16,label,12,enabled?'#fff5de':'#8e9ba9').setOrigin(.5);
    if(enabled){const hit=this.add.rectangle(x+w/2,y+16,w,32,0,0).setInteractive({useHandCursor:true}).on('pointerdown',fn);this.root.add(hit);navRegister(this,hit,fn);}
  }
  private act(result:ShopResult){
    if(!result.ok){this.notice=result.reason;this.render();return;}
    this.state=result.state;this.notice=result.item?`UNLOCKED: ${result.item.name} · preview collection only`:'Preview reward added. No advertisement was played.';this.persist();this.render();
    if(result.item){const banner=this.text(422,192,result.item.name,25,'#ffdc62').setOrigin(.5);banner.setDepth(200);this.tweens.add({targets:banner,scaleX:{from:.8,to:1.05},scaleY:{from:.8,to:1.05},duration:shopConfig.revealMs,yoyo:true,onComplete:()=>banner.destroy()});}
  }
  private render(){
    const generation=++this.generation;
    this.root?.destroy(true);const scale=Math.min(VIEW.width/844,VIEW.height/390);this.root=this.add.container(VIEW.cx-422*scale,VIEW.cy-195*scale).setScale(scale).setDepth(100);
    this.text(25,14,'PUNCHIES SHOP',26);this.text(26,46,'LOCAL PREVIEW · NOT CONNECTED TO REAL ADS OR RANKED UNLOCKS',10,'#9fbbd4');
    const coin=punchToken(this,650,29,12,100);this.root.add(coin);this.text(673,18,String(this.state.tokens),22);this.button(737,13,83,'BACK',()=>startScreen(this,'Menu'));
    this.button(25,65,130,'FIGHTERS',()=>{this.kind='fighters';this.render();},this.kind!=='fighters');this.button(165,65,130,'SKINS',()=>{this.kind='skins';this.render();},this.kind!=='skins');
    const items=SHOP_ITEMS.filter(i=>i.kind===this.kind);
    items.forEach((item,index)=>{
      const x=25+index*266;this.panel(x,108,254,143);const owned=this.state.owned.includes(item.id);
      this.text(x+12,119,item.name,14);this.text(x+12,140,owned?'OWNED':item.id==='fighter-four'?'WELCOME EXCLUSIVE':'IN PULL POOL',10,owned?'#70edaa':'#ffcf65');
      if(item.boxer){const key=artKey(this,`portrait_${item.boxer}`);if(key){const image=this.add.image(x+57,247,key).setOrigin(.5,1);image.setScale(Math.min(105/image.width,87/image.height)).setTint(item.accent);this.root.add(image);}}
      else {const g=this.add.graphics();g.fillStyle(item.accent,.6).fillCircle(x+58,178,14).fillRoundedRect(x+33,194,50,45,15);this.root.add(g);}
      this.text(x+108,166,item.boxer?'PALETTE STUDY\nFinal skin art pending':'FIGHTER CONCEPT\nPortrait, rig, stats\nto be designed',11,'#a8c1d8');
      if(item.boxer){const id=item.boxer;whenGroupsReady(this,fighterGroups([id,id]),()=>{
        if(generation!==this.generation||!this.scene.isActive())return;
        const before=new Set(this.children.list),look=mainLook(id),view=new FighterView(this,look.color);view.setLook(look.color,look.scale,look.ponytail);
        const parts=this.children.list.filter(o=>!before.has(o));const rig=this.add.container(x+178,218,parts).setScale(.65);this.root.add(rig);
        const fighter=createSimState({timed:false,fighters:[{char:id},{char:id}]}).fighters[0];fighter.x=0;fighter.y=0;view.draw(fighter,this.time.now,false);
        parts.forEach(o=>{if(o instanceof Phaser.GameObjects.Image)o.setTint(item.accent);});
      });}
    });
    this.panel(25,263,390,72);this.panel(429,263,390,72);
    const pool=availablePool(this.state,this.kind),cost=this.kind==='fighters'?shopConfig.fighterPullCost:shopConfig.skinPullCost;
    this.text(38,273,this.state.welcomeClaimed?`WATCH AD · +${shopConfig.adRewardTokens} TOKENS`:'WELCOME GIFT · GUARANTEED FOURTH FIGHTER',12);
    this.text(38,296,this.state.welcomeClaimed?`${this.state.adsToday}/${shopConfig.dailyAdLimit} today · resets 00:00 UTC`:'Gifted token. Fixed reward.',10,'#a8c1d8');
    this.button(236,294,166,this.state.welcomeClaimed?'PREVIEW AD REWARD':`WELCOME PULL · ${shopConfig.welcomeCost}`,()=>this.act(this.state.welcomeClaimed?previewAdReward(this.state):welcomePull(this.state)),!this.state.welcomeClaimed||this.state.adsToday<shopConfig.dailyAdLimit);
    this.text(442,273,`${pool.length} remaining · equal odds · no duplicates in draft`,11,'#a8c1d8');
    this.button(442,294,364,`${this.kind==='fighters'?'FIGHTER':'SKIN'} PULL · ${cost} TOKENS`,()=>this.act(regularPull(this.state,this.kind,Math.random())),this.state.welcomeClaimed&&this.state.tokens>=cost&&pool.length>0);
    this.text(25,346,this.notice,11,'#ffdc8a').setWordWrapWidth(790);this.text(25,373,'Preview collection only. Final artwork, equip flow, ad service and secure wallet are pending.',10,'#91abc3');
  }
}
