import { mountTunePanelIfRequested } from 'dig-kit';
import { runtime } from '../scenes/GameScene';
import { tune, tuneDefaults } from '../tune';

export function mountDebugPanelIfRequested(): void {
  mountTunePanelIfRequested({
    title: 'dig match tune',
    tune,
    defaults: tuneDefaults,
    extras: (pane) => {
      pane.addButton({ title: 'New board' }).on('click', () => {
        runtime.newBoard = true;
      });
    },
  });
}
