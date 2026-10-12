import type Phaser from 'phaser';
import {DEBUG_TOOLS_BUILD} from '../buildFlags';
import {GAME_SAVE_KEYS} from '../portal/keys';
import {store} from '../portal/store';
import {CHARACTER_IDS,isCharId,type CharId} from '../sim/character';
import {SHOP_ITEMS} from '../shop/draft';
import type {FolderApi} from 'tweakpane';

/** Transient QA selection: never writes ownership, currency or character preferences. */
export function qaTrainingPick(data:{qaPreview?:boolean;char?:unknown;skin?:unknown}):{char:CharId;skin:string}|null {
 if(!DEBUG_TOOLS_BUILD||data.qaPreview!==true||!isCharId(data.char))return null;
 const char=data.char,skin=typeof data.skin==='string'?data.skin:'default';
 if(skin!=='default'&&!SHOP_ITEMS.some(item=>item.kind==='skins'&&item.boxer===char&&item.id===skin))return null;
 return {char,skin};
}
export function resetStageTestData():void {
 if(!DEBUG_TOOLS_BUILD||GAME_SAVE_KEYS.some(key=>!key.startsWith('punchies:staging:')))throw Error('Stage-only reset refused');
 for(const key of GAME_SAVE_KEYS)store.removeItem(key);
 if(GAME_SAVE_KEYS.some(key=>store.getItem(key)!==null))throw Error('Stage reset could not remove every test save');
}
export function mountStageReviewControls(folder:FolderApi,game:Phaser.Game):void {
 const pick={fighter:'tee',skin:'default'};
 const fighterBinding=folder.addBinding(pick,'fighter',{options:Object.fromEntries(CHARACTER_IDS.map(id=>[id,id]))});
 let skinBinding:ReturnType<FolderApi['addBinding']>;
 const refreshSkins=()=>{skinBinding?.dispose();pick.skin='default';skinBinding=folder.addBinding(pick,'skin',{options:{Default:'default',...Object.fromEntries(SHOP_ITEMS.filter(item=>item.kind==='skins'&&item.boxer===pick.fighter).map(item=>[item.id,item.id]))}});};
 refreshSkins();
 fighterBinding.on('change',refreshSkins);
 folder.addButton({title:'Preview in Training (no unlocks)'}).on('click',()=>{
  if(!game.scene.isActive('Menu')&&!game.scene.isActive('Training'))return;
  for(const scene of game.scene.getScenes(true))if(scene.scene.key!=='ArtBoot')scene.scene.stop();
  game.scene.start('Training',{...pick,char:pick.fighter,qaPreview:true});
 });
 folder.addButton({title:'Reset staging test saves'}).on('click',()=>{resetStageTestData();location.reload();});
}
