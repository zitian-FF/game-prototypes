export function shade(color: number, f: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((color & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => {
    const av = (a >> s) & 255;
    const bv = (b >> s) & 255;
    return Math.round(av + (bv - av) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
