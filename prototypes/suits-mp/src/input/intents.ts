import Phaser from 'phaser';

// Minimal intent layer: game logic never reads a pointer/touch event
// directly. This prototype's placeholder text-dump UI is built entirely
// out of tappable rows/buttons, so the only intent it needs is "select a
// target" - not shared code with mp-net/suits (see root CLAUDE.md).
export function bindTapIntent(zone: Phaser.GameObjects.GameObject, onTap: () => void): void {
  zone.on('pointerdown', onTap);
}
