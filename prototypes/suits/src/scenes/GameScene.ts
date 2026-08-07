import Phaser from 'phaser';
import { bindSelectIntent } from '../input/intents';
import { CARD_DEFS, GOD_DISPLAY_NAME, GOD_TEAM, SUIT_CYCLE, TEAMMATE_GOD, cardById, cardId, sortCardIds } from '../rules/cards';
import {
  activePlayerId,
  advanceBlocker,
  cancelRoleGuess,
  chooseDelegate,
  currentRequiredSuit,
  declareRoleGuess,
  isRoleGuessEligible,
  legalOptions,
  initGame,
  playCard,
  proceedFromTrickResult,
  redistribute,
  submitRoleGuess,
} from '../rules/engine';
import type { CardId, ForcedDeal, GameState, God, PlayerId, TrickPlay } from '../rules/types';

const WIDTH = 390;
const HEIGHT = 844;

const GOD_COLOR: Record<God, number> = {
  YogSothoth: 0x2b6cb0,
  Cthulhu: 0x276749,
  ShubNiggurath: 0x975a16,
  Nyarlathotep: 0x742a2a,
};

const CARD_W = 72;
const CARD_H = 88;
const CARD_GAP = 6;

function playKindLabel(kind: TrickPlay['kind']): string {
  if (kind === 'double') return 'double';
  if (kind === 'offsuit') return 'off-suit';
  return '';
}

// Rules overlay content (item 5). Wording, headings and bullets are exactly
// as specified; only the incidental mid-sentence line wraps from the source
// brief (sized for a much wider column than this 390px canvas) are removed
// so Phaser's own wordWrap can reflow each line correctly here.
const RULES_TEXT = `SUIT OF MADNESS — QUICK RULES

GOAL
Collect 10 cards of your own suit (shown in your win-condition tracker), or reach 40 tricks won as your team (alternate win).

EACH TRICK
- First player may lead with any suit.
- Suits rotate each trick, follow the suit cycle shown at the top.

FOLLOWING SUIT
- If you have an on-suit single, you must play it.
- Only if you have no on-suit singles may you instead play:
  - a double (off-suit override), or
  - a single face-down (shown as a grey X on the cards played this trick, cannot win the trick)

RANK & TIES
- Highest rank wins the trick.
- If two cards tie in rank, whichever was played later wins.
- Ace beats a 10 only if played after it in the same trick.

PLAYING SINGLES
- Winning the trick with an on-suit single: you get to redistribute cards yourself.

PLAYING DOUBLES (OFF-SUIT OVERRIDE)
- A double (two matching cards) does not need to follow the led suit, only playable when you have no on-suit singles.
- An off-suit double always beats any single card in the trick, regardless of rank.
- If two doubles clash, higher rank wins, later play wins ties.
- Winning the trick with a double triggers mandatory redistribution delegation: you must hand off the redistribution decision to someone else, shown in the redistribution log, bottom right toggle.

TEAMS
- You have one teammate. Their identity/colour is shown at the top during your turn.
- Cards collected by either you or your teammate count toward your team's win condition.

FIRST MOVE OF THE GAME
- The very first player of the very first trick must lead with the Blue 2.`;

