/** Presentation contract. Match state supplies modes; preferences never override it. */
export type ControlMode = 'modern' | 'classic';
export type ControlModes = readonly [ControlMode, ControlMode];
export type NormalAttackSink = (source: string, held: boolean) => void;
export const CLASSIC_MODES: ControlModes = ['classic', 'classic'];
export function controlMode(value: unknown): ControlMode { return value === 'classic' ? 'classic' : 'modern'; }

/** Modern derives from saved stick/main/Super anchors without altering Classic layouts. */
export function modernControlLayout(view: {left:number;top:number;width:number;height:number}, main: {x:number;y:number}, upper: {x:number;y:number}) {
  const r = 58, superR = 34, margin = 10;
  const clamp = (v:number,a:number,b:number) => Math.max(a,Math.min(b,v));
  const normal = {x:clamp(main.x,view.left+view.width*.55+r,view.left+view.width-r-margin),y:clamp(main.y,view.top+104+r,view.top+view.height-r-margin),r};
  const superButton = {x:clamp(upper.x,view.left+view.width*.55+superR,view.left+view.width-superR-margin),y:clamp(upper.y,view.top+104+superR,normal.y-r-superR-12),r:superR};
  return {normal,superButton};
}
