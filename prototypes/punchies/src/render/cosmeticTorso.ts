import {PALETTES} from './paletteCatalog';

/** Cosmetic silhouette only: no fighter dimensions, reach or collision changes. */
export function cosmeticTorsoScale(char:string,skin='default'):number {
  const marcoSkin=skin==='skin-marco-unique'||skin==='skin-marco-mcclassic'||PALETTES[skin]?.boxer==='marco';
  return char==='marco'&&marcoSkin?0.88:1;
}
