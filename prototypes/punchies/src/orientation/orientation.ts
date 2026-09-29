import type Phaser from 'phaser';

// Always present the game in landscape on touch devices.
// 1. On the first tap, ask the browser to lock to landscape (works on
//    Android Chrome while fullscreen, e.g. itch.io's fullscreen button).
// 2. If the phone is still held in portrait (lock refused, or iOS), rotate
//    the game container 90deg with CSS and remap touch coordinates, since
//    Phaser's own input mapping assumes an unrotated canvas.

// Phaser internals we patch; not part of the public typings.
interface ScaleInternals {
  parentSize: { width: number; height: number; setSize(w: number, h: number): void };
  displaySize: { width: number; height: number };
  getParentBounds(): boolean;
  updateCenter(): void;
  refresh(): void;
}
interface InputInternals {
  transformPointer(pointer: Phaser.Input.Pointer, pageX: number, pageY: number, wasMove: boolean): void;
}

export function setupOrientation(game: Phaser.Game): void {
  const app = document.getElementById('app');
  if (!app) return;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  let rotated = false;

  const scale = game.scale as unknown as ScaleInternals;
  const input = game.input as unknown as InputInternals;

  const apply = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    rotated = isTouch && h > w;
    if (rotated) {
      app.style.width = `${h}px`;
      app.style.height = `${w}px`;
      app.style.transformOrigin = '0 0';
      app.style.transform = `translateX(${w}px) rotate(90deg)`;
    } else {
      app.style.width = '';
      app.style.height = '';
      app.style.transform = '';
    }
    scale.refresh();
  };

  // Phaser sizes to the parent's getBoundingClientRect(), which reports the
  // rotated (portrait) box. Use the unrotated layout size instead.
  const origBounds = scale.getParentBounds.bind(scale);
  scale.getParentBounds = () => {
    if (!rotated) return origBounds();
    const w = app.offsetWidth;
    const h = app.offsetHeight;
    if (scale.parentSize.width === w && scale.parentSize.height === h) return false;
    scale.parentSize.setSize(w, h);
    return true;
  };

  // Phaser also centers using the canvas's on-screen (rotated) box, which
  // swaps width and height. Recompute the margins from layout sizes.
  const origCenter = scale.updateCenter.bind(scale);
  scale.updateCenter = () => {
    origCenter();
    if (!rotated || !game.canvas) return;
    const style = game.canvas.style;
    style.marginLeft = `${Math.floor((app.offsetWidth - scale.displaySize.width) / 2)}px`;
    style.marginTop = `${Math.floor((app.offsetHeight - scale.displaySize.height) / 2)}px`;
  };

  // Map page coordinates back through the 90deg rotation into canvas space.
  const origTransform = input.transformPointer.bind(input);
  input.transformPointer = (pointer, pageX, pageY, wasMove) => {
    if (!rotated) {
      origTransform(pointer, pageX, pageY, wasMove);
      return;
    }
    const localX = pageY - window.scrollY;
    const localY = window.innerWidth - (pageX - window.scrollX);
    const canvas = game.canvas;
    pointer.prevPosition.x = pointer.position.x;
    pointer.prevPosition.y = pointer.position.y;
    // displayScale is also derived from the rotated box; use layout sizes.
    pointer.position.x = (localX - canvas.offsetLeft) * (canvas.width / scale.displaySize.width);
    pointer.position.y = (localY - canvas.offsetTop) * (canvas.height / scale.displaySize.height);
  };

  const tryLock = () => {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    orientation.lock?.('landscape').catch(() => {});
  };
  if (isTouch) window.addEventListener('pointerdown', tryLock, { once: true });

  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 250));
  apply();
  // Phaser's scale manager re-measures during boot; apply again once ready.
  game.events.once('ready', apply);
}
