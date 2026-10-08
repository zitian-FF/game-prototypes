import { tune } from './tune';
import meta from '../tune.meta.json';

// Debug panel, hidden unless the page is opened with ?debug=1 (remembered per
// browser; ?debug=0 locks it again). Same unlock idea as the main Punchies
// debug panel.
const UNLOCK_KEY = 'punchies-playable:debug:unlock:v1';

export function debugUnlocked(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('debug');
    if (q === '1') localStorage.setItem(UNLOCK_KEY, '1');
    if (q === '0') localStorage.removeItem(UNLOCK_KEY);
    return q === '1' || localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return new URLSearchParams(location.search).get('debug') === '1';
  }
}

interface Meta { cat: string; desc: string; min: number; max: number; step: number }
type Obj = Record<string, unknown>;

export async function mountDebugPanel(onRestart: () => void): Promise<void> {
  const { Pane } = await import('tweakpane');
  const pane = new Pane({ title: 'punchies playable tune', expanded: true });
  const host = pane.element.parentElement;
  if (host) host.style.cssText += ';z-index:2147483000;width:340px;max-height:90vh;overflow:auto;';

  pane.addButton({ title: 'Restart run' }).on('click', onRestart);
  pane.addButton({ title: 'Copy tune JSON' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(tune, null, 2) + '\n');
  });

  const folders = new Map<string, ReturnType<typeof pane.addFolder>>();
  for (const [path, m] of Object.entries(meta as Record<string, Meta>)) {
    let folder = folders.get(m.cat);
    if (!folder) folders.set(m.cat, (folder = pane.addFolder({ title: m.cat, expanded: false })));
    const parts = path.split('.');
    let obj = tune as unknown as Obj;
    for (const p of parts.slice(0, -1)) obj = obj[p] as Obj;
    const key = parts[parts.length - 1];
    folder.addBinding(obj, key, { label: parts.slice(-2).join('.'), min: m.min, max: m.max, step: m.step });
  }
}
