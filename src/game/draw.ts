import { clampImpostors, clampPlayers } from './limits';
import { pickOne, shuffle } from './random';
import {
  MIX,
  type Bags,
  type Catalog,
  type CatalogCategory,
  type CatalogWord,
  type Role,
  type Round,
  type Settings,
} from './types';

interface Entry {
  word: CatalogWord;
  category: CatalogCategory;
}

function poolFor(catalog: Catalog, slug: string): Entry[] {
  const cats = slug === MIX ? catalog.categories : catalog.categories.filter((c) => c.slug === slug);
  return cats.flatMap((category) => category.words.map((word) => ({ word, category })));
}

/**
 * Saca una palabra de la "bolsa" de la categoría: no se repite ninguna hasta
 * agotarlas todas, y la última de una bolsa nunca abre la siguiente.
 * Es pura: devuelve las bolsas nuevas en lugar de mutar las recibidas.
 */
export function takeWord(catalog: Catalog, slug: string, bags: Bags): { entry: Entry; bags: Bags } {
  const pool = poolFor(catalog, slug);
  if (pool.length === 0) throw new Error(`La categoría "${slug}" no tiene palabras.`);

  const byId = new Map(pool.map((e) => [e.word.id, e]));
  const prev = bags[slug];
  // El catálogo pudo cambiar: descarta ids que ya no existen.
  let remaining = (prev?.remaining ?? []).filter((id) => byId.has(id));

  if (remaining.length === 0) {
    remaining = shuffle(pool.map((e) => e.word.id));
    const last = prev?.last;
    // `pop()` toma del final: si coincide con la última jugada, cámbiala de lugar.
    if (remaining.length > 1 && remaining[remaining.length - 1] === last) {
      [remaining[0], remaining[remaining.length - 1]] = [remaining[remaining.length - 1], remaining[0]];
    }
  } else {
    remaining = [...remaining];
  }

  const id = remaining.pop()!;
  return { entry: byId.get(id)!, bags: { ...bags, [slug]: { remaining, last: id } } };
}

/**
 * Reparte `count` pistas distintas. Si hay más impostores que pistas, se usan
 * todas y solo entonces se repiten (en ciclos barajados).
 */
export function distributeHints(hints: readonly string[], count: number): (string | null)[] {
  if (hints.length === 0) return Array(count).fill(null);
  const out: string[] = [];
  while (out.length < count) out.push(...shuffle(hints).slice(0, count - out.length));
  return out;
}

export function drawRound(
  catalog: Catalog,
  settings: Settings,
  bags: Bags,
): { round: Round; bags: Bags } {
  const players = clampPlayers(settings.players);
  const impostors = clampImpostors(settings.impostors, players);

  const { entry, bags: nextBags } = takeWord(catalog, settings.category, bags);

  const impostorIdx = new Set(shuffle([...Array(players).keys()]).slice(0, impostors));
  const hints = settings.withHints
    ? distributeHints(entry.word.hints, impostors)
    : Array<string | null>(impostors).fill(null);

  let h = 0;
  const roles: Role[] = [...Array(players).keys()].map((i) => {
    const isImpostor = impostorIdx.has(i);
    return {
      name: settings.names[i]?.trim() || `jugador ${i + 1}`,
      isImpostor,
      hint: isImpostor ? hints[h++] : null,
    };
  });

  return {
    bags: nextBags,
    round: {
      id: crypto.randomUUID(),
      wordId: entry.word.id,
      word: entry.word.text,
      categoryName: entry.category.name,
      withHints: settings.withHints,
      roles,
      starter: pickOne(roles).name,
    },
  };
}
