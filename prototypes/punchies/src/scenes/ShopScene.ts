import Phaser from 'phaser';
import { t } from '../i18n';
import { itemName } from '../shop/itemText';
import { track } from '../portal/analytics';
import { portal, showRewardedAd } from '../portal/index';
import { isDebug } from '../debug/debugPanel';
import { sfx } from '../audio/sfx';
import { RewardReveal } from '../ui/rewardReveal';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { artKey, backdrop } from '../render/art';
import { skinTexture } from '../render/skins';
import { reducedMotion, startScreen } from '../ui/presentation';
import { punchToken } from '../ui/punchToken';
import { tune } from '../sim/tune';
import { navRegister } from '../ui/menuNav';
import { cartoonPanel, cartoonButton } from '../ui/cartoonChrome';
import { loadShopDraft, saveShopDraft, shopConfig, SHOP_ITEMS, previewAdReward, refreshDailyOffers, dailyOffers, chestRewards, buyDailyChest, type ShopDraftState, type ShopKind, type ShopResult } from '../shop/draft';

/** Local storefront draft. No ad provider or production unlocks are connected. */
export class ShopScene extends Phaser.Scene {
  private reveal:RewardReveal|null=null;
  private state!:ShopDraftState;
  private root!:Phaser.GameObjects.Container;
  private rays:Phaser.GameObjects.Graphics[]=[];
  private popupKind:ShopKind|null=null;
  private adBusy=false;
  private adSeen=false;
  private notice='';
  constructor(){super('Shop');}
  create(){track('shop','shop','open');this.notice=t('shop.tap_a_chest_to_inspect');this.adSeen=false;sfx.shopOpen();this.reveal=null;applyCameraPixelRatio(this);backdrop(this,.78,'gym_background');this.popupKind=null;this.state=refreshDailyOffers(loadShopDraft());this.persist();this.render();}
  update(){for(const ray of this.rays)ray.rotation=reducedMotion()?0:this.time.now/tune.view.menu.shopRayRotationMs*Math.PI*2;if(!this.reveal&&this.state&&this.state.offerDay!==new Date().toISOString().slice(0,10)){this.state=refreshDailyOffers(this.state);this.persist();this.render();}}
  private persist(){if(!saveShopDraft(this.state))this.notice=t('shop.storage_unavailable_this_preview_will');}
  private text(x:number,y:number,label:string,size=14,color='#fff3da'){
    const t=this.add.text(x,y,label,{fontFamily:'Arial Black, Arial',fontSize:size,fontStyle:'bold',color,stroke:'#081225',strokeThickness:size>=14?3:1,resolution:PIXEL_RATIO});this.root.add(t);return t;
  }
  private panel(x:number,y:number,w:number,h:number,color=0x28517d){const g=this.add.graphics();cartoonPanel(g,x,y,w,h,color,11);this.root.add(g);}
  private hit(x:number,y:number,w:number,h:number,fn:()=>void,depth=0){const hit=this.add.rectangle(x+w/2,y+h/2,w,h,0,0).setDepth(depth).setInteractive({useHandCursor:true}).on('pointerdown',fn);this.root.add(hit);navRegister(this,hit,fn);}
  private button(x:number,y:number,w:number,label:string,fn:()=>void,enabled=true,depth=0,tone:'green'|'purple'|'gold'|'blue'='green'){
    const g=this.add.graphics();const color=!enabled?0x435271:tone==='purple'?0x9c4edf:tone==='gold'?0xe8a72d:tone==='blue'?0x268eda:0x28af70;cartoonButton(g,x,y,w,32,color,9);this.root.add(g);
    this.text(x+w/2,y+16,label,12,enabled?'#fff5de':'#8e9ba9').setOrigin(.5).setStroke('#23415a',0).setShadow(0,2,'#23415a',1,true,true);
    if(enabled)this.hit(x,y,w,32,fn,depth);
  }
  /** Rewarded ad for a token. The reward is granted only when the portal reports 'rewarded'. */
  private async watchAd(){
    if(this.adBusy||this.reveal)return;
    track('rewarded','shop_token','interact');
    const check=previewAdReward(this.state);
    if(!check.ok){this.act(check);return;}
    this.adBusy=true;this.input.enabled=false;
    const result=await showRewardedAd('shop_token');
    track('rewarded','shop_token',result);
    this.adBusy=false;
    if(!this.scene.isActive('Shop'))return;
    this.input.enabled=true;
    if(result==='rewarded'){this.act(previewAdReward(this.state));return;}
    sfx.denied();
    this.notice=result==='unavailable'?t('shop.no_ad_is_available_right'):t('shop.the_ad_did_not_finish');
    this.render();
  }
  private act(result:ShopResult){
    if(this.reveal)return;
    if (result.ok) {
      if (result.state.tokens > this.state.tokens) sfx.tokenEarned();
      if (result.state.tokens < this.state.tokens) sfx.tokenSpent();
      if (result.item) { sfx.chestOpen(); track('chest', result.item.kind, 'unlock', { item: result.item.id }); }
    } else sfx.denied();
    this.state=result.state;
    this.notice=result.ok?(result.item?t('shop.unlocked', { name: itemName(result.item) }):portal.ads.kind==='preview'?t('shop.1_preview_token_added_no'):t('shop.1_token_earned')):result.reasonKey?t(result.reasonKey,result.reasonParams):result.reason;
    if(result.ok)this.popupKind=null;
    this.persist();this.render();
    if(result.ok&&result.item){
      for(const child of this.root.list){if((child as Phaser.GameObjects.Rectangle).input)(child as Phaser.GameObjects.Rectangle).input!.enabled=false;}
      this.reveal=new RewardReveal(this,result.item,()=>{this.reveal=null;this.render();});
    }
  }
  private chest(kind:ShopKind,x:number){
    const ray=this.add.graphics({x,y:175});
    ray.fillStyle(kind==='skins'?0xdcaaff:0xffdb7b,.22);
    for(let i=0;i<10;i++){const a=i*Math.PI/5,b=a+.19;ray.fillTriangle(0,0,Math.cos(a)*78,Math.sin(a)*78,Math.cos(b)*78,Math.sin(b)*78);}
    this.root.add(ray);this.rays.push(ray);
    const key=artKey(this,kind==='skins'?'chest_skin_base':'chest_fighter_base');
    if(key){const icon=this.add.image(x,175,key);icon.setScale(140/Math.max(icon.width,icon.height));this.root.add(icon);}
    else{const g=this.add.graphics();g.fillStyle(kind==='skins'?0x8256be:0xeebf43).fillRoundedRect(x-57,134,114,77,12);g.lineStyle(5,0x081428).strokeRoundedRect(x-57,134,114,77,12);this.root.add(g);}
    this.hit(x-88,116,176,122,()=>{this.popupKind=kind;this.render();});
    const freeChest=kind==='skins'&&this.state.freeSkinChest===true;
    const pool=chestRewards(this.state,kind),purchased=!freeChest&&this.state.purchasedChests?.includes(kind);
    this.text(x,247,purchased?t('shop.opened_today'):pool.length?t('shop.tap_to_see_rewards'):t('common.collection_complete'),12,purchased?'#91dbb4':'#a8c1d8').setOrigin(.5,0);
    this.text(x,268,t('shop.one_chest_per_day'),10,'#a8c1d8').setOrigin(.5,0);
    const cost=kind==='skins'?shopConfig.skinPullCost:shopConfig.fighterPullCost;
    this.button(x-117,291,234,purchased?t('shop.come_back_tomorrow'):freeChest?t('shop.open_chest_free'):t('shop.open_chest_tokens',{cost}),()=>this.act(buyDailyChest(this.state,kind,Math.random())),!purchased&&pool.length>0&&(freeChest||this.state.tokens>=cost),0,kind==='skins'?'purple':'gold');
  }
  private bubble(kind:ShopKind){
    const shade=this.add.rectangle(422,195,844,390,0x050e1b,.74).setInteractive().on('pointerdown',()=>{this.popupKind=null;this.render();});this.root.add(shade);
    const x=kind==='skins'?270:490,w=324,color=kind==='skins'?0x693da0:0x967022;
    const tail=this.add.graphics().fillStyle(color).fillTriangle(x+140,342,x+168,342,x+154,357);this.root.add(tail);this.panel(x,70,w,277,color);
    this.root.add(this.add.rectangle(x+w/2,208,w,277,0,0).setInteractive());
    this.text(x+15,82,kind==='skins'?t('shop.today_s_skins'):t('shop.today_s_fighter'),16);this.button(x+w-84,79,70,t('shop.close'),()=>{this.popupKind=null;this.render();},true,300,'blue');
    const rewards=chestRewards(this.state,kind),offers=dailyOffers(this.state,kind);
    offers.forEach((item,i)=>{
      const y=kind==='skins'?120+i*62:123;this.panel(x+12,y,w-24,57,0x102034);
      const unique=item.skinType==='unique',key=item.boxer?(unique?artKey(this,item.portraitKey!):skinTexture(this,item.boxer,item.kind==='skins'?item.id:'default',`portrait_${item.boxer}`)):null;
      if(key&&this.textures.exists(key)){const image=this.add.image(x+40,y+53,key).setOrigin(.5,1);image.setScale(Math.min(43/image.width,49/image.height));this.root.add(image);}
      else {const g=this.add.graphics().fillStyle(item.accent,.6).fillCircle(x+40,y+17,8).fillRoundedRect(x+27,y+28,26,23,7);this.root.add(g);}
      this.text(x+70,y+7,itemName(item),11).setWordWrapWidth(225);
      const probability=rewards.find(r=>r.item.id===item.id)?.probability??0;
      this.text(x+70,y+26,`${item.kind==='fighters'?t('shop.fighter'):unique?t('shop.unique'):t('shop.palette_swap')} · ${Math.round(probability*100)}%${this.state.owned.includes(item.id)?t('shop.owned'):''}`,11,'#ffdc72');
    });
    if(!offers.length)this.text(x+162,155,t('common.collection_complete'),14).setOrigin(.5);
    if(kind==='fighters')this.text(x+16,193,t('shop.guaranteed_fighter_of_the_day'),11,'#a8c1d8').setWordWrapWidth(289);
    else this.text(x+16,311,t('shop.equal_odds_across_remaining_rewards'),10,'#a8c1d8');
    if(kind==='fighters')this.text(x+16,273,t('shop.each_chest_can_be_opened'),11,'#a8c1d8');
  }
  private render(){
    this.rays=[];this.root?.destroy(true);const scale=Math.min(VIEW.width/844,VIEW.height/390);this.root=this.add.container(VIEW.cx-422*scale,VIEW.cy-195*scale).setScale(scale).setDepth(100);
    this.text(25,14,t('shop.punchies_shop'),26);this.text(26,46,t('shop.local_preview_daily_chests_reset'),10,'#9fbbd4');
    this.root.add(punchToken(this,650,29,12,100));this.text(673,18,String(this.state.tokens),22);this.button(737,13,83,t('common.back'),()=>startScreen(this,'Menu'),true,0,'blue');
    // Debug builds only (?debug=1): jump to 99 tokens to test the chests.
    if(isDebug())this.button(300,13,100,t('shop.debug_tokens'),()=>{this.state={...this.state,tokens:99};this.persist();this.render();},true,0,'purple');
    [25,291,557].forEach((x,i)=>this.panel(x,72,262,266,[0x236f9a,0x59398b,0x826027][i]));
    this.text(156,89,t('shop.earn_tokens'),19).setOrigin(.5,0);
    this.text(422,89,t('shop.skin_chest'),19,'#d6b4ff').setOrigin(.5,0);this.text(688,89,t('shop.fighter_chest'),19,'#ffdb78').setOrigin(.5,0);
    const rewardKey=artKey(this,'reward_ad_base');
    if(rewardKey){const icon=this.add.image(156,167,rewardKey);icon.setScale(120/Math.max(icon.width,icon.height));this.root.add(icon);}
    else this.root.add(punchToken(this,156,165,38,100));
    this.text(156,217,t('shop.watch_an_ad_get_1'),15,'#ffdc72').setOrigin(.5,0).setAlign('center');
    this.text(156,262,t('shop.rewards_today', { n: this.state.adsToday, max: shopConfig.dailyAdLimit }),11,'#a8c1d8').setOrigin(.5,0);
    if(portal.ads.available&&!this.adSeen){this.adSeen=true;track('rewarded','shop_token','visible');}
    this.button(39,291,234,!portal.ads.available?t('shop.ads_unavailable'):portal.ads.kind==='preview'?t('shop.preview_ad_1_token'):t('shop.watch_ad_1_token'),()=>void this.watchAd(),portal.ads.available&&!this.adBusy&&this.state.adsToday<shopConfig.dailyAdLimit);
    this.chest('skins',422);this.chest('fighters',688);
    this.text(25,346,this.notice,11,'#ffdc8a').setWordWrapWidth(790);
    this.text(25,373,t('shop.purple_one_random_skin_gold'),10,'#91abc3');
    if(this.popupKind)this.bubble(this.popupKind);
  }
}
