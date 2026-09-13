import Phaser from 'phaser';
import tune from '../../tune.json';

// Tutorial-only guide pointer: a bouncing arrow indicating the one
// tappable target at a guided moment (suits-mp-tutorial-design.md,
// Section 2). Placeholder art per the project's placeholder-first
// convention - a plain procedural triangle, explicitly meant to be
// replaced with real art later. Positioned by the caller (see
// ui/renderGameView.ts's tutorial-pointer render step, which resolves a
// GuidePointerTarget to an (x, y) and calls this) - this module only
// knows how to draw and animate the shape itself, not how to find any
// particular target's position, so it stays reusable across every target
// kind the design doc lists (hand card, seat nameplate, confirm button).
//
// Rebuilt on every render, same as every other canvas element in this
// file's rendering model (renderWithView's own container.removeAll(true)
// at the top of each pass) - no persistent handle is kept or needed.
export function drawGuidePointer(scene: Phaser.Scene, container: Phaser.GameObjects.Container, targetX: number, targetY: number): void {
  const size = tune.tutorialPointerSize;
  const restY = targetY - tune.tutorialPointerGap;

  const g = scene.add.graphics();
  g.fillStyle(tune.tutorialPointerColor, 1);
  // A downward-pointing triangle, centered on (0, 0) in its own local
  // space - the container below positions/animates the whole shape, so
  // this never has to account for targetX/targetY itself.
  g.fillTriangle(-size * 0.6, -size * 0.6, size * 0.6, -size * 0.6, 0, size * 0.6);
  g.lineStyle(Math.max(1, size * 0.08), 0x000000, 0.35);
  g.strokeTriangle(-size * 0.6, -size * 0.6, size * 0.6, -size * 0.6, 0, size * 0.6);

  const pointer = scene.add.container(targetX, restY, [g]);
  container.add(pointer);

  scene.tweens.add({
    targets: pointer,
    y: restY - tune.tutorialPointerBounceDistance,
    duration: tune.tutorialPointerBounceMs,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}
