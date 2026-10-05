/**
 * Valida content/*.json y lo sincroniza con Supabase.
 *
 *   npm run import            # valida y sube
 *   npm run import:dry        # solo valida y muestra qué cambiaría (no necesita credenciales)
 *
 * Requiere SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SECRET_KEY en .env.local.
 * La clave secreta salta RLS: úsala solo aquí, nunca en el front.
 *
 * Es idempotente: correrlo dos veces seguidas no cambia nada (y no sube la versión).
 * Lo que ya no está en content/ se DESACTIVA (is_active = false), no se borra,
 * para no romper el historial de `rounds`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- configuración

/** Pistas mínimas por palabra: con menos, varios impostores recibirían pistas repetidas. */
const MIN_HINTS = 5;
const CONTENT_DIR = process.env.CONTENT_DIR ?? 'content';
const CHUNK = 500;
const PAGE = 1000; // PostgREST devuelve máx. 1000 filas por consulta

const DRY = process.argv.includes('--dry-run');

// ---------------------------------------------------------------- tipos

interface WordFile {
  text: string;
  difficulty?: number;
  hints: string[];
}
interface CategoryFile {
  slug: string;
  name: string;
  sort_order: number;
  words: WordFile[];
}

// ---------------------------------------------------------------- validación

/** Minúsculas, sin acentos ni espacios sobrantes: para comparar duplicados. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

function loadContent(): { cats: CategoryFile[]; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cats: CategoryFile[] = [];
  const slugs = new Set<string>();

  const files = readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (files.length === 0) errors.push(`no hay archivos .json en ${CONTENT_DIR}/`);

  for (const file of files) {
    let cat: CategoryFile;
    try {
      cat = JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8'));
    } catch (e) {
      errors.push(`${file}: JSON inválido (${(e as Error).message})`);
      continue;
    }

    const at = (msg: string) => `${file}: ${msg}`;
    if (!cat.slug || !/^[a-z0-9_-]+$/.test(cat.slug)) errors.push(at(`slug inválido "${cat.slug}"`));
    if (file !== `${cat.slug}.json`) errors.push(at(`el archivo debe llamarse ${cat.slug}.json`));
    if (slugs.has(cat.slug)) errors.push(at(`slug repetido "${cat.slug}"`));
    slugs.add(cat.slug);
    if (!cat.name?.trim()) errors.push(at('falta "name"'));
    if (!Number.isInteger(cat.sort_order)) errors.push(at('"sort_order" debe ser un entero'));
    if (!Array.isArray(cat.words) || cat.words.length === 0) {
      errors.push(at('no tiene palabras'));
      continue;
    }

    const seenWords = new Set<string>();
    for (const w of cat.words) {
      const label = `${file} → "${w.text}"`;
      if (!w.text?.trim()) {
        errors.push(at('hay una palabra vacía'));
        continue;
      }
      const key = norm(w.text);
      if (seenWords.has(key)) errors.push(`${label}: palabra duplicada en la categoría`);
      seenWords.add(key);

      if (w.difficulty !== undefined && ![1, 2, 3].includes(w.difficulty)) {
        errors.push(`${label}: "difficulty" debe ser 1, 2 o 3`);
      }
      if (!Array.isArray(w.hints) || w.hints.length < MIN_HINTS) {
        errors.push(`${label}: necesita al menos ${MIN_HINTS} pista(s)`);
        continue;
      }

      const seenHints = new Set<string>();
      for (const h of w.hints) {
        if (!h?.trim()) {
          errors.push(`${label}: hay una pista vacía`);
          continue;
        }
        const hk = norm(h);
        if (seenHints.has(hk)) errors.push(`${label}: pista duplicada "${h}"`);
        seenHints.add(hk);
        // Una pista no debe regalar la palabra.
        const giveaway = hk.split(/\s+/).includes(key) || (key.length >= 4 && hk.includes(key));
        if (giveaway) errors.push(`${label}: la pista "${h}" contiene la palabra`);
      }
    }
    cats.push(cat);
  }
  return { cats, errors, warnings };
}

// ---------------------------------------------------------------- Supabase

function connect(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Faltan SUPABASE_URL (o VITE_SUPABASE_URL) y/o SUPABASE_SECRET_KEY en .env.local');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

/** Lee todas las filas de una tabla (PostgREST pagina a 1000). */
async function fetchAll<T>(db: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = check(
      await db.from(table).select(columns).order('id').range(from, from + PAGE - 1),
      `leer ${table}`,
    ) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

const chunks = <T>(arr: T[], n = CHUNK): T[][] =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

interface DbCategory { id: number; slug: string; name: string; sort_order: number; is_active: boolean }
interface DbWord { id: number; category_id: number; text: string; difficulty: number; is_active: boolean }
interface DbHint { id: number; word_id: number; text: string }

async function sync(db: SupabaseClient, cats: CategoryFile[]) {
  const stats = { catsNew: 0, catsChanged: 0, catsOff: 0, wordsNew: 0, wordsChanged: 0, wordsOff: 0, hintsNew: 0, hintsDel: 0 };

  // ---- categorías
  const dbCats = await fetchAll<DbCategory>(db, 'categories', 'id,slug,name,sort_order,is_active');
  const catBySlug = new Map(dbCats.map((c) => [c.slug, c]));
  for (const c of cats) {
    const row = { slug: c.slug, name: c.name, sort_order: c.sort_order, is_active: true };
    const prev = catBySlug.get(c.slug);
    if (!prev) stats.catsNew++;
    else if (prev.name !== c.name || prev.sort_order !== c.sort_order || !prev.is_active) stats.catsChanged++;
    else continue;
    check(await db.from('categories').upsert(row, { onConflict: 'slug' }), `guardar categoría ${c.slug}`);
  }
  const wanted = new Set(cats.map((c) => c.slug));
  for (const c of dbCats) {
    if (c.is_active && !wanted.has(c.slug)) {
      stats.catsOff++;
      check(await db.from('categories').update({ is_active: false }).eq('id', c.id), `desactivar ${c.slug}`);
    }
  }
  const idBySlug = new Map(
    (await fetchAll<DbCategory>(db, 'categories', 'id,slug,name,sort_order,is_active')).map((c) => [c.slug, c.id]),
  );

  // ---- palabras (el índice único es sobre lower(text): se compara en JS)
  const dbWords = await fetchAll<DbWord>(db, 'words', 'id,category_id,text,difficulty,is_active');
  const wordKey = (catId: number, text: string) => `${catId}:${text.toLowerCase()}`;
  const dbWordByKey = new Map(dbWords.map((w) => [wordKey(w.category_id, w.text), w]));
  const keep = new Set<string>();
  const toInsert: { category_id: number; text: string; difficulty: number }[] = [];

  for (const c of cats) {
    const catId = idBySlug.get(c.slug)!;
    for (const w of c.words) {
      const k = wordKey(catId, w.text);
      keep.add(k);
      const diff = w.difficulty ?? 2;
      const prev = dbWordByKey.get(k);
      if (!prev) {
        toInsert.push({ category_id: catId, text: w.text, difficulty: diff });
      } else if (prev.difficulty !== diff || !prev.is_active) {
        stats.wordsChanged++;
        check(await db.from('words').update({ difficulty: diff, is_active: true }).eq('id', prev.id), `actualizar ${w.text}`);
      }
    }
  }
  for (const part of chunks(toInsert)) {
    check(await db.from('words').insert(part), 'insertar palabras');
    stats.wordsNew += part.length;
  }
  // Solo se desactivan las de categorías gestionadas desde content/.
  const managed = new Set(cats.map((c) => idBySlug.get(c.slug)!));
  const off = dbWords.filter((w) => w.is_active && managed.has(w.category_id) && !keep.has(wordKey(w.category_id, w.text)));
  for (const part of chunks(off.map((w) => w.id))) {
    check(await db.from('words').update({ is_active: false }).in('id', part), 'desactivar palabras');
    stats.wordsOff += part.length;
  }

  // ---- pistas (se recargan las palabras para conocer los ids nuevos)
  const allWords = await fetchAll<DbWord>(db, 'words', 'id,category_id,text,difficulty,is_active');
  const wordId = new Map(allWords.map((w) => [wordKey(w.category_id, w.text), w.id]));
  const dbHints = await fetchAll<DbHint>(db, 'hints', 'id,word_id,text');
  const hintsByWord = new Map<number, DbHint[]>();
  for (const h of dbHints) hintsByWord.set(h.word_id, [...(hintsByWord.get(h.word_id) ?? []), h]);

  const hintsToInsert: { word_id: number; text: string }[] = [];
  const hintsToDelete: number[] = [];
  for (const c of cats) {
    const catId = idBySlug.get(c.slug)!;
    for (const w of c.words) {
      const id = wordId.get(wordKey(catId, w.text))!;
      const existing = hintsByWord.get(id) ?? [];
      const wantedKeys = new Set(w.hints.map((h) => h.toLowerCase()));
      const haveKeys = new Set(existing.map((h) => h.text.toLowerCase()));
      for (const h of w.hints) if (!haveKeys.has(h.toLowerCase())) hintsToInsert.push({ word_id: id, text: h });
      for (const h of existing) if (!wantedKeys.has(h.text.toLowerCase())) hintsToDelete.push(h.id);
    }
  }
  for (const part of chunks(hintsToInsert)) {
    check(await db.from('hints').insert(part), 'insertar pistas');
    stats.hintsNew += part.length;
  }
  for (const part of chunks(hintsToDelete)) {
    check(await db.from('hints').delete().in('id', part), 'borrar pistas');
    stats.hintsDel += part.length;
  }

  // ---- versión del catálogo: solo si algo cambió
  const changed = Object.values(stats).some((n) => n > 0);
  if (changed) {
    const { version } = check(await db.from('content_meta').select('version').single(), 'leer versión') as { version: number };
    check(await db.from('content_meta').update({ version: version + 1 }).eq('id', true), 'subir versión');
    console.log(`versión del catálogo: ${version} → ${version + 1}`);
  }
  return { stats, changed };
}

// ---------------------------------------------------------------- main

async function main() {
  const { cats, errors, warnings } = loadContent();
  const words = cats.reduce((n, c) => n + c.words.length, 0);
  const hints = cats.reduce((n, c) => n + c.words.reduce((m, w) => m + w.hints.length, 0), 0);

  for (const w of warnings) console.warn(`⚠ ${w}`);
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(es) de validación:`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(`✓ contenido válido: ${cats.length} categorías, ${words} palabras, ${hints} pistas`);
  if (DRY) {
    console.log('(--dry-run: no se escribió nada en Supabase)');
    return;
  }

  const { stats, changed } = await sync(connect(), cats);
  console.log(changed ? '✓ sincronizado:' : '✓ sin cambios: Supabase ya estaba al día');
  if (changed) console.table(stats);
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
