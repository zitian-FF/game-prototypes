import { tune } from '../tune';

// Content that is not a tuned number: names, types, levels. Numbers live in tune.json.

export type Kind = 'text' | 'image';
export type WordId = keyof typeof tune.words;
export type ModelId = keyof typeof tune.models;
export type SlotId = 's0' | 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8';
export type NodeRef = 'in' | 'out' | SlotId;

export const SLOTS: SlotId[] = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
export const SLOT_COLS = 3;
export const SLOT_ROWS = 3;

export interface ModelInfo {
  label: string;
  /** One-line role shown in the picker. */
  role: string;
  in: Kind[];
  out: Kind[];
  /** The model's colour, used everywhere that model appears. */
  color: number;
}

export const MODEL_INFO: Record<ModelId, ModelInfo> = {
  nano: { label: 'Nano', role: 'Fast and cheap', in: ['text'], out: ['text'], color: 0x4fe3c1 },
  scribe: { label: 'Scribe', role: 'Reliable writer', in: ['text'], out: ['text'], color: 0x5b8cff },
  sage: { label: 'Sage', role: 'Frontier, multimodal', in: ['text', 'image'], out: ['text', 'image'], color: 0xb388ff },
  lens: { label: 'Lens', role: 'Vision reader', in: ['text', 'image'], out: ['text'], color: 0xffb454 },
  canvas: { label: 'Canvas', role: 'Image maker', in: ['text'], out: ['image'], color: 0xff6b9d },
};

export interface Level {
  id: string;
  title: string;
  hint: string;
  inKind: Kind;
  outKind: Kind;
  /** Words the delivered result must carry. */
  needs: WordId[];
  /** Words the player may hand to agents (needs plus decoys). */
  basket: WordId[];
  /** Models available on this level. */
  models: ModelId[];
  seed: number;
  goals: { success: number; cost: number; time: number };
}

export const LEVELS: Level[] = [
  {
    id: 'complaint',
    title: 'Complaint email',
    hint: 'One node holding two words dilutes both. Try splitting the work.',
    inKind: 'text',
    outKind: 'text',
    needs: ['formal', 'apologize'],
    basket: ['formal', 'apologize', 'short', 'summarize'],
    models: ['nano', 'scribe', 'sage'],
    seed: 101,
    goals: { success: 0.7, cost: 22, time: 3 },
  },
  {
    id: 'receipt',
    title: 'Receipt photo',
    hint: 'Only some models can read an image. Only the first one needs to.',
    inKind: 'image',
    outKind: 'text',
    needs: ['extract', 'summarize'],
    basket: ['extract', 'summarize', 'short', 'formal'],
    models: ['nano', 'scribe', 'sage', 'lens'],
    seed: 202,
    goals: { success: 0.7, cost: 36, time: 5 },
  },
  {
    id: 'poster',
    title: 'Launch poster',
    hint: 'The last node must output an image. Draft copy first, then draw.',
    inKind: 'text',
    outKind: 'image',
    needs: ['short', 'cheerful', 'visual'],
    basket: ['short', 'cheerful', 'visual', 'formal'],
    models: ['nano', 'scribe', 'sage', 'lens', 'canvas'],
    seed: 303,
    goals: { success: 0.7, cost: 44, time: 5 },
  },
];

export const slotRow = (ref: NodeRef): number => (ref === 'in' ? -1 : ref === 'out' ? SLOT_ROWS : Math.floor(SLOTS.indexOf(ref) / SLOT_COLS));
