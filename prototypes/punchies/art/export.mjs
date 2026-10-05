// Original vector artwork, exported as registered raster frames, never runtime drawings.
// Usage: node prototypes/punchies/art/export.mjs [menu-background.png]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import AdmZip from 'adm-zip';
const out = 'prototypes/punchies/assets-src';
const ink = '#101b32', cream = '#fff1d1', gold = '#ffc84a';
const roster = {
  marco: { color: '#079cf0', alt: '#2ec4d6', skin: '#cb865e', hair: '#252030' },
  mia: { color: '#f33c48', alt: '#f06fae', skin: '#f2bd92', hair: '#ffd34a' },
  bruno: { color: '#3fa34d', alt: '#9be84a', skin: '#dfad84', hair: '#6c4031' },
  dummy: { color: '#b7834a', skin: '#d6ad74', hair: '#604333' },
};
const actions = { idle: 6, walk: 8, jab: 6, cross: 8, hook_l: 8, hook_r: 8, uppercut: 8, guard: 4, perfect_guard: 4, dodge: 6, hit_light: 4, hit_heavy: 6, stunned: 6, exhausted: 6, ko: 8 };
const wrap = (w,h,s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`;
const ellipse = (x,y,rx,ry,c,stroke=ink,sw=3) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" stroke="${stroke}" stroke-width="${sw}"/>`;
const rect = (x,y,w,h,c,r=0,stroke=ink,sw=3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" stroke="${stroke}" stroke-width="${sw}"/>`;
const line = (x,y,a,b,c,w=3) => `<path d="M${x} ${y}L${a} ${b}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const polygon = (pts,c,sw=3) => `<polygon points="${pts}" fill="${c}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const star = (x,y,r,c=gold) => polygon(Array.from({length:10},(_,i)=>{ const a=-Math.PI/2+i*Math.PI/5, q=i%2?r*.43:r; return `${x+Math.cos(a)*q},${y+Math.sin(a)*q}`; }).join(' '),c,2);
async function write(name,w,h,s) { const file=path.join(out,name); fs.mkdirSync(path.dirname(file),{recursive:true}); await sharp(Buffer.from(wrap(w,h,s))).png().toFile(file); }
function glove(x,y,color,side) {
  return `<g transform="translate(${x} ${y})">${rect(-16,-12,12,24,cream,3)}${ellipse(1,0,17,17,color)}${ellipse(-3,side*12,8,6,color)}${ellipse(9,-5,3,7,'#ffffff88','none',0)}${line(-13,-6,-13,6,'#7e8794',2)}</g>`;
}
function fighter(id,color,action,index,count,feetOnly=false,component=null) {
  const c=roster[id], t=count<=1?0:index/(count-1), wave=Math.sin(t*Math.PI*2), attack=['jab','cross','hook_l','hook_r','uppercut'].includes(action);
  const k=action==='ko'?t:0, slump=action==='exhausted'?3:0;
  let left={x:31,y:-28},right={x:23,y:30};
  let twist=0;
  if (attack) {
    const extent=t<.25?-8*t/.25:t<.55?(-8+(t-.25)/.3*68):60*(1-(t-.55)/.45);
    const hand=action==='jab'||action==='hook_l'?'left':'right';
    const side=hand==='left'?-1:1;
    const hook=action.startsWith('hook');
    const a=hook?(-1.2+t*2.4)*side:0;
    const reach=hook?40:action==='uppercut'?30+extent*.83:action==='cross'?30+extent*1.23:extent+30;
    const pt={x:hook?20+Math.cos(a)*reach:reach,y:hook?Math.sin(a)*reach:side*(28*(1-Math.max(0,extent)/60))};
    if(hand==='left') left=pt; else right=pt;
    twist=(hand==='left'?-1:1)*Math.sin(t*Math.PI)*8;
  }
  if(action==='guard'||action==='perfect_guard') { left={x:39,y:-18};right={x:39,y:18}; }
  if(action.startsWith('hit')) {left.x-=Math.sin(t*Math.PI)*15;right.x-=Math.sin(t*Math.PI)*10;twist=wave*7;}
  if(action==='ko') {left={x:24-32*k,y:-28-17*k};right={x:24-32*k,y:28+17*k};}
  const bob=action==='idle'?wave*1.3:action==='walk'?wave*2:action==='stunned'?wave*3:slump;
  const stride=action==='walk'?wave*14:0;
  let s=`<g transform="translate(128 128) rotate(${twist})">`;
  const outer=s;
  if (feetOnly) {
    s+=ellipse(-24+stride,-20,15,9,ink)+ellipse(-17-stride,20,15,9,ink);
    s+=rect(-35,-27,25,20,color,5)+rect(-35,10,25,20,color,5);
    s+=line(-31,-22,-17,-22,cream,3)+line(-31,15,-17,15,cream,3);
    return s+'</g>';
  }
  const armStart=s.length;
  for(const [pt,side] of [[left,-1],[right,1]]) {
    const ex=(pt.x-7)*.55-3,ey=side*27+(pt.y-side*27)*.4;
    s+=`<path d="M-1 ${side*25}Q${ex} ${ey} ${pt.x-12} ${pt.y}" fill="none" stroke="${ink}" stroke-width="16" stroke-linecap="round"/>`;
    s+=`<path d="M-1 ${side*25}Q${ex} ${ey} ${pt.x-12} ${pt.y}" fill="none" stroke="${c.skin}" stroke-width="11" stroke-linecap="round"/>`;
    s+=line(-1,side*25,ex,ey,'#fff1d14d',3);
  }
  const arms=s.slice(armStart),headStart=s.length;
  s+=`<g transform="translate(${-k*12} ${bob})">`;

  // Padded overhead headguard: compact original master silhouette and layered panels.
  s+=ellipse(-3,0,30,31,color,ink,4);
  s+=`<path d="M-27 14Q-22 33 2 31Q24 28 26 13L15 18Q-8 27 -27 14Z" fill="#101b3240"/>`;
  s+=`<path d="M-26 -16Q-12 -34 8 -26Q23 -22 24 -10" fill="none" stroke="#ffffff70" stroke-width="3" stroke-linecap="round"/>`;
  s+=`<path d="M-24 -20Q-34 0 -24 23M-16 -25Q-25 0 -16 26" fill="none" stroke="${ink}" stroke-width="2"/>`;
  s+=ellipse(25,0,5,10,c.skin,ink,2);
  s+=rect(-8,-4,24,8,color,4,ink,2)+line(-5,-1,9,-1,cream,2);
  s+=rect(-32,-6,5,12,gold,2,ink,2);
  if(id==='mia') s+=`<path d="M-33 -3L-49 -4L-49 4L-33 3Z" fill="${gold}" stroke="${ink}" stroke-width="3"/>`+ellipse(-44,0,3,6,gold,ink,1)+ellipse(-50,0,3,5,gold,ink,1);
  if(id==='dummy') s+=line(-12,-12,7,12,'#795b3c',2)+line(-12,12,7,-12,'#795b3c',2);
  s+='</g>';
  const head=s.slice(headStart),handsStart=s.length;
  s+=glove(left.x,left.y,color,1)+glove(right.x,right.y,color,-1);
  const hands=s.slice(handsStart),effectsStart=s.length;
  if(action==='perfect_guard') s+=`<path d="M61 -43Q86 0 61 43" fill="none" stroke="${cream}" stroke-width="5"/>`;
  if(action==='stunned') s+=star(-16,-42,8)+star(12,-49,7)+star(35,-38,8);
  if(action==='dodge') s+=line(-48,-31,-68,-31,'#83ddec',3)+line(-43,0,-65,0,'#83ddec',3)+line(-48,32,-68,32,'#83ddec',3);
  if(component==='head')return outer+head+'</g>';
  if(component==='gloves')return outer+arms+hands+'</g>';
  if(component==='hands')return outer+hands+'</g>';
  if(component==='effects')return outer+s.slice(effectsStart)+'</g>';
  if(component==='torso')return outer+`<g transform="translate(${-k*12} ${bob})">`+
    ellipse(-5,3,23,24,c.skin,ink,3)+`<path d="M-26 -11Q-12 -21 9 -15L13 16Q-2 26 -22 17Z" fill="${color}" stroke="${ink}" stroke-width="3"/>`+
    line(-20,-9,-20,15,cream,3)+'</g></g>';
  return s+'</g>';
}
// Preserve source RGBA values at visible edges rather than rerasterizing them
// separately (which would change overlap anti-aliasing). Only fully opaque
// occluded pixels get hidden underlap. Zero-offset source-over is exact.
async function componentFrames(id,color,action,i,count,bodyFile,prefix,frame) {
  const raw={width:256,height:256,channels:4};
  const body=await sharp(bodyFile).ensureAlpha().raw().toBuffer();
  const names=['torso','gloves','head','effects','hands'];
  const rendered=await Promise.all(names.map(part=>sharp(Buffer.from(wrap(256,256,fighter(id,color,action,i,count,false,part)))).ensureAlpha().raw().toBuffer()));
  const [torsoSvg,glovesSvg,headSvg,effectsSvg,handsSvg]=rendered;
  const parts=Object.fromEntries(names.slice(0,4).map(name=>[name,Buffer.alloc(body.length)]));
  for(let p=0;p<256*256;p++){
    const n=p*4,alpha=body[n+3];if(!alpha)continue;
    const owner=effectsSvg[n+3]?'effects':handsSvg[n+3]?'gloves':headSvg[n+3]?'head':'gloves';
    body.copy(parts[owner],n,n,n+4);
    // A torso exists under the helmet, even though the overhead source hid it.
    // At least 16 source pixels of overlap through the central shoulders gives
    // head offsets room; constrain it to opaque source coverage for exactness.
    if(alpha===255&&owner==='head'&&torsoSvg[n+3])torsoSvg.copy(parts.torso,n,n,n+4);
    if(alpha===255&&owner==='head'&&glovesSvg[n+3])glovesSvg.copy(parts.gloves,n,n,n+4);
  }
  for(const name of names.slice(0,4)){
    const file=path.join(out,`packed/${prefix}_${action}_${name}/${frame}`);fs.mkdirSync(path.dirname(file),{recursive:true});
    await sharp(parts[name],{raw}).png().toFile(file);
  }
}
function portrait(id) {
  const c=roster[id],color=c.color;
  let s=polygon('12,420 26,185 95,154 265,154 334,185 348,420',color,5);
  s+=`<path d="M44 390L53 226Q59 194 104 180L144 226L216 226L256 180Q302 194 309 226L317 390Z" fill="${c.skin}" stroke="${ink}" stroke-width="6"/>`;
  s+=rect(152,140,56,60,c.skin,12)+ellipse(180,109,63,81,c.skin,ink,6);
  s+=`<path d="M219 57Q247 126 210 171L184 183Q228 166 221 83Z" fill="#101b322b"/>`;
  s+=`<path d="M120 84Q108 26 164 22Q216 2 241 54L237 92L214 82L200 56L176 69L151 60L132 90Z" fill="${c.hair}" stroke="${ink}" stroke-width="6"/>`;
  if(id==='mia') s+=`<path d="M232 37Q317 18 304 150L274 126L256 137Q275 69 229 63Z" fill="${gold}" stroke="${ink}" stroke-width="5"/>`;
  if(id==='bruno') s+=`<path d="M132 123L155 148L206 148L230 123L215 168L184 182L147 164Z" fill="${c.hair}"/>`;
  s+=line(141,99,162,102,ink,6)+line(200,102,222,99,ink,6)+ellipse(155,113,4,5,ink)+ellipse(209,113,4,5,ink);
  s+=`<path d="M182 113L178 135L187 137M165 155Q183 162 202 153" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`;
  s+=`<g transform="translate(70 273) rotate(-15) scale(2.5)">${glove(0,0,color,1)}</g><g transform="translate(288 273) rotate(15) scale(2.5)">${glove(0,0,color,-1)}</g>`;
  s+=rect(119,309,122,110,color,10)+rect(121,309,118,20,cream,4)+star(180,370,28);
  return s;
}
for(const [id,c] of Object.entries(roster)) {
  const variants=id==='dummy'?[[id,c.color]]:[[id,c.color],[`${id}_alt`,c.alt]];
  for(const [prefix,color] of variants) for(const [action,count] of Object.entries(actions)) {
    for(let i=0;i<count;i++) {
      const frame=String(i+1).padStart(4,'0')+'.png';
      await write(`packed/${prefix}_${action}/${frame}`,256,256,fighter(id,color,action,i,count));
      await write(`packed/${prefix}_${action}_feet/${frame}`,256,256,fighter(id,color,action,i,count,true));
      await componentFrames(id,color,action,i,count,path.join(out,`packed/${prefix}_${action}/${frame}`),prefix,frame);
    }
  }
  if(id!=='dummy') await write(`loose/portrait_${id}.png`,360,440,portrait(id));
}
// Ring floor has no ropes: existing dynamic corner/post layer sits above it.
let floor=rect(0,0,620,620,'#304665',0,ink,0)+rect(16,16,588,588,'#3d5678',0,ink,0);
floor+=rect(3,3,614,614,'none',0,'#101b32',6)+rect(12,12,596,596,'none',0,'#6e8bac',3);
for(let n=0;n<50;n++) {const x=30+(n*113)%560,y=30+(n*71)%560;floor+=line(x,y,x+18,y+3,'#8197b322',2);}
floor+=`<circle cx="310" cy="310" r="115" fill="none" stroke="#94acc44d" stroke-width="4"/>`;
floor+=line(310,288,310,332,'#94acc44d',4)+line(288,310,332,310,'#94acc44d',4);
await write('loose/ring_floor.png',620,620,floor);
await write('loose/ring_apron.png',652,54,
  rect(2,2,648,48,'#203951',4,ink,4)+rect(4,3,644,8,'#7897b8',2,ink,0)+
  line(6,15,646,15,'#0c1728',3)+line(10,45,642,45,'#3a4f6c',2)+
  rect(24,20,604,16,'#263d5b',3,ink,0)+
  `<text x="326" y="33" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="14" letter-spacing="8" fill="${cream}">PUNCHIES</text>`);

// Quiet three-quarter gym: shared vanishing point, low-contrast floor seams,
// and grounded props at the rear edges, outside ring and thumb-control zones.
let gym=rect(0,0,1688,780,'#17253a',0,ink,0);
gym+=rect(0,0,1688,132,'#132035',0,ink,0)+line(0,132,1688,132,'#28394f',3);
gym+=`<path d="M0 132L1688 132L1688 780L0 780Z" fill="#1c2c42"/>`;
for(const x of [-1700,-900,-250,350,844,1338,1940,2588,3388]) gym+=line(844,70,x,780,'#35475b55',2);
for(const y of [156,199,260,345,458,602,776]) gym+=line(0,y,1688,y,'#35475b44',2);
for(const x of [76,356,1324,1604]) gym+=rect(x,12,8,114,'#23334a',1,ink,0);
const bench=(mirror)=>{
 let b=ellipse(143,229,118,18,'#090f1944','none',0);
 b+=polygon('35,158 247,181 225,201 18,177','#4c4650',4);
 b+=polygon('18,177 225,201 225,211 18,188','#302e3c',3);
 b+=polygon('32,187 45,188 41,222 30,220', '#172337',2)+polygon('209,207 220,208 217,244 207,240','#172337',2);
 b+=line(35,163,235,184,'#70616a',2);
 // Bottle stands vertically; elliptical cap and base share the floor angle.
 b+=rect(177,146,17,39,'#28506b',5,ink,3)+ellipse(185,147,8,3,'#426881',ink,2)+rect(180,139,10,7,'#344b66',2,ink,2);
 b+=line(181,153,181,175,'#698094',2);
 // Folded towel on the bench, rather than a floating frontal object.
 b+=polygon('70,163 120,169 110,190 61,184','#7a8495',3)+line(75,167,67,180,'#a0a8b4',2);
 return mirror?`<g transform="translate(1688 0) scale(-1 1)">${b}</g>`:b;
};
gym+=bench(false)+bench(true);
// A pair of dim wall pads give context without competing with the controls.
gym+=rect(23,24,68,83,'#323548',10,'#0e192a',3)+rect(1597,24,68,83,'#323548',10,'#0e192a',3);
await write('loose/stage_background.png',1688,780,gym);
let ropes=rect(0,0,652,24,'#101b3240',0,ink,0);
for(const y of [4,12,20]) ropes+=line(0,y+2,652,y+2,'#00000066',8)+line(0,y,652,y,ink,7)+line(0,y-1,652,y-1,y===12?cream:'#ed4b59',4)+line(1,y-2,651,y-2,y===12?'#ffffff':'#ff9a9f',1);
for(const x of [163,326,489]) ropes+=rect(x-3,1,6,22,'#fff1d1aa',1,ink,1);
await write('loose/ring_rope.png',652,24,ropes);
await write('loose/ring_post.png',40,40,ellipse(21,29,17,10,'#00000066','none',0)+rect(8,16,24,21,'#8290a4',7,ink,3)+ellipse(19,16,17,14,'#edf3f5',ink,3)+ellipse(14,10,5,4,'#ffffff','none',0)+line(12,29,27,29,'#52657f',3));
await write('loose/ring_turnbuckle.png',44,44,
  rect(12,6,26,32,cream,8,ink,3)+rect(17,9,17,25,'#b1becf',5,ink,0)+
  line(20,10,20,32,'#ffffff',3)+line(8,10,14,12,ink,4)+line(8,33,14,31,ink,4));
await write('loose/ui_button.png',440,72,polygon('10,4 430,4 438,12 438,61 429,68 10,68 2,60 2,12','#253650',4)+line(16,9,421,9,'#4d698d',3)+line(14,64,424,64,'#101b32',4));
await write('loose/ui_panel.png',392,600,rect(3,3,386,594,'#16243bee',16,'#4d698d',5)+line(24,18,368,18,gold,4));
await write('loose/ui_prompt.png',1080,112,rect(3,3,1074,106,'#101b32ed',12,'#ffc84a',4));
await write('loose/ui_result.png',800,360,polygon('45,4 755,4 797,50 797,310 755,356 45,356 3,310 3,50','#101b32ed',6)+line(57,18,744,18,gold,4)+star(74,65,26)+star(726,65,26));
await write('loose/ui_hud.png',520,108,
  rect(4,7,512,99,'#060d1888',16,ink,0)+rect(3,3,514,97,'#16253bee',16,'#354b67',3)+
  rect(7,7,506,89,'none',13,'#7187a23d',2)+line(23,8,497,8,'#9cafc84d',2));
await write('loose/ui_touch.png',128,128,ellipse(64,64,60,60,'#16243bdd','#7fa9c7',4)+ellipse(64,64,53,53,'none','#ffffff25',2));
await write('loose/ui_stick.png',128,128,ellipse(64,64,59,59,'#101b3260','#a5ccdca0',3)+polygon('64,9 57,20 71,20','#a5ccdc',0)+polygon('64,119 57,108 71,108','#a5ccdc',0)+polygon('9,64 20,57 20,71','#a5ccdc',0)+polygon('119,64 108,57 108,71','#a5ccdc',0));
await write('loose/ui_knob.png',88,88,ellipse(44,44,39,39,'#e6e7d3aa','#ffffffa0',4)+ellipse(38,35,23,23,'#ffffff22','none',0));
for(const [name,color,side] of [['icon_jab','#079cf0',1],['icon_cross','#f33c48',-1]]) {
  await write('loose/'+name+'.png',64,64,`<g transform="translate(32 27) rotate(-90)">${glove(0,0,color,side)}</g>`);
}
// Until the menu pass lands, use coherent gym art rather than the retired cinematic image.
fs.copyFileSync(process.argv[2] || path.join(out,'loose/stage_background.png'),path.join(out,'loose/menu_background.png'));
// Optional exact approved logo cutout. Preserve an already exported logo otherwise.
if(process.argv[3]) fs.copyFileSync(process.argv[3],path.join(out,'loose/logo.png'));
// Remove generated non-KO baked bodies now that the layered renderer is merged.
// Source canvases remain registered; only the packer trims their bounds.
for(const key of fs.readdirSync(path.join(out,'packed'))){
  if(/_(feet|torso|gloves|head|effects|ko)$/.test(key))continue;
  const target=path.resolve(out,'packed',key),root=path.resolve(out,'packed')+path.sep;
  if(!target.startsWith(root))throw new Error('Unsafe generated frame path');
  fs.rmSync(target,{recursive:true,force:true});
}
const zip=new AdmZip();zip.addLocalFolder(out);zip.writeZip('punchies_assets.zip');
console.log(`Exported ${Object.keys(roster).length} fighters, fixed 256x256 canvases, ${Object.keys(actions).length} poses and loose presentation assets into ${out}; punchies_assets.zip`);
