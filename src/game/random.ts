/** Entero uniforme en [0, max) con crypto.getRandomValues (sin sesgo de módulo). */
export function randomInt(max: number): number {
  if (max <= 0) throw new RangeError('max debe ser > 0');
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

/** Fisher–Yates. Devuelve una copia; no modifica la entrada. */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickOne<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}
