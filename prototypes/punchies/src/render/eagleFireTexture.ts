import type Phaser from 'phaser';
const KEY='punchies:eagle-fire-cel-v1',W=96,H=64;
export const EAGLE_ART={width:W,height:H,gloveX:72,gloveY:32} as const;
/** Shared short flame curls, charge arcs and impact shards. No bloom/fullscreen pass. */
export function eagleFireTexture(scene:Phaser.Scene):string {
 if(scene.textures.exists(KEY))return KEY;const texture=scene.textures.createCanvas(KEY,W*7,H)!,ctx=texture.context;
 const path=(draw:()=>void,color:string,outline='#182039',line=2)=>{ctx.beginPath();draw();ctx.fillStyle=color;ctx.fill();if(line){ctx.strokeStyle=outline;ctx.lineWidth=line;ctx.lineJoin='round';ctx.stroke();}};
 for(let frame=0;frame<4;frame++){ctx.save();ctx.translate(frame*W,0);const curl=Math.sin(frame*Math.PI/2)*3;
  path(()=>{ctx.moveTo(86,32);ctx.bezierCurveTo(89,16,74,8,62,17);ctx.lineTo(37,11+curl);ctx.lineTo(46,24);ctx.bezierCurveTo(30,25,21,15,8,22);ctx.lineTo(26,32);ctx.lineTo(12,46);ctx.bezierCurveTo(33,41,39,55,56,48);ctx.bezierCurveTo(72,57,90,47,86,32);},'#ef4b23');
  path(()=>{ctx.moveTo(81,32);ctx.bezierCurveTo(79,17,65,17,63,25);ctx.lineTo(44,21+curl);ctx.lineTo(55,32);ctx.lineTo(25,29);ctx.bezierCurveTo(43,38,45,46,64,41);ctx.bezierCurveTo(77,49,86,39,81,32);},'#ffb82f','#983724',1);
  path(()=>{ctx.moveTo(76,25);ctx.bezierCurveTo(64,23,62,34,69,39);ctx.bezierCurveTo(61,38,57,33,49,35);ctx.bezierCurveTo(57,42,72,45,78,36);ctx.bezierCurveTo(83,30,79,28,76,25);},'#fff1b8','',0);
  ctx.restore();texture.add('fire-'+frame,0,frame*W,0,W,H);
 }
 ctx.save();ctx.translate(W*4,0);for(const [r,color,line] of [[16,'#19233b',4],[16,'#ffc74b',2],[11,'#fff1b8',2]] as const){ctx.strokeStyle=color;ctx.lineWidth=line;ctx.beginPath();ctx.arc(72,32,r,-1.25,1.25);ctx.stroke();}
 path(()=>{ctx.moveTo(58,19);ctx.lineTo(64,25);ctx.lineTo(59,29);ctx.lineTo(54,24);ctx.closePath();},'#ffb82f');ctx.restore();texture.add('charge',0,W*4,0,W,H);
 ctx.save();ctx.translate(W*5,0);for(let i=0;i<6;i++){ctx.save();ctx.translate(48,32);ctx.rotate(i*Math.PI/3);path(()=>{ctx.moveTo(7,-3);ctx.lineTo(21,-5);ctx.lineTo(17,1);ctx.lineTo(27,5);ctx.lineTo(9,4);ctx.closePath();},i%2?'#fff2c2':'#ffb632');ctx.restore();}ctx.restore();texture.add('impact',0,W*5,0,W,H);
 ctx.save();ctx.translate(W*6,0);path(()=>{ctx.moveTo(94,32);ctx.lineTo(76,16);ctx.lineTo(66,24);ctx.lineTo(43,16);ctx.lineTo(50,30);ctx.lineTo(7,24);ctx.lineTo(27,33);ctx.lineTo(10,42);ctx.lineTo(49,39);ctx.lineTo(42,49);ctx.lineTo(73,42);ctx.closePath();},'#ee4d22');path(()=>{ctx.moveTo(87,32);ctx.lineTo(73,26);ctx.lineTo(48,23);ctx.lineTo(57,31);ctx.lineTo(28,32);ctx.lineTo(60,40);ctx.lineTo(76,37);ctx.closePath();},'#ffd456','',0);ctx.restore();texture.add('trail',0,W*6,0,W,H);
 texture.refresh();return KEY;
}
