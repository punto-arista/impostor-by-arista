import type { Round } from '../game/types';
import { load, save } from './storage';
import { supabase } from './supabase';

const KEY = 'pending_rounds';

interface PendingRound {
  id: string;
  word_id: number;
  players: number;
  impostors: number;
  with_hints: boolean;
  played_at: string;
}

// Todas las operaciones sobre la cola van en fila: leer-modificar-escribir
// en IndexedDB no es atómico y dos llamadas a la vez perderían registros.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function flush(): Promise<void> {
  if (!supabase) return;
  const queue = (await load<PendingRound[]>(KEY)) ?? [];
  if (queue.length === 0) return;

  // `id` lo genera el cliente; ignoreDuplicates hace seguro reenviar una ronda
  // (la política RLS solo permite insert, no update).
  const send = (rows: PendingRound[]) =>
    supabase!.from('rounds').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

  const { error } = await send(queue);
  if (!error) return save(KEY, []);

  // Sin red u otro fallo transitorio: se conserva la cola y se reintenta luego.
  // Si el servidor rechaza datos (violación de integridad, 23xxx), se aísla la
  // ronda mala para que no bloquee a las demás.
  if (!error.code?.startsWith('23')) return;
  const keep: PendingRound[] = [];
  for (const row of queue) {
    const { error: e } = await send([row]);
    if (e && !e.code?.startsWith('23')) keep.push(row);
  }
  await save(KEY, keep);
}

/** Guarda la ronda en la cola local y la intenta enviar. Nunca lanza. */
export function recordRound(round: Round): Promise<void> {
  if (!supabase) return Promise.resolve();
  const row: PendingRound = {
    id: round.id,
    word_id: round.wordId,
    players: round.roles.length,
    impostors: round.roles.filter((r) => r.isImpostor).length,
    with_hints: round.withHints,
    played_at: new Date().toISOString(),
  };
  return serial(async () => {
    const queue = (await load<PendingRound[]>(KEY)) ?? [];
    await save(KEY, [...queue, row]);
    await flush();
  }).catch(() => undefined);
}

/** Reintenta enviar lo pendiente (al abrir la app y al recuperar conexión). */
export function flushRounds(): Promise<void> {
  return serial(flush).catch(() => undefined);
}
