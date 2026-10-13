import type Phaser from 'phaser';
const KEY='punchies:wave-motion-cel-v1',W=128,H=96;
/** One shared outlined, cel-coloured atlas. Normal blending works in Canvas and WebGL. */
export function waveMotionTexture(scene:Phaser.Scene):string {
 if(scene.textures.exists(KEY))return KEY;
 const texture=scene.textures.createCanvas(KEY,W*6,H)!,ctx=texture.context;
 const path=(draw:()=>void,fill:string,stroke='#101d3b',width=4)=>{ctx.beginPath();draw();ctx.fillStyle=fill;ctx.fill();if(width){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();}};
 for(let frame=0;frame<4;frame++){
  ctx.save();ctx.translate(frame*W,0);const curl=Math.sin(frame*Math.PI/2)*3;
  // Broad advancing crescent with two backward curling ribbon tips.
  path(()=>{ctx.moveTo(105,48);ctx.bezierCurveTo(100,20,74,10,52,22);ctx.bezierCurveTo(37,29,26,21,11,24);ctx.lineTo(31,40+curl);ctx.bezierCurveTo(18,41,12,50,7,54);ctx.bezierCurveTo(27,53,37,65,51,72);ctx.bezierCurveTo(74,85,99,71,105,48);},'#245de0');
  path(()=>{ctx.moveTo(99,48);ctx.bezierCurveTo(92,25,73,20,57,28);ctx.bezierCurveTo(42,37,37,30,27,31);ctx.lineTo(47,45+curl);ctx.lineTo(22,50);ctx.bezierCurveTo(38,55,43,65,61,68);ctx.bezierCurveTo(78,73,94,62,99,48);},'#37c8f5','#0d3679',2);
  path(()=>{ctx.moveTo(92,47);ctx.bezierCurveTo(85,32,73,29,64,32);ctx.bezierCurveTo(78,39,83,46,79,53);ctx.bezierCurveTo(72,62,55,58,48,54);ctx.bezierCurveTo(60,69,84,67,92,47);},'#d8ffff','#136296',1.5);
  path(()=>{ctx.moveTo(72,37);ctx.quadraticCurveTo(88,46,73,55);ctx.quadraticCurveTo(84,44,61,43+curl);ctx.closePath();},'#ffffff','',0);
  path(()=>{ctx.moveTo(36,62);ctx.lineTo(17,66+curl);ctx.lineTo(25,57);ctx.closePath();},'#80edff','#173674',2);
  ctx.restore();texture.add('wave-'+frame,0,frame*W,0,W,H);
 }
 ctx.save();ctx.translate(W*4,0);
 // Startup is a small open crescent around the glove socket, not a screen halo.
 ctx.lineWidth=5;ctx.strokeStyle='#14244b';ctx.beginPath();ctx.arc(64,48,23,-1.4,1.4);ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#75ebff';ctx.stroke();
 path(()=>{ctx.moveTo(67,29);ctx.lineTo(82,48);ctx.lineTo(66,67);ctx.lineTo(74,48);ctx.closePath();},'#e8ffff','#17477d',2);ctx.restore();texture.add('startup',0,W*4,0,W,H);
 ctx.save();ctx.translate(W*5,0);
 for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.save();ctx.translate(64,48);ctx.rotate(a);path(()=>{ctx.moveTo(9,-3);ctx.lineTo(34,-7);ctx.lineTo(25,0);ctx.lineTo(37,7);ctx.lineTo(11,4);ctx.closePath();},i%2?'#e5ffff':'#63dfff','#183866',2);ctx.restore();}
 ctx.restore();texture.add('impact',0,W*5,0,W,H);texture.refresh();return KEY;
}
