import { useCallback, useEffect, useState } from 'react';
import type { Catalog } from '../game/types';
import { load, save } from './storage';
import { supabase } from './supabase';

const KEY = 'catalog';

/** Descarta categorías sin palabras: no se pueden sortear. */
function usable(c: Catalog): Catalog {
  return { ...c, categories: c.categories.filter((cat) => cat.words.length > 0) };
}

async function fetchCatalog(): Promise<Catalog> {
  const { data, error } = await supabase!.rpc('get_catalog');
  if (error) throw new Error(error.message);
  return usable(data as Catalog);
}

async function fetchVersion(): Promise<number> {
  const { data, error } = await supabase!.rpc('catalog_version');
  if (error) throw new Error(error.message);
  return data as number;
}

export type CatalogStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface CatalogState {
  status: CatalogStatus;
  catalog: Catalog | null;
  error: string | null;
  retry: () => void;
}

/**
 * Catálogo para jugar. Con caché: se usa al instante y la versión se revisa en
 * segundo plano. Sin caché: se descarga (solo la primera vez).
 * `enabled` debe ser true solo con sesión iniciada (el catálogo requiere login).
 */
export function useCatalog(enabled: boolean): CatalogState {
  const [state, setState] = useState<Omit<CatalogState, 'retry'>>({
    status: 'loading',
    catalog: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ status: 'loading', catalog: null, error: null });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const set = (catalog: Catalog) => {
      if (!cancelled) {
        setState({ status: catalog.categories.length ? 'ready' : 'empty', catalog, error: null });
      }
    };

    (async () => {
      if (!supabase) {
        // Modo local: el catálogo semilla se carga aparte para no inflar el build de producción.
        const { seedCatalog } = await import('./seed');
        return set(usable(seedCatalog));
      }

      const cached = await load<Catalog>(KEY);
      if (cached) {
        set(cached);
        // Actualización en segundo plano; si no hay red, se sigue con la caché.
        try {
          if ((await fetchVersion()) !== cached.version) {
            const fresh = await fetchCatalog();
            await save(KEY, fresh);
            set(fresh);
          }
        } catch {
          /* sin red: seguimos con la caché */
        }
        return;
      }

      try {
        const fresh = await fetchCatalog();
        await save(KEY, fresh);
        set(fresh);
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            catalog: null,
            error: e instanceof Error ? e.message : 'no se pudo descargar el catálogo',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  return { ...state, retry };
}
