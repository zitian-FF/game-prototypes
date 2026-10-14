import type Phaser from 'phaser';
import {VIEW} from '../../render/pixelRatio';
import {betaView} from '../../progress/beta';
import {t} from '../../i18n';
import {profileText} from './text';
/** Ledger is owned by the match scene. This is presentation only. */
export function resultProgress(scene:Phaser.Scene,x:number,width:number,positionY=VIEW.bottom-175):void {
 scene.registry.remove('lastAward');
 profileText(scene,x,positionY,t('beta.completed_matches',{matches:betaView().completed}),14,Math.max(1,width-24),'#a0eaff',150);
}
