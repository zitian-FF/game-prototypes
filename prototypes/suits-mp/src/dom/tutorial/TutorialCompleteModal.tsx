import '../modalChrome.css';

// Shown once the player finishes whichever scene is currently the last
// one built (see TutorialScene.finishScene's own doc comment) - a
// deliberately simple, scene-agnostic stand-in for an eventual real
// end-of-tutorial screen, not the final "Tutorial Complete" Victory
// Screen appendage the full design calls for (that only makes sense once
// Scene 6's real end-game sequence exists). Its own copy must never name
// a specific scene's own lesson (e.g. "you just won a trick" was Scene
// 1-specific text that became actively wrong once this same modal became
// Scene 2's fallback too, following Scene 2's own redistribution lesson
// instead) - it stays generic on purpose, since which scene is "last
// built" keeps changing as later tasks add more. Reuses the exact same
// Back to Menu button styling as VictoryModal's, per this project's
// convention of one real navigation mechanism, not a second look-alike.
export interface TutorialCompleteModalProps {
  onBackToMenu: () => void;
}

export function TutorialCompleteModal({ onBackToMenu }: TutorialCompleteModalProps): JSX.Element {
  return (
    <div
      data-ui="tutorial-complete-screen"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        background: 'rgba(4, 8, 10, 0.92)',
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
          color: 'oklch(0.95 0.05 90)',
          textShadow: '0 0 24px rgba(226, 182, 84, 0.4)',
        }}
      >
        Tutorial: More Coming Soon
      </span>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, textAlign: 'center', maxWidth: 300 }}>
        You've completed every lesson built so far. More are on the way.
      </p>
      <div style={{ width: '100%', maxWidth: 300, marginTop: 8 }}>
        <button
          type="button"
          data-ui="tutorial-back-to-menu"
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
