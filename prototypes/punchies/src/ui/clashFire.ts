import type Phaser from 'phaser';

// One scene-owned Graphics object, no emitters, textures or per-flame tweens.
// The stepped contours deliberately read like the roster's inked cartoon art.
export function drawClashFire(g: Phaser.GameObjects.Graphics, x: number, y: number,
  ms: number, scale: number, motion: boolean, reveal = 1): void {
  g.clear();
  if (reveal <= 0) return;
  const phase = motion ? ms * .006 : 0;
  const paint = (points: number[][], color: number, outline = false, alpha = 1) => {
    // Round the shoulders with short quadratic joins, retaining pointed tips.
    const p: {x:number;y:number}[] = [];
    points.forEach(([dx,dy],i)=>{
      const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
      const a=[dx+(prev[0]-dx)*.22,dy+(prev[1]-dy)*.22];
      const b=[dx+(next[0]-dx)*.22,dy+(next[1]-dy)*.22];
      for(let j=0;j<=4;j++){
        const t=j/4,u=1-t;
        p.push({x:x+(u*u*a[0]+2*u*t*dx+t*t*b[0])*scale,
          y:y+(u*u*a[1]+2*u*t*dy+t*t*b[1])*scale});
      }
    });
    g.fillStyle(color, alpha * reveal).fillPoints(p, true);
    if (outline) g.lineStyle(3 * scale, 0x562331, alpha * reveal).strokePoints(p, true);
  };
  // A continuous bed connects the tongues; no picket-fence gaps at their roots.
  paint([[-107,40],[-92,12],[-67,19],[-43,-3],[-13,8],[20,-6],[49,14],
    [79,4],[111,35],[86,57],[-76,57]], 0xd92c2c, true);
  const heights = [75,112,91,151,123,164,102];
  for (let i = 0; i < heights.length; i++) {
    const root = (i - 3) * 27;
    const sway = Math.sin(phase + i * 1.7) * 9;
    const h = heights[i] + Math.sin(phase * 1.3 + i * 2.1) * 8;
    const curl = (i % 2 ? -1 : 1) * (15 + Math.cos(phase + i) * 5);
    // Broad base, scooped shoulder and hooked tip. Each nested contour is authored
    // separately so the cream core does not simply duplicate the outer silhouette.
    paint([[root-24,40],[root-30,14],[root-24,-h*.25],[root-10,-h*.48],
      [root-8+sway,-h*.72],[root+curl+sway,-h],
      [root+curl+sway+3,-h*.77],[root+4+sway,-h*.57],
      [root+20,-h*.39],[root+15,-h*.16],[root+27,16],[root+21,43]],0xf04a23,true);
    paint([[root-16,36],[root-21,8],[root-14,-h*.26],[root+2+sway,-h*.55],
      [root+curl*.6+sway,-h*.83],[root+13+sway,-h*.58],
      [root+9,-h*.32],[root+19,-h*.09],[root+13,37]],0xff9b25);
    paint([[root-8,34],[root-12,12],[root-5,-h*.14],[root+7,-h*.38],
      [root+5,-h*.12],[root+12,10],[root+7,36]],0xffdc59);
    paint([[root-4,32],[root-6,17],[root+2,-h*.13],[root+7,17],[root+4,33]],0xfff2bd);
  }
  // Twelve bounded teardrop embers: curved drift, shrink and fade as they rise.
  for (let i = 0; i < 12; i++) {
    const life = motion ? ((ms * .00065 + i / 12) % 1) : i / 12;
    const dx = Math.sin(i * 2.4) * 98 + Math.sin(phase*.5+i)*life*17;
    const dy = 18 - life * (135 + i%3 * 20);
    const r = (3 + i%3) * (1-life*.65);
    paint([[dx-r,dy+r],[dx-r*.5,dy-r],[dx+r,dy-r*2.5],
      [dx+r*.7,dy+r*.4],[dx,dy+r*1.4]],i%2?0xffd65b:0xff8b27,true,1-life);
  }
}
