import './modalChrome.css';
import type { RedistLogEntry } from './domUiStore';
import { HEX_CLIP_PATH, symbolArtUrl } from './godArtUrl';
import { cardById } from '../rules/cards';
import { GOD_MOTIF } from '../rules/godArt';
import type { CardId } from '../rules/types';

// Same modal shell as RulesModal.tsx (scrim, seethe glow, noise overlay,
// clip-path frame, header/scroll-body/footer layout) - this panel gets the
// same DOM/React treatment now that it needs real scrolling, per root
// CLAUDE.md's "UI implementation split" (previously canvas-drawn, see
// ui/renderGameView.ts's old renderRedistributionLogOverlay). `entries` is
// already display-ready (labels resolved, newest trick first) - see
// ui/renderGameView.ts's computeRedistLogEntries; this component owns no
// game-state knowledge of its own.

export interface RedistLogModalProps {
  entries: RedistLogEntry[];
  onClose: () => void;
}

// Small "mini card" badge: the card's god symbol plus a rank tag, in the
// same hex/circle motif used everywhere else a god's art appears (card
// frames, god chips). Not a port of ui/cardArt.ts's full frame compositing
// - that's real per-god Canvas2D art meant for a card's own play area, way
// more than this compact log entry needs to just identify a card at a
// glance.
function CardBadge({ cardId }: { cardId: CardId }): JSX.Element {
  const card = cardById(cardId);
  const motif = GOD_MOTIF[card.god];
  return (
    <div
      data-ui="redist-card-badge"
      style={{
        position: 'relative',
        flex: '0 0 auto',
        width: 34,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(120, 190, 178, 0.32)',
        background: 'rgba(10, 24, 26, 0.75)',
        borderRadius: motif === 'circle' ? '50%' : 0,
        clipPath: motif === 'hex' ? HEX_CLIP_PATH : undefined,
      }}
    >
      <img src={symbolArtUrl(card.god)} alt={card.god} style={{ width: 18, height: 18, objectFit: 'contain' }} />
      <span
        style={{
          position: 'absolute',
          right: -3,
          bottom: -3,
          minWidth: 15,
          height: 14,
          padding: '0 2px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(6, 12, 15, 0.95)',
          border: '1px solid rgba(198, 160, 78, 0.5)',
          borderRadius: 3,
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 700,
          fontSize: 8,
          color: 'oklch(0.9 0.05 90)',
        }}
      >
        {card.rank === 'Ace' ? 'A' : card.rank}
      </span>
    </div>
  );
}

function CardRow({ cards }: { cards: CardId[] }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
      {cards.map((id, i) => (
        <CardBadge key={`${id}-${i}`} cardId={id} />
      ))}
    </div>
  );
}

