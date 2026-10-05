import { describe, expect, it } from 'vitest';
import { distributeHints, drawRound, takeWord } from './draw';
import { clampImpostors, clampPlayers, maxImpostors } from './limits';
import { DEFAULT_SETTINGS, initialState, reducer } from './reducer';
import { MIX, type Catalog, type Settings } from './types';

const catalog: Catalog = {
  version: 1,
  categories: [
    {
      slug: 'a',
      name: 'cat a',
      sort_order: 1,
      words: [1, 2, 3, 4].map((id) => ({
        id,
        text: `A${id}`,
        difficulty: 2,
        hints: ['h1', 'h2', 'h3', 'h4', 'h5'].map((h) => `${h}-${id}`),
      })),
    },
    {
      slug: 'b',
      name: 'cat b',
      sort_order: 2,
      words: [10, 11].map((id) => ({ id, text: `B${id}`, difficulty: 2, hints: ['solo'] })),
    },
  ],
};

const settings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  category: 'a',
  ...over,
});

describe('limits', () => {
  it('garantiza mayoría de jugadores que saben la palabra', () => {
    expect(maxImpostors(3)).toBe(1);
    expect(maxImpostors(4)).toBe(1);
    expect(maxImpostors(5)).toBe(2);
    expect(maxImpostors(30)).toBe(14);
    for (let p = 3; p <= 30; p++) expect(p - maxImpostors(p)).toBeGreaterThan(maxImpostors(p));
  });

  it('acota jugadores e impostores', () => {
    expect(clampPlayers(1)).toBe(3);
    expect(clampPlayers(99)).toBe(30);
    expect(clampPlayers(Number.NaN)).toBe(3);
    expect(clampImpostors(0, 10)).toBe(1);
    expect(clampImpostors(9, 10)).toBe(4);
  });
});

describe('takeWord', () => {
  it('no repite palabras hasta agotar la bolsa', () => {
    let bags = {};
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = takeWord(catalog, 'a', bags);
      seen.push(r.entry.word.id);
      bags = r.bags;
    }
    expect(new Set(seen).size).toBe(4);
  });

  it('la última de una bolsa nunca abre la siguiente', () => {
    for (let n = 0; n < 200; n++) {
      let bags = {};
      let prev = -1;
      for (let i = 0; i < 12; i++) {
        const r = takeWord(catalog, 'a', bags);
        expect(r.entry.word.id).not.toBe(prev);
        prev = r.entry.word.id;
        bags = r.bags;
      }
    }
  });

  it('no muta las bolsas recibidas', () => {
    const first = takeWord(catalog, 'a', {});
    const snapshot = JSON.stringify(first.bags);
    takeWord(catalog, 'a', first.bags);
    expect(JSON.stringify(first.bags)).toBe(snapshot);
  });

  it('"mix" mezcla todas las categorías', () => {
    let bags = {};
    const cats = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const r = takeWord(catalog, MIX, bags);
      cats.add(r.entry.category.slug);
      bags = r.bags;
    }
    expect(cats).toEqual(new Set(['a', 'b']));
  });

  it('ignora ids guardados que ya no existen en el catálogo', () => {
    const r = takeWord(catalog, 'a', { a: { remaining: [999], last: 998 } });
    expect([1, 2, 3, 4]).toContain(r.entry.word.id);
  });

  it('falla con una categoría vacía o inexistente', () => {
    expect(() => takeWord(catalog, 'nope', {})).toThrow();
  });
});

describe('distributeHints', () => {
  it('da pistas distintas a cada impostor', () => {
    const hints = ['a', 'b', 'c', 'd', 'e'];
    for (let n = 0; n < 100; n++) {
      const out = distributeHints(hints, 4);
      expect(new Set(out).size).toBe(4);
    }
  });

  it('si faltan pistas, usa todas antes de repetir', () => {
    const out = distributeHints(['a', 'b'], 5);
    expect(out).toHaveLength(5);
    expect(new Set(out.slice(0, 2)).size).toBe(2);
    expect(new Set(out.slice(2, 4)).size).toBe(2);
  });

  it('sin pistas devuelve null', () => {
    expect(distributeHints([], 2)).toEqual([null, null]);
  });
});

describe('drawRound', () => {
  it('crea el número exacto de impostores y de jugadores', () => {
    const { round } = drawRound(catalog, settings({ players: 8, impostors: 3 }), {});
    expect(round.roles).toHaveLength(8);
    expect(round.roles.filter((r) => r.isImpostor)).toHaveLength(3);
  });

  it('con pistas: cada impostor recibe una distinta; los demás ninguna', () => {
    for (let n = 0; n < 50; n++) {
      const { round } = drawRound(catalog, settings({ players: 9, impostors: 4, withHints: true }), {});
      const imp = round.roles.filter((r) => r.isImpostor);
      expect(new Set(imp.map((r) => r.hint)).size).toBe(4);
      expect(imp.every((r) => r.hint !== null)).toBe(true);
      expect(round.roles.filter((r) => !r.isImpostor).every((r) => r.hint === null)).toBe(true);
    }
  });

  it('a ciegas: nadie recibe pista', () => {
    const { round } = drawRound(catalog, settings({ withHints: false, impostors: 2, players: 6 }), {});
    expect(round.roles.every((r) => r.hint === null)).toBe(true);
  });

  it('acota impostores al máximo permitido', () => {
    const { round } = drawRound(catalog, settings({ players: 5, impostors: 25 }), {});
    expect(round.roles.filter((r) => r.isImpostor)).toHaveLength(2);
  });

  it('usa nombres personalizados o "jugador n"', () => {
    const names = [...DEFAULT_SETTINGS.names];
    names[1] = '  Ana ';
    const { round } = drawRound(catalog, settings({ players: 3, names }), {});
    expect(round.roles.map((r) => r.name)).toEqual(['jugador 1', 'Ana', 'jugador 3']);
    expect(round.roles.map((r) => r.name)).toContain(round.starter);
  });

  it('cada ronda tiene un id propio', () => {
    const a = drawRound(catalog, settings(), {}).round.id;
    const b = drawRound(catalog, settings(), {}).round.id;
    expect(a).not.toBe(b);
  });
});

describe('reducer', () => {
  const { round } = drawRound(catalog, settings({ players: 3 }), {});

  it('ajusta impostores al cambiar jugadores', () => {
    let s = initialState(settings({ players: 9, impostors: 4 }));
    s = reducer(s, { type: 'SET_PLAYERS', players: 3 });
    expect(s.settings.impostors).toBe(1);
  });

  it('recorre handoff → reveal → … → discuss → final', () => {
    let s = reducer(initialState(), { type: 'START', round });
    expect(s.screen).toBe('handoff');
    for (let i = 0; i < 3; i++) {
      s = reducer(s, { type: 'SHOW_ROLE' });
      expect(s.screen).toBe('reveal');
      s = reducer(s, { type: 'NEXT' });
    }
    expect(s.screen).toBe('discuss');
    s = reducer(s, { type: 'REVEAL_ALL' });
    expect(s.screen).toBe('final');
    expect(reducer(s, { type: 'TO_SETUP' }).round).toBeNull();
  });

  it('no deja volver a ver un rol ni saltarse pantallas', () => {
    let s = reducer(initialState(), { type: 'START', round });
    expect(reducer(s, { type: 'NEXT' })).toBe(s);
    expect(reducer(s, { type: 'REVEAL_ALL' })).toBe(s);
    s = reducer(s, { type: 'SHOW_ROLE' });
    expect(reducer(s, { type: 'SHOW_ROLE' })).toBe(s);
  });
});
