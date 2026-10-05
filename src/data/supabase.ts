import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Sin variables de entorno la app corre en "modo local": usa el catálogo
 * semilla del mockup, sin login ni historial. Útil para desarrollar la UI.
 */
export const isSupabaseConfigured = Boolean(url && key);

// La clave publishable es pública por diseño: la seguridad la dan las políticas RLS.
export const supabase = isSupabaseConfigured ? createClient(url!, key!) : null;
