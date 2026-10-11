// Keep the public JSON authoring format; pack repetitive labels only in builds.
export function packTuneMetadata(meta: Record<string, { cat: string; desc: string; min: number | null; max: number | null; step: number | null }>): string {
  const cats = [...new Set(Object.values(meta).map(v => v.cat))];
  const descriptions = [...new Set(Object.values(meta).map(v => v.desc))];
  const rows = Object.entries(meta).map(([key, v]) => [key, cats.indexOf(v.cat), descriptions.indexOf(v.desc), v.min, v.max, v.step]);
  return `const cats=${JSON.stringify(cats)},descriptions=${JSON.stringify(descriptions)};export default Object.fromEntries(${JSON.stringify(rows)}.map(([key,cat,desc,min,max,step])=>[key,{cat:cats[cat],desc:descriptions[desc],min,max,step}]));`;
}

export function packLocale(en: Record<string, string>, locale: Record<string, string>): string {
  // Do not pack incomplete tables: their missing keys must still fall back to English.
  const keys = Object.keys(en);
  if (keys.length !== Object.keys(locale).length || keys.some(key => !(key in locale))) return `export default ${JSON.stringify(locale)};`;
  return `import en from './en.json';const strings=${JSON.stringify(keys.map(key => locale[key] === en[key] ? null : locale[key]))};export default Object.fromEntries(Object.keys(en).map((key,index)=>[key,strings[index] ?? en[key]]));`;
}

// Store shared animation prefixes once; reconstruct exact authored frame names.
export function packArtIndex(index: {manifest: unknown[]; groups: unknown; animations: Record<string,{frameCount:number;frames:string[]}>}): string {
 const rows=Object.entries(index.animations).map(([key,v])=>{
  const prefix=v.frames.every(f=>f.startsWith(key+'/'));
  return [key,v.frameCount,prefix?v.frames.map(f=>f.slice(key.length+1)):v.frames,prefix];
 });
 return `Object.assign(${JSON.stringify({manifest:index.manifest,groups:index.groups})},{animations:Object.fromEntries(${JSON.stringify(rows)}.map(([key,frameCount,frames,prefix])=>[key,{frameCount,frames:frames.map(f=>prefix?key+"/"+f:f)}]))})`;
}
