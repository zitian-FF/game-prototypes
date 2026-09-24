import type { CSSProperties } from 'react';

// Source pixels and destination border widths are paired so the end caps
// retain their original proportions. Only the stone center is stretched.
export const NINE_SLICE = {
  localNameplate: { cuts: '70 95 fill', widths: '40px 54px' },
  actionSlab: { cuts: '80 80 fill', widths: '44px 44px' },
  landingButton: { cuts: '200 170 fill', widths: '30px 26px' },
  landingSecondary: { cuts: '200 170 fill', widths: '20px 17px' },
  landingTutorial: { cuts: '200 170 fill', widths: '13px 11px' },
  landingInput: { cuts: '200 170 fill', widths: '18px 15px' },
} as const;

export function nineSliceArt(url: string, spec: { cuts: string; widths: string }): CSSProperties {
  return {
    // CSS custom-property URLs are resolved against the stylesheet, not the
    // document. Resolve here so the art works in Vite builds and on itch.io.
    '--nine-slice-art': `url(${new URL(url, document.baseURI).href})`,
    '--nine-slice-cuts': spec.cuts,
    '--nine-slice-widths': spec.widths,
  } as CSSProperties;
}
