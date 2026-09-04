import './modalChrome.css';

// Same modal shell as RulesModal.tsx (scrim, clip-path frame, header/footer
// layout) - a small hub reached from the board's top-left Menu button (see
// dom/overlay/GameOverlay.tsx), per this task's resolution that Menu opens
// more than a straight Rules relocation. Kept deliberately minimal: it
// links out to the two existing overlays it hosts (Rules, and the
// previous-trick log that used to sit behind its own top-bar button) rather
// than reimplementing either.

export interface MenuModalProps {
  onRules: () => void;
  onPreviousTrick: () => void;
  onClose: () => void;
}

function MenuButton({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '14px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 3,
        background: 'linear-gradient(180deg, rgba(16, 38, 38, 0.9), rgba(7, 15, 18, 0.92))',
        border: '1px solid rgba(120, 190, 178, 0.3)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          fontFamily: "'IM Fell English SC', serif",
          fontSize: 18,
          color: 'oklch(0.93 0.03 92)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'rgba(158, 196, 186, 0.6)',
        }}
      >
        {hint}
      </span>
    </button>
  );
}

export function MenuModal({ onRules, onPreviousTrick, onClose }: MenuModalProps): JSX.Element {
  return (
    <div
      data-ui="menu-screen"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', color: 'oklch(0.90 0.02 90)', fontFamily: "'EB Garamond', Georgia, serif" }}
    >
      <div
        data-ui="menu-scrim"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(3, 6, 8, 0.82)', backdropFilter: 'blur(7px)', pointerEvents: 'auto' }}
      />
      <div
        data-ui="menu-modal"
        role="dialog"
        aria-modal="true"
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          top: '30%',
          padding: 1,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, rgba(198, 160, 78, 0.6), rgba(48, 40, 18, 0.35) 45%, rgba(120, 190, 178, 0.35))',
          clipPath:
            'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)',
          boxShadow: '0 40px 90px rgba(0, 0, 0, 0.85)',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, rgba(9, 22, 25, 0.985), rgba(4, 9, 12, 0.99))',
            clipPath:
              'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)',
          }}
        >
          <div
            style={{
              padding: '18px 18px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(198, 160, 78, 0.26)',
            }}
          >
            <span style={{ fontFamily: "'IM Fell English SC', serif", fontSize: 22, color: 'oklch(0.93 0.05 88)' }}>Menu</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(10, 24, 26, 0.8)',
                border: '1px solid rgba(120, 190, 178, 0.34)',
                color: 'rgba(196, 226, 218, 0.85)',
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MenuButton label="The Rites" hint="Full rules reference" onClick={onRules} />
            <MenuButton label="Previous Trick" hint="Review the last trick played" onClick={onPreviousTrick} />
          </div>
        </div>
      </div>
    </div>
  );
}
