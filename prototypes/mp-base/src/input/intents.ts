import Phaser from 'phaser';

// Minimal intent layer: game logic never reads a pointer/touch event
// directly. This prototype's only gameplay intent is "primary" (the one big
// button); mirrors digger/suits's bindSelectIntent pattern for the same
// house rule, not shared code with them (see root CLAUDE.md).
export interface PrimaryIntentHandlers {
  onDown: () => void;
  onUp: () => void;
}

export function bindPrimaryIntent(
  scene: Phaser.Scene,
  zone: Phaser.GameObjects.GameObject,
  handlers: PrimaryIntentHandlers,
): void {
  zone.on('pointerdown', handlers.onDown);
  zone.on('pointerup', handlers.onUp);
  zone.on('pointerout', handlers.onUp);
  // Catches the case where a touch drags off the button before release,
  // which pointerout on the zone alone can miss on some mobile browsers.
  scene.input.on('pointerup', handlers.onUp);
}
