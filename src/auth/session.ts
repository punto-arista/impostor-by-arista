import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../data/supabase';

/** Dominio ficticio: el jugador solo escribe su usuario y su PIN. */
const EMAIL_DOMAIN = 'impostor.arista';

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function usernameOf(session: Session | null): string | null {
  return session?.user.email?.split('@')[0] ?? null;
}

/** Devuelve un mensaje de error para mostrar, o null si el acceso fue correcto. */
export async function signIn(username: string, pin: string): Promise<string | null> {
  if (!supabase) return null;
  const email = `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
  if (!error) return null;
  // Se distingue por `code`: un 400 genérico no siempre significa credenciales malas.
  switch (error.code) {
    case 'invalid_credentials':
      return 'usuario o pin incorrectos.';
    case 'email_not_confirmed':
      return 'tu cuenta aún no está activada. avisa a arista.';
    case 'over_request_rate_limit':
      return 'demasiados intentos. espera un momento e intenta de nuevo.';
  }
  if (error.name === 'AuthRetryableFetchError') return 'no se pudo conectar. revisa tu internet e intenta de nuevo.';
  return `no se pudo entrar (${error.code ?? error.message}).`;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}
