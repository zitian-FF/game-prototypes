import './modalChrome.css';

// The Return to Menu warning confirmation - deliberately styled to read
// as a warning (a red/orange accent, a warning glyph), distinct from the
// game's normal gold/teal dialog chrome (Rules/Menu/RedistLog), since
// confirming here is irreversible and - in a real multiplayer session -
// ends the game for every connected player, not just the one tapping
// Confirm. Copy differs by `isMultiplayer`: a real multiplayer session
// (host or peer) gets the unambiguous "this ends the game for everyone"
// wording; Single Player/Tutorial (no real other players involved) gets
// a lighter "are you sure you want to quit?" confirmation instead, since
// the "ends it for everyone" phrasing would simply be untrue there.
export interface EndGameConfirmModalProps {
  isMultiplayer: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EndGameConfirmModal({ isMultiplayer, onConfirm, onCancel }: EndGameConfirmModalProps): JSX.Element {
  const accent = 'oklch(0.80 0.14 25)';
  const border = 'rgba(214, 106, 84, 0.5)';

  return (
    <div
      data-ui="end-game-confirm-screen"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', color: 'oklch(0.90 0.02 90)', fontFamily: "'EB Garamond', Georgia, serif" }}
    >
      <div
        data-ui="end-game-confirm-scrim"
        onClick={onCancel}
        style={{ position: 'absolute', inset: 0, background: 'rgba(3, 6, 8, 0.86)', backdropFilter: 'blur(7px)', pointerEvents: 'auto' }}
      />
      <div
        data-ui="end-game-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          top: '28%',
          padding: 1,
          boxSizing: 'border-box',
          background: `linear-gradient(180deg, ${border}, rgba(42, 18, 16, 0.35) 45%, ${border})`,
          clipPath:
            'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)',
          boxShadow: `0 40px 90px rgba(0, 0, 0, 0.85), 0 0 40px ${border}`,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            padding: '28px 22px 22px',
            background: 'linear-gradient(180deg, rgba(30, 14, 12, 0.98), rgba(10, 6, 6, 0.99))',
            clipPath:
              'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: 34,
              lineHeight: 1,
              color: accent,
              textShadow: `0 0 20px ${border}`,
            }}
          >
            ⚠
          </span>
          <span style={{ fontFamily: "'IM Fell English SC', serif", fontSize: 21, color: accent, textAlign: 'center' }}>
            {isMultiplayer ? 'End the Game?' : 'Quit to Menu?'}
          </span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, textAlign: 'center', color: 'rgba(230, 220, 216, 0.9)' }}>
            {isMultiplayer
              ? 'This ends the game for every player, not just you. This cannot be undone.'
              : 'Are you sure you want to quit? Your progress in this session will be lost.'}
          </p>
          <div style={{ width: '100%', display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              type="button"
              data-ui="end-game-cancel-button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '13px 10px',
                boxSizing: 'border-box',
                background: 'rgba(20, 20, 24, 0.7)',
                border: '1px solid rgba(180, 180, 190, 0.3)',
                color: 'rgba(220, 220, 224, 0.9)',
                fontFamily: "'IM Fell English SC', serif",
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              data-ui="end-game-confirm-button"
              onClick={onConfirm}
              style={{
                flex: 1,
                padding: '13px 10px',
                boxSizing: 'border-box',
                background: 'linear-gradient(180deg, rgba(214, 106, 84, 0.92), rgba(120, 44, 32, 0.7))',
                border: `1px solid ${border}`,
                color: 'oklch(0.97 0.02 30)',
                fontFamily: "'IM Fell English SC', serif",
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              {isMultiplayer ? 'End Game for Everyone' : 'Quit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
