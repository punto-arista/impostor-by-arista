import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// `beforeinstallprompt` puede dispararse antes de que React monte: se captura
// a nivel de módulo (este archivo se importa desde main.tsx).
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  emit();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  emit();
});

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true // iOS
  );
}

export function isIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS se identifica como Mac
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Dispositivo táctil (teléfono o tableta). En desktop instalar es opcional. */
export function isTouchDevice(): boolean {
  return matchMedia('(pointer: coarse)').matches;
}

export function useInstall() {
  const prompt = useSyncExternalStore(subscribe, () => deferred);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    emit();
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* el navegador lo rechazó: se ignora */
    }
  }, []);

  return {
    standalone: isStandalone(),
    ios: isIOS(),
    canInstall: prompt !== null,
    install,
    // iOS Safari no ofrece la Fullscreen API en iPhone: ahí solo sirve instalar.
    canFullscreen: Boolean(document.fullscreenEnabled),
    fullscreen,
    toggleFullscreen,
  };
}
