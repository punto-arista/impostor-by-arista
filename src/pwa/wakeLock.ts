import { useEffect } from 'react';

/** Mantiene la pantalla encendida mientras `active`. Si no hay soporte, no hace nada. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) return void l.release();
        lock = l;
      } catch {
        /* denegado (ahorro de batería, pestaña oculta): se ignora */
      }
    };
    // El navegador libera el lock al ocultar la pestaña: hay que pedirlo de nuevo.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
