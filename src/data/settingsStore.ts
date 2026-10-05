import { DEFAULT_SETTINGS } from '../game/reducer';
import { MAX_PLAYERS, clampImpostors, clampPlayers } from '../game/limits';
import type { Settings } from '../game/types';

const KEY = 'impostor_settings';

/** Ajustes de la última partida (conveniencia por dispositivo, no es crítico). */
export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
    const players = clampPlayers(Number(raw.players));
    const names = Array.isArray(raw.names) ? raw.names.map((n: unknown) => (typeof n === 'string' ? n : '')) : [];
    while (names.length < MAX_PLAYERS) names.push('');
    return {
      players,
      names: names.slice(0, MAX_PLAYERS),
      impostors: clampImpostors(Number(raw.impostors), players),
      category: typeof raw.category === 'string' ? raw.category : DEFAULT_SETTINGS.category,
      withHints: typeof raw.withHints === 'boolean' ? raw.withHints : DEFAULT_SETTINGS.withHints,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* sin almacenamiento: se ignora */
  }
}
