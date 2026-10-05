export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 30;

/** Siempre debe haber mayoría de jugadores que sí saben la palabra. */
export function maxImpostors(players: number): number {
  return Math.max(1, Math.floor((players - 1) / 2));
}

export function clampPlayers(n: number): number {
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.trunc(n) || MIN_PLAYERS));
}

export function clampImpostors(n: number, players: number): number {
  return Math.min(maxImpostors(players), Math.max(1, Math.trunc(n) || 1));
}
