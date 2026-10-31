/**
 * Point 6: "Add to Home Screen" in one tap.
 *
 * Chrome / Edge / Samsung Internet fire `beforeinstallprompt` once, early in
 * the page's life. A button mounted later (the Account page, the footer) used
 * to miss it and fell back to written instructions. An inline script in the
 * page head (INSTALL_BOOT, see layout.tsx) now catches the event before React
 * starts; every button reads it from here and opens the browser's own install
 * dialog directly.
 */
export interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type W = Window & { __bingoorInstall?: InstallPrompt | null };

export const INSTALL_READY = 'bingoor:install-ready';

/** Runs in <head> before the app: keeps the install event for later. */
export const INSTALL_BOOT = `(function(){window.__bingoorInstall=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bingoorInstall=e;window.dispatchEvent(new Event('${INSTALL_READY}'))});window.addEventListener('appinstalled',function(){window.__bingoorInstall=null;window.dispatchEvent(new Event('${INSTALL_READY}'))})})()`;

export function installPrompt(): InstallPrompt | null {
  if (typeof window === 'undefined') return null;
  return (window as W).__bingoorInstall ?? null;
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isIosSafari(): boolean {
  if (!isIos()) return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Opens the browser's install dialog. If the browser has not offered it yet
 * (it can take a moment after the page opens), waits up to `waitMs` for it -
 * still inside the tap, so the dialog may open. Resolves to:
 *  - 'accepted' / 'dismissed' - the customer answered the browser's dialog;
 *  - 'unavailable' - this browser never offers it (iPhone, Firefox, or the
 *    app is already installed).
 */
export async function promptInstall(waitMs = 3500): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  let ev = installPrompt();
  if (!ev && !isIos()) {
    ev = await new Promise<InstallPrompt | null>((resolve) => {
      const done = () => {
        window.removeEventListener(INSTALL_READY, done);
        clearTimeout(t);
        resolve(installPrompt());
      };
      const t = setTimeout(done, waitMs);
      window.addEventListener(INSTALL_READY, done);
    });
  }
  if (!ev) return 'unavailable';
  // The event can be used once; the browser fires a fresh one if it is needed again.
  (window as W).__bingoorInstall = null;
  window.dispatchEvent(new Event(INSTALL_READY));
  await ev.prompt();
  const choice = await ev.userChoice?.catch(() => undefined);
  return choice?.outcome ?? 'accepted';
}
