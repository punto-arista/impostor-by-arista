import { get, set } from 'idb-keyval';

// IndexedDB puede fallar (ventana privada, datos bloqueados): la app debe seguir
// funcionando sin él, así que ningún error de almacenamiento sube a la UI.

export async function load<T>(key: string): Promise<T | undefined> {
  try {
    return await get<T>(key);
  } catch {
    return undefined;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  try {
    await set(key, value);
  } catch {
    /* sin almacenamiento: se ignora */
  }
}
