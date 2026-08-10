import Phaser from 'phaser';
import { GOD_DISPLAY_NAME, cardById } from '../rules/cards';
import { legalOptions } from '../rules/engine';
import type { CardId } from '../rules/types';
import { bindTapIntent } from '../input/intents';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { ALL_NET_PLAYER_IDS } from '../net/netPlayerId';
import type { NetPlayerId } from '../net/netPlayerId';
import type { ClientAction, MaskedState, PlayType } from '../net/actions';

const FONT = 'monospace';
const WIDTH = 390;

function cardLabel(id: CardId): string {
  const card = cardById(id);
  return `${card.name} [${GOD_DISPLAY_NAME[card.god]} ${card.rank}]`;
}

// Local-only selection state for whatever action is in progress (which
// card(s) are tapped so far, redistribution assignments made so far). Must
// survive re-renders triggered by the player's own taps (see `rerender`
// below) - it only resets when a genuinely new masked state arrives from
// the host, which is a fresh decision point. Getting this wrong (rebuilding
// a fresh ViewState on every re-render, including ones caused by the
// player's own selection taps) was the bug behind the Stage 1+2 build
// looking "non-interactive": a tap would register, trigger a re-render to
// show the selection, and that re-render would immediately discard the
// selection it was trying to show.
interface ViewState {
  selectedCards: CardId[];
  redistributeAssignment: Partial<Record<NetPlayerId, CardId[]>>;
}

function freshViewState(): ViewState {
  return { selectedCards: [], redistributeAssignment: {} };
}

type LineFn = (text: string, color?: string, size?: number) => Phaser.GameObjects.Text;
type ButtonFn = (text: string, onTap: () => void, color?: string) => Phaser.GameObjects.Text;

// Entry point: always starts a fresh ViewState, since a new masked state
// (the only thing that triggers a top-level call to this function - see
// HostGameScene/PlayerGameScene) is a fresh decision point with nothing
// carried over from before.
export function renderGameView(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  sendAction: (action: ClientAction) => void,
): void {
  renderWithView(scene, container, state, sendAction, freshViewState());
}

// Rebuilds the entire placeholder text-dump view for one masked state -
// this is Stage 2's whole UI: your hand, whose turn, the trick so far, the
// current turn phase, and (when applicable) tap targets to submit an
// action. Real visuals are Stage 3; everything here is monospace text and
// tappable rows, all routed through the intent layer (bindTapIntent), not
// raw pointer events. Shared between HostGameScene (host's own
// perspective, rendered locally with no network round trip) and
// PlayerGameScene (a remote peer's perspective, rendered from a received
// `state` message).
function renderWithView(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  sendAction: (action: ClientAction) => void,
  view: ViewState,
): void {
  container.removeAll(true);
  // Local re-renders (triggered by the player's own taps, to show an
  // updated selection before they've confirmed anything) reuse this same
  // `view` object rather than calling the exported renderGameView, which
  // would hand back a fresh one and discard whatever was selected so far.
  const rerender = (): void => renderWithView(scene, container, state, sendAction, view);
  let y = 20;

  const line: LineFn = (text, color = '#eeeeee', size = 13) => {
    const t = scene.add.text(16, y, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
      wordWrap: { width: WIDTH - 32 },
      resolution: PIXEL_RATIO,
    });
    container.add(t);
    y += t.height + 4;
    return t;
  };

  const button: ButtonFn = (text, onTap, color = '#88ff88') => {
    const t = scene.add
      .text(16, y, `[ ${text} ]`, {
        fontFamily: FONT,
        fontSize: '14px',
        color,
        resolution: PIXEL_RATIO,
      })
      .setInteractive({ useHandCursor: true });
    bindTapIntent(t, onTap);
    container.add(t);
    y += t.height + 6;
    return t;
  };

  const tappableLine = (text: string, color: string, onTap: () => void): Phaser.GameObjects.Text => {
    const t = line(text, color);
    t.setInteractive({ useHandCursor: true });
    bindTapIntent(t, onTap);
    return t;
  };

  const isYourTurn = state.currentTurn === state.yourSlot;

  line(`suits-mp - you are ${state.yourSlot}`, '#88aaff', 12);
  line(`Trick ${state.trickNumber}  |  Turn phase: ${state.turnPhase}  |  Current turn: ${state.currentTurn ?? '-'}`);
  if (state.leadSuit) {
    const required = state.requiredSuit ? `  Required: ${GOD_DISPLAY_NAME[state.requiredSuit]}` : '';
    line(`Lead suit: ${GOD_DISPLAY_NAME[state.leadSuit]}${required}`, '#aaaaaa');
  }

  line('Trick so far:', '#aaaaaa');
  if (state.currentTrick.length === 0) {
    line('  (no cards played yet this trick)', '#666666');
  } else {
    for (const play of state.currentTrick) {
      line(`  ${play.player}: ${play.cards.map(cardLabel).join(' + ')} (${play.kind})`);
    }
  }

  if (Object.keys(state.revealedGods).length > 0) {
    line('Revealed gods:', '#aaaaaa');
    for (const slot of ALL_NET_PLAYER_IDS) {
      const god = state.revealedGods[slot];
      if (god) line(`  ${slot}: ${GOD_DISPLAY_NAME[god]}`);
    }
  }

  if (state.winner) {
    line('--- GAME OVER ---', '#ffd27a', 16);
    line(state.winner.detail, '#ffd27a');
    line(`Winning team: ${state.winner.team ?? 'none (stalemate)'}`, '#ffd27a');
    return;
  }

  // Redistribution log is intentionally a stub this stage - real
  // presentation is Stage 3 (see BRIEF.md). Just proves the data arrived.
  if (state.redistributionLog.length > 0) {
    const n = state.redistributionLog.length;
    line(`(redistribution log: ${n} entr${n === 1 ? 'y' : 'ies'} received - see Stage 3)`, '#666666', 11);
  }

  line(`Your hand (${state.yourHand.length}):`, '#aaaaaa');
  const handRows: Phaser.GameObjects.Text[] = [];
  for (const id of state.yourHand) {
    const selected = view.selectedCards.includes(id);
    const t = scene.add
      .text(16, y, `${selected ? '> ' : '  '}${cardLabel(id)}`, {
        fontFamily: FONT,
        fontSize: '13px',
        color: selected ? '#ffd27a' : '#dddddd',
        resolution: PIXEL_RATIO,
      })
      .setInteractive({ useHandCursor: true });
    container.add(t);
    handRows.push(t);
    y += t.height + 2;
  }

  const canAct = isYourTurn && state.turnPhase !== 'gameOver';
  if (!canAct) {
    line(state.currentTurn ? `Waiting for ${state.currentTurn}...` : 'Waiting...', '#666666');
    return;
  }

  if (state.turnPhase === 'play') {
    renderPlayPhase(state, handRows, view, sendAction, rerender, line, button);
  } else if (state.turnPhase === 'selectDelegate') {
    line('You won by Twin Awakening - choose who redistributes:', '#ffd27a');
    for (const target of state.delegateChoices ?? []) {
      button(`Delegate to ${target}`, () => sendAction({ action: 'selectDelegate', targetPlayer: target }));
    }
  } else if (state.turnPhase === 'redistribute') {
    renderRedistributePhase(state, view, sendAction, rerender, line, button, tappableLine);
  }
}

