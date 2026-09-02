import Phaser from 'phaser';
import { createRoot } from 'react-dom/client';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { DomRoot } from './DomRoot';
import './modalChrome.css';

// Same 390x844 logical box every scene lays out in - see main.ts.
const WIDTH = 390;
const HEIGHT = 844;

// Mounts suits-mp's React DOM overlay layer into Phaser's own DOM container
// (game config `dom.createContainer: true`), which Phaser already keeps
// sized/positioned/scaled to track the canvas through Scale.FIT and window
// resizes - reimplementing that tracking here would just duplicate it.
//
// One wrinkle: Phaser sizes that container in *device* pixels
// (WIDTH*PIXEL_RATIO x HEIGHT*PIXEL_RATIO, to match the high-DPI canvas
// backing store - see render/pixelRatio.ts), not the 390x844 logical
// coordinate space every scene/mockup is authored in. The inner wrapper
// below is sized at the logical 390x844 and scaled up by PIXEL_RATIO
// (transform-origin top left) to fill that space exactly - the DOM
// equivalent of every scene's `camera.setZoom(PIXEL_RATIO)`, so components
// mounted inside it (e.g. RulesModal) can use the design's own pixel
// coordinates unchanged.
export function mountDom(game: Phaser.Game): void {
  const container = game.domContainer;
  if (!container) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    `width: ${WIDTH}px`,
    `height: ${HEIGHT}px`,
    'transform-origin: top left',
    `transform: scale(${PIXEL_RATIO})`,
    'position: relative',
    'z-index: 1000',
    'pointer-events: none',
  ].join('; ');
  container.appendChild(wrapper);

  const root = createRoot(wrapper);
  root.render(<DomRoot />);
}
