import {store} from '../portal/store';
import {KEYS} from '../portal/keys';
import {controlMode,type ControlMode,type ControlModes} from '../ui/controlMode';
function saved():Record<string,unknown> {
  try {const value:unknown=JSON.parse(store.getItem(KEYS.localInputs)??'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};} catch{return {};}
}
export function loadControlModes():ControlModes {
  const modes=saved().controlModes as {p1?:unknown;p2?:unknown}|undefined;
  return [controlMode(modes?.p1),controlMode(modes?.p2)];
}
/** Next-match preferences; retain devices, bindings and layouts in the same save blob. */
export function saveControlMode(side:0|1,mode:ControlMode):void {
  const value=saved(),modes=[...loadControlModes()];modes[side]=mode;
  store.setItem(KEYS.localInputs,JSON.stringify({...value,controlModes:{p1:modes[0],p2:modes[1]}}));
}
