import './modalChrome.css';

// The universal Victory Screen's text/button layer - deliberately NOT a
// scrim'd modal like RulesModal/MenuModal/RedistLogModal: the two Deity
// Face sprites and their ambient glow are canvas-drawn underneath this
// (see ui/renderGameView.ts's startVictorySequence/showVictoryScreen),
// and must stay visible through this whole layer, so every element here
// has a transparent background and `pointerEvents: 'none'` except the one
// real button. Text/button chrome only, per root CLAUDE.md's "UI
// implementation split" - the choreographed WebGL entrance/glow itself
// stays in Phaser.

export interface VictoryIdentity {
  label: string;
  godDisplayName: string;
}

export interface VictoryModalProps {
  teamHeadline: string;
  trickNumber: number;
  identities: VictoryIdentity[];
  onBackToMenu: () => void;
}

export function VictoryModal({ teamHeadline, trickNumber, identities, onBackToMenu }: VictoryModalProps): JSX.Element {
  return (
    <div
      data-ui="victory-screen"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        color: 'oklch(0.90 0.02 90)',
        fontFamily: "'EB Garamond', Georgia, serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <span
          data-bind="victory-team-headline"
          style={{
            fontFamily: "'IM Fell English SC', serif",
            fontSize: 30,
            letterSpacing: '0.03em',
            color: 'oklch(0.95 0.05 90)',
            textShadow: '0 0 28px rgba(226, 182, 84, 0.55), 0 2px 6px rgba(0, 0, 0, 0.9)',
            textAlign: 'center',
          }}
        >
          {teamHeadline}
        </span>
        <span
          data-bind="victory-trick-count"
          style={{
            fontFamily: "'Cormorant Unicase', serif",
            fontWeight: 500,
            fontSize: 12,
            letterSpacing: '0.18em',
            color: 'rgba(230, 220, 200, 0.75)',
            textShadow: '0 1px 4px rgba(0, 0, 0, 0.9)',
          }}
        >
          {`After ${trickNumber} tricks`}
        </span>
      </div>

      {/* Spacer for the deity sprites' own canvas-drawn vertical space -
          not an element, just flex-grow, so the identities list below
          never overlaps them regardless of exact sprite height. */}
      <div style={{ flex: '1 1 auto' }} />

      <div
        data-ui="victory-identities"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: '10px 16px',
          background: 'linear-gradient(180deg, rgba(6, 12, 15, 0), rgba(6, 12, 15, 0.55))',
        }}
      >
        {identities.map((identity, i) => (
          <span
            key={i}
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: 13,
              color: 'rgba(226, 226, 218, 0.85)',
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.9)',
            }}
          >
            {identity.label}
            {' — '}
            <em>{identity.godDisplayName}</em>
          </span>
        ))}
      </div>

      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 320, padding: '14px 24px 28px', boxSizing: 'border-box' }}>
        <button
          type="button"
          data-ui="victory-back-to-menu"
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
