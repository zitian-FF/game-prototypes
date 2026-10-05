import { Pane, type FolderApi } from 'tweakpane';
import { tune, tuneBaseline, tuneSource, onTuneReplaced } from '../sim/tune';
import meta from '../../tune.meta.json';

// Tweakpane panel for every tune.json value, available in production builds
// (see "Tuning" in root CLAUDE.md). While we are in internal testing a red bug
// button is always on screen: it toggles debug mode (this panel, the hitbox
// overlay, the net stats readout). ?debug=1 still starts with it on, and the
// last state is remembered. Values are grouped by
// category from tune.meta.json; each shows its allowed range, a short
// description and the value it started from ("was"), with a reset button.
// Binds straight to the live tune object, so edits apply immediately.

const DEBUG_KEY = 'punchies:debug:v1';

function loadDebug(): boolean {
  if (new URLSearchParams(location.search).get('debug') === '1') return true;
  try {
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

let debugOn = loadDebug();
let panelHost: HTMLElement | null = null;

// Live debug-mode flag; read it every frame instead of caching it.
export function isDebug(): boolean {
  return debugOn;
}

// Debug-only view toggles. Not tuned values, so not in tune.json.
export const debugView = { showHitboxes: true };

interface MetaEntry {
  cat: string;
  desc: string;
  min: number | null;
  max: number | null;
  step: number | null;
}

const CATEGORY_ORDER = ['Attack', 'Defense', 'HP & Stun', 'Stamina', 'Movement & Arena', 'View', 'Match & Online', 'KO', 'Characters', 'AI', 'Training'];

type Obj = Record<string, unknown>;

function getParent(root: Obj, path: string): { obj: Obj; key: string } {
  const parts = path.split('.');
  let obj = root;
  for (const p of parts.slice(0, -1)) obj = obj[p] as Obj;
  return { obj, key: parts[parts.length - 1] };
}

function readPath(root: Obj, path: string): unknown {
  const { obj, key } = getParent(root, path);
  return obj[key];
}

function setDebug(on: boolean): void {
  debugOn = on;
  try {
    localStorage.setItem(DEBUG_KEY, on ? '1' : '0');
  } catch {
    // Private mode: the toggle still works for this page load.
  }
  if (on) mountPanel();
  if (panelHost) panelHost.style.display = on ? '' : 'none';
  bug?.style.setProperty('opacity', on ? '1' : '0.55');
  bug?.style.setProperty('box-shadow', on ? '0 0 0 3px #ffd24a, 0 2px 6px #0008' : '0 2px 6px #0008');
}

let bug: HTMLButtonElement | null = null;

// Always-visible red bug button (internal testing). Bottom centre, clear of
// the touch controls. A debug aid, so it is a plain DOM button like the panel.
export function mountDebugPanelIfRequested(): void {
  bug = document.createElement('button');
  bug.textContent = '\u{1F41E}';
  bug.title = 'Toggle debug mode';
  bug.setAttribute('aria-label', 'Toggle debug mode');
  bug.style.cssText =
    'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);width:34px;height:34px;border-radius:50%;' +
    'border:2px solid #7a0f0f;background:#d62b2b;color:#fff;font-size:18px;line-height:1;padding:0;cursor:pointer;' +
    'z-index:2147483000;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
  bug.addEventListener('click', () => setDebug(!debugOn));
  document.body.appendChild(bug);
  setDebug(debugOn);
}

function mountPanel(): void {
  if (panelHost) return;
  const pane = new Pane({ title: 'punchies tune', expanded: false });
  // Wider than Tweakpane's default so long value names aren't cut off.
  const host = pane.element.parentElement;
  panelHost = host;
  if (host) host.style.width = '420px';
  pane.element.style.setProperty('--bld-vw', '230px');
  const root = tune as unknown as Obj;
  const entries = meta as Record<string, MetaEntry>;

  const header = { source: tuneSource() };
  pane.addBinding(header, 'source', { readonly: true, label: 'loaded' });
  pane.addBinding(debugView, 'showHitboxes');
  pane.addButton({ title: 'Copy JSON (paste into tune.json)' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(tune, null, 2) + '\n');
  });

  const wasLabels: { path: string; el: HTMLElement }[] = [];
  const folders = new Map<string, FolderApi>();
  for (const cat of CATEGORY_ORDER) folders.set(cat, pane.addFolder({ title: cat, expanded: false }));

  // Sub-folder per section inside each category (e.g. Defense > guard).
  const sections = new Map<string, FolderApi>();
  for (const [path, m] of Object.entries(entries)) {
    const section = path.split('.').slice(0, -1).join('.').replace(/^punches\./, '');
    const secKey = `${m.cat}/${section}`;
    let folder = sections.get(secKey);
    if (!folder) {
      folder = (folders.get(m.cat) ?? pane).addFolder({ title: section, expanded: false });
      sections.set(secKey, folder);
    }
    const { obj, key } = getParent(root, path);
    const params: Record<string, unknown> = { label: key };
    if (m.min !== null) params.min = m.min;
    if (m.max !== null) params.max = m.max;
    if (m.step !== null) params.step = m.step;
    const binding = folder.addBinding(obj, key, params);

    // Description + range + "was" line, and a reset link, under the control.
    const info = document.createElement('div');
    info.style.cssText = 'font-size:10px;line-height:1.3;color:#9a9aa0;padding:0 8px 6px 8px;';
    const desc = document.createElement('div');
    desc.textContent = m.desc;
    const was = document.createElement('div');
    const reset = document.createElement('a');
    reset.textContent = 'reset';
    reset.href = '#';
    reset.style.cssText = 'color:#7fb3ff;margin-left:8px;';
    reset.onclick = (e) => {
      e.preventDefault();
      obj[key] = readPath(tuneBaseline() as unknown as Obj, path);
      pane.refresh();
    };
    info.append(desc, was);
    was.append(document.createElement('span'), reset);
    // Inside the binding's own element so it stays under its control.
    binding.element.style.flexWrap = 'wrap';
    info.style.flexBasis = '100%';
    binding.element.appendChild(info);
    wasLabels.push({ path, el: was.firstChild as HTMLElement });
  }

  const refreshWas = () => {
    const base = tuneBaseline() as unknown as Obj;
    for (const { path, el } of wasLabels) {
      const m = entries[path];
      const range = m.min !== null ? `range ${m.min} to ${m.max}` : 'on/off';
      el.textContent = `${range} · was ${String(readPath(base, path))}`;
    }
    header.source = tuneSource();
    pane.refresh();
  };
  refreshWas();
  onTuneReplaced(refreshWas);
}
