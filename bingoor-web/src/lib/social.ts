/* Opens Google's and Facebook's own sign-in windows and hands back an access token for the server to check. */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (r: { access_token?: string; error?: string }) => void;
            error_callback?: () => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
    FB?: {
      init: (cfg: { appId: string; version: string; cookie?: boolean; xfbml?: boolean }) => void;
      login: (cb: (r: { authResponse?: { accessToken: string } }) => void, opts: { scope: string }) => void;
    };
  }
}

function loadScript(src: string, ready: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ready()) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Could not reach the sign-in service. Check your internet connection.'));
    document.body.appendChild(el);
  });
}

export async function googleAccessToken(clientId: string): Promise<string> {
  await loadScript('https://accounts.google.com/gsi/client', () => !!window.google?.accounts?.oauth2);
  return new Promise((resolve, reject) => {
    window.google!.accounts.oauth2
      .initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error('Google sign-in did not finish.'))),
        error_callback: () => reject(new Error('Google sign-in was closed.')),
      })
      .requestAccessToken();
  });
}

export async function facebookAccessToken(appId: string): Promise<string> {
  await loadScript('https://connect.facebook.net/en_US/sdk.js', () => !!window.FB);
  window.FB!.init({ appId, version: 'v19.0', cookie: true, xfbml: false });
  return new Promise((resolve, reject) => {
    window.FB!.login((r) => (r.authResponse?.accessToken ? resolve(r.authResponse.accessToken) : reject(new Error('Facebook sign-in was closed.'))), {
      scope: 'public_profile,email',
    });
  });
}

const IG_STATE = 'bingoor_ig_state';
const IG_NEXT = 'bingoor_ig_next';

/** Where Instagram sends the customer back to; must be listed as a redirect URI in the Meta app. */
export const instagramRedirectUri = () => `${window.location.origin}/auth/instagram`;

/**
 * Continue with Instagram: Instagram has no popup SDK, so the page goes to
 * Instagram's own login and comes back to /auth/instagram with a code.
 */
export function startInstagramLogin(appId: string, next: string) {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, '0')).join('');
  try {
    sessionStorage.setItem(IG_STATE, state);
    sessionStorage.setItem(IG_NEXT, next);
  } catch {
    /* private mode: the state check below then fails safely */
  }
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', instagramRedirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'instagram_business_basic');
  url.searchParams.set('state', state);
  window.location.assign(url.toString());
}

/** Reads (once) what startInstagramLogin saved: whether the state matches, and where to go next. */
export function finishInstagramLogin(state: string | null): { ok: boolean; next: string } {
  let saved: string | null = null;
  let next = '/';
  try {
    saved = sessionStorage.getItem(IG_STATE);
    next = sessionStorage.getItem(IG_NEXT) || '/';
    sessionStorage.removeItem(IG_STATE);
    sessionStorage.removeItem(IG_NEXT);
  } catch {
    /* ignore */
  }
  // Only same-site paths, never a full URL from the query string.
  if (!next.startsWith('/') || next.startsWith('//')) next = '/';
  return { ok: !!state && state === saved, next };
}
