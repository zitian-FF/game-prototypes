import { mountTunePanelIfRequested } from 'dig-kit';
import { SAVE_KEY } from '../game/game';
import { tune, tuneDefaults } from '../tune';

export function mountDebugPanelIfRequested(): void {
  mountTunePanelIfRequested({
    title: 'agents.io tune',
    tune,
    defaults: tuneDefaults,
    extras: (pane) => {
      pane.addButton({ title: 'Reset save and reload' }).on('click', () => {
        try {
          localStorage.removeItem(SAVE_KEY);
        } catch {
          /* storage unavailable */
        }
        location.reload();
      });
    },
  });
}
