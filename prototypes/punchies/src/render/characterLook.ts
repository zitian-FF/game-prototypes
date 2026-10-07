import { isCharId, type CharId } from '../sim/character';
import { tune } from '../sim/tune';

// How each character is drawn. Render only: size here never touches
// hurtboxes or reach (those stay in the sim / tune).
export interface Look {
  color: number;
  scale: number;
  ponytail: boolean;
}

const LOOKS: Record<CharId, { main: number; alt: number; scale: number; ponytail: boolean }> = {
  marco: { main: 0x3a78d0, alt: 0x2ec4d6, scale: 1, ponytail: false },
  mia: { main: 0xd04a4a, alt: 0xf06fae, scale: 0.88, ponytail: true },
  bruno: { main: 0x3fa34d, alt: 0x9be84a, scale: 1.12, ponytail: false },
};

// Fighter `idx` in a match between chars[0] and chars[1]: in a mirror
// match the second fighter wears the alt colour.
export function lookFor(chars: [string, string], idx: number): Look {
  const id = isCharId(chars[idx]) ? chars[idx] : 'marco';
  const l = LOOKS[id as CharId];
  const mirror = idx === 1 && chars[0] === chars[1];
  return { color: mirror ? l.alt : l.main, scale: l.scale * tune.view.fighterScale, ponytail: l.ponytail };
}

export function mainLook(id: string): Look {
  return lookFor([id, ''], 0);
}
