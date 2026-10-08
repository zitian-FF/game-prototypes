// Loads a portal SDK script once. Only portal builds call this; the default
// build never makes an external request.
export function loadScript(src: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    const timer = setTimeout(() => reject(new Error(`timed out loading ${src}`)), timeoutMs);
    s.src = src;
    s.async = true;
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); reject(new Error(`failed to load ${src}`)); };
    document.head.appendChild(s);
  });
}
