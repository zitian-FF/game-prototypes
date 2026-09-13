// The lesson text/callout shown alongside a guided moment (suits-mp-
// tutorial-design.md, Section 3) - a small, non-blocking banner near the
// top of the screen, well clear of the hand fan/guide pointer below.
// `pointerEvents: 'none'` throughout: this never intercepts a tap meant
// for the canvas underneath (the hard-locked card, or later a locked
// seat/button).
export interface TutorialLessonBannerProps {
  text: string;
}

export function TutorialLessonBanner({ text }: TutorialLessonBannerProps): JSX.Element {
  return (
    <div
      data-ui="tutorial-lesson-banner"
      style={{
        position: 'absolute',
        left: 20,
        right: 20,
        top: 92,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          padding: '10px 18px',
          maxWidth: 340,
          background: 'linear-gradient(180deg, rgba(30, 24, 12, 0.88), rgba(7, 12, 15, 0.92))',
          border: '1px solid rgba(198, 160, 78, 0.4)',
          borderRadius: 4,
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
          fontFamily: "'EB Garamond', Georgia, serif",
          fontSize: 14,
          lineHeight: 1.4,
          textAlign: 'center',
          color: 'oklch(0.93 0.04 88)',
        }}
      >
        {text}
      </div>
    </div>
  );
}
