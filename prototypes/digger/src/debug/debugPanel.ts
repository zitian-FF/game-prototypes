import { Pane } from 'tweakpane';
import { runtime } from '../scenes/GameScene';
import { tune, tuneDefaults } from '../tune';

type Bag = Record<string, unknown>;

function rangeFor(def: number): { min: number; max: number; step: number } {
  const isInt = Number.isInteger(def);
  const max = def === 0 ? 10 : Math.abs(def) * 4;
  return { min: def < 0 ? -max : 0, max: isInt ? Math.max(10, max) : Math.max(1, max), step: isInt ? 1 : 0.01 };
}

function addGroup(parent: { addBinding: Function; addFolder: Function }, obj: Bag, defaults: Bag): void {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === 'number') parent.addBinding(obj, key, rangeFor(defaults[key] as number));
    else if (v && typeof v === 'object') {
      const folder = parent.addFolder({ title: key, expanded: false });
      addGroup(folder, v as Bag, defaults[key] as Bag);
    }
  }
}

// Tweakpane panel for tune.json, available in production builds via ?debug=1
// (see "Tuning" in root CLAUDE.md). It edits the live tune object, so feel
// values change immediately. Board-shape values (grid, tile hp, mix) apply to
// the next board. "Copy JSON" copies the current values for tune.json.
export function mountDebugPanelIfRequested(): void {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;
  const pane = new Pane({ title: 'dice dig tune' });
  pane.addBinding(runtime, 'skin', { options: { 'Bevel (2.5D)': 'bevel', Flat: 'flat', Isometric: 'iso' } });
  pane.addButton({ title: 'New board' }).on('click', () => {
    runtime.newBoard = true;
  });
  addGroup(pane as never, tune as unknown as Bag, tuneDefaults as unknown as Bag);
  pane.addButton({ title: 'Copy JSON' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(tune, null, 2));
  });
}
