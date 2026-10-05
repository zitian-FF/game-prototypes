import { Pane } from 'tweakpane';
import { clientTune } from '../clientTune';
import { DEBUG } from '../scenes/base';

type Obj = Record<string, unknown>;

/**
 * Tweakpane over every client tune value, in production builds via ?debug=1.
 * Edits apply live. The match rules (tune.json) belong to the server and are
 * shown read-only elsewhere; this panel is for how the client looks and feels.
 */
export function mountDebugPanelIfRequested(): void {
  if (!DEBUG) return;
  const pane = new Pane({ title: 'firestorm-arena client tune', expanded: false });
  const host = pane.element.parentElement;
  if (host) {
    host.style.width = '360px';
    host.style.top = '300px'; // clear of the in-canvas top bar and target panel
  }
  pane.addButton({ title: 'Copy JSON (paste into client.tune.json)' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(clientTune, null, 2) + '\n');
  });
  const addAll = (folder: { addBinding: (o: Obj, k: string) => unknown; addFolder: (p: { title: string; expanded: boolean }) => unknown }, values: Obj): void => {
    for (const key of Object.keys(values)) {
      const v = values[key];
      // Tweakpane binds numbers, strings and booleans; a nested object becomes a folder of its own.
      if (typeof v === 'object' && v !== null) addAll(folder.addFolder({ title: key, expanded: false }) as typeof folder, v as Obj);
      else folder.addBinding(values, key);
    }
  };
  for (const [section, values] of Object.entries(clientTune as unknown as Obj)) {
    addAll(pane.addFolder({ title: section, expanded: false }) as never, values as Obj);
  }
}
