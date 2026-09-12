import Phaser from 'phaser';

// Real-device-testable diagnostic for the Powered idle shimmer
// (addPoweredIdleShimmer in ui/cardArt.ts). The shimmer is a WebGL-only,
// BitmapMask-based effect that a tester has no way to introspect from a
// real phone's devtools-less browser - this gives ?debug=1 a read-only
// window into exactly the two facts that decide whether it can be visible
// at all, without needing to eyeball the card itself:
//
//   1. rendererType - set once, right after Phaser.Game boots, from the
//      real `game.renderer.type` the AUTO config actually resolved to.
//      addPoweredIdleShimmer hard-no-ops under Canvas (BitmapMask is
//      WebGL-only) - if this reads "CANVAS", that alone is the whole
//      explanation and no tuning change anywhere will help.
//   2. attachCount / lastTweenX - updated by addPoweredIdleShimmer itself
//      every time it actually runs and while its tween ticks, so a tester
//      can watch a Powered card during a real trick and confirm the effect
//      is genuinely present and animating, not just reachable in theory.
export const shimmerDiagnostics = {
  rendererType: 'not yet booted',
  attachCount: 0,
  lastTweenX: 0,
};

const RENDERER_TYPE_NAMES: Partial<Record<number, string>> = {
  [Phaser.CANVAS]: 'CANVAS (shimmer disabled - see cardArt.ts guard)',
  [Phaser.WEBGL]: 'WEBGL',
  [Phaser.HEADLESS]: 'HEADLESS (shimmer disabled)',
};

export function recordRendererType(type: number): void {
  shimmerDiagnostics.rendererType = RENDERER_TYPE_NAMES[type] ?? `unknown (${type})`;
}

export function recordShimmerAttached(): void {
  shimmerDiagnostics.attachCount += 1;
}

export function recordShimmerTweenTick(x: number): void {
  shimmerDiagnostics.lastTweenX = Math.round(x);
}
