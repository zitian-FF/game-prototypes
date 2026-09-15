import './modalChrome.css';

// The dedicated screen for a player-initiated end (WinInfo.reason ===
// 'quit') - deliberately much simpler than the Victory Screen, since
// nobody completed a suit here and there's nothing to celebrate. Every
// connected client lands here identically, including the quitter's own
// client once its own confirm goes through - there is no separate
// "you ended it" vs "someone else ended it" copy. Reuses the exact same
// Back to Menu button styling as VictoryModal's/TutorialCompleteModal's,
// per this project's convention of one real navigation mechanism, not a
// second look-alike.
export interface GameEndedModalProps {
  quitterLabel: string;
  onBackToMenu: () => void;
}

export function GameEndedModal({ quitterLabel, onBackToMenu }: GameEndedModalProps): JSX.Element {
  return (
    <div
      data-ui="game-ended-screen"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        background: 'rgba(4, 8, 10, 0.94)',
        color: 'oklch(0.90 0.02 90)',
        fontFamily: "'EB Garamond', Georgia, serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        padding: '0 28px',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          fontFamily: "'IM Fell English SC', serif",
          fontSize: 26,
          letterSpacing: '0.03em',
          textAlign: 'center',
          color: 'oklch(0.90 0.03 80)',
        }}
      >
        Game Ended
      </span>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, textAlign: 'center', maxWidth: 300 }}>
        The game has been ended by {quitterLabel}.
      </p>
      <div style={{ width: '100%', maxWidth: 300, marginTop: 8 }}>
        <button
          type="button"
          data-ui="game-ended-back-to-menu"
          onClick={onBackToMenu}
          style={{
            width: '100%',
            padding: 1,
            boxSizing: 'border-box',
            border: 0,
            background: 'linear-gradient(180deg, rgba(226, 188, 96, 0.9), rgba(120, 88, 30, 0.55))',
            clipPath:
              'polygon(11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px), 0 11px)',
            boxShadow: '0 0 34px rgba(212, 168, 66, 0.32)',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 50,
              background: 'linear-gradient(180deg, rgba(106, 78, 22, 0.96), rgba(38, 28, 10, 0.97))',
              clipPath:
                'polygon(11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px), 0 11px)',
              fontFamily: "'IM Fell English SC', serif",
              fontSize: 19,
              letterSpacing: '0.05em',
              color: 'oklch(0.97 0.04 92)',
              textShadow: '0 0 14px rgba(252, 216, 130, 0.5)',
            }}
          >
            Back to Menu
          </span>
        </button>
      </div>
    </div>
  );
}
