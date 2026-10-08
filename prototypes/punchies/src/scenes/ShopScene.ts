import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { artKey, backdrop } from '../render/art';
import { startScreen } from '../ui/presentation';
import { punchToken } from '../ui/punchToken';
import { navRegister } from '../ui/menuNav';
import { loadShopDraft, saveShopDraft, shopConfig, welcomePull, previewAdReward, refreshDailyOffers, dailyOffers, buyDailyOffer, type ShopDraftState, type ShopItem, type ShopResult } from '../shop/draft';

/** Local storefront draft. No ad provider or production unlocks are connected. */
export class ShopScene extends Phaser.Scene {
  private state!:ShopDraftState;
  private root!:Phaser.GameObjects.Container;
  private notice='Daily offers · choose exactly what you unlock.';
  constructor(){super('Shop');}
  create(){applyCameraPixelRatio(this);backdrop(this,.78,'gym_background');this.state=refreshDailyOffers(loadShopDraft());this.persist();this.render();}
  update(){if(this.state&&this.state.offerDay!==new Date().toISOString().slice(0,10)){this.state=refreshDailyOffers(this.state);this.persist();this.render();}}
  private persist(){if(!saveShopDraft(this.state))this.notice='Storage unavailable: this preview will not persist after closing.';}
  private text(x:number,y:number,label:string,size=14,color='#fff3da'){
    const t=this.add.text(x,y,label,{fontFamily:'Arial',fontSize:size,fontStyle:'bold',color,resolution:PIXEL_RATIO});this.root.add(t);return t;
  }
  private panel(x:number,y:number,w:number,h:number,color=0x17273e){const g=this.add.graphics();g.fillStyle(color,.97).fillRoundedRect(x,y,w,h,14).lineStyle(2,0x345777).strokeRoundedRect(x,y,w,h,14);this.root.add(g);}
  private button(x:number,y:number,w:number,label:string,fn:()=>void,enabled=true){
    const g=this.add.graphics();g.fillStyle(enabled?0x167547:0x26374a).fillRoundedRect(x,y,w,32,9).lineStyle(1,enabled?0x71ebaf:0x526276).strokeRoundedRect(x,y,w,32,9);this.root.add(g);
    this.text(x+w/2,y+16,label,12,enabled?'#fff5de':'#8e9ba9').setOrigin(.5);
    if(enabled){const hit=this.add.rectangle(x+w/2,y+16,w,32,0,0).setInteractive({useHandCursor:true}).on('pointerdown',fn);this.root.add(hit);navRegister(this,hit,fn);}
  }
  private act(result:ShopResult){
    this.state=result.state;
    this.notice=result.ok?(result.item?`UNLOCKED: ${result.item.name}`:'1 preview token added. No advertisement was played.'):result.reason;
    this.persist();this.render();
  }
  private skinRow(item:ShopItem,y:number){
    this.panel(299,y,246,69,0x102034);
    const owned=this.state.owned.includes(item.id),unique=item.skinType==='unique';
    const key=artKey(this,unique?item.portraitKey!:`portrait_${item.boxer}`);
    if(key){const image=this.add.image(330,y+65,key).setOrigin(.5,1);image.setScale(Math.min(49/image.width,57/image.height));if(!unique)image.setTint(item.accent);this.root.add(image);}
    else{const g=this.add.graphics();g.fillStyle(item.accent,.65).fillCircle(328,y+20,9).fillRoundedRect(313,y+32,30,29,10);this.root.add(g);}
    this.text(358,y+8,item.name,11).setWordWrapWidth(178);
    this.text(358,y+26,unique?'UNIQUE · portrait + rig':'PALETTE SWAP',9,'#aac8df');
    this.button(358,y+36,174,owned?'OWNED':`GET SKIN · ${shopConfig.skinPullCost}`,()=>this.act(buyDailyOffer(this.state,item.id)),!owned&&this.state.welcomeClaimed&&this.state.tokens>=shopConfig.skinPullCost);
  }
  private render(){
    this.root?.destroy(true);const scale=Math.min(VIEW.width/844,VIEW.height/390);this.root=this.add.container(VIEW.cx-422*scale,VIEW.cy-195*scale).setScale(scale).setDepth(100);
    this.text(25,14,'PUNCHIES SHOP',26);this.text(26,46,'LOCAL PREVIEW · DAILY OFFERS RESET AT 00:00 UTC',10,'#9fbbd4');
    this.root.add(punchToken(this,650,29,12,100));this.text(673,18,String(this.state.tokens),22);this.button(737,13,83,'BACK',()=>startScreen(this,'Menu'));
    [25,291,557].forEach(x=>this.panel(x,72,262,266));
    this.text(156,89,this.state.welcomeClaimed?'EARN TOKENS':'WELCOME GIFT',19).setOrigin(.5,0);
    this.text(422,89,'SKINS · 5 TOKENS',19).setOrigin(.5,0);this.text(688,89,'FIGHTER · 10 TOKENS',18).setOrigin(.5,0);
    this.root.add(punchToken(this,156,165,38,100));
    this.text(156,217,this.state.welcomeClaimed?'WATCH AN AD\nGET 1 TOKEN':'ONE GIFTED TOKEN\nGUARANTEED FOURTH FIGHTER',15,'#ffdc72').setOrigin(.5,0).setAlign('center');
    this.text(156,262,this.state.welcomeClaimed?`${this.state.adsToday}/${shopConfig.dailyAdLimit} rewards today`:'One-time introduction',11,'#a8c1d8').setOrigin(.5,0);
    this.button(39,291,234,this.state.welcomeClaimed?'PREVIEW AD · +1 TOKEN':'WELCOME PULL · 1 TOKEN',()=>this.act(this.state.welcomeClaimed?previewAdReward(this.state):welcomePull(this.state)),!this.state.welcomeClaimed||this.state.adsToday<shopConfig.dailyAdLimit);
    const skins=dailyOffers(this.state,'skins');skins.forEach((item,i)=>this.skinRow(item,116+i*73));
    if(!skins.length)this.text(422,191,'ALL SKINS OWNED',15,'#a8c1d8').setOrigin(.5);
    const fighter=dailyOffers(this.state,'fighters')[0];
    if(fighter){
      const g=this.add.graphics();g.fillStyle(fighter.accent,.65).fillCircle(688,158,23).fillRoundedRect(648,189,80,53,20);this.root.add(g);
      this.text(688,250,fighter.name,16).setOrigin(.5,0);this.text(688,273,'Portrait + rig + tuned stats pending',10,'#a8c1d8').setOrigin(.5,0);
      const owned=this.state.owned.includes(fighter.id);this.button(571,291,234,owned?'OWNED':`GET FIGHTER · ${shopConfig.fighterPullCost}`,()=>this.act(buyDailyOffer(this.state,fighter.id)),!owned&&this.state.welcomeClaimed&&this.state.tokens>=shopConfig.fighterPullCost);
    }else this.text(688,191,'ALL FIGHTERS OWNED',15,'#a8c1d8').setOrigin(.5);
    this.text(25,346,this.notice,11,'#ffdc8a').setWordWrapWidth(790);
    this.text(25,373,'Unique skins keep the same fighter stats, with their own portrait and rig sprites. Draft artwork pending.',10,'#91abc3');
  }
}
