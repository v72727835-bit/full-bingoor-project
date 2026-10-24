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
