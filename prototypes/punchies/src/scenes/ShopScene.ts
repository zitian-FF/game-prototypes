import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { artKey, backdrop } from '../render/art';
import { startScreen } from '../ui/presentation';
import { punchToken } from '../ui/punchToken';
import { punchMark } from '../ui/punchMark';
import { navRegister } from '../ui/menuNav';
import { cartoonPanel } from '../ui/cartoonChrome';
import { loadShopDraft, saveShopDraft, shopConfig, welcomePull, previewAdReward, refreshDailyOffers, dailyOffers, chestRewards, buyDailyChest, type ShopDraftState, type ShopKind, type ShopResult } from '../shop/draft';

/** Local storefront draft. No ad provider or production unlocks are connected. */
export class ShopScene extends Phaser.Scene {
  private state!:ShopDraftState;
  private root!:Phaser.GameObjects.Container;
  private popupKind:ShopKind|null=null;
  private notice='Tap a chest to inspect today’s rewards.';
  constructor(){super('Shop');}
  create(){applyCameraPixelRatio(this);backdrop(this,.78,'gym_background');this.popupKind=null;this.state=refreshDailyOffers(loadShopDraft());this.persist();this.render();}
  update(){if(this.state&&this.state.offerDay!==new Date().toISOString().slice(0,10)){this.state=refreshDailyOffers(this.state);this.persist();this.render();}}
  private persist(){if(!saveShopDraft(this.state))this.notice='Storage unavailable: this preview will not persist after closing.';}
  private text(x:number,y:number,label:string,size=14,color='#fff3da'){
    const t=this.add.text(x,y,label,{fontFamily:'Arial Black, Arial',fontSize:size,fontStyle:'bold',color,stroke:'#081225',strokeThickness:size>=14?3:1,resolution:PIXEL_RATIO});this.root.add(t);return t;
  }
  private panel(x:number,y:number,w:number,h:number,color=0x28517d){const g=this.add.graphics();cartoonPanel(g,x,y,w,h,color,11);this.root.add(g);}
  private hit(x:number,y:number,w:number,h:number,fn:()=>void,depth=0){const hit=this.add.rectangle(x+w/2,y+h/2,w,h,0,0).setDepth(depth).setInteractive({useHandCursor:true}).on('pointerdown',fn);this.root.add(hit);navRegister(this,hit,fn);}
  private button(x:number,y:number,w:number,label:string,fn:()=>void,enabled=true,depth=0){
    const g=this.add.graphics();const color=!enabled?0x435271:label.includes('5 TOKENS')?0x9c4edf:label.includes('10 TOKENS')?0xe8a72d:label==='CLOSE'||label==='BACK'?0x268eda:0x28af70;cartoonPanel(g,x,y,w,32,color,7);this.root.add(g);
    this.text(x+w/2,y+16,label,12,enabled?'#fff5de':'#8e9ba9').setOrigin(.5);
    if(enabled)this.hit(x,y,w,32,fn,depth);
  }
  private act(result:ShopResult){
    this.state=result.state;
    this.notice=result.ok?(result.item?`UNLOCKED: ${result.item.name}`:'1 preview token added. No advertisement was played.'):result.reason;
    if(result.ok)this.popupKind=null;
    this.persist();this.render();
  }
  private chest(kind:ShopKind,x:number){
    const key=artKey(this,kind==='skins'?'chest_skin_base':'chest_fighter_base');
    if(key){const icon=this.add.image(x,175,key);icon.setScale(140/Math.max(icon.width,icon.height));this.root.add(icon);}
    else{const g=this.add.graphics();g.fillStyle(kind==='skins'?0x8256be:0xeebf43).fillRoundedRect(x-57,134,114,77,12);g.lineStyle(5,0x081428).strokeRoundedRect(x-57,134,114,77,12);this.root.add(g);}
    const mark=punchMark(this,x-23,195,38);if(mark)this.root.add(mark);
    this.hit(x-88,116,176,122,()=>{this.popupKind=kind;this.render();});
    const pool=chestRewards(this.state,kind),purchased=this.state.purchasedChests?.includes(kind);
    this.text(x,247,purchased?'OPENED TODAY':pool.length?'TAP TO SEE REWARDS':'COLLECTION COMPLETE',12,purchased?'#91dbb4':'#a8c1d8').setOrigin(.5,0);
    this.text(x,268,'ONE CHEST PER DAY',10,'#a8c1d8').setOrigin(.5,0);
    const cost=kind==='skins'?shopConfig.skinPullCost:shopConfig.fighterPullCost;
    this.button(x-117,291,234,purchased?'COME BACK TOMORROW':`OPEN CHEST · ${cost} TOKENS`,()=>this.act(buyDailyChest(this.state,kind,Math.random())),!purchased&&pool.length>0&&this.state.welcomeClaimed&&this.state.tokens>=cost);
  }
  private bubble(kind:ShopKind){
    const shade=this.add.rectangle(422,195,844,390,0x050e1b,.74).setInteractive().on('pointerdown',()=>{this.popupKind=null;this.render();});this.root.add(shade);
    const x=kind==='skins'?270:490,w=324,color=kind==='skins'?0x693da0:0x967022;
    const tail=this.add.graphics().fillStyle(color).fillTriangle(x+140,342,x+168,342,x+154,357);this.root.add(tail);this.panel(x,70,w,277,color);
    this.root.add(this.add.rectangle(x+w/2,208,w,277,0,0).setInteractive());
    this.text(x+15,82,kind==='skins'?'TODAY’S SKINS':'TODAY’S FIGHTER',16);this.button(x+w-84,79,70,'CLOSE',()=>{this.popupKind=null;this.render();},true,300);
    const rewards=chestRewards(this.state,kind),offers=dailyOffers(this.state,kind);
    offers.forEach((item,i)=>{
      const y=kind==='skins'?120+i*62:123;this.panel(x+12,y,w-24,57,0x102034);
      const unique=item.skinType==='unique',key=item.boxer?artKey(this,unique?item.portraitKey!:`portrait_${item.boxer}`):null;
      if(key){const image=this.add.image(x+40,y+53,key).setOrigin(.5,1);image.setScale(Math.min(43/image.width,49/image.height));if(!unique)image.setTint(item.accent);this.root.add(image);}
      else {const g=this.add.graphics().fillStyle(item.accent,.6).fillCircle(x+40,y+17,8).fillRoundedRect(x+27,y+28,26,23,7);this.root.add(g);}
      this.text(x+70,y+7,item.name,11).setWordWrapWidth(225);
      const probability=rewards.find(r=>r.item.id===item.id)?.probability??0;
      this.text(x+70,y+26,`${item.kind==='fighters'?'FIGHTER':unique?'UNIQUE':'PALETTE SWAP'} · ${Math.round(probability*100)}%${this.state.owned.includes(item.id)?' · OWNED':''}`,11,'#ffdc72');
    });
    if(!offers.length)this.text(x+162,155,'COLLECTION COMPLETE',14).setOrigin(.5);
    if(kind==='fighters')this.text(x+16,193,'Guaranteed fighter of the day.\nPortrait, rig and stats are draft placeholders.',11,'#a8c1d8').setWordWrapWidth(289);
    else this.text(x+16,311,'Equal odds across remaining rewards.',10,'#a8c1d8');
    if(kind==='fighters')this.text(x+16,273,'Each chest can be opened once per day.',11,'#a8c1d8');
  }
  private render(){
    this.root?.destroy(true);const scale=Math.min(VIEW.width/844,VIEW.height/390);this.root=this.add.container(VIEW.cx-422*scale,VIEW.cy-195*scale).setScale(scale).setDepth(100);
    this.text(25,14,'PUNCHIES SHOP',26);this.text(26,46,'LOCAL PREVIEW · DAILY CHESTS RESET AT 00:00 UTC',10,'#9fbbd4');
    this.root.add(punchToken(this,650,29,12,100));this.text(673,18,String(this.state.tokens),22);this.button(737,13,83,'BACK',()=>startScreen(this,'Menu'));
    [25,291,557].forEach((x,i)=>this.panel(x,72,262,266,[0x236f9a,0x59398b,0x826027][i]));
    this.text(156,89,this.state.welcomeClaimed?'EARN TOKENS':'WELCOME GIFT',19).setOrigin(.5,0);
    this.text(422,89,'SKIN CHEST',19,'#d6b4ff').setOrigin(.5,0);this.text(688,89,'FIGHTER CHEST',19,'#ffdb78').setOrigin(.5,0);
    const rewardKey=artKey(this,'reward_ad_base');
    if(this.state.welcomeClaimed&&rewardKey){const icon=this.add.image(156,167,rewardKey);icon.setScale(120/Math.max(icon.width,icon.height));this.root.add(icon);const mark=punchMark(this,137,184,31);if(mark)this.root.add(mark);}
    else this.root.add(punchToken(this,156,165,38,100));
    this.text(156,217,this.state.welcomeClaimed?'WATCH AN AD\nGET 1 TOKEN':'ONE GIFTED TOKEN\nGUARANTEED FOURTH FIGHTER',15,'#ffdc72').setOrigin(.5,0).setAlign('center');
    this.text(156,262,this.state.welcomeClaimed?`${this.state.adsToday}/${shopConfig.dailyAdLimit} rewards today`:'One-time introduction',11,'#a8c1d8').setOrigin(.5,0);
    this.button(39,291,234,this.state.welcomeClaimed?'PREVIEW AD · +1 TOKEN':'WELCOME PULL · 1 TOKEN',()=>this.act(this.state.welcomeClaimed?previewAdReward(this.state):welcomePull(this.state)),!this.state.welcomeClaimed||this.state.adsToday<shopConfig.dailyAdLimit);
    this.chest('skins',422);this.chest('fighters',688);
    this.text(25,346,this.notice,11,'#ffdc8a').setWordWrapWidth(790);
    this.text(25,373,'Purple: one random skin. Gold: guaranteed daily fighter. Unique skin artwork is pending.',10,'#91abc3');
    if(this.popupKind)this.bubble(this.popupKind);
  }
}
