import { useState } from 'react';
import './RulesModal.css';
import { CYCLE, NUMERALS, SECTIONS, cycleBg, cycleBorder, cycleTeamColor } from './rulesContent';
import { GOD_MOTIF } from '../rules/godArt';
import { HEX_CLIP_PATH, symbolArtUrl } from './godArtUrl';

// Ported from the Claude Design handoff (`Suit of Madness Rules.dc.html`).
// Structure and inline styles mirror the source closely (gradients, oklch
// colors, clip-path polygons) since that's the most faithful way to
// reproduce a bespoke, non-utility visual design pixel-for-pixel - see
// root CLAUDE.md's UI implementation split. Only real CSS pseudo-classes
// (:hover/:active, ::-webkit-scrollbar) and the seethe keyframe live in
// RulesModal.css; everything else is inline, same as the source.

export interface RulesModalProps {
  onClose: () => void;
}

const DEFAULT_OPEN: Record<string, boolean> = { objective: true, cycle: true };

export function RulesModal({ onClose }: RulesModalProps): JSX.Element {
  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN);

  const toggle = (id: string): void => setOpen((s) => ({ ...s, [id]: !s[id] }));
  const allOpen = SECTIONS.every((s) => open[s.id]);
  const toggleAll = (): void => {
    if (allOpen) {
      setOpen({});
    } else {
      const next: Record<string, boolean> = {};
      for (const s of SECTIONS) next[s.id] = true;
      setOpen(next);
    }
  };

  return (
    <div
      data-ui="rules-screen"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        color: 'oklch(0.90 0.02 90)',
        fontFamily: "'EB Garamond', Georgia, serif",
      }}
    >
      {/* scrim: the screen beneath (game) shows through, blurred */}
      <div
        data-ui="rules-scrim"
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
        data-ui="rules-modal"
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
            data-ui="rules-header"
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
                The Rites
              </span>
            </div>
            <button
              type="button"
              data-ui="rules-close-x"
              onClick={onClose}
              aria-label="Close the rites"
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

          {/* scroll body */}
          <div
            data-ui="rules-scroll"
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              padding: '14px 16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(198, 160, 78, 0.4) rgba(158, 196, 186, 0.06)',
            }}
          >
            <p
              style={{
                margin: '0 0 4px',
                fontFamily: "'EB Garamond', serif",
                fontStyle: 'italic',
                fontSize: 15,
                lineHeight: 1.55,
                color: 'rgba(188, 214, 208, 0.72)',
                textWrap: 'pretty',
              }}
            >
              Four are seated, two covenants contend, and the suits turn in an order no player may break.
            </p>

            {SECTIONS.map((sec, i) => {
              const isOpen = !!open[sec.id];
              return (
                <div
                  key={sec.id}
                  data-ui="rules-section"
                  data-section={sec.id}
                  data-open={isOpen}
                  style={{
                    borderTop: `1px solid ${sec.tone.line}`,
                    borderBottom: `1px solid ${sec.tone.line}`,
                    background: isOpen ? sec.tone.bg : 'rgba(6, 12, 15, 0.5)',
                  }}
                >
                  <button
                    type="button"
                    data-ui="rules-section-toggle"
                    onClick={() => toggle(sec.id)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 56,
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      background: 'transparent',
                      border: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        flex: '0 0 auto',
                        width: 26,
                        height: 26,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${sec.tone.dim}`,
                        transform: 'rotate(45deg)',
                      }}
                    >
                      <span
                        style={{
                          transform: 'rotate(-45deg)',
                          fontFamily: "'Cormorant Unicase', serif",
                          fontWeight: 700,
                          fontSize: 10,
                          letterSpacing: '0.04em',
                          color: sec.tone.accent,
                        }}
                      >
                        {NUMERALS[i]}
                      </span>
                    </span>
                    <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span
                        style={{
                          fontFamily: "'IM Fell English SC', serif",
                          fontSize: 17,
                          lineHeight: 1.15,
                          letterSpacing: '0.02em',
                          color: 'oklch(0.93 0.03 92)',
                        }}
                      >
                        {sec.title}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Cormorant Unicase', serif",
                          fontWeight: 500,
                          fontSize: 8,
                          letterSpacing: '0.16em',
                          color: sec.tone.soft,
                        }}
                      >
                        {sec.kicker}
                      </span>
                    </span>
                    <span
                      style={{
                        flex: '0 0 auto',
                        fontFamily: "'Cormorant Unicase', serif",
                        fontSize: 15,
                        color: sec.tone.accent,
                        transition: 'transform 220ms ease',
                        transform: `rotate(${isOpen ? 180 : 0}deg)`,
                      }}
                    >
                      ⌄
                    </span>
                  </button>

                  {isOpen && (
                    <div data-ui="rules-section-body" style={{ padding: '0 16px 16px 51px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                      {sec.body.map((para, j) => (
                        <p
                          key={j}
                          style={{
                            margin: 0,
                            fontFamily: "'EB Garamond', serif",
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: 'oklch(0.87 0.015 95)',
                            textWrap: 'pretty',
                          }}
                        >
                          {para}
                        </p>
                      ))}

                      {sec.isCycle && (
                        <div
                          data-ui="suit-cycle-diagram"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 7,
                            padding: '12px 12px 13px',
                            border: '1px solid rgba(120, 190, 178, 0.2)',
                            background: 'rgba(6, 20, 22, 0.7)',
                          }}
                        >
                          {CYCLE.map((god) => (
                            <div key={god.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span
                                style={{
                                  flex: '0 0 auto',
                                  width: 28,
                                  height: 28,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  border: `1px solid ${cycleBorder(god.tone)}`,
                                  background: cycleBg(god.tone),
                                  borderRadius: GOD_MOTIF[god.god] === 'circle' ? '50%' : 0,
                                  clipPath: GOD_MOTIF[god.god] === 'hex' ? HEX_CLIP_PATH : undefined,
                                }}
                              >
                                <img src={symbolArtUrl(god.god)} alt={god.code} style={{ width: 19, height: 19, objectFit: 'contain' }} />
                              </span>
                              <span
                                style={{
                                  flex: '1 1 auto',
                                  minWidth: 0,
                                  fontFamily: "'IM Fell English SC', serif",
                                  fontSize: 15,
                                  color: 'oklch(0.91 0.02 96)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {god.name}
                              </span>
                              <span
                                style={{
                                  flex: '0 0 auto',
                                  fontFamily: "'Cormorant Unicase', serif",
                                  fontWeight: 500,
                                  fontSize: 8,
                                  letterSpacing: '0.14em',
                                  color: cycleTeamColor(god.tone),
                                }}
                              >
                                {god.team}
                              </span>
                            </div>
                          ))}
                          <div
                            style={{
                              paddingTop: 3,
                              fontFamily: "'Cormorant Unicase', serif",
                              fontWeight: 500,
                              fontSize: 8,
                              letterSpacing: '0.16em',
                              color: 'rgba(158, 196, 186, 0.5)',
                            }}
                          >
                            ↻ then Yog-Sothoth again, without end
                          </div>
                        </div>
                      )}

                      {sec.isOffSuit && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                          <div
                            style={{
                              padding: '11px 11px 12px',
                              border: '1px solid rgba(120, 190, 178, 0.24)',
                              background: 'rgba(6, 20, 22, 0.72)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "'Cormorant Unicase', serif",
                                fontWeight: 700,
                                fontSize: 9,
                                letterSpacing: '0.14em',
                                color: 'oklch(0.82 0.08 178)',
                              }}
                            >
                              Single off-suit
                            </span>
                            <span
                              style={{
                                fontFamily: "'EB Garamond', serif",
                                fontSize: 13,
                                lineHeight: 1.45,
                                color: 'rgba(206, 222, 218, 0.78)',
                              }}
                            >
                              Counts as rank 0. It never wins the trick.
                            </span>
                          </div>
                          <div
                            style={{
                              padding: '11px 11px 12px',
                              border: '1px solid rgba(170, 132, 216, 0.4)',
                              background: 'rgba(22, 16, 38, 0.75)',
                              boxShadow: 'inset 0 0 22px rgba(104, 58, 168, 0.24)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "'Cormorant Unicase', serif",
                                fontWeight: 700,
                                fontSize: 9,
                                letterSpacing: '0.14em',
                                color: 'oklch(0.84 0.09 300)',
                              }}
                            >
                              Twin Awakening
                            </span>
                            <span
                              style={{
                                fontFamily: "'EB Garamond', serif",
                                fontSize: 13,
                                lineHeight: 1.45,
                                color: 'rgba(214, 206, 232, 0.8)',
                              }}
                            >
                              Two cards of equal rank, any suits. It may win.
                            </span>
                          </div>
                        </div>
                      )}

                      {sec.note && (
                        <div
                          data-ui="rules-note"
                          style={{
                            padding: '10px 12px',
                            borderLeft: `1px solid ${sec.tone.dim}`,
                            background: 'rgba(8, 16, 19, 0.6)',
                            fontFamily: "'EB Garamond', serif",
                            fontStyle: 'italic',
                            fontSize: 13,
                            lineHeight: 1.55,
                            color: 'rgba(196, 218, 212, 0.74)',
                          }}
                        >
                          {sec.note}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div
              style={{
                padding: '10px 0 2px',
                textAlign: 'center',
                fontFamily: "'Cormorant Unicase', serif",
                fontWeight: 500,
                fontSize: 8,
                letterSpacing: '0.2em',
                color: 'rgba(158, 196, 186, 0.3)',
              }}
            >
              ✦ Here the rites end ✦
            </div>
          </div>

          {/* footer: one-handed dismiss */}
          <div
            data-ui="rules-footer"
            style={{
              flex: '0 0 auto',
              padding: '12px 16px 16px',
              borderTop: '1px solid rgba(198, 160, 78, 0.26)',
              background: 'linear-gradient(180deg, rgba(6, 14, 17, 0), rgba(4, 9, 12, 0.9))',
            }}
          >
            <div style={{ display: 'flex', gap: 9 }}>
              <button
                type="button"
                data-ui="rules-expand-all"
                onClick={toggleAll}
                style={{
                  flex: '0 0 auto',
                  minHeight: 52,
                  padding: '0 14px',
                  background: 'rgba(10, 24, 26, 0.8)',
                  border: '1px solid rgba(120, 190, 178, 0.3)',
                  color: 'rgba(186, 220, 212, 0.82)',
                  fontFamily: "'Cormorant Unicase', serif",
                  fontWeight: 500,
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                }}
              >
                {allOpen ? 'Fold all' : 'Unfold all'}
              </button>
              <button
                type="button"
                data-ui="rules-close-button"
                onClick={onClose}
                style={{
                  flex: '1 1 auto',
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
                  Seal the book
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
