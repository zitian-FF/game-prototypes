import {PALETTES} from './paletteCatalog';

/** Cosmetic silhouette only: no fighter dimensions, reach or collision changes. */
export function cosmeticTorsoScale(char:string,skin='default'):number {
  // Nadia's full-height128px torso otherwise renders40px vs Mia's113/128 visible35.31px.
  // Target31.6px follows her .82/.92 petite portrait/head comparison; shoulder roots
  // at±13.5 remain inside the skin shoulder caps. Shared by every palette.
  if(char==='nadia')return .79;
  const marcoSkin=skin==='skin-marco-unique'||skin==='skin-marco-mcclassic'||PALETTES[skin]?.boxer==='marco';
  return char==='marco'&&marcoSkin?0.88:1;
}

/** Narrow torso needs its arm roots inside the authored shoulder caps; fists/reach stay fixed. */
export function cosmeticShoulderScale(char:string,skin='default'):number {return char==='nadia'?cosmeticTorsoScale(char,skin):1;}
