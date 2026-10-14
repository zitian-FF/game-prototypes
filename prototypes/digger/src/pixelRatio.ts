// The canvas backing store is logical size x this ratio, and every camera is
// zoomed by it, so layout math stays in the unchanged 390x844 logical space.
// Capped at 2: higher ratios add fill cost for sharpness that is barely visible.
export const PIXEL_RATIO = Math.min(Math.ceil(window.devicePixelRatio || 1), 2);
export const WIDTH = 390;
export const HEIGHT = 844;
