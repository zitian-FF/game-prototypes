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
  return `import en from './en.json';const strings=${JSON.stringify(keys.map(key => locale[key]))};export default Object.fromEntries(Object.keys(en).map((key,index)=>[key,strings[index]]));`;
}