export interface GameSceneInitData {
  playerNames: [string, string, string, string];
  forcedDeal?: ForcedDeal;
  // Device pixel ratio (capped) computed once at game init in main.ts. See
  // the comment there for why this replaces the old Phaser `resolution`
  // game-config option.
  pixelRatio?: number;
}

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private layer: Phaser.GameObjects.Container | null = null;
  private hitRegions: { rect: Phaser.Geom.Rectangle; onTap: () => void }[] = [];
  private pixelRatio = 1;

  private pendingGifts: Partial<Record<PlayerId, CardId[]>> = {};
  private selectedForGift: CardId | null = null;
  private redistributionKey: string | null = null;

  private roleGuesses: Partial<Record<PlayerId, God>> = {};

  private showRedistributionLog = false;
  private showRulesOverlay = false;

  constructor() {
    super('Game');
  }

  init(data: GameSceneInitData): void {
    this.state = initGame(data.playerNames, data.forcedDeal);
    this.pixelRatio = data.pixelRatio ?? 1;
  }

  create(): void {
    // The canvas backing store is sized at pixelRatio in main.ts (see the
    // comment there). Zooming the camera by the same factor, then
    // re-centering it on the logical 390x844 world, makes the camera's
    // world view exactly [0,390]x[0,844] again — every existing x/y
    // coordinate below still lines up exactly, now rendered at the
    // device's actual pixel density. Camera zoom auto-sizes the viewport
    // to the (now larger) canvas, which shifts its world-space center;
    // centerOn() pulls it back to the original logical center point.
    this.cameras.main.setZoom(this.pixelRatio);
    this.cameras.main.centerOn(WIDTH / 2, HEIGHT / 2);

    bindSelectIntent(this, (worldX, worldY) => {
      for (const region of this.hitRegions) {
        if (region.rect.contains(worldX, worldY)) {
          region.onTap();
          break;
        }
      }
    });
    this.render();
  }

  private setState(next: GameState): void {
    this.state = next;
    this.render();
  }

  // --- low-level drawing helpers ------------------------------------

  private registerHit(x: number, y: number, w: number, h: number, onTap: () => void): void {
    this.hitRegions.push({ rect: new Phaser.Geom.Rectangle(x, y, w, h), onTap });
  }

  private text(
    x: number,
    y: number,
    value: string,
    opts?: { size?: number; color?: string; wrap?: number; align?: string }
  ): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, value, {
      fontFamily: 'monospace',
      fontSize: `${opts?.size ?? 14}px`,
      color: opts?.color ?? '#eeeeee',
      align: opts?.align ?? 'left',
      wordWrap: opts?.wrap ? { width: opts.wrap } : undefined,
      resolution: this.pixelRatio,
    });
    this.layer!.add(t);
    return t;
  }

  private button(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onTap: () => void,
    opts?: { color?: number; disabled?: boolean; fontSize?: number }
  ): void {
    const color = opts?.color ?? 0x333333;
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, color, opts?.disabled ? 0.3 : 1);
    rect.setStrokeStyle(2, 0xffffff, opts?.disabled ? 0.2 : 0.7);
    const t = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: 'monospace',
        fontSize: `${opts?.fontSize ?? 13}px`,
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: w - 10 },
        resolution: this.pixelRatio,
      })
      .setOrigin(0.5);
    this.layer!.add([rect, t]);
    if (!opts?.disabled) this.registerHit(x, y, w, h, onTap);
  }

  private cardBox(
    x: number,
    y: number,
    w: number,
    h: number,
    id: CardId,
    opts?: { dim?: boolean; selected?: boolean; onTap?: () => void }
  ): void {
    const def = cardById(id);
    const alpha = opts?.dim ? 0.28 : 1;
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, GOD_COLOR[def.god], alpha);
    rect.setStrokeStyle(opts?.selected ? 3 : 1, opts?.selected ? 0xffe066 : 0xffffff, opts?.dim ? 0.25 : 0.7);
    // Number + colour only — no flavour name or god label, large text to
    // fill the box for at-a-glance legibility.
    const label = def.rank === 'Ace' ? 'A' : String(def.rank);
    const t = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: 'monospace',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        resolution: this.pixelRatio,
      })
      .setOrigin(0.5)
      .setAlpha(opts?.dim ? 0.6 : 1);
    this.layer!.add([rect, t]);
    if (opts?.onTap) this.registerHit(x, y, w, h, opts.onTap);
  }

  private cardGrid(
    cards: CardId[],
    startX: number,
    startY: number,
    cols: number,
    perCard: (id: CardId) => { dim?: boolean; selected?: boolean; onTap?: () => void }
  ): number {
    cards.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (CARD_W + CARD_GAP);
      const y = startY + row * (CARD_H + CARD_GAP);
      this.cardBox(x, y, CARD_W, CARD_H, id, perCard(id));
    });
    const rows = Math.ceil(cards.length / cols);
    return startY + rows * (CARD_H + CARD_GAP);
  }

  // Small colour + rank chip, used wherever a card must be shown without
  // revealing its name (trick-in-progress log, redistribution log).
  private renderCardChip(x: number, y: number, id: CardId): number {
    const def = cardById(id);
    const w = 30;
    const h = 20;
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, GOD_COLOR[def.god], 1);
    rect.setStrokeStyle(1, 0xffffff, 0.6);
    const label = def.rank === 'Ace' ? 'A' : String(def.rank);
    const t = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        resolution: this.pixelRatio,
      })
      .setOrigin(0.5);
    this.layer!.add([rect, t]);
    return x + w;
  }

  // Faction HUD: shown while it's a specific player's turn. Only reveals
  // colours, never identities — teammate colour is derivable from the
  // fixed team/god pairing, not from knowing who the teammate actually is.
  private renderFactionHud(playerId: PlayerId, y: number): number {
    const player = this.state.players[playerId];
    const team = GOD_TEAM[player.god];
    const teammateGod = TEAMMATE_GOD[player.god];
    const swatch = 18;

    this.text(16, y, `Faction: ${team}`, { size: 13, color: '#ffe066' });

    const swatchY = y + 20;
    const drawSwatch = (x: number, color: number, label: string) => {
      const rect = this.add.rectangle(x + swatch / 2, swatchY + swatch / 2, swatch, swatch, color, 1);
      rect.setStrokeStyle(1, 0xffffff, 0.7);
      this.layer!.add(rect);
      this.text(x + swatch + 6, swatchY + 2, label, { size: 12, color: '#cccccc' });
    };
    drawSwatch(16, GOD_COLOR[player.god], 'You');
    drawSwatch(120, GOD_COLOR[teammateGod], 'Ally');

    return swatchY + swatch + 10;
  }

  // Bottom-right toggle for the cumulative, per-viewer redistribution log.
  // Hidden by default each turn; reset in the blocker's advance handler.
  private renderRedistributionLogToggle(playerId: PlayerId): void {
    if (this.showRedistributionLog) {
      this.layer!.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x050505, 0.96));
      this.text(16, 16, `Redistribution log — ${this.state.players[playerId].name}`, {
        size: 15,
        color: '#ffe066',
        wrap: WIDTH - 32,
      });

      const entries = this.state.receivedLog[playerId] ?? [];
      let cursor = 52;
      if (entries.length === 0) {
        this.text(16, cursor, 'No redistributions received yet this game.', { size: 12, color: '#888888' });
      } else {
        for (const entry of entries) {
          const fromName = this.state.players[entry.fromPlayerId].name;
          this.text(16, cursor, `Trick #${entry.trickNumber}: received`, { size: 12, color: '#cccccc' });
          cursor += 18;
          let chipX = 16;
          for (const id of entry.cardIds) chipX = this.renderCardChip(chipX, cursor, id) + 4;
          this.text(chipX + 4, cursor + 3, `from ${fromName}`, { size: 12, color: '#88bbff' });
          cursor += 30;
        }
      }
    }

    const btnW = 116;
    const btnH = 36;
    this.button(
      WIDTH - btnW - 12,
      HEIGHT - btnH - 12,
      btnW,
      btnH,
      this.showRedistributionLog ? 'Close Log' : 'Redist. Log',
      () => {
        this.showRedistributionLog = !this.showRedistributionLog;
        this.render();
      },
      { color: this.showRedistributionLog ? 0x663333 : 0x334455 }
    );
  }

  // Public suit-cycle strip: shown at the top of every turn screen. An
  // arrow marks the active player's own suit within the fixed rotation;
  // the first player of each trick sees "start with any suit" instead,
  // since they aren't following anyone.
  private renderSuitCycleBar(playerId: PlayerId, isLeader: boolean, y: number): number {
    const ownGod = this.state.players[playerId].god;
    const swatch = 44;
    const gap = 8;
    const totalW = SUIT_CYCLE.length * swatch + (SUIT_CYCLE.length - 1) * gap;
    const startX = (WIDTH - totalW) / 2;
    const rowY = y + 4;

    SUIT_CYCLE.forEach((god, i) => {
      const x = startX + i * (swatch + gap);
      const rect = this.add.rectangle(x + swatch / 2, rowY + swatch / 2, swatch, swatch, GOD_COLOR[god], 1);
      rect.setStrokeStyle(god === ownGod ? 3 : 1, god === ownGod ? 0xffe066 : 0xffffff, 0.85);
      this.layer!.add(rect);
    });

    const belowY = rowY + swatch + 2;
    if (isLeader) {
      this.text(startX, belowY, 'start with any suit', {
        size: 12,
        color: '#ffe066',
        align: 'center',
        wrap: totalW,
      });
    } else {
      const idx = SUIT_CYCLE.indexOf(ownGod);
      const arrowX = startX + idx * (swatch + gap);
      this.text(arrowX, belowY, '▲', { size: 20, color: '#ffe066', align: 'center', wrap: swatch });
    }

    return belowY + 22;
  }

  // Always-visible win-condition banner: the viewing player's own progress
  // toward collecting all 10 cards of their identity suit (own suit only,
  // not the required suit they're currently following).
  private renderWinBanner(playerId: PlayerId, y: number): number {
    const player = this.state.players[playerId];
    const total = CARD_DEFS.filter((c) => c.god === player.god).length;
    const owned = CARD_DEFS.filter((c) => c.god === player.god && player.hand.includes(c.id)).length;
    const h = 30;

    const rect = this.add.rectangle(WIDTH / 2, y + h / 2, WIDTH - 16, h, GOD_COLOR[player.god], 0.22);
    rect.setStrokeStyle(1, GOD_COLOR[player.god], 0.9);
    this.layer!.add(rect);
    this.text(24, y + 8, `Win: collect 10 of your suit — ${owned}/${total}`, { size: 13, color: '#ffe066' });

    return y + h + 6;
  }

  // Bottom-left toggle for the quick-rules reference overlay (item 5).
  private renderRulesOverlayToggle(): void {
    if (this.showRulesOverlay) {
      this.layer!.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x050505, 0.97));
      const isHeadingLine = (line: string) => line.length > 0 && line === line.toUpperCase() && /[A-Z]/.test(line);
      let cursor = 10;
      for (const line of RULES_TEXT.split('\n')) {
        if (line === '') {
          cursor += 6;
          continue;
        }
        const heading = isHeadingLine(line);
        const t = this.text(14, cursor, line, {
          size: heading ? 11 : 9.5,
          color: heading ? '#ffe066' : '#dddddd',
          wrap: WIDTH - 28,
        });
        cursor += t.height + (heading ? 4 : 2);
      }
    }

    const btnW = 116;
    const btnH = 36;
    this.button(
      12,
      HEIGHT - btnH - 12,
      btnW,
      btnH,
      this.showRulesOverlay ? 'Close Rules' : 'Rules',
      () => {
        this.showRulesOverlay = !this.showRulesOverlay;
        this.render();
      },
      { color: this.showRulesOverlay ? 0x663333 : 0x334455 }
    );
  }

  // --- top-level render dispatch --------------------------------------

  private render(): void {
    this.layer?.destroy();
    this.hitRegions = [];
    this.layer = this.add.container(0, 0);

    switch (this.state.phase) {
      case 'blocker':
        this.renderBlocker();
        break;
      case 'turn':
        this.renderTurn();
        break;
      case 'roleGuess':
        this.renderRoleGuess();
        break;
      case 'trickResult':
        this.renderTrickResult();
        break;
      case 'chooseDelegate':
        this.renderChooseDelegate();
        break;
      case 'redistribution':
        this.renderRedistribution();
        break;
      case 'gameOver':
        this.renderGameOver();
        break;
    }
  }

  // --- blocker ----------------------------------------------------------

  private renderBlocker(): void {
    const pending = this.state.pendingBlocker;
    if (!pending) return;
    const name = this.state.players[pending.forPlayerId].name;

    this.layer!.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x0a0a0a, 1));

    const subtitle =
      pending.next === 'turn'
        ? 'tap when ready to take your turn.'
        : pending.next === 'chooseDelegate'
          ? 'tap when ready to choose who redistributes for you.'
          : 'tap when ready to redistribute cards.';

    this.text(24, HEIGHT / 2 - 60, `Pass to`, { size: 18, color: '#999999' });
    this.text(24, HEIGHT / 2 - 30, name, { size: 30, color: '#ffffff', wrap: WIDTH - 48 });
    this.text(24, HEIGHT / 2 + 30, subtitle, { size: 15, color: '#cccccc', wrap: WIDTH - 48 });
    this.text(24, HEIGHT - 80, 'Tap anywhere to continue', { size: 13, color: '#666666' });

    this.registerHit(0, 0, WIDTH, HEIGHT, () => {
      this.showRedistributionLog = false;
      if (
        this.state.pendingBlocker?.next === 'redistribution' &&
        this.redistributionKey !==
          `${this.state.pendingWinnerId ?? ''}-${this.state.trickNumber}`
      ) {
        this.pendingGifts = {};
        this.selectedForGift = null;
        this.redistributionKey = `${this.state.pendingWinnerId ?? ''}-${this.state.trickNumber}`;
      }
      this.setState(advanceBlocker(this.state));
    });
  }

  // --- public trick-so-far log (shared by turn + trickResult) -----------

  private renderTrickLog(x: number, y: number, plays: TrickPlay[]): number {
    this.text(x, y, 'This trick so far:', { size: 13, color: '#999999' });
    let cursor = y + 20;
    if (plays.length === 0) {
      this.text(x, cursor, '(no cards played yet)', { size: 12, color: '#666666' });
      return cursor + 18;
    }
    for (const play of plays) {
      const name = this.state.players[play.playerId].name;
      const nameText = this.text(x, cursor + 3, `${name}:`, { size: 12, color: '#dddddd' });
      let chipX = x + nameText.width + 8;
      for (const id of play.cardIds) {
        chipX = this.renderCardChip(chipX, cursor, id) + 4;
      }
      const kindLabel = playKindLabel(play.kind);
      if (kindLabel) {
        this.text(chipX, cursor + 3, `(${kindLabel})`, { size: 11, color: '#999999' });
      }
      cursor += 26;
    }
    return cursor;
  }

  // --- turn ---------------------------------------------------------------

  private renderTurn(): void {
    const playerId = activePlayerId(this.state)!;
    const player = this.state.players[playerId];
    const position = this.state.plays.length;
    const isLeader = position === 0;
    const requiredSuit = currentRequiredSuit(this.state);
    // The very first trick of the whole game is exactly trickNumber === 1
    // (it only ever increments) combined with being the leader's turn.
    const isFirstTrickOpener = isLeader && this.state.trickNumber === 1;

    let cursor = this.renderSuitCycleBar(playerId, isLeader, 6);
    cursor = this.renderWinBanner(playerId, cursor + 4);

    this.text(16, cursor + 4, `Trick #${this.state.trickNumber}`, { size: 13, color: '#888888' });
    const heading = this.text(16, cursor + 22, `${player.name}'s turn`, { size: 20, color: '#ffffff', wrap: WIDTH - 32 });

    const hudBottom = this.renderFactionHud(playerId, heading.y + heading.height + 6);
    cursor = this.renderTrickLog(16, hudBottom + 6, this.state.plays);

    const received = this.state.lastReceived[playerId];
    if (received) {
      const fromName = this.state.players[received.fromPlayerId].name;
      const names = received.cardIds.map((id) => cardById(id).name).join(', ');
      const line = this.text(16, cursor + 6, `Last redistribution: received ${names} from ${fromName}.`, {
        size: 12,
        color: '#88bbff',
        wrap: WIDTH - 32,
      });
      cursor += line.height + 10;
    }

    cursor += 14;

    if (isRoleGuessEligible(this.state, playerId)) {
      this.button(16, cursor, WIDTH - 32, 36, 'Declare Role Guess (trick 40+)', () => {
        this.roleGuesses = {};
        this.setState(declareRoleGuess(this.state, playerId));
      }, { color: 0x553311 });
      cursor += 46;
    }

    const opts = legalOptions(player.hand, requiredSuit);

    let instruction: string;
    if (isFirstTrickOpener) {
      instruction = 'First trick of the game — you must lead with the Blue 2:';
    } else if (isLeader) {
      instruction = 'Lead the trick — play any card:';
    } else if (opts.mustPlaySuit) {
      instruction = `Required suit: ${GOD_DISPLAY_NAME[opts.mustPlaySuit]} — highlighted cards are legal:`;
    } else {
      instruction = 'No cards of the required suit. Play any card off-suit (scores 0), or a double below:';
    }
    this.text(16, cursor, instruction, { size: 13, color: '#cccccc', wrap: WIDTH - 32 });
    cursor += 34;

    const highlightSet = new Set(
      isFirstTrickOpener ? [cardId('YogSothoth', 2)] : isLeader || !opts.mustPlaySuit ? player.hand : opts.suitCards
    );
    const sortedHand = sortCardIds(player.hand);

    const gridBottom = this.cardGrid(sortedHand, 16, cursor, 4, (id) => ({
      dim: !highlightSet.has(id),
      onTap: highlightSet.has(id)
        ? () => this.setState(playCard(this.state, playerId, [id]))
        : undefined,
    }));

    if (!isLeader && !opts.mustPlaySuit && opts.doubleRanks.length > 0) {
      let dCursor = gridBottom + 8;
      this.text(16, dCursor, 'Play a double (always beats singles):', { size: 13, color: '#ffe066' });
      dCursor += 22;
      for (const rank of opts.doubleRanks) {
        const rankCards = sortCardIds(player.hand.filter((id) => cardById(id).rank === rank));
        if (rankCards.length === 2) {
          const [a, b] = rankCards;
          const label = `Double ${rank === 'Ace' ? 'Ace' : rank}: ${cardById(a).name} + ${cardById(b).name}`;
          this.button(16, dCursor, WIDTH - 32, 36, label, () =>
            this.setState(playCard(this.state, playerId, [a, b]))
          );
          dCursor += 46;
        } else {
          this.text(16, dCursor, `Rank ${rank === 'Ace' ? 'Ace' : rank} — pick 2 cards to pair:`, {
            size: 12,
            color: '#ffe066',
          });
          dCursor += 18;
          dCursor = this.cardGrid(rankCards, 16, dCursor, 4, (id) => ({
            selected: id === this.selectedForGift,
            onTap: () => {
              if (this.selectedForGift === id) {
                this.selectedForGift = null;
                this.render();
              } else if (this.selectedForGift && rankCards.includes(this.selectedForGift)) {
                const pair = [this.selectedForGift, id];
                this.selectedForGift = null;
                this.setState(playCard(this.state, playerId, pair));
              } else {
                this.selectedForGift = id;
                this.render();
              }
            },
          }));
          dCursor += 10;
        }
      }
    }

    this.renderRedistributionLogToggle(playerId);
    this.renderRulesOverlayToggle();
  }

  // --- role guess -----------------------------------------------------

  private renderRoleGuess(): void {
    const playerId = this.state.leaderId;
    const player = this.state.players[playerId];

    const heading = this.text(16, 8, `${player.name}: guess every player's god`, {
      size: 17,
      color: '#ffe066',
      wrap: WIDTH - 32,
    });
    const desc = this.text(16, heading.y + heading.height + 4, 'Fully correct wins the game for your team. Wrong uses up your one attempt.', {
      size: 12,
      color: '#cccccc',
      wrap: WIDTH - 32,
    });

    const hudBottom = this.renderFactionHud(playerId, desc.y + desc.height + 8);

    const gods: God[] = ['Cthulhu', 'Nyarlathotep', 'ShubNiggurath', 'YogSothoth'];
    let cursor = hudBottom + 8;

    for (const p of this.state.players) {
      this.text(16, cursor, p.name, { size: 14, color: '#ffffff' });
      cursor += 20;
      gods.forEach((god, i) => {
        const x = 16 + i * ((WIDTH - 32) / 4);
        const w = (WIDTH - 32) / 4 - 4;
        const selected = this.roleGuesses[p.id] === god;
        this.button(
          x,
          cursor,
          w,
          34,
          GOD_DISPLAY_NAME[god],
          () => {
            for (const key of Object.keys(this.roleGuesses)) {
              const pid = Number(key) as PlayerId;
              if (this.roleGuesses[pid] === god) delete this.roleGuesses[pid];
            }
            this.roleGuesses[p.id] = god;
            this.render();
          },
          { color: selected ? 0x996600 : 0x333333, fontSize: 9 }
        );
      });
      cursor += 44;
    }

    const allSet = this.state.players.every((p) => this.roleGuesses[p.id] !== undefined);

    this.button(
      16,
      cursor + 10,
      WIDTH - 32,
      40,
      'Submit Guess',
      () => {
        const guesses = { ...this.roleGuesses } as Record<PlayerId, God>;
        this.setState(submitRoleGuess(this.state, playerId, guesses));
      },
      { disabled: !allSet, color: 0x226622 }
    );

    this.button(16, cursor + 58, WIDTH - 32, 36, 'Cancel — play a card instead', () => {
      this.setState(cancelRoleGuess(this.state));
    });

    this.renderRedistributionLogToggle(playerId);
  }

  // --- trick result ----------------------------------------------------

  private renderTrickResult(): void {
    const result = this.state.lastTrickResult!;
    const winnerName = this.state.players[result.winnerId].name;

    this.text(16, 8, `Trick #${this.state.trickNumber} result`, { size: 16, color: '#ffffff' });
    const bottom = this.renderTrickLog(16, 40, result.plays);

    this.text(16, bottom + 16, `${winnerName} wins the trick${result.wonByDouble ? ' with a double!' : '!'}`, {
      size: 16,
      color: '#66ff99',
      wrap: WIDTH - 32,
    });

    this.button(16, bottom + 60, WIDTH - 32, 44, 'Continue', () => {
      this.setState(proceedFromTrickResult(this.state));
    });
  }

  // --- choose delegate ---------------------------------------------------

  private renderChooseDelegate(): void {
    const winnerId = this.state.pendingWinnerId!;
    const winner = this.state.players[winnerId];

    const heading = this.text(16, 8, `${winner.name} won with a double.`, { size: 17, color: '#ffe066', wrap: WIDTH - 32 });
    const hudBottom = this.renderFactionHud(winnerId, heading.y + heading.height + 8);
    const instruction = this.text(
      16,
      hudBottom + 6,
      'You must choose someone else to redistribute your cards on your behalf:',
      { size: 13, color: '#cccccc', wrap: WIDTH - 32 }
    );

    let cursor = instruction.y + instruction.height + 16;
    for (const p of this.state.players) {
      if (p.id === winnerId) continue;
      this.button(16, cursor, WIDTH - 32, 44, p.name, () => {
        this.setState(chooseDelegate(this.state, p.id));
      });
      cursor += 54;
    }

    this.renderRedistributionLogToggle(winnerId);
  }

  // --- redistribution -----------------------------------------------------

  private renderRedistribution(): void {
    const winnerId = this.state.pendingWinnerId!;
    const distributorId = this.state.pendingDistributorId!;
    const winner = this.state.players[winnerId];
    const distributor = this.state.players[distributorId];
    const result = this.state.lastTrickResult!;

    const heading = this.text(16, 8, `${distributor.name} redistributes ${winner.name}'s cards`, {
      size: 15,
      color: '#ffffff',
      wrap: WIDTH - 32,
    });
    const hudBottom = this.renderFactionHud(distributorId, heading.y + heading.height + 8);

    const gifted = new Set(Object.values(this.pendingGifts).flat());
    const available = sortCardIds(winner.hand.filter((id) => !gifted.has(id)));

    this.text(16, hudBottom + 6, 'Tap a card, then tap who receives it:', { size: 12, color: '#999999' });
    const gridBottom = this.cardGrid(available, 16, hudBottom + 28, 4, (id) => ({
      selected: id === this.selectedForGift,
      onTap: () => {
        this.selectedForGift = this.selectedForGift === id ? null : id;
        this.render();
      },
    }));

    let cursor = gridBottom + 14;
    const recipients = result.plays.filter((p) => p.playerId !== winnerId);
    for (const play of recipients) {
      const recipient = this.state.players[play.playerId];
      const required = play.cardIds.length;
      const assigned = this.pendingGifts[play.playerId] ?? [];
      const label = `Give to ${recipient.name} (${assigned.length}/${required})`;
      const canAssign = this.selectedForGift !== null && assigned.length < required;
      this.button(
        16,
        cursor,
        WIDTH - 32,
        36,
        label,
        () => {
          if (!this.selectedForGift) return;
          const next = { ...this.pendingGifts, [play.playerId]: [...assigned, this.selectedForGift] };
          this.pendingGifts = next;
          this.selectedForGift = null;
          this.render();
        },
        { disabled: !canAssign, color: 0x334455 }
      );
      cursor += 40;
      if (assigned.length > 0) {
        let chipX = 16;
        for (const id of assigned) {
          const chipStart = chipX;
          chipX = this.renderCardChip(chipX, cursor, id) + 4;
          this.registerHit(chipStart, cursor, chipX - chipStart, 20, () => {
            this.pendingGifts = {
              ...this.pendingGifts,
              [play.playerId]: assigned.filter((cid) => cid !== id),
            };
            this.render();
          });
        }
        cursor += 28;
      }
    }

    const allAssigned = recipients.every((p) => (this.pendingGifts[p.playerId] ?? []).length === p.cardIds.length);

    this.button(
      16,
      cursor + 6,
      WIDTH - 32,
      44,
      'Confirm Redistribution',
      () => {
        const gifts = recipients.map((p) => ({
          toPlayerId: p.playerId,
          cardIds: this.pendingGifts[p.playerId] ?? [],
        }));
        this.setState(redistribute(this.state, gifts));
      },
      { disabled: !allAssigned, color: 0x226622 }
    );

    this.renderRedistributionLogToggle(distributorId);
  }

  // --- game over -----------------------------------------------------

  private renderGameOver(): void {
    const win = this.state.winner!;
    this.text(16, 16, 'Game Over', { size: 24, color: '#ffffff' });

    const headline =
      win.reason === 'stalemate'
        ? 'Stalemate — no winner.'
        : `${win.team} wins!`;
    this.text(16, 56, headline, { size: 20, color: win.reason === 'stalemate' ? '#999999' : '#66ff99', wrap: WIDTH - 32 });
    this.text(16, 90, win.detail, { size: 13, color: '#cccccc', wrap: WIDTH - 32 });

    const reasonLabel =
      win.reason === 'suit' ? 'suit completion' : win.reason === 'roleGuess' ? 'correct role guess' : 'stalemate';
    this.text(16, 130, `Reason: ${reasonLabel}`, { size: 12, color: '#888888' });

    this.text(16, 166, 'Revealed roles:', { size: 14, color: '#ffffff' });
    let cursor = 190;
    for (const p of this.state.players) {
      const team = p.god === 'Cthulhu' || p.god === 'Nyarlathotep' ? 'Chaos' : 'Cosmos';
      this.text(16, cursor, `${p.name} — ${GOD_DISPLAY_NAME[p.god]} (${team})`, {
        size: 14,
        color: '#eeeeee',
        wrap: WIDTH - 32,
      });
      cursor += 26;
    }

    this.text(16, cursor + 20, 'Refresh the page to start a new game.', { size: 12, color: '#666666' });
  }
}
