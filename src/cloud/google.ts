/** Google Identity Services (GIS) — real "Continue with Google" sign-in.
 *  Loaded lazily, only when the sign-in dialog opens; signed out, the app
 *  makes no network calls beyond fonts. */

declare global {
  interface Window { google?: any }
}

export interface GoogleClaims {
  name: string;
  email: string;
  sub: string;
  /** epoch seconds */
  exp: number;
}

export const ENV = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
  region: import.meta.env.VITE_AWS_REGION as string | undefined,
  identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID as string | undefined,
  bucket: import.meta.env.VITE_S3_BUCKET as string | undefined,
};

export function cloudConfigured(): boolean {
  return !!(ENV.googleClientId && ENV.region && ENV.identityPoolId && ENV.bucket);
}

let gisLoading: Promise<void> | null = null;

export function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => res();
    s.onerror = () => { gisLoading = null; rej(new Error('Could not load Google sign-in.')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

export function decodeJwt(credential: string): GoogleClaims {
  const part = credential.split('.')[1] || '';
  const json = decodeURIComponent(
    atob(part.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  const p = JSON.parse(json);
  return { name: p.name || p.email || '', email: p.email || '', sub: p.sub || '', exp: p.exp || 0 };
}

let credentialCb: ((credential: string) => void) | null = null;
let initialized = false;

export async function initGoogle(onCredential: (credential: string) => void): Promise<void> {
  credentialCb = onCredential;
  await loadGis();
  if (initialized) return;
  initialized = true;
  window.google.accounts.id.initialize({
    client_id: ENV.googleClientId,
    callback: (resp: { credential?: string }) => { if (resp.credential && credentialCb) credentialCb(resp.credential); },
    auto_select: true,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true,
  });
}

/** Render the official GIS button into `node` (stacked invisibly over the app's
 *  own button so the visual stays pixel-identical to the design). */
export function renderGoogleButton(node: HTMLElement): void {
  if (!window.google?.accounts?.id) return;
  window.google.accounts.id.renderButton(node, { type: 'standard', theme: 'outline', text: 'continue_with', width: 340 });
}

/** One Tap prompt — used as a click fallback and for silent session renewal. */
export function promptGoogle(): void {
  if (window.google?.accounts?.id) window.google.accounts.id.prompt();
}

/** Try to renew the ID token silently. Resolves with a fresh credential or rejects after `ms`. */
export function silentCredential(ms = 5000): Promise<string> {
  return new Promise((res, rej) => {
    let done = false;
    const prev = credentialCb;
    const t = setTimeout(() => { if (!done) { done = true; credentialCb = prev; rej(new Error('Google session expired.')); } }, ms);
    credentialCb = (cred) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      credentialCb = prev;
      if (prev) prev(cred);
      res(cred);
    };
    promptGoogle();
  });
}
