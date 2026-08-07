import { Pane } from 'tweakpane';
import tune from '../../tune.json';

// Tweakpane panel exposing tune.json's values, available in production
// builds via ?debug=1 (see "Tuning" in root CLAUDE.md). Tuned values here are
// connection timings, not "game feel" in the traditional sense, but they are
// the durations/cooldowns this prototype has, so they live in tune.json like
// any other tunable.
export function mountDebugPanelIfRequested(): void {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;

  const values = { ...tune };
  const pane = new Pane({ title: 'mp-net tune' });

  for (const key of Object.keys(values) as (keyof typeof values)[]) {
    pane.addBinding(values, key, { min: 0, step: 100 });
  }

  pane.addButton({ title: 'Copy JSON' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(values, null, 2));
  });
}
