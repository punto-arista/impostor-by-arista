import { useEffect, useState } from 'react';
import { useIsAdmin } from './auth/admin';
import { signOut, useSession, usernameOf } from './auth/session';
import { useCatalog } from './data/catalog';
import { flushRounds } from './data/rounds';
import { isSupabaseConfigured } from './data/supabase';
import { isStandalone, isTouchDevice } from './pwa/install';
import { Admin } from './screens/Admin';
import { Game } from './screens/Game';
import { Install } from './screens/Install';
import { Login } from './screens/Login';
import { Splash } from './screens/Splash';

const SKIP_KEY = 'install_skipped';

function readSkipped(): boolean {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Flujo: instalar (solo en móvil/tableta y si no está instalada) → login →
 * descarga del catálogo → juego. Sin Supabase configurado se salta el login
 * y se usa el catálogo semilla ("modo local").
 */
export default function App() {
  const [skipped, setSkipped] = useState(readSkipped);
  const { session, loading } = useSession();

  const authed = !isSupabaseConfigured || session !== null;
  const catalog = useCatalog(authed);

  const isAdmin = useIsAdmin(session);
  const [view, setView] = useState<'game' | 'admin'>('game');
  // Al cerrar sesión (o si deja de ser admin) se vuelve al juego.
  useEffect(() => {
    if (!isAdmin) setView('game');
  }, [isAdmin]);

  // Enviar rondas pendientes al abrir y cada vez que vuelve la conexión.
  useEffect(() => {
    if (!isSupabaseConfigured || !authed) return;
    void flushRounds();
    window.addEventListener('online', flushRounds);
    return () => window.removeEventListener('online', flushRounds);
  }, [authed]);

  if (!skipped && !isStandalone() && isTouchDevice()) {
    return (
      <Install
        onSkip={() => {
          try {
            sessionStorage.setItem(SKIP_KEY, '1');
          } catch {
            /* sin sessionStorage: solo se pierde el recuerdo */
          }
          setSkipped(true);
        }}
      />
    );
  }

  if (isSupabaseConfigured) {
    if (loading) return <Splash label="acceso" message="cargando" />;
    if (!session) return <Login />;
  }

  if (view === 'admin' && isAdmin) return <Admin onBack={() => setView('game')} />;

  if (catalog.status === 'loading') return <Splash message="cargando palabras" />;
  if (catalog.status === 'error') {
    return (
      <Splash
        label="error"
        message="sin catálogo"
        detail={`no pudimos descargar las palabras (${catalog.error}). revisa tu internet e intenta de nuevo.`}
        action={{ label: 'reintentar.', onClick: catalog.retry }}
      />
    );
  }
  if (catalog.status === 'empty' || !catalog.catalog) {
    return (
      <Splash
        label="vacío"
        message="aún no hay palabras"
        detail="el catálogo está vacío. importa el contenido con scripts/import-content.ts."
      />
    );
  }

  return (
    <Game
      catalog={catalog.catalog}
      user={isSupabaseConfigured ? usernameOf(session) : null}
      onLogout={isSupabaseConfigured ? () => void signOut() : undefined}
      onAdmin={isAdmin ? () => setView('admin') : undefined}
    />
  );
}
