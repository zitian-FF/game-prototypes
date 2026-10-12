// Tee's monochrome design requires authored material boundaries. White hair,
// exposed skin, signature red tabs and highlights on black leather are not kit.
type P = readonly (readonly [number,number])[];
const box=(x:number,y:number,w:number,h:number):P=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
// 1 black fabric; 2 black glove leather; 4 white jacket fabric; 0 protected.
const portrait:readonly [number,P][]=[
 [1,[[.40,.36],[.61,.37],[.69,.49],[.70,.72],[.61,.70],[.51,.70],[.43,.73],[.38,.65],[.41,.54]]],
 [1,[[.37,.81],[.50,.79],[.70,.86],[.74,1],[.30,1],[.26,.97]]],
 [4,[[.16,.51],[.24,.49],[.34,.52],[.38,.58],[.35,.62],[.29,.59],[.22,.62],[.17,.68],[.17,.74],[.26,.78],[.37,.75],[.43,.73],[.46,.78],[.34,.84],[.20,.90],[.17,.87],[.13,.81],[.12,.76],[.14,.69],[.13,.63]]],
 [4,[[.77,.50],[.79,.55],[.77,.64],[.83,.66],[.88,.61],[.88,.51],[.94,.53],[.99,.61],[.96,.70],[.86,.79],[.79,.77],[.78,.69],[.71,.66],[.70,.62],[.72,.56]]],
 [4,[[.69,.69],[.72,.73],[.75,.79],[.76,.89],[.73,.96],[.69,.91],[.68,.82],[.64,.80],[.64,.76]]],
 [2,[[.29,.59],[.36,.57],[.42,.62],[.43,.66],[.37,.73],[.33,.74],[.30,.72],[.27,.69],[.26,.65]]],
 [2,[[.72,.36],[.77,.34],[.82,.37],[.84,.41],[.86,.47],[.83,.51],[.79,.50],[.76,.46],[.74,.44]]],
];
const portraitSkin:readonly P[]=[
 [[0,.30],[.28,.28],[.24,.42],[.13,.51],[.12,.70],[.14,.80],[.16,.82],[.14,.93],[0,1]],
 [[.24,.44],[.30,.39],[.36,.41],[.43,.47],[.41,.54],[.36,.57],[.33,.51],[.27,.49]],
 [[.47,.44],[.56,.46],[.62,.46],[.69,.50],[.73,.56],[.71,.62],[.66,.54],[.55,.51]],
 [[.43,.71],[.53,.70],[.61,.72],[.64,.78],[.66,.81],[.70,.85],[.59,.83],[.49,.80],[.39,.79]],
 [[.40,.62],[.44,.64],[.44,.67],[.40,.71],[.36,.74],[.34,.73],[.37,.69]],
 [[.70,.39],[.72,.36],[.76,.39],[.78,.43],[.75,.46],[.72,.44]],
 [[.81,.52],[.85,.51],[.89,.56],[.87,.60],[.82,.59]],
 [[.27,.68],[.28,.73],[.32,.73],[.31,.77],[.28,.78],[.24,.76],[.24,.71]],
];
const torsoSkin:readonly P[]=[
 [[.41,.36],[.42,.25],[.50,.16],[.58,.13],[.67,.17],[.75,.25],[.78,.30],[.73,.35],[.63,.38],[.52,.40]],
 [[.41,.62],[.51,.62],[.63,.64],[.74,.69],[.78,.76],[.73,.82],[.61,.86],[.51,.83],[.44,.77]],
 [[.81,.40],[.85,.40],[.81,.49],[.83,.57],[.81,.61],[.76,.57],[.76,.47]],
];
const cache=new Map<string,Uint8Array>();
export function teeMaterialMask(name:string,width:number,height:number):Uint8Array{
 const key=name+':'+width+'x'+height;const old=cache.get(key);if(old)return old;
 const mask=new Uint8Array(width*height);
 const regions:readonly [number,P][]=name.startsWith('portrait_')?portrait:name.endsWith('_torso')?[[1,box(.03,.03,.88,.94)],
 [4,[[.08,.25],[.43,.04],[.56,.10],[.43,.18],[.38,.31],[.43,.40],[.30,.37],[.18,.32]]],
 [4,[[.08,.42],[.20,.39],[.27,.39],[.15,.50],[.10,.51]]],
 [4,[[.08,.51],[.12,.51],[.26,.61],[.29,.64],[.19,.67],[.09,.59]]],
 [4,[[.11,.73],[.29,.65],[.40,.62],[.40,.77],[.48,.91],[.43,.96],[.27,.89],[.17,.79]]],
 [4,box(.34,.40,.09,.22)]]:name.includes('glove')?[[2,box(.03,.02,.80,.95)]]:name.includes('boot')?[[1,box(.02,.12,.95,.76)]]:[];
 // Scanlines avoid per-pixel polygon work on the synchronous recolour path.
 const exclusions=name.startsWith('portrait_')?portraitSkin:name.endsWith('_torso')?torsoSkin:[];
 const authored:readonly [number,P][]=[...regions,...exclusions.map(p=>[0,p] as [number,P])];
 for(const [flag,p] of authored)for(let row=0;row<height;row++){
  const y=(row+.5)/height,cuts:number[]=[];
  for(let i=0,j=p.length-1;i<p.length;j=i++){const [xi,yi]=p[i],[xj,yj]=p[j];if((yi>y)!==(yj>y))cuts.push((xj-xi)*(y-yi)/(yj-yi)+xi);}
  cuts.sort((a,b)=>a-b);for(let i=0;i+1<cuts.length;i+=2)for(let x=Math.max(0,Math.ceil(cuts[i]*width-.5));x<Math.min(width,Math.ceil(cuts[i+1]*width-.5));x++)mask[row*width+x]=flag;
 }
 if(cache.size>=10)cache.delete(cache.keys().next().value!);cache.set(key,mask);return mask;
}
