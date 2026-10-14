import type Phaser from 'phaser';
// Head landmarks measured on existing source portraits. Include helmet/visor,
// hair silhouette and Bruno's beard; independent of large-card waist framing.
const HEADS:Readonly<Record<string,{cx:number;cy:number;height:number}>>={
 marco:{cx:.65,cy:.365,height:.47},mia:{cx:.61,cy:.28,height:.51},bruno:{cx:.48,cy:.33,height:.53},
 tee:{cx:.62,cy:.25,height:.50},tyke:{cx:.45,cy:.24,height:.44},dragon:{cx:.66,cy:.23,height:.42},
 longan:{cx:.57,cy:.23,height:.44},captain:{cx:.57,cy:.23,height:.40},roxy:{cx:.49,cy:.25,height:.47},nadia:{cx:.53,cy:.24,height:.46},
 marco_mcclassic:{cx:.53,cy:.25,height:.46},marco_rising_star:{cx:.51,cy:.26,height:.43},mia_flaming_kunoichi:{cx:.56,cy:.26,height:.48},
};
export function headshotCrop(id:string,width:number,height:number,texture='',aspect=43/27):{x:number;y:number;width:number;height:number} {
 const variant=Object.keys(HEADS).find(k=>k!==id&&k.startsWith(id+'_')&&texture.includes('portrait_'+k)),head=HEADS[variant??id]??{cx:.5,cy:.25,height:.45};
 const sourceHeight=texture.includes('mia_flaming_kunoichi:waist')?height/.75:height;
 const cropHeight=Math.min(height,width/aspect,sourceHeight*head.height),cropWidth=cropHeight*aspect;
 return {x:Math.max(0,Math.min(width-Math.round(cropWidth),Math.round(width*head.cx-cropWidth/2))),y:Math.max(0,Math.min(height-Math.round(cropHeight),Math.round(sourceHeight*head.cy-cropHeight/2))),width:Math.round(cropWidth),height:Math.round(cropHeight)};
}
export function rosterHeadFrame(scene:Phaser.Scene,key:string,id:string,aspect=43/27):string {
 const texture=scene.textures.get(key),name='roster-headshot:'+id+(aspect===43/27?'':':'+aspect.toFixed(4));
 if(!texture.has(name)){const source=texture.getSourceImage(),c=headshotCrop(id,source.width,source.height,key,aspect),initial=texture.firstFrame;texture.add(name,0,c.x,c.y,c.width,c.height);texture.firstFrame=initial;}
 return name;
}
