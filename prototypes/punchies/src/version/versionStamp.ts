import Phaser from 'phaser';
import {STAGING_BUILD,SOURCE_SHA} from '../buildFlags';
import { VERSION_STAMP } from '../version.generated';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';

// Tiny, low-contrast, top-left version stamp (DDMMYYrXXXX). See "Version
// stamping" in root CLAUDE.md.
export function addVersionStamp(scene: Phaser.Scene): void {
  scene.add
    .text(VIEW.left + 6, VIEW.top + 4, STAGING_BUILD?`STAGE ${SOURCE_SHA.slice(0,8)} · ${VERSION_STAMP}`:VERSION_STAMP, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#555555',
      resolution: PIXEL_RATIO,
    })
    .setDepth(9999);
}
