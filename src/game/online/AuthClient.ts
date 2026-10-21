import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export const ONLINE_AUTH_STORAGE_KEY = 'ore-frontier-online-auth-v1';
export const ONLINE_CACHE_PREFIX = 'ore-frontier-online-cache-v1:';

let client: SupabaseClient | null | undefined;

/** The provider may return a failed email-link callback in the URL fragment. */
export function onlineSignInErrorMessage(hash: string): string | null {
  if (!hash.startsWith('#')) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has('error')) return null;
  return params.get('error_code') === 'otp_expired'
    ? 'This sign-in link expired or was already used. Request a fresh link.'
    : 'Sign-in could not be completed. Request a fresh link or try again later.';
}

export function consumeOnlineSignInError(): string | null {
  const message = onlineSignInErrorMessage(location.hash);
  if (message) history.replaceState(history.state, '', location.pathname + location.search);
  return message;
}

/** The publishable key is public; a service-role key must never enter Vite env. */
export function onlineAuthClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return client = null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return client = null; }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))
    return client = null;
  return client = createClient(parsed.toString(), key, {
    auth: {
      storageKey: ONLINE_AUTH_STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  });
}

export async function verifiedAccount(): Promise<User | null> {
  const auth = onlineAuthClient();
  if (!auth) return null;
  const { data, error } = await auth.auth.getUser();
  return error ? null : data.user;
}

export async function sendOnlineSignInLink(email: string): Promise<void> {
  const auth = onlineAuthClient();
  if (!auth) throw new Error('Online sign-in is not configured.');
  const destination = new URL(`${import.meta.env.BASE_URL}game.html?account=1`, location.origin);
  const { error } = await auth.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: destination.toString() },
  });
  if (error) throw new Error(error.message);
}

/** Logging out never removes the Local campaign key. */
export async function signOutOnline(): Promise<void> {
  const auth = onlineAuthClient();
  if (auth) {
    const { error } = await auth.auth.signOut();
    if (error) throw new Error(error.message);
  }
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (key?.startsWith(ONLINE_CACHE_PREFIX)) localStorage.removeItem(key);
  }
}
