/**
 * auth.ts — Thin wrapper around Supabase email/password auth.
 * The app is gated behind a login; only the pre-created accounts can sign in
 * (self-signup is disabled in the Supabase dashboard).
 */

import { supabase } from './supabase';

/** Return the current signed-in user's email, or null if not signed in. */
export async function getCurrentEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

/** True if there is an active session. */
export async function isSignedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/** Sign in with email + password. Returns an error message on failure, else null. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    // Keep the message friendly and non-leaky
    if (error.message.toLowerCase().includes('invalid')) return 'Wrong email or password';
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
