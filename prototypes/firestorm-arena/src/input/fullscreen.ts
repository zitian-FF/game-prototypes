// Fullscreen and landscape lock. Browsers only allow both from inside a user gesture, so this
// hooks the first taps and clicks rather than running at load. iOS Safari has no usable
// Fullscreen or orientation-lock API for web pages, so it is left alone.

const ua = navigator.userAgent;
const IOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);

type FsDoc = Document & { webkitFullscreenElement?: Element | null };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(document.fullscreenElement || d.webkitFullscreenElement);
}

async function enter(): Promise<void> {
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    /* refused (embedded frame, permissions policy, no gesture): keep playing windowed */
  }
  try {
    // Only Chromium on Android allows this, and only while fullscreen.
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (isFullscreen() && o?.lock) await o.lock('landscape');
  } catch {
    /* unsupported */
  }
}

/**
 * Ask for fullscreen landscape on taps and clicks. Touch devices retry on every tap while not
 * fullscreen (a swipe can drop out of it); desktop asks once so Esc stays respected.
 */
export function installFullscreen(isTouch: () => boolean): void {
  if (IOS) return;
  let desktopAsked = false;
  const onGesture = () => {
    if (isFullscreen()) return;
    if (!isTouch()) {
      if (desktopAsked) return;
      desktopAsked = true;
    }
    void enter();
  };
  window.addEventListener('pointerup', onGesture);
}
