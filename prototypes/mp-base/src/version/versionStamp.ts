import Phaser from 'phaser';
import { VERSION_STAMP } from '../version.generated';

// Tiny, low-contrast, top-left version stamp (DDMMYYrXXXX). See "Version
// stamping" in root CLAUDE.md.
export function addVersionStamp(scene: Phaser.Scene): void {
  scene.add
    .text(6, 4, VERSION_STAMP, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#555555',
    })
    .setDepth(9999)
    .setScrollFactor(0);
}
