import { useEffect, useRef, useState } from 'react';
import './LobbyFlow.css';
import { ERRORS, SUBTITLES, type Screen, type ErrorKind } from './lobbyContent';
import { seatModel, type SeatInfo } from './lobbySeats';
import { goToJoinScreen, goToLandingScreen } from './lobbyUiStore';
import { isValidLobbyCode, normalizeLobbyCode, LOBBY_CODE_LENGTH } from '../../net/lobbyCode';

// Display name is capped to this many characters (matches the wireframe's
// fixed-width name column in the seat list) - enforced via the input's own
// maxLength, no other validation.
const DISPLAY_NAME_MAX_LENGTH = 20;

// Ported from the Claude Design handoff (`Suit of Madness Lobby.dc.html`).
// Now a fully controlled component: `screen`/`roomCode`/`seats` and every
// networked action (host, join, bot fill/release, start, refresh, cancel/
// retry) are driven entirely by whichever real scene currently owns the
// flow (LandingScene, HostLobbyScene, ConnectingScene - see
// dom/lobby/lobbyUiStore.ts). This component holds no game/network state
// of its own; the only local state left is the join code-entry draft and
// the transient copy-to-clipboard toast, neither of which needs to survive
// outside a single render pass.
//
// Two screen transitions stay purely local (Landing <-> the join code-entry
// screen): they involve no scene/network action, so lobbyUiStore exposes
// them as plain store mutations rather than routing through a scene.
//
// Structured for future binding: every element keeps the design's own
// data-ui/data-bind/data-state attributes even where nothing reads them
// yet.

export interface LobbyFlowProps {
  screen: Screen;
  roomCode: string;
  seats: SeatInfo[];
  hostLeft: boolean;
  refreshCodeError: boolean;
  onSinglePlayer: () => void;
  onHost: (name: string) => void;
  onSubmitJoin: (code: string, name: string) => void;
  onFillBot: (index: number) => void;
  onReleaseBot: (index: number) => void;
  onStartGame: () => void;
  onRefreshCode: () => void;
  onBack: () => void;
  onRetry: () => void;
}

const isErrorKind = (s: Screen): s is ErrorKind => s in ERRORS;

