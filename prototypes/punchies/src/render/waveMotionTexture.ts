import type Phaser from 'phaser';
const KEY='punchies:wave-motion-orb-v2',W=128,H=96;
/** Core fits the radius12 collision envelope; trailing stream is decorative. */
export const WAVE_ART={width:W,height:H,coreX:88,coreY:48,coreRadius:24,tailBack:80} as const;
/** One outlined cel atlas, shared by both renderers. No external glow or particle field. */
export function waveMotionTexture(scene:Phaser.Scene):string {
 if(scene.textures.exists(KEY))return KEY;
 const texture=scene.textures.createCanvas(KEY,W*6,H)!,ctx=texture.context;
 const path=(draw:()=>void,fill:string,stroke='#152746',width=2)=>{ctx.beginPath();draw();ctx.fillStyle=fill;ctx.fill();if(width){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();}};
 const circle=(radius:number,color:string)=>{ctx.beginPath();ctx.arc(88,48,radius,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
 const core=(radius:number,curl:number)=>{
  circle(radius,'#152746');circle(radius-2,'#45d9f7');circle(radius-4,'#f0ffff');
  ctx.save();ctx.beginPath();ctx.arc(88,48,radius-2,0,Math.PI*2);ctx.clip();
  path(()=>{ctx.moveTo(85,24);ctx.bezierCurveTo(69,34,67,52,81,66);ctx.bezierCurveTo(91,76,107,59,104,47);ctx.bezierCurveTo(98,66,78,62,78,49);ctx.bezierCurveTo(74,40,80,31,85,24);},'#2482bc','',0);
  path(()=>{ctx.moveTo(91,29);ctx.bezierCurveTo(109,39,106,59,91,62);ctx.bezierCurveTo(79,64,76,48,85,43);ctx.bezierCurveTo(95,37,101,48,95,53);ctx.bezierCurveTo(98,44,89,42+curl,85,49);ctx.bezierCurveTo(82,56,95,57,98,47);ctx.bezierCurveTo(103,39,97,33,91,29);},'#70edfa','',0);
  path(()=>{ctx.moveTo(92,32);ctx.bezierCurveTo(100,35,104,44,101,50);ctx.bezierCurveTo(102,42,94,39,91,41);ctx.bezierCurveTo(89,38,89,35,92,32);},'#ffffff','',0);
  ctx.restore();
 };
 for(let frame=0;frame<4;frame++){
  ctx.save();ctx.translate(frame*W,0);const curl=Math.sin(frame*Math.PI/2)*2;
  // Compact layered stream behind the round core. Never part of collision.
  path(()=>{ctx.moveTo(71,33);ctx.lineTo(49,31+curl);ctx.lineTo(35,35);ctx.lineTo(40,39);ctx.lineTo(10,42);ctx.lineTo(29,47);ctx.lineTo(14,51);ctx.lineTo(42,54);ctx.lineTo(31,60-curl);ctx.lineTo(60,62);ctx.lineTo(74,57);ctx.closePath();},'#2887bf');
  path(()=>{ctx.moveTo(69,38);ctx.lineTo(49,36+curl);ctx.lineTo(54,41);ctx.lineTo(26,43);ctx.lineTo(52,47);ctx.lineTo(23,49);ctx.lineTo(56,53);ctx.lineTo(42,57);ctx.lineTo(71,57);ctx.closePath();},'#b9faff','',0);
  path(()=>{ctx.moveTo(64,42);ctx.lineTo(42,44);ctx.lineTo(61,48);ctx.lineTo(39,51);ctx.lineTo(70,53);ctx.closePath();},'#ffffff','',0);
  core(24,curl);ctx.restore();texture.add('wave-'+frame,0,frame*W,0,W,H);
 }
 ctx.save();ctx.translate(W*4,0);core(24,0);ctx.restore();texture.add('startup',0,W*4,0,W,H);
 ctx.save();ctx.translate(W*5,0);
 for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.save();ctx.translate(88,48);ctx.rotate(a);path(()=>{ctx.moveTo(8,-3);ctx.lineTo(27,-7);ctx.lineTo(22,0);ctx.lineTo(35,5);ctx.lineTo(11,4);ctx.closePath();},i%2?'#f4ffff':'#67e9fa');ctx.restore();}
 circle(7,'#68eaff');circle(4,'#ffffff');ctx.restore();texture.add('impact',0,W*5,0,W,H);texture.refresh();return KEY;
}
