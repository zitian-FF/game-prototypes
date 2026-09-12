import { Pane } from 'tweakpane';
import tune from '../../tune.json';
import { shimmerDiagnostics } from './shimmerDiagnostics';

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

  // Read-only, polled monitors (not tune values - nothing here is
  // writable) for diagnosing why the Powered idle shimmer might not be
  // visible on a given device: see debug/shimmerDiagnostics.ts for what
  // each field means and why it's the one thing a real-device tester with
  // no devtools access can check directly.
  const shimmerFolder = pane.addFolder({ title: 'Powered shimmer diagnostics' });
  shimmerFolder.addBinding(shimmerDiagnostics, 'rendererType', { readonly: true, interval: 250 });
  shimmerFolder.addBinding(shimmerDiagnostics, 'attachCount', { readonly: true, interval: 250 });
  shimmerFolder.addBinding(shimmerDiagnostics, 'lastTweenX', { readonly: true, interval: 250 });
}
