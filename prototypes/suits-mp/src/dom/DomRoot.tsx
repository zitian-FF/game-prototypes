import { useSyncExternalStore } from 'react';
import { RulesModal } from './RulesModal';
import { closeRules, getSnapshot, subscribe } from './domUiStore';

// Single React root for suits-mp's whole DOM overlay layer (see
// mountDom.ts). Add future DOM chrome (React + Tailwind, per root
// CLAUDE.md's "UI implementation split") as siblings here rather than
// mounting a separate React root per component.
export function DomRoot(): JSX.Element | null {
  const { rulesOpen, closeRules: onClose } = useSyncExternalStore(subscribe, getSnapshot);

  if (!rulesOpen) return null;

  return (
    <RulesModal
      onClose={() => {
        onClose();
        closeRules();
      }}
    />
  );
}
