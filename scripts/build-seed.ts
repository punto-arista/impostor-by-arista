/**
 * Regenera src/data/seed.json (catálogo del "modo local" de la app) a partir de content/*.json.
 *
 *   npm run seed
 *
 * Los ids son secuenciales y solo sirven en modo local; con Supabase los ids son los de la base.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface CategoryFile {
  slug: string;
  name: string;
  sort_order: number;
  words: { text: string; difficulty?: number; hints: string[] }[];
}

const cats: CategoryFile[] = readdirSync('content')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join('content', f), 'utf8')))
  .sort((a, b) => a.sort_order - b.sort_order);

let id = 1;
const seed = {
  version: 0,
  categories: cats.map((c) => ({
    slug: c.slug,
    name: c.name,
    sort_order: c.sort_order,
    words: c.words.map((w) => ({ id: id++, text: w.text, difficulty: w.difficulty ?? 2, hints: w.hints })),
  })),
};

writeFileSync('src/data/seed.json', JSON.stringify(seed, null, 1) + '\n');
console.log(`✓ src/data/seed.json: ${cats.length} categorías, ${id - 1} palabras`);
