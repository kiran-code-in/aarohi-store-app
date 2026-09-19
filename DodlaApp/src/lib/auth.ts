/**
 * auth.ts — Thin wrapper around Supabase email/password auth.
 * The app is gated behind a login; only the pre-created accounts can sign in
 * (self-signup is disabled in the Supabase dashboard).
 */

import { supabase } from './supabase';

// Users sign in with a simple username. Supabase Auth is email-based, so we
// map each username to the account's real email behind the scenes.
const USERNAME_TO_EMAIL: Record<string, string> = {
  kiran: 'vg.kiran@gmail.com',
  avinash: 'avinash.vattigunta4@gmail.com',
  vpnaidu: 'perumallu.vattigunta@gmail.com',
};

const EMAIL_TO_USERNAME: Record<string, string> = Object.fromEntries(
  Object.entries(USERNAME_TO_EMAIL).map(([u, e]) => [e, u])
);

/** Turn a typed username into the login email. Falls back to the raw input
 *  (so a full email still works if someone types one). */
function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase();
  return USERNAME_TO_EMAIL[u] ?? u;
}

/** Return the current signed-in user's username, or null if not signed in. */
export async function getCurrentEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user?.email ?? null;
  if (!email) return null;
  return EMAIL_TO_USERNAME[email] ?? email;
}

/** True if there is an active session. */
export async function isSignedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/** Sign in with username + password. Returns an error message on failure, else null. */
export async function signIn(username: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) {
    // Keep the message friendly and non-leaky
    if (error.message.toLowerCase().includes('invalid')) return 'Wrong username or password';
    return error.message;
  }
  return null;
}

/** Sign out the current user. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Subscribe to sign-in / sign-out events. Returns an unsubscribe function. */
export function onAuthChange(cb: (signedIn: boolean) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(!!session);
  });
  return () => data.subscription.unsubscribe();
}
