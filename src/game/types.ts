export interface CatalogWord {
  id: number;
  text: string;
  difficulty: number;
  hints: string[];
}

export interface CatalogCategory {
  slug: string;
  name: string;
  sort_order: number;
  words: CatalogWord[];
}

export interface Catalog {
  version: number;
  categories: CatalogCategory[];
}

/** Slug especial: une todas las categorías del catálogo. No existe en la base. */
export const MIX = 'mix';

export interface Settings {
  players: number;
  /** Siempre MAX_PLAYERS posiciones; solo se usan las primeras `players`. */
  names: string[];
  impostors: number;
  category: string;
  withHints: boolean;
}

export interface Role {
  name: string;
  isImpostor: boolean;
  /** Pista del impostor; null para los demás o en modo "a ciegas". */
  hint: string | null;
}

export interface Round {
  /** Lo genera el cliente: permite reenviar el historial sin duplicar. */
  id: string;
  wordId: number;
  word: string;
  categoryName: string;
  withHints: boolean;
  roles: Role[];
  starter: string;
}

/** Palabras que aún no han salido, por categoría ("bolsa" barajada). */
export type Bags = Record<string, { remaining: number[]; last?: number }>;
