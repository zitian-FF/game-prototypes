import type Phaser from 'phaser';
import {controlModeSelector} from './controlModeSelector';
import type {ControlMode} from './controlMode';

/** Tutorial scene owns curriculum/reset/progress. This changes no saved preference. */
export function tutorialControlPath(scene:Phaser.Scene,x:number,y:number,initial:ControlMode,onPath:(mode:ControlMode)=>void,depth=130) {
  return controlModeSelector(scene,x,y,240,initial,onPath,depth);
}
