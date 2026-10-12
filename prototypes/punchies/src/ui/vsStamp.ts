import type Phaser from 'phaser';
const KEY='punchies:vs-stamp-v1',RESOLUTION=2;
/** One shared cel-lettered mark: cream/navy face with red-blue extrusion; no panel. */
export function createVsStamp(scene:Phaser.Scene):Phaser.GameObjects.Image {
  if(!scene.textures.exists(KEY)){
    const text=scene.make.text({x:0,y:0,text:'VS',add:false,style:{fontFamily:'Impact, Arial Black, sans-serif',fontSize:'128px',fontStyle:'bold italic',color:'#fff1d4',stroke:'#101b32',strokeThickness:8,padding:{left:14,right:34,top:12,bottom:12},resolution:RESOLUTION}});
    const canvas=text.canvas,w=canvas.width+16,h=canvas.height+16;
    const atlas=scene.textures.createCanvas(KEY,w,h)!,ctx=atlas.context;
    ctx.drawImage(canvas,12,14);ctx.globalCompositeOperation='source-in';
    const edge=ctx.createLinearGradient(0,0,w,0);edge.addColorStop(0,'#24b9f0');edge.addColorStop(.48,'#249edf');edge.addColorStop(.52,'#ef3c5a');edge.addColorStop(1,'#c62747');
    ctx.fillStyle=edge;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';ctx.drawImage(canvas,0,0);
    atlas.refresh();text.destroy();
  }
  return scene.add.image(0,0,KEY).setScale(1/RESOLUTION).setOrigin(.5);
}
interface StampTiming {portraitSlideMs:number;impactMs:number;showcaseMs:number;vsExitMs:number;vibrateMs:number;vibratePixels:number;vsExitScale:number}
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
/** Pure absolute simulation-time presentation; it never changes the combat timeline. */
export function vsStampFrame(ms:number,cfg:StampTiming,motion:boolean){
  const stamp=clamp((ms-cfg.portraitSlideMs)/Math.max(1,cfg.impactMs));
  const stampEnd=cfg.portraitSlideMs+cfg.impactMs,exitStart=cfg.showcaseMs-cfg.vsExitMs;
  const approach=clamp((ms-stampEnd)/Math.max(1,exitStart-stampEnd)),exit=clamp((ms-exitStart)/Math.max(1,cfg.vsExitMs));
  const opacity=1-(exit<.5?4*exit*exit*exit:1-Math.pow(-2*exit+2,3)/2);
  const scale=motion?1+.8*Math.pow(1-stamp,3)+.65*approach*approach+Math.min(6,cfg.vsExitScale)*exit*exit:1+.08*Math.pow(1-stamp,3);
  const jitter=motion&&stamp===1?Math.min(2,cfg.vibratePixels)*(.3+.7*approach)*(1-exit):0;
  return {visible:ms>cfg.portraitSlideMs&&ms<cfg.showcaseMs,complete:ms>=cfg.showcaseMs,opacity,scale,
    x:jitter===0?0:Math.sin(ms/Math.max(1,cfg.vibrateMs))*jitter,y:jitter===0?0:Math.cos(ms/Math.max(1,cfg.vibrateMs)*1.23)*jitter*.5};
}
