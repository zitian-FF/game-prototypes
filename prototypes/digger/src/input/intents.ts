import Phaser from 'phaser';

export type SelectCallback = (worldX: number, worldY: number) => void;

export function bindSelectIntent(scene: Phaser.Scene, onSelect: SelectCallback): void {
  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    const world = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    onSelect(world.x, world.y);
  });
}
