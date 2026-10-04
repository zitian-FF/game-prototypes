import { Ui, TextField } from './ui';

export type KeyboardKind = 'code' | 'name';

/** Room codes use this small alphabet, so the code keypad is a 4 x 4 grid. */
const CODE_ROWS = ['ACDE', 'FHJK', 'MNPR', 'TWXY'];
const NAME_ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** Height the keyboard wants for a given width, so scenes can lay out around it. */
export function keyboardHeight(kind: KeyboardKind, keyH: number, gap: number): number {
  const rows = (kind === 'code' ? CODE_ROWS.length : NAME_ROWS.length) + 1;
  return rows * keyH + (rows - 1) * gap;
}

/**
 * Canvas-drawn on-screen keyboard for touch devices. It types into the given field exactly like
 * the physical keyboard does, and calls onEnter from its last key.
 */
export function drawKeyboard(ui: Ui, field: TextField, kind: KeyboardKind, x: number, y: number, w: number, keyH: number, gap: number, enterLabel: string, onEnter: () => void): void {
  const rows = kind === 'code' ? CODE_ROWS : NAME_ROWS;
  const upper = kind === 'code' || field.value.length === 0 || field.value.endsWith(' ');
  const widest = Math.max(...rows.map((r) => r.length));
  const keyW = Math.min(keyH * 1.4, (w - (widest - 1) * gap) / widest);
  rows.forEach((row, ri) => {
    const rowW = row.length * keyW + (row.length - 1) * gap;
    const rx = x + (w - rowW) / 2;
    for (let i = 0; i < row.length; i++) {
      const ch = upper || /[0-9]/.test(row[i]) ? row[i] : row[i].toLowerCase();
      ui.button(rx + i * (keyW + gap), y + ri * (keyH + gap), keyW, keyH, ch, { onClick: () => field.type(ch), size: 16 });
    }
  });
  const ly = y + rows.length * (keyH + gap);
  const backW = keyW * 1.8;
  ui.button(x + (w - (widest * keyW + (widest - 1) * gap)) / 2, ly, backW, keyH, 'Del', { onClick: () => field.backspace(), size: 14 });
  const endX = x + (w + (widest * keyW + (widest - 1) * gap)) / 2;
  const enterW = keyW * 2.6;
  ui.button(endX - enterW, ly, enterW, keyH, enterLabel, { onClick: onEnter, size: 14, active: true });
  if (kind === 'name') {
    const sx = x + (w - widest * keyW - (widest - 1) * gap) / 2 + backW + gap;
    ui.button(sx, ly, endX - enterW - gap - sx, keyH, 'space', { onClick: () => field.type(' '), size: 13 });
  }
}
