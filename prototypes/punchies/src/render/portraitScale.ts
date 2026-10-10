// Presentation proportions reviewed against the visible head, excluding raised
// gloves, ponytails and transparent padding. This never changes combat size.
// All large-portrait screens share these factors and preserve the waist anchor.
const FIGHTER_PORTRAIT_SCALE:Readonly<Record<string,number>>={
 marco:.9,mia:.92,bruno:1.05,tee:.9,tyke:1.05,
 dragon:1.02,longan:.98,captain:1,roxy:.96,nadia:.82,
};
export function portraitScaleFactor(id:string):number{return FIGHTER_PORTRAIT_SCALE[id]??1;}