export function LobbyFlow({
  screen,
  roomCode,
  seats,
  hostLeft,
  refreshCodeError,
  onSinglePlayer,
  onHost,
  onSubmitJoin,
  onFillBot,
  onReleaseBot,
  onStartGame,
  onRefreshCode,
  onBack,
  onRetry,
}: LobbyFlowProps): JSX.Element {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [copyToast, setCopyToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  // Clear any leftover code-entry draft whenever we land back on the join
  // screen from somewhere else (e.g. after an error sends us back here).
  useEffect(() => {
    if (screen === 'join') setCode('');
  }, [screen]);

  const copy = (what: 'code' | 'link'): void => {
    const text = what === 'code' ? roomCode : `${location.origin}${location.pathname}?lobby=${roomCode}`;
    if (navigator.clipboard) void navigator.clipboard.writeText(text).catch(() => {});
    setCopyToast(what === 'code' ? 'Sigil copied.' : 'Summons copied.');
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setCopyToast(''), 2200);
  };

  const filled = seats.filter((s) => s.occupancy !== null).length;
  const canStart = filled === 4;
  const codeValid = isValidLobbyCode(code);
  const isBusy = screen === 'joining' || screen === 'reconnecting';
  const err = isErrorKind(screen) ? ERRORS[screen] : null;

  return (
    <div
      data-ui="lobby-screen"
      data-bind="screen"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'auto',
        color: 'oklch(0.90 0.02 90)',
        fontFamily: "'EB Garamond', Georgia, serif",
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 300,
          width: 520,
          height: 520,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          background: 'radial-gradient(closest-side, rgba(40, 150, 148, 0.18) 0%, rgba(30, 90, 120, 0.09) 45%, rgba(0,0,0,0) 72%)',
          filter: 'blur(6px)',
          animation: 'somSeethe 48s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.5,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.42'/></svg>")`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(120% 78% at 50% 40%, rgba(0,0,0,0) 42%, rgba(2, 5, 7, 0.86) 100%)',
        }}
      />

      {/* masthead (all screens) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 34, height: 1, background: 'linear-gradient(90deg, rgba(176,142,66,0) 0%, rgba(176,142,66,0.6) 100%)' }} />
          <span style={{ color: 'rgba(212, 176, 96, 0.8)', fontSize: 11 }}>✦</span>
          <span style={{ width: 34, height: 1, background: 'linear-gradient(90deg, rgba(176,142,66,0.6) 0%, rgba(176,142,66,0) 100%)' }} />
        </div>
        <div
          style={{
            fontFamily: "'IM Fell English SC', serif",
            fontSize: 30,
            lineHeight: 1.05,
            letterSpacing: '0.04em',
            textAlign: 'center',
            color: 'oklch(0.93 0.05 88)',
            textShadow: '0 0 30px rgba(70, 180, 172, 0.45), 0 0 6px rgba(0,0,0,0.9)',
          }}
        >
          Suit of Madness
        </div>
        <div
          data-bind="screen-subtitle"
          style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 500, fontSize: 11, letterSpacing: '0.28em', color: 'oklch(0.76 0.06 178)' }}
        >
          {SUBTITLES[screen]}
        </div>
      </div>

      {screen === 'landing' && (
        <div data-ui="screen-landing" style={{ position: 'absolute', left: 26, right: 26, top: 268, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            data-ui="name-input-wrap"
            style={{
              padding: '10px 14px 12px',
              borderTop: '1px solid rgba(198, 160, 78, 0.3)',
              borderBottom: '1px solid rgba(198, 160, 78, 0.3)',
              background: 'linear-gradient(180deg, rgba(20, 16, 8, 0.65), rgba(6, 10, 13, 0.7))',
            }}
          >
            <span
              style={{
                fontFamily: "'Cormorant Unicase', serif",
                fontWeight: 500,
                fontSize: 9,
                letterSpacing: '0.2em',
                color: 'rgba(212, 186, 132, 0.6)',
              }}
            >
              Thy name (optional)
            </span>
            <input
              data-ui="display-name-input"
              data-bind="display-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, DISPLAY_NAME_MAX_LENGTH))}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
              placeholder="Nameless wanderer"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                padding: '4px 0 6px',
                background: 'transparent',
                border: 0,
                borderBottom: '1px solid rgba(198, 160, 78, 0.28)',
                outline: 'none',
                fontFamily: "'EB Garamond', serif",
                fontSize: 18,
                color: 'oklch(0.93 0.04 88)',
                caretColor: 'oklch(0.85 0.09 84)',
              }}
            />
          </div>
          <button
            type="button"
            data-ui="host-button"
            onClick={() => onHost(name.trim())}
            style={{
              width: '100%',
              padding: 1,
              boxSizing: 'border-box',
              border: 0,
              background: 'linear-gradient(180deg, rgba(226, 188, 96, 0.9), rgba(120, 88, 30, 0.55))',
              clipPath:
                'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
              boxShadow: '0 0 40px rgba(212, 168, 66, 0.32)',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                height: 78,
                background: 'linear-gradient(180deg, rgba(106, 78, 22, 0.96), rgba(38, 28, 10, 0.97))',
                clipPath:
                  'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
              }}
            >
              <span style={{ fontFamily: "'IM Fell English SC', serif", fontSize: 24, letterSpacing: '0.05em', color: 'oklch(0.97 0.04 92)', textShadow: '0 0 16px rgba(252, 216, 130, 0.55)' }}>
                Open a Circle
              </span>
              <span style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 500, fontSize: 9, letterSpacing: '0.18em', color: 'rgba(252, 228, 170, 0.72)' }}>
                Host · summon three others
              </span>
            </span>
          </button>
          <button
            type="button"
            data-ui="join-button"
            onClick={goToJoinScreen}
            style={{
              width: '100%',
              height: 78,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'linear-gradient(180deg, rgba(14, 40, 42, 0.9), rgba(6, 14, 18, 0.93))',
              border: '1px solid rgba(120, 190, 178, 0.4)',
              clipPath:
                'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
              boxShadow: 'inset 0 0 30px rgba(28, 120, 116, 0.22)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontFamily: "'IM Fell English SC', serif", fontSize: 24, letterSpacing: '0.05em', color: 'oklch(0.93 0.04 176)' }}>Enter a Circle</span>
            <span style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 500, fontSize: 9, letterSpacing: '0.18em', color: 'rgba(158, 210, 198, 0.7)' }}>
              Join · with a five-mark sigil
            </span>
          </button>
          <div style={{ textAlign: 'center', fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: 13, color: 'rgba(158, 196, 186, 0.5)' }}>
            Four must sit before the deal.
          </div>
          <button
            type="button"
            data-ui="single-player-button"
            onClick={onSinglePlayer}
            style={{
              alignSelf: 'center',
              padding: '8px 4px',
              background: 'transparent',
              border: 0,
              color: 'rgba(158, 196, 186, 0.4)',
              fontFamily: "'Cormorant Unicase', serif",
              fontWeight: 500,
              fontSize: 9,
              letterSpacing: '0.14em',
              cursor: 'pointer',
            }}
          >
            Single Player (play with bots)
          </button>
        </div>
      )}

      {screen === 'lobby' && (
        <div data-ui="screen-lobby" style={{ position: 'absolute', left: 22, right: 22, top: 178, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            data-ui="room-code-panel"
            style={{
              padding: '12px 16px 14px',
              borderTop: '1px solid rgba(198, 160, 78, 0.4)',
              borderBottom: '1px solid rgba(198, 160, 78, 0.4)',
              background: 'linear-gradient(180deg, rgba(30, 24, 12, 0.86), rgba(7, 12, 15, 0.9))',
              boxShadow: 'inset 0 0 40px rgba(120, 88, 30, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 500, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(212, 186, 132, 0.65)' }}>
                Sigil of the circle
              </span>
              <button
                type="button"
                data-ui="refresh-code-button"
                onClick={onRefreshCode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  minHeight: 44,
                  padding: '0 12px',
                  background: 'rgba(10, 24, 26, 0.7)',
                  border: '1px solid rgba(120, 190, 178, 0.32)',
                  color: 'rgba(180, 222, 212, 0.85)',
                  fontFamily: "'Cormorant Unicase', serif",
                  fontWeight: 500,
                  fontSize: 8,
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                }}
              >
                ↻ Re-announce
              </button>
            </div>
            <div
              data-bind="room-code"
              style={{
                padding: '8px 0 2px',
                textAlign: 'center',
                fontFamily: "'Cormorant Unicase', serif",
                fontWeight: 700,
                fontSize: 46,
                lineHeight: 1,
                letterSpacing: '0.22em',
                textIndent: '0.22em',
                color: 'oklch(0.95 0.06 90)',
                textShadow: '0 0 32px rgba(226, 182, 84, 0.45), 0 0 4px rgba(0,0,0,0.9)',
              }}
            >
              {roomCode}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 12 }}>
              <button
                type="button"
                data-ui="copy-code-button"
                onClick={() => copy('code')}
                style={{
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  background: 'rgba(48, 38, 16, 0.7)',
                  border: '1px solid rgba(198, 160, 78, 0.45)',
                  color: 'oklch(0.88 0.06 86)',
                  fontFamily: "'Cormorant Unicase', serif",
                  fontWeight: 500,
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                }}
              >
                ◫ Copy sigil
              </button>
              <button
                type="button"
                data-ui="copy-link-button"
                onClick={() => copy('link')}
                style={{
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  background: 'rgba(48, 38, 16, 0.7)',
                  border: '1px solid rgba(198, 160, 78, 0.45)',
                  color: 'oklch(0.88 0.06 86)',
                  fontFamily: "'Cormorant Unicase', serif",
                  fontWeight: 500,
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                }}
              >
                ⛓ Copy summons
              </button>
            </div>
            <div
              data-bind="copy-toast"
              style={{
                paddingTop: 8,
                textAlign: 'center',
                fontFamily: "'EB Garamond', serif",
                fontStyle: 'italic',
                fontSize: 12,
                color: !copyToast && refreshCodeError ? 'rgba(224, 120, 120, 0.85)' : 'rgba(180, 222, 212, 0.8)',
                minHeight: 16,
              }}
            >
              {copyToast || (refreshCodeError ? 'Re-announcement failed — tap ↻ to try again.' : '')}
            </div>
          </div>

          <div data-ui="seat-list" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 2 }}>
              <span style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 500, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(158, 196, 186, 0.6)' }}>
                The four seats
              </span>
              <span
                data-bind="seat-count"
                style={{
                  fontFamily: "'Cormorant Unicase', serif",
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  color: canStart ? 'oklch(0.85 0.09 84)' : 'rgba(158, 196, 186, 0.6)',
                }}
              >
                {filled} / 4 seated
              </span>
            </div>
            {seatModel(seats, onFillBot, onReleaseBot).map((seat) => (
              <div
                key={seat.id}
                data-ui="seat-row"
                data-seat={seat.id}
                data-state={seat.state}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 56,
                  padding: '4px 12px',
                  borderTop: `1px solid ${seat.line}`,
                  borderBottom: `1px solid ${seat.line}`,
                  background: seat.bg,
                }}
              >
                <span style={{ width: 22, fontFamily: "'Cormorant Unicase', serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', color: seat.numColor }}>
                  {seat.numeral}
                </span>
                <span style={{ fontSize: 10, color: seat.dotColor }}>{seat.glyph}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span
                    data-bind="seat-name"
                    style={{
                      fontFamily: "'IM Fell English SC', serif",
                      fontSize: 16,
                      letterSpacing: '0.02em',
                      color: seat.nameColor,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {seat.name}
                  </span>
                  <span data-bind="seat-role" style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 500, fontSize: 8, letterSpacing: '0.16em', color: seat.roleColor }}>
                    {seat.role}
                  </span>
                </span>
                {seat.canFill && (
                  <button
                    type="button"
                    data-ui="fill-bot-button"
                    onClick={seat.fill}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(22, 18, 38, 0.8)',
                      border: '1px dashed rgba(170, 132, 216, 0.5)',
                      color: 'oklch(0.84 0.07 300)',
                      fontFamily: "'Cormorant Unicase', serif",
                      fontWeight: 500,
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      cursor: 'pointer',
                    }}
                  >
                    ✦ Bind a thrall
                  </button>
                )}
                {seat.canRelease && (
                  <button
                    type="button"
                    data-ui="release-bot-button"
                    onClick={seat.release}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      background: 'transparent',
                      border: '1px solid rgba(170, 132, 216, 0.32)',
                      color: 'rgba(198, 174, 232, 0.7)',
                      fontFamily: "'Cormorant Unicase', serif",
                      fontWeight: 500,
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      cursor: 'pointer',
                    }}
                  >
                    Release
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            data-ui="start-game-button"
            data-bind="start-enabled"
            data-enabled={canStart}
            onClick={() => canStart && onStartGame()}
            style={{
              width: '100%',
              padding: 1,
              boxSizing: 'border-box',
              border: 0,
              background: canStart ? 'linear-gradient(180deg, rgba(226, 188, 96, 0.9), rgba(120, 88, 30, 0.55))' : 'rgba(90, 104, 104, 0.22)',
              clipPath:
                'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
              boxShadow: canStart ? '0 0 44px rgba(212, 168, 66, 0.42)' : 'none',
              cursor: canStart ? 'pointer' : 'not-allowed',
            }}
          >
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                height: 64,
                background: canStart
                  ? 'linear-gradient(180deg, rgba(106, 78, 22, 0.96), rgba(38, 28, 10, 0.97))'
                  : 'linear-gradient(180deg, rgba(16, 24, 26, 0.9), rgba(8, 12, 14, 0.92))',
                clipPath:
                  'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
              }}
            >
              <span style={{ fontFamily: "'IM Fell English SC', serif", fontSize: 22, letterSpacing: '0.05em', color: canStart ? 'oklch(0.97 0.04 92)' : 'rgba(150, 176, 174, 0.4)' }}>
                Begin the Rite
              </span>
              <span
                data-bind="start-hint"
                style={{
                  fontFamily: "'Cormorant Unicase', serif",
                  fontWeight: 500,
                  fontSize: 8,
                  letterSpacing: '0.18em',
                  color: canStart ? 'rgba(252, 228, 170, 0.72)' : 'rgba(150, 176, 174, 0.32)',
                }}
              >
                {canStart ? 'All four are seated' : 'Four seats must be filled'}
              </span>
            </span>
          </button>
        </div>
      )}

      {screen === 'join' && (
        <div data-ui="screen-join" style={{ position: 'absolute', left: 26, right: 26, top: 268, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center', fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: 'rgba(178, 210, 202, 0.7)' }}>
            Speak the five marks given thee.
          </div>

          <div
            data-ui="code-input-wrap"
            style={{
              padding: '16px 14px 18px',
              borderTop: '1px solid rgba(120, 190, 178, 0.4)',
              borderBottom: '1px solid rgba(120, 190, 178, 0.4)',
              background: 'linear-gradient(180deg, rgba(10, 30, 32, 0.88), rgba(5, 11, 14, 0.92))',
              boxShadow: 'inset 0 0 40px rgba(28, 120, 116, 0.2)',
            }}
          >
            <div style={{ position: 'relative' }}>
              <input
                data-ui="room-code-input"
                data-bind="code-value"
                value={code}
                onChange={(e) => {
                  setCode(normalizeLobbyCode(e.target.value || '').slice(0, LOBBY_CODE_LENGTH));
                }}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={LOBBY_CODE_LENGTH}
                placeholder="—————"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 0 10px',
                  background: 'transparent',
                  border: 0,
                  borderBottom: '1px solid rgba(120, 190, 178, 0.28)',
                  outline: 'none',
                  textAlign: 'center',
                  fontFamily: "'Cormorant Unicase', serif",
                  fontWeight: 700,
                  fontSize: 42,
                  letterSpacing: '0.24em',
                  textIndent: '0.24em',
                  color: 'oklch(0.95 0.04 176)',
                  caretColor: 'oklch(0.85 0.09 84)',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 12 }}>
              {Array.from({ length: LOBBY_CODE_LENGTH }, (_, i) => (
                <span
                  key={i}
                  data-ui="code-pip"
                  data-filled={i < code.length}
                  style={{ width: 26, height: 2, background: i < code.length ? 'oklch(0.82 0.09 178)' : 'rgba(120, 190, 178, 0.22)' }}
                />
              ))}
            </div>
            <div
              data-bind="code-hint"
              style={{
                paddingTop: 10,
                textAlign: 'center',
                fontFamily: "'Cormorant Unicase', serif",
                fontWeight: 500,
                fontSize: 9,
                letterSpacing: '0.16em',
                color: codeValid ? 'oklch(0.82 0.09 84)' : 'rgba(158, 196, 186, 0.5)',
              }}
            >
              {codeValid ? 'The sigil is whole' : `${LOBBY_CODE_LENGTH - code.length} marks remain`}
            </div>
          </div>

          <button
            type="button"
            data-ui="submit-join-button"
            data-bind="join-enabled"
            data-enabled={codeValid}
            onClick={() => codeValid && onSubmitJoin(code, name.trim())}
            style={{
              width: '100%',
              padding: 1,
              boxSizing: 'border-box',
              border: 0,
              background: codeValid ? 'linear-gradient(180deg, rgba(150, 226, 210, 0.75), rgba(30, 96, 92, 0.5))' : 'rgba(90, 104, 104, 0.2)',
              clipPath:
                'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
              boxShadow: codeValid ? '0 0 40px rgba(70, 200, 186, 0.32)' : 'none',
              cursor: codeValid ? 'pointer' : 'not-allowed',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 62,
                background: codeValid
                  ? 'linear-gradient(180deg, rgba(20, 70, 68, 0.95), rgba(6, 20, 22, 0.96))'
                  : 'linear-gradient(180deg, rgba(16, 24, 26, 0.9), rgba(8, 12, 14, 0.92))',
                clipPath:
                  'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
                fontFamily: "'IM Fell English SC', serif",
                fontSize: 22,
                letterSpacing: '0.05em',
                color: codeValid ? 'oklch(0.95 0.04 176)' : 'rgba(150, 176, 174, 0.4)',
              }}
            >
              Enter
            </span>
          </button>
          <button
            type="button"
            data-ui="back-to-landing-button"
            onClick={goToLandingScreen}
            style={{
              alignSelf: 'center',
              padding: '8px 4px',
              background: 'transparent',
              border: 0,
              color: 'rgba(158, 196, 186, 0.55)',
              fontFamily: "'Cormorant Unicase', serif",
              fontWeight: 500,
              fontSize: 9,
              letterSpacing: '0.18em',
              cursor: 'pointer',
            }}
          >
            ← Turn back
          </button>
        </div>
      )}

      {screen === 'waiting' && (
        <div
          data-ui="screen-waiting"
          data-bind="host-left"
          data-state={hostLeft ? 'hostLeft' : 'waiting'}
          style={{
            position: 'absolute',
            left: 26,
            right: 26,
            top: 320,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            textAlign: 'center',
          }}
        >
          <div
            data-bind="waiting-title"
            style={{ fontFamily: "'IM Fell English SC', serif", fontSize: 22, letterSpacing: '0.04em', color: 'oklch(0.93 0.04 88)' }}
          >
            {hostLeft ? 'The host has vanished' : 'Thou art seated'}
          </div>
          <div
            data-bind="waiting-detail"
            style={{
              maxWidth: 260,
              fontFamily: "'EB Garamond', serif",
              fontStyle: 'italic',
              fontSize: 14,
              lineHeight: 1.5,
              color: 'rgba(178, 210, 202, 0.72)',
            }}
          >
            {hostLeft
              ? 'The circle has been severed. This session has ended.'
              : 'Waiting for the host to gather the rest and begin the rite.'}
          </div>
        </div>
      )}

      {isBusy && (
        <div data-ui="screen-busy" data-bind="busy-kind" style={{ position: 'absolute', left: 30, right: 30, top: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <div style={{ position: 'relative', width: 138, height: 138 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(176, 142, 66, 0.2)' }} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '1px solid transparent',
                borderTopColor: 'rgba(226, 182, 84, 0.85)',
                borderRightColor: 'rgba(120, 220, 206, 0.5)',
                animation: 'somCreep 2.6s linear infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 16,
                borderRadius: '50%',
                border: '1px dotted rgba(158, 196, 186, 0.24)',
                animation: 'somCreep 9s linear infinite reverse',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 62,
                height: 62,
                margin: '-31px 0 0 -31px',
                borderRadius: '50%',
                background: 'radial-gradient(50% 50% at 50% 40%, rgba(14, 46, 48, 0.95), rgba(4, 9, 12, 0.97))',
                border: '1px solid rgba(176, 142, 66, 0.26)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Cormorant Unicase', serif",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '0.14em',
                color: 'oklch(0.92 0.05 88)',
              }}
            >
              {roomCode}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div data-bind="busy-title" style={{ fontFamily: "'IM Fell English SC', serif", fontSize: 23, letterSpacing: '0.04em', color: 'oklch(0.93 0.04 88)' }}>
              {screen === 'reconnecting' ? 'Holding the thread' : 'Crossing over'}
            </div>
            <div
              data-bind="busy-detail"
              style={{
                maxWidth: 250,
                textAlign: 'center',
                fontFamily: "'EB Garamond', serif",
                fontStyle: 'italic',
                fontSize: 14,
                lineHeight: 1.5,
                color: 'rgba(178, 210, 202, 0.72)',
                animation: 'somPulse 3.4s ease-in-out infinite',
              }}
            >
              {screen === 'reconnecting'
                ? 'The link faltered. Waiting a moment before we call the circle again.'
                : 'Announcing thyself to the circle and opening the passage.'}
            </div>
          </div>
          <button
            type="button"
            data-ui="cancel-busy-button"
            onClick={onBack}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid rgba(158, 196, 186, 0.24)',
              color: 'rgba(178, 210, 202, 0.7)',
              fontFamily: "'Cormorant Unicase', serif",
              fontWeight: 500,
              fontSize: 9,
              letterSpacing: '0.18em',
              cursor: 'pointer',
            }}
          >
            Sever the thread
          </button>
        </div>
      )}

      {err && (
        <div data-ui="screen-error" data-bind="error-kind" data-error={screen} style={{ position: 'absolute', left: 26, right: 26, top: 286, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 76,
              height: 76,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${err.border}`,
              background: err.bg,
              boxShadow: `inset 0 0 30px ${err.inner}`,
              transform: 'rotate(45deg)',
            }}
          >
            <span style={{ transform: 'rotate(-45deg)', fontFamily: "'Cormorant Unicase', serif", fontWeight: 700, fontSize: 26, color: err.accent }}>{err.glyph}</span>
          </div>
          <div
            data-ui="error-banner"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '16px 18px',
              borderTop: `1px solid ${err.border}`,
              borderBottom: `1px solid ${err.border}`,
              background: err.bg,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              textAlign: 'center',
            }}
          >
            <span data-bind="error-title" style={{ fontFamily: "'IM Fell English SC', serif", fontSize: 22, lineHeight: 1.15, letterSpacing: '0.03em', color: err.accent }}>
              {err.title}
            </span>
            <span data-bind="error-detail" style={{ fontFamily: "'EB Garamond', serif", fontSize: 14, lineHeight: 1.55, color: 'rgba(200, 216, 212, 0.72)', textWrap: 'pretty' }}>
              {err.detail}
            </span>
            <span data-bind="error-code" style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 500, fontSize: 8, letterSpacing: '0.2em', color: 'rgba(158, 186, 186, 0.45)' }}>
              {err.tag}
            </span>
          </div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button
              type="button"
              data-ui="error-primary"
              onClick={onRetry}
              style={{
                width: '100%',
                height: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(72, 54, 18, 0.92), rgba(30, 22, 8, 0.94))',
                border: '1px solid rgba(198, 160, 78, 0.55)',
                clipPath:
                  'polygon(11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px), 0 11px)',
                color: 'oklch(0.93 0.05 90)',
                fontFamily: "'IM Fell English SC', serif",
                fontSize: 18,
                letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >
              {err.primary}
            </button>
            <button
              type="button"
              data-ui="error-secondary"
              onClick={onBack}
              style={{
                width: '100%',
                height: 46,
                background: 'transparent',
                border: '1px solid rgba(158, 196, 186, 0.24)',
                color: 'rgba(178, 210, 202, 0.72)',
                fontFamily: "'Cormorant Unicase', serif",
                fontWeight: 500,
                fontSize: 10,
                letterSpacing: '0.16em',
                cursor: 'pointer',
              }}
            >
              Return to the threshold
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 20,
          textAlign: 'center',
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 8,
          letterSpacing: '0.2em',
          color: 'rgba(158, 196, 186, 0.28)',
        }}
      >
        Portrait only · four seats · peer to peer
      </div>
    </div>
  );
}
