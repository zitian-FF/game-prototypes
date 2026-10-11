
import Phaser from 'phaser';
import {LobbyScene} from '../prototypes/punchies/src/scenes/LobbyScene';
import {VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
const calls=[];const original=window.fetch.bind(window);window.fetch=(url,opts)=>{if(String(url).includes('punchies-rating')){calls.push(new URL(String(url)).pathname);document.querySelector('#requests').textContent=JSON.stringify(calls);}return original(url,opts);};
let rated=false;class Lobby extends LobbyScene{create(){super.create({role:'host',rated});}}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'app',width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[Lobby]});
for(const mode of ['casual','ranked'])document.querySelector('#'+mode).onclick=()=>{rated=mode==='ranked';game.scene.getScene('Lobby').scene.restart();};
document.querySelector('#requests').textContent='[]';
