import Phaser from 'phaser';
import {portal} from '../prototypes/punchies/src/portal/select';
import {KEYS} from '../prototypes/punchies/src/portal/keys';
import {SHOP_ITEMS,newShopDraft} from '../prototypes/punchies/src/shop/draft';
import {CHARACTER_IDS} from '../prototypes/punchies/src/sim/character';
import {CharSelectScene} from '../prototypes/punchies/src/scenes/CharSelectScene';
import {CharacterSelectView} from '../prototypes/punchies/src/ui/CharacterSelectView';
import {ArtBootScene} from '../prototypes/punchies/src/render/art';
import {VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
const memory=new Map([[KEYS.shop,JSON.stringify({...newShopDraft(),owned:SHOP_ITEMS.map(i=>i.id),welcomeClaimed:true})]]);
portal.storage={async preload(){},getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,v)},removeItem:k=>{memory.delete(k)}};
let stats:any,frames:number[]=[],last=0,record=false;
const reset=()=>{stats={renderMs:[],builds:0,textRasterMs:0,textRasters:0,canvasReadMs:0,canvasReads:0,tweensAdded:0};frames=[];last=0;};reset();
function patch(target:any,key:string,measure:(ms:number)=>void){const fn=target[key];target[key]=function(...args:any[]){const begin=performance.now();try{return fn.apply(this,args);}finally{if(record)measure(performance.now()-begin)}};}
patch(CharacterSelectView.prototype,'render',ms=>stats.renderMs.push(ms));patch(CharacterSelectView.prototype,'buildPanel',()=>stats.builds++);
patch(Phaser.GameObjects.Text.prototype,'updateText',ms=>{stats.textRasters++;stats.textRasterMs+=ms});
patch(CanvasRenderingContext2D.prototype,'getImageData',ms=>{stats.canvasReads++;stats.canvasReadMs+=ms});
class Boot extends ArtBootScene{create(){super.create();this.scene.launch('CharSelect',{mode:'vsai'});document.querySelector('#status')!.textContent='Ready · mock inventory';}}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'app',backgroundColor:'#101b32',input:{activePointers:4},fps:{forceSetTimeOut:true,target:60},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
game.scene.add('CharSelect',CharSelectScene,false);game.scene.add('ArtBoot',Boot,true);
game.events.once('ready',()=>{game.canvas.tabIndex=0;game.events.removeAllListeners(Phaser.Core.Events.HIDDEN)});window.setInterval(()=>game.loop.resume(),500);
const pause=(ms:number)=>new Promise(r=>window.setTimeout(r,ms));
const quant=(a:number[],p:number)=>{const s=[...a].sort((x,y)=>x-y);return Math.round((s[Math.min(s.length-1,Math.floor(s.length*p))]??0)*100)/100};
const report=(label:string)=>{record=false;const scene:any=game.scene.getScene('CharSelect');document.querySelector('#report')!.textContent=JSON.stringify({label,viewport:[innerWidth,innerHeight],frames:frames.length,frameP50:quant(frames,.5),frameP95:quant(frames,.95),frameMax:Math.max(0,...frames),renderP95:quant(stats.renderMs,.95),renderMax:Math.max(0,...stats.renderMs),...stats,renderMs:undefined,activeTweens:scene.tweens.getTweens().length,textures:Object.keys(game.textures.list).length},null,2)};
const attach=()=>{const scene:any=game.scene.getScene('CharSelect');scene.events.on('preupdate',()=>{if(record){const now=performance.now();if(last)frames.push(now-last);last=now;}});patch(scene.tweens,'add',()=>stats.tweensAdded++);};
window.setTimeout(attach,1800);
document.querySelector<HTMLButtonElement>('#run')!.onclick=async()=>{const scene:any=game.scene.getScene('CharSelect');reset();record=true;for(let cycle=0;cycle<2;cycle++){for(let i=0;i<CHARACTER_IDS.length;i++){scene.tapCard(i);await pause(130);const choices=scene.skinChoices(0);for(let skin=0;skin<choices.length;skin++){scene.cycleSkin(0,1);await pause(130)}}}await pause(600);report('cold + warm actual scene navigation')};
document.querySelector<HTMLButtonElement>('#confirm')!.onclick=async()=>{const scene:any=game.scene.getScene('CharSelect');scene.tapCard(0);await pause(600);reset();record=true;scene.confirm(0);await pause(600);report('confirm/status only')};
