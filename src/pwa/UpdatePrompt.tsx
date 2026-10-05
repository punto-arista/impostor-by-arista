import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Aviso de nueva versión. Solo se muestra donde `allowed` sea true: nunca
 * en medio de una partida, porque actualizar recarga la app.
 */
export function UpdatePrompt({ allowed }: { allowed: boolean }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh || !allowed) return null;
  return (
    <div className="banner" role="status">
      <span>nueva versión disponible.</span>
      <button className="link" onClick={() => updateServiceWorker(true)}>
        actualizar.
      </button>
    </div>
  );
}
