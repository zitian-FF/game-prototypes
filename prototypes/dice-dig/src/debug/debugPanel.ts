import { mountTunePanelIfRequested } from 'dig-kit';
import { runtime } from '../scenes/GameScene';
import { tune, tuneDefaults } from '../tune';

export function mountDebugPanelIfRequested(): void {
  mountTunePanelIfRequested({
    title: 'dice dig tune',
    tune,
    defaults: tuneDefaults,
    extras: (pane) => {
      pane.addBinding(runtime, 'skin', { options: { 'Pastel (soft)': 'pastel', 'Bevel (2.5D)': 'bevel', Flat: 'flat', Isometric: 'iso' } });
      pane.addButton({ title: 'New board' }).on('click', () => {
        runtime.newBoard = true;
      });
    },
  });
}
