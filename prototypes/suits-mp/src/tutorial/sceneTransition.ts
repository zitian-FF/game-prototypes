import Phaser from 'phaser';
import tune from '../../tune.json';

// Black-out/black-in cut between discrete scripted tutorial scenes
// (suits-mp-tutorial-design.md, Section 1.4) - every scene past this
// task's Scene 1 jumps to its own forced scenario via this same cut, so
// it's built as a general two-step primitive now even though Part 1 only
// exercises it once (the Scene 0 intro -> Scene 1 board reveal). Reuses
// the same native `camera.fadeOut`/`fadeIn` API the real Local Victory
// sequence already uses for its white fade (ui/renderGameView.ts) -
// inherently monotonic/gradual, just black instead of white and with its
// own tune.json timing.
export function cutToBlack(scene: Phaser.Scene, onBlack: () => void): void {
  scene.cameras.main.fadeOut(tune.tutorialTransitionMs, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, onBlack);
}

export function cutFromBlack(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(tune.tutorialTransitionMs, 0, 0, 0);
}
