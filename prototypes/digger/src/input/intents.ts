import Phaser from 'phaser';

export type SelectCallback = (worldX: number, worldY: number) => void;

export function bindSelectIntent(scene: Phaser.Scene, onSelect: SelectCallback): void {
  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    const world = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    onSelect(world.x, world.y);
  });
}

// Vertical-drag intent for panning the scrollable board camera. Reports raw
// screen-space (device-pixel) delta per move; the caller converts to world
// units using its own camera's zoom, since only the caller knows which
// camera the drag should affect.
export type VerticalDragCallback = (deltaY: number) => void;

export function bindVerticalDragIntent(scene: Phaser.Scene, onDrag: VerticalDragCallback): void {
  scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    if (!pointer.isDown) return;
    const deltaY = pointer.y - pointer.prevPosition.y;
    if (deltaY !== 0) onDrag(deltaY);
  });
}
