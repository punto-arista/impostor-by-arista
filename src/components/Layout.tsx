import type { ReactNode } from 'react';
import { useInstall } from '../pwa/install';
import { UpdatePrompt } from '../pwa/UpdatePrompt';

interface Props {
  /** Etiqueta del paso, arriba a la derecha ("ajustes", "discusión"…). */
  label: string;
  user?: string | null;
  onLogout?: () => void;
  /** Solo para administradores: muestra el icono que abre la gestión de usuarios. */
  onAdmin?: () => void;
  /** false durante la partida: actualizar la app la recargaría. */
  allowUpdate?: boolean;
  children: ReactNode;
}

export function Layout({ label, user, onLogout, onAdmin, allowUpdate = true, children }: Props) {
  const { standalone, canFullscreen, fullscreen, toggleFullscreen } = useInstall();

  return (
    <div className="app">
      <div className="col">
        <header className="topbar">
          <div className="brand">
            impostor<span>.</span>
          </div>
          <div className={`topbar-right${onAdmin ? ' has-admin' : ''}`}>
            <div className="step">{label}</div>
            {!standalone && canFullscreen && (
              <button
                className="icon-btn"
                onClick={toggleFullscreen}
                aria-label={fullscreen ? 'salir de pantalla completa' : 'pantalla completa'}
              >
                {fullscreen ? '⤡' : '⤢'}
              </button>
            )}
            {onAdmin && (
              <button className="icon-btn" onClick={onAdmin} aria-label="administrar usuarios" title="usuarios">
                {/* Lucide "users" */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </button>
            )}
            {user && onLogout && (
              <button className="link" onClick={onLogout}>
                {/* El nombre se recorta con "…" si no cabe; "salir." siempre se ve. */}
                <span className="who">{user}</span>
                <span className="out">
                  <span className="sep"> · </span>salir.
                </span>
              </button>
            )}
          </div>
        </header>
        <UpdatePrompt allowed={allowUpdate} />
        {children}
      </div>
    </div>
  );
}
