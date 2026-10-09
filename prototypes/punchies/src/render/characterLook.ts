import { isCharId, type CharId } from '../sim/character';
import { fighterScale } from '../sim/geometry';

// Character colours and proportions; scale is shared with simulation geometry.
export interface Look {
  color: number;
  scale: number;
  ponytail: boolean;
}

const LOOKS: Record<CharId, { main: number; alt: number; ponytail: boolean }> = {
  tyke: {main:0xf4c832,alt:0xf4c832,ponytail:false},
  dragon: {main:0xf5f1e8,alt:0xf5f1e8,ponytail:true},
  tee: {main:0x34343f,alt:0x645a7d,ponytail:true},
  marco: { main: 0x3a78d0, alt: 0x2ec4d6, ponytail: false },
  mia: { main: 0xd04a4a, alt: 0xf06fae, ponytail: true },
  bruno: { main: 0x3fa34d, alt: 0x9be84a, ponytail: false },
};

// Fighter appearance is independent of player slot; matching skins are allowed.

export function lookFor(chars: [string, string], idx: number): Look {
  const id = isCharId(chars[idx]) ? chars[idx] : 'marco';
  const l = LOOKS[id as CharId];
  return { color: l.main, scale: fighterScale(id), ponytail: l.ponytail };
}

export function mainLook(id: string): Look {
  return lookFor([id, ''], 0);
}
