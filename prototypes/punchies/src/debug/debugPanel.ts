import { Pane, type FolderApi } from 'tweakpane';
import { tune } from '../sim/tune';

// Tweakpane panel exposing every tune.json value, available in production
// builds via ?debug=1 (see "Tuning" in root CLAUDE.md). Binds straight to
// the live tune object, so edits apply to the running sim immediately.

export const DEBUG_ENABLED = new URLSearchParams(location.search).get('debug') === '1';

// Debug-only view toggles. Not tuned values, so not in tune.json.
export const debugView = { showHitboxes: true };

type Node = { [k: string]: number | boolean | Node };

function bindTree(folder: Pick<FolderApi, 'addBinding' | 'addFolder'>, obj: Node): void {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === 'object') {
      bindTree(folder.addFolder({ title: key, expanded: false }), v);
    } else {
      folder.addBinding(obj, key);
    }
  }
}

export function mountDebugPanelIfRequested(): void {
  if (!DEBUG_ENABLED) return;
  const pane = new Pane({ title: 'punchies tune', expanded: false });
  pane.addBinding(debugView, 'showHitboxes');
  pane.addButton({ title: 'Copy JSON' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(tune, null, 2));
  });
  bindTree(pane, tune as unknown as Node);
}