function renderPlayPhase(
  state: MaskedState,
  handRows: Phaser.GameObjects.Text[],
  view: ViewState,
  sendAction: (action: ClientAction) => void,
  rerender: () => void,
  line: LineFn,
  button: ButtonFn,
): void {
  const leading = state.currentTrick.length === 0;
  const opts = legalOptions(state.yourHand, leading ? null : state.requiredSuit);

  state.yourHand.forEach((id, i) => {
    bindTapIntent(handRows[i], () => {
      const idx = view.selectedCards.indexOf(id);
      if (idx >= 0) view.selectedCards.splice(idx, 1);
      else if (view.selectedCards.length < 2) view.selectedCards.push(id);
      rerender();
    });
  });

  if (leading) {
    line('Leading this trick: tap exactly one card, then Play.', '#aaaaaa');
  } else if (opts.mustPlaySuit) {
    line(`Must follow suit (${GOD_DISPLAY_NAME[opts.mustPlaySuit]}): tap exactly one, then Play.`, '#aaaaaa');
  } else {
    line(
      'No cards of the required suit - tap 1 for a facedown single, or 2 matching ranks for a Twin Awakening double.',
      '#aaaaaa',
    );
  }

  const selection = view.selectedCards;
  let playType: PlayType | null = null;
  if (selection.length === 1) {
    playType = leading || opts.mustPlaySuit ? 'single' : 'facedownSingle';
  } else if (selection.length === 2 && !leading && !opts.mustPlaySuit) {
    const [a, b] = selection;
    if (cardById(a).rank === cardById(b).rank) playType = 'double';
  }

  if (playType) {
    const type = playType;
    button('Play', () => sendAction({ action: 'playCard', playType: type, cards: [...selection] }));
  } else {
    line('(select a legal card / pair to enable Play)', '#666666', 11);
  }
}

function renderRedistributePhase(
  state: MaskedState,
  view: ViewState,
  sendAction: (action: ClientAction) => void,
  rerender: () => void,
  line: LineFn,
  button: ButtonFn,
  tappableLine: (text: string, color: string, onTap: () => void) => Phaser.GameObjects.Text,
): void {
  const ctx = state.redistribution;
  if (!ctx) {
    line('(waiting for redistribution details...)', '#666666');
    return;
  }

  line('Redistribute this trick facedown - tap a card, then it goes to whoever still needs one:', '#aaaaaa');

  const assigned = new Set(Object.values(view.redistributeAssignment).flat());
  const currentTarget = (): NetPlayerId | null => {
    for (const c of ctx.contributions) {
      if ((view.redistributeAssignment[c.player] ?? []).length < c.count) return c.player;
    }
    return null;
  };

  line('Contributions needed:', '#aaaaaa');
  for (const c of ctx.contributions) {
    const have = (view.redistributeAssignment[c.player] ?? []).length;
    line(`  ${c.player}: ${have}/${c.count}`, have >= c.count ? '#88ff88' : '#dddddd');
  }

  line('Candidate cards:', '#aaaaaa');
  for (const id of ctx.candidateCards) {
    const used = assigned.has(id);
    const text = `  ${used ? '(assigned) ' : ''}${cardLabel(id)}`;
    if (used) {
      line(text, '#555555');
    } else {
      tappableLine(text, '#dddddd', () => {
        const target = currentTarget();
        if (!target) return;
        const list = view.redistributeAssignment[target] ?? [];
        view.redistributeAssignment[target] = [...list, id];
        rerender();
      });
    }
  }

  const allAssigned = ctx.contributions.every((c) => (view.redistributeAssignment[c.player] ?? []).length === c.count);
  if (allAssigned) {
    button('Confirm redistribution', () =>
      sendAction({
        action: 'redistribute',
        assignments: ctx.contributions.map((c) => ({ toPlayer: c.player, cards: view.redistributeAssignment[c.player] ?? [] })),
      }),
    );
  }
  button(
    'Reset',
    () => {
      view.redistributeAssignment = {};
      rerender();
    },
    '#888888',
  );
}
