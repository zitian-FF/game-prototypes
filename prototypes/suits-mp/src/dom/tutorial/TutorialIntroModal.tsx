import '../modalChrome.css';

// Scene 0 - the tutorial's dismissible full-screen intro overlay
// (suits-mp-tutorial-design.md, Section 3): plain language, no game
// state visible yet, dismissed by tapping anywhere to continue into
// Scene 1. Deliberately simpler than RulesModal/MenuModal's full scrim
// treatment - this is the one moment the design doc says clarity matters
// more than matching the game's established chrome elsewhere.
export interface TutorialIntroModalProps {
  onDismiss: () => void;
}

export function TutorialIntroModal({ onDismiss }: TutorialIntroModalProps): JSX.Element {
  return (
    <div
      data-ui="tutorial-intro-screen"
      onClick={onDismiss}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        background: 'rgba(4, 8, 10, 0.96)',
        color: 'oklch(0.90 0.02 90)',
        fontFamily: "'EB Garamond', Georgia, serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        padding: '0 28px',
        boxSizing: 'border-box',
        cursor: 'pointer',
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
        How to Play
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 16, lineHeight: 1.5, textAlign: 'center', maxWidth: 320 }}>
        <p style={{ margin: 0 }}>4 players. 2 hidden teams of 2.</p>
        <p style={{ margin: 0 }}>Your goal: collect one full Deity Suit — all 10 cards of one god.</p>
        <p style={{ margin: 0 }}>
          For this tutorial, <strong>Player 2 is your ally</strong>. In a real game your ally is hidden — you have to work it out from how people
          play.
        </p>
      </div>
      <span
        style={{
          marginTop: 10,
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 11,
          letterSpacing: '0.2em',
          color: 'rgba(212, 186, 132, 0.7)',
        }}
      >
        Tap to continue
      </span>
    </div>
  );
}
