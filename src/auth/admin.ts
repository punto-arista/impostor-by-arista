import type { PostgrestError, Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../data/supabase';

/**
 * Administración de usuarios. Todo pasa por funciones SQL de Supabase (migración 0002):
 * cada una comprueba por su cuenta que quien llama es admin, así que esconder el botón
 * en la app es solo comodidad. No hay claves secretas en el navegador.
 */

/** ¿La sesión es de un administrador? Solo decide si se muestra el acceso a la vista. */
export function useIsAdmin(session: Session | null): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    setIsAdmin(false);
    if (!supabase || !userId) return;
    let cancelled = false;
    // RLS: un usuario solo puede leer su propio perfil, así que no puede ver ni fingir el de otros.
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(data?.is_admin === true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return isAdmin;
}

export interface ManagedUser {
  id: string;
  username: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export type Failure = { ok: false; message: string };

/** Traduce el error de Supabase a un mensaje para mostrar. */
export function describeError(error: PostgrestError): string {
  switch (error.code) {
    case 'PGRST202': // la función no existe en la base
    case '42883':
      return 'faltan las funciones de administración en Supabase: ejecuta la migración 0002_admin_users.sql.';
    case '22023': // datos inválidos
    case '23505': // usuario repetido
    case 'P0002': // usuario inexistente
      return error.message; // son mensajes nuestros, ya en español
    case '42501':
      return 'no tienes permiso para esta acción.';
  }
  if (!error.code) return 'no se pudo conectar. revisa tu internet e intenta de nuevo.';
  return `no se pudo completar la acción (${error.code}).`;
}

const offline: Failure = { ok: false, message: 'sin conexión con Supabase.' };

export async function createUser(username: string, pin: string): Promise<{ ok: true; username: string } | Failure> {
  if (!supabase) return offline;
  const { data, error } = await supabase.rpc('admin_create_user', { p_username: username, p_pin: pin });
  if (error) return { ok: false, message: describeError(error) };
  return { ok: true, username: data as string };
}

export async function listUsers(): Promise<{ ok: true; users: ManagedUser[] } | Failure> {
  if (!supabase) return offline;
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error) return { ok: false, message: describeError(error) };
  return { ok: true, users: (data ?? []) as ManagedUser[] };
}

export async function setUserActive(userId: string, active: boolean): Promise<{ ok: true } | Failure> {
  if (!supabase) return offline;
  const { error } = await supabase.rpc('admin_set_user_active', { p_user_id: userId, p_active: active });
  if (error) return { ok: false, message: describeError(error) };
  return { ok: true };
}
