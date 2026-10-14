import { Pane } from 'tweakpane';

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
    else if (v && typeof v === 'object') addGroup(parent.addFolder({ title: key, expanded: false }), v as Bag, defaults[key] as Bag);
  }
}

export interface TunePanelOptions {
  title: string;
  /** Live, mutable copy of the prototype's tune.json. The panel edits it in place. */
  tune: object;
  /** The original tune.json values, used to pick slider ranges. */
  defaults: object;
  /** Add prototype-specific controls (skin switch, new board) above the tune values. */
  extras?: (pane: Pane) => void;
}

/**
 * Tweakpane panel for tune.json, shown in production builds only with
 * ?debug=1 (see "Tuning" in root CLAUDE.md). Edits apply immediately.
 * "Copy JSON" copies the current values to paste back into tune.json.
 */
export function mountTunePanelIfRequested(opts: TunePanelOptions): void {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;
  const pane = new Pane({ title: opts.title });
  opts.extras?.(pane);
  addGroup(pane as never, opts.tune as Bag, opts.defaults as Bag);
  pane.addButton({ title: 'Copy JSON' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(opts.tune, null, 2));
  });
}
