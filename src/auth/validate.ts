import { randomInt } from '../game/random';

// Mismas reglas que admin_create_user (supabase/migrations/0002_admin_users.sql): la base de datos
// siempre las vuelve a comprobar; esto solo da respuesta inmediata en el formulario.
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const MIN_PIN = 6;
export const MAX_PIN = 72;

export const normalizeUsername = (s: string) => s.trim().toLowerCase();

/** Devuelve el mensaje de error para mostrar, o null si los datos son válidos. */
export function validateNewUser(username: string, pin: string): string | null {
  if (!USERNAME_RE.test(normalizeUsername(username))) {
    return 'el usuario debe tener de 3 a 20 caracteres: minúsculas, números o guion bajo.';
  }
  if (pin.length < MIN_PIN || pin.length > MAX_PIN) return `el pin debe tener entre ${MIN_PIN} y ${MAX_PIN} caracteres.`;
  return null;
}

/** PIN numérico aleatorio (crypto, no Math.random). */
export function generatePin(length = MIN_PIN): string {
  return Array.from({ length }, () => randomInt(10)).join('');
}
