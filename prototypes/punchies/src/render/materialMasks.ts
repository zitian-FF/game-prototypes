// Authored semantic regions in normalized source coordinates. Colour membership
// is resolved inside these regions, never from a rectangle through the whole portrait.
export type Material = 'kit' | 'glove' | 'hair' | 'skin' | 'trim';
type Polygon = readonly (readonly [number, number])[];
type Regions = Partial<Record<Material, readonly Polygon[]>>;
const box = (x: number, y: number, w: number, h: number): Polygon => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
export const PORTRAIT_MATERIALS: Record<string, Regions> = {
  marco: {
    hair: [[[.45,.16],[.64,.11],[.80,.14],[.95,.23],[.94,.38],[.86,.39],[.83,.31],[.62,.25],[.46,.27]]],
    glove: [box(.06,0,.45,.28),box(.61,.53,.38,.30)],
    kit: [[[.18,.38],[.42,.39],[.65,.53],[.70,.69],[.63,.84],[.71,1],[.12,1],[.17,.74],[.12,.61]]],
    trim: [box(.37,.29,.16,.17)],
  },
  mia: {
    hair: [[[0,.65],[0,.32],[.12,.30],[.17,.22],[.19,.06],[.48,0],[.52,.08],[.46,.20],[.44,.46],[.29,.58],[.15,.65]],
      [[.45,.06],[.70,.05],[.84,.18],[.87,.33],[.78,.38],[.72,.30],[.58,.26],[.50,.31]],
      [[.61,.27],[.80,.27],[.82,.31],[.75,.35],[.70,.36],[.68,.32],[.61,.31]]],
    glove: [box(.55,.39,.36,.25),box(.27,.59,.45,.25)],
    kit: [box(.19,.39,.60,.61),box(.27,.03,.53,.32)],
    trim: [box(.30,.22,.19,.24)],
    skin: [[[.22,.56],[.28,.46],[.39,.41],[.49,.45],[.58,.57],[.49,.68],[.25,.67]]],
  },
  bruno: {
    hair: [box(.32,.08,.36,.16),[[.34,.32],[.44,.31],[.65,.36],[.64,.49],[.57,.55],[.40,.52],[.31,.42]]],
    glove: [box(.72,.27,.26,.24),box(.17,.74,.30,.20)],
    kit: [box(.18,.08,.66,.26),box(.24,.38,.57,.58)],
    skin: [box(0,.20,1,.73)],
    trim: [box(.29,.22,.13,.15)],
  },
  tee: {
    glove: [box(.22,.57,.33,.22),box(.62,.34,.24,.20)],
    kit: [[[.18,.49],[.31,.48],[.39,.39],[.61,.39],[.78,.49],[.90,.47],[1,.61],[.94,1],[.21,1],[.10,.80]]],
    hair: [box(.22,0,.58,.39),[[0,.40],[.18,.32],[.25,.32],[.21,.46],[.08,.68],[.02,.87],[.16,.87],[.15,.98],[0,1]],[[.94,.65],[1,.65],[1,1],[.90,1]]],
  },
  tyke: {
    glove: [box(0,.24,.39,.36),box(.30,.58,.53,.23)],
    kit: [box(.04,.81,.85,.19)],
  },
  dragon: {
    glove: [box(.05,.38,.36,.23),box(.60,.48,.26,.22)],
    kit: [box(.07,.28,.85,.72)],
    hair: [box(.45,0,.40,.16)],
    trim: [[[.01,.33],[.06,.28],[.43,.20],[.48,.23],[.35,.29],[.22,.37],[.11,.41]]],
  },
  longan: {
    glove: [[[.26,.58],[.39,.52],[.57,.46],[.68,.57],[.52,.70],[.34,.73]],box(.70,.37,.22,.31)],
    kit: [box(.16,.87,.69,.13)],
  },
};
export function inPolygon(x: number, y: number, p: Polygon): boolean {
  let inside = false;
  for (let i=0,j=p.length-1;i<p.length;j=i++) {
    const [xi,yi]=p[i], [xj,yj]=p[j];
    if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
export function portraitRegion(char: string, material: Material, x: number, y: number): boolean {
  return PORTRAIT_MATERIALS[char]?.[material]?.some(p=>inPolygon(x,y,p)) ?? false;
}