export function RedistLogModal({ entries, onClose }: RedistLogModalProps): JSX.Element {
  return (
    <div
      data-ui="redist-log-screen"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        color: 'oklch(0.90 0.02 90)',
        fontFamily: "'EB Garamond', Georgia, serif",
      }}
    >
      <div
        data-ui="redist-log-scrim"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(3, 6, 8, 0.82)', backdropFilter: 'blur(7px)', pointerEvents: 'auto' }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 300,
          width: 520,
          height: 520,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          background: 'radial-gradient(closest-side, rgba(40, 150, 148, 0.14) 0%, rgba(0,0,0,0) 70%)',
          filter: 'blur(6px)',
          animation: 'somSeethe 48s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.45,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.42'/></svg>")`,
        }}
      />

      {/* ===== the modal ===== */}
      <div
        data-ui="redist-log-modal"
        role="dialog"
        aria-modal="true"
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          top: 22,
          bottom: 22,
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
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, rgba(9, 22, 25, 0.985), rgba(4, 9, 12, 0.99))',
            clipPath:
              'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)',
          }}
        >
          {/* header */}
          <div
            data-ui="redist-log-header"
            style={{
              flex: '0 0 auto',
              padding: '20px 20px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              borderBottom: '1px solid rgba(198, 160, 78, 0.26)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: "'Cormorant Unicase', serif",
                  fontWeight: 500,
                  fontSize: 9,
                  letterSpacing: '0.24em',
                  color: 'rgba(212, 186, 132, 0.6)',
                }}
              >
                Suit of Madness
              </span>
              <span
                style={{
                  fontFamily: "'IM Fell English SC', serif",
                  fontSize: 27,
                  lineHeight: 1.05,
                  letterSpacing: '0.04em',
                  color: 'oklch(0.93 0.05 88)',
                  textShadow: '0 0 24px rgba(70, 180, 172, 0.4)',
                }}
              >
                The Ledger
              </span>
            </div>
            <button
              type="button"
              data-ui="redist-log-close-x"
              onClick={onClose}
              aria-label="Close the ledger"
              style={{
                flex: '0 0 auto',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(10, 24, 26, 0.8)',
                border: '1px solid rgba(120, 190, 178, 0.34)',
                color: 'rgba(196, 226, 218, 0.85)',
                fontFamily: "'Cormorant Unicase', serif",
                fontSize: 17,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          {/* scroll body - the whole point of this task: contained within
              the modal's own fixed bounds (flex: 1 1 auto + minHeight: 0
              is what lets overflowY: auto actually kick in inside a flex
              column, rather than the modal growing to fit every entry and
              pushing the header/footer off-screen) so an arbitrarily long
              game (up to 40 tricks) never becomes inaccessible. */}
          <div
            data-ui="redist-log-scroll"
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              padding: '14px 16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(198, 160, 78, 0.4) rgba(158, 196, 186, 0.06)',
            }}
          >
            {entries.length === 0 ? (
              <p
                style={{
                  margin: '4px 0 0',
                  textAlign: 'center',
                  fontFamily: "'EB Garamond', serif",
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: 'rgba(158, 196, 186, 0.55)',
                }}
              >
                No tricks resolved yet.
              </p>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.trickNumber}
                  data-ui="redist-log-entry"
                  data-trick={entry.trickNumber}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '10px 12px 12px',
                    borderTop: '1px solid rgba(120, 190, 178, 0.24)',
                    borderBottom: '1px solid rgba(120, 190, 178, 0.24)',
                    background: 'rgba(6, 20, 22, 0.5)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Cormorant Unicase', serif",
                      fontWeight: 700,
                      fontSize: 9,
                      letterSpacing: '0.16em',
                      color: 'oklch(0.86 0.09 84)',
                    }}
                  >
                    Trick {entry.trickNumber}
                  </span>

                  {entry.perspective === 'received' ? (
                    <>
                      <span style={{ fontFamily: "'EB Garamond', serif", fontSize: 13, color: 'rgba(206, 222, 218, 0.82)' }}>
                        Received from {entry.fromPlayerLabel}
                      </span>
                      <CardRow cards={entry.groups[0].cards} />
                    </>
                  ) : (
                    <>
                      <span style={{ fontFamily: "'EB Garamond', serif", fontSize: 13, color: 'rgba(206, 222, 218, 0.82)' }}>
                        {entry.wonByDouble ? 'You redistributed as delegate' : 'You redistributed'}
                      </span>
                      {entry.groups.map((group, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: 12, color: 'rgba(158, 196, 186, 0.7)' }}>
                            {group.toPlayerLabel}
                          </span>
                          <CardRow cards={group.cards} />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* footer */}
          <div
            data-ui="redist-log-footer"
            style={{
              flex: '0 0 auto',
              padding: '12px 16px 16px',
              borderTop: '1px solid rgba(198, 160, 78, 0.26)',
              background: 'linear-gradient(180deg, rgba(6, 14, 17, 0), rgba(4, 9, 12, 0.9))',
            }}
          >
            <button
              type="button"
              data-ui="redist-log-close-button"
              onClick={onClose}
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
                Seal the ledger
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
