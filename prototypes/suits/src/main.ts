import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import type { ForcedDeal } from './rules/types';

const isDebug = new URLSearchParams(location.search).get('debug') === '1';

function startGame(playerNames: [string, string, string, string], forcedDeal?: ForcedDeal): void {
  document.getElementById('name-entry')?.remove();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#111111',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 390,
      height: 844,
    },
  });

  game.scene.add('Game', GameScene, true, { playerNames, forcedDeal });
}

async function buildNameEntry(): Promise<void> {
  const container = document.getElementById('name-entry');
  if (!container) return;

  const heading = document.createElement('h1');
  heading.textContent = 'Suit of Madness';
  container.appendChild(heading);

  const subheading = document.createElement('p');
  subheading.textContent = 'Enter 4 player names (seat order = entry order):';
  container.appendChild(subheading);

  const inputs: HTMLInputElement[] = [];
  for (let i = 0; i < 4; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Player ${i + 1} name`;
    input.maxLength = 20;
    container.appendChild(input);
    inputs.push(input);
  }

  const hint = document.createElement('div');
  hint.style.color = '#888';
  hint.style.fontSize = '0.8rem';
  hint.textContent = 'Leave a name blank to default to "Player 1".."Player 4" by seat order.';
  container.appendChild(hint);

  const startButton = document.createElement('button');
  startButton.textContent = 'Start Game';
  startButton.addEventListener('click', () => {
    const names = inputs.map((input, i) => input.value.trim() || `Player ${i + 1}`);
    startGame(names as [string, string, string, string]);
  });
  container.appendChild(startButton);

  // Dev-only: forced deals so Playwright can exercise specific trick
  // scenarios deterministically. Only loaded and only rendered when
  // ?debug=1 is present; has zero effect on normal play otherwise.
  if (isDebug) {
    const { DEBUG_SCENARIOS } = await import('./rules/debugScenarios');

    const debugRow = document.createElement('div');
    debugRow.className = 'debug-row';
    const label = document.createElement('div');
    label.textContent = 'Debug scenarios (?debug=1):';
    debugRow.appendChild(label);

    for (const scenario of DEBUG_SCENARIOS) {
      const button = document.createElement('button');
      button.textContent = scenario.label;
      button.addEventListener('click', () => {
        startGame(['P1', 'P2', 'P3', 'P4'], scenario.deal);
      });
      debugRow.appendChild(button);
    }
    container.appendChild(debugRow);
  }
}

void buildNameEntry();
