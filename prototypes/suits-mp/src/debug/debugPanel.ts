import { Pane } from 'tweakpane';
import tune from '../../tune.json';

// Tweakpane panel exposing tune.json's values, available in production
// builds via ?debug=1 (see "Tuning" in root CLAUDE.md).
export function mountDebugPanelIfRequested(): void {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;

  const values = { ...tune };
  const pane = new Pane({ title: 'suits-mp tune' });

  for (const key of Object.keys(values) as (keyof typeof values)[]) {
    // Most tune values are numeric durations/sizes; a few (CSS easing
    // curves, e.g. turnWheelRotationEasing) are strings - addBinding infers
    // a text field for those on its own, but the numeric min/step options
    // don't apply and must be omitted.
    const options = typeof values[key] === 'number' ? { min: 0, step: 100 } : undefined;
    pane.addBinding(values, key, options);
  }

  pane.addButton({ title: 'Copy JSON' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(values, null, 2));
  });
}
