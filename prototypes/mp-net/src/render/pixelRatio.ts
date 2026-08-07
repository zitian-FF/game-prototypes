// Phaser 3 dropped the old global `resolution` game-config option, so
// there's no single knob for "render at device pixel density" anymore.
// The equivalent today: size the canvas backing store at devicePixelRatio
// (main.ts, and HostLobbyScene's landscape resize), then zoom every camera
// by the same factor and re-center it on the unchanged logical world so
// existing pixel-coordinate math keeps meaning what it already means (see
// orientation.ts / each scene's create()). Capped at 2x - many phones
// report 3x+, and the extra sharpness above 2x is barely visible while
// adding real fill-rate cost.
export const PIXEL_RATIO = Math.min(Math.ceil(window.devicePixelRatio || 1), 2);
