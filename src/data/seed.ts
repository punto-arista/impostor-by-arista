import type { Catalog } from '../game/types';
import seed from './seed.json';

/** Catálogo del mockup (1 pista por palabra). Solo se usa en modo local. */
export const seedCatalog = seed as Catalog;
