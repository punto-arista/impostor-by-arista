/**
 * Ejecuta las migraciones reales (0001 y 0002) en PGlite, un Postgres que corre dentro de Node,
 * sobre un esquema `auth` simulado. Prueba la lógica y la seguridad del SQL; NO prueba que
 * GoTrue (el servicio de login de Supabase) acepte las filas: eso se comprueba entrando con
 * el usuario creado (ver PLAN.md).
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const sql = (f: string) => readFileSync(join(import.meta.dirname, f), 'utf8');

const ADMIN = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

let db: PGlite;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  // Lo que Supabase ya trae y las migraciones dan por existente:
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema extensions;
    create schema auth;
    create table auth.users (
      instance_id uuid, id uuid primary key, aud varchar, role varchar,
      email varchar unique, encrypted_password varchar, email_confirmed_at timestamptz,
      raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
      confirmation_token varchar, recovery_token varchar, email_change_token_new varchar, email_change varchar,
      last_sign_in_at timestamptz, banned_until timestamptz
    );
    create table auth.identities (
      id uuid primary key, user_id uuid references auth.users on delete cascade, provider_id text,
      identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
    );
    create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  await db.exec(sql('0001_init.sql'));
  await db.exec(sql('0002_admin_users.sql'));
  await db.exec(sql('0002_admin_users.sql')); // debe poder correrse dos veces

  // Un admin y un usuario normal (el trigger crea sus perfiles)
  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN}', 'argenis@impostor.arista'), ('${USER}', 'normal@impostor.arista');
    update public.profiles set is_admin = true where id = '${ADMIN}';
  `);
});

async function as(id: string | null, role: 'authenticated' | 'anon' = 'authenticated') {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${id ?? ''}', false); set role ${role};`);
}
async function asSuper() {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
}
async function fails(q: string, match: { code?: string; message?: RegExp }) {
  let err: { code?: string; message: string } | undefined;
  try {
    await db.query(q);
  } catch (e) {
    err = e as { code?: string; message: string };
  }
  expect(err, `se esperaba un error en: ${q}`).toBeDefined();
  if (match.code) expect(err!.code).toBe(match.code);
  if (match.message) expect(err!.message).toMatch(match.message);
}
const count = async (q: string) => Number((await db.query<{ n: string }>(q)).rows[0].n);

describe('is_admin()', () => {
  it('es true solo para el admin', async () => {
    await as(ADMIN);
    expect((await db.query<{ r: boolean }>('select public.is_admin() as r')).rows[0].r).toBe(true);
    await as(USER);
    expect((await db.query<{ r: boolean }>('select public.is_admin() as r')).rows[0].r).toBe(false);
    await as(null);
    expect((await db.query<{ r: boolean }>('select public.is_admin() as r')).rows[0].r).toBe(false);
  });
});

describe('admin_create_user', () => {
  it('un usuario normal NO puede crear usuarios y no se crea nada', async () => {
    await as(USER);
    await fails(`select public.admin_create_user('intruso', '123456')`, { code: '42501', message: /no tienes permiso/ });
    await asSuper();
    expect(await count(`select count(*) n from auth.users where email like 'intruso@%'`)).toBe(0);
  });

  it('sin sesión (anon) ni siquiera puede ejecutar la función', async () => {
    await as(null, 'anon');
    await fails(`select public.admin_create_user('intruso2', '123456')`, { message: /permission denied/i });
    await asSuper();
    expect(await count(`select count(*) n from auth.users where email like 'intruso2@%'`)).toBe(0);
  });

  it('sesión válida pero sin perfil admin (id desconocido) tampoco puede', async () => {
    await as('99999999-9999-9999-9999-999999999999');
    await fails(`select public.admin_create_user('fantasma', '123456')`, { code: '42501' });
  });

  it('el admin crea un usuario activo, con perfil, correo confirmado y PIN cifrado', async () => {
    await as(ADMIN);
    const r = await db.query<{ u: string }>(`select public.admin_create_user('  Maria_01 ', 'abc123') as u`);
    expect(r.rows[0].u).toBe('maria_01'); // normalizado
    await asSuper();

    const u = (await db.query<Record<string, unknown>>(`select * from auth.users where email = 'maria_01@impostor.arista'`)).rows[0];
    expect(u).toBeDefined();
    expect(u.aud).toBe('authenticated');
    expect(u.role).toBe('authenticated');
    expect(u.email_confirmed_at).not.toBeNull(); // "activado": puede entrar ya
    expect(u.banned_until).toBeNull();
    expect(u.confirmation_token).toBe(''); // GoTrue falla con NULL en estas columnas
    expect(u.recovery_token).toBe('');
    expect(u.encrypted_password).not.toContain('abc123'); // nunca en claro
    expect(u.raw_app_meta_data).toEqual({ provider: 'email', providers: ['email'] });

    const ok = await db.query<{ ok: boolean }>(
      `select encrypted_password = extensions.crypt('abc123', encrypted_password) as ok from auth.users where email = 'maria_01@impostor.arista'`,
    );
    expect(ok.rows[0].ok).toBe(true);
    const bad = await db.query<{ ok: boolean }>(
      `select encrypted_password = extensions.crypt('otro-pin', encrypted_password) as ok from auth.users where email = 'maria_01@impostor.arista'`,
    );
    expect(bad.rows[0].ok).toBe(false);

    const ident = (await db.query<{ provider: string; identity_data: Record<string, unknown>; provider_id: string }>(
      `select i.* from auth.identities i join auth.users u on u.id = i.user_id where u.email = 'maria_01@impostor.arista'`,
    )).rows[0];
    expect(ident.provider).toBe('email');
    expect(ident.identity_data).toMatchObject({ email: 'maria_01@impostor.arista', email_verified: true });
    expect(ident.provider_id).toBe(ident.identity_data.sub);

    const profile = (await db.query<{ username: string; is_admin: boolean }>(
      `select p.username, p.is_admin from public.profiles p join auth.users u on u.id = p.id where u.email = 'maria_01@impostor.arista'`,
    )).rows[0];
    expect(profile).toEqual({ username: 'maria_01', is_admin: false }); // nunca nace admin
  });

  it.each([
    ['ab', '123456'],
    ['a'.repeat(21), '123456'],
    ['ma ria', '123456'],
    ['maría', '123456'],
    ['a@b.com', '123456'],
    ['', '123456'],
  ])('rechaza el usuario inválido %j', async (username, pin) => {
    await as(ADMIN);
    await fails(`select public.admin_create_user('${username}', '${pin}')`, { code: '22023' });
  });

  it('rechaza pines fuera de rango y nulos', async () => {
    await as(ADMIN);
    await fails(`select public.admin_create_user('pinmalo', '12345')`, { code: '22023' });
    await fails(`select public.admin_create_user('pinmalo', '${'x'.repeat(73)}')`, { code: '22023' });
    await fails(`select public.admin_create_user('pinmalo', null)`, { code: '22023' });
    await fails(`select public.admin_create_user(null, '123456')`, { code: '22023' });
    await asSuper();
    expect(await count(`select count(*) n from auth.users where email like 'pinmalo@%'`)).toBe(0);
  });

  it('rechaza un usuario repetido (aunque cambie mayúsculas)', async () => {
    await as(ADMIN);
    await db.query(`select public.admin_create_user('repetido', '123456')`);
    await fails(`select public.admin_create_user('REPETIDO', '654321')`, { code: '23505', message: /ya existe/ });
    await asSuper();
    expect(await count(`select count(*) n from auth.users where email = 'repetido@impostor.arista'`)).toBe(1);
  });

  it('un PIN con comillas se guarda bien (sin inyección)', async () => {
    await as(ADMIN);
    await db.query(`select public.admin_create_user('comillas', $1)`, [`p'in"; drop table x; --`]);
    await asSuper();
    expect(await count(`select count(*) n from auth.users where email = 'comillas@impostor.arista'`)).toBe(1);
  });
});

describe('admin_list_users', () => {
  it('lista usuarios con su estado al admin', async () => {
    await as(ADMIN);
    const rows = (await db.query<{ username: string; is_admin: boolean; is_active: boolean }>('select * from public.admin_list_users()')).rows;
    const by = Object.fromEntries(rows.map((r) => [r.username, r]));
    expect(by.argenis).toMatchObject({ is_admin: true, is_active: true });
    expect(by.normal).toMatchObject({ is_admin: false, is_active: true });
    expect(by.maria_01).toBeDefined();
  });

  it('un usuario normal no puede listarlos', async () => {
    await as(USER);
    await fails('select * from public.admin_list_users()', { code: '42501' });
    await as(null, 'anon');
    await fails('select * from public.admin_list_users()', { message: /permission denied/i });
  });
});

describe('admin_set_user_active', () => {
  it('desactiva (cierra sesiones) y reactiva', async () => {
    await asSuper();
    await db.exec(`insert into auth.sessions (user_id) values ('${USER}'), ('${USER}')`);
    expect(await count(`select count(*) n from auth.sessions where user_id = '${USER}'`)).toBe(2);

    await as(ADMIN);
    await db.query(`select public.admin_set_user_active('${USER}', false)`);
    await asSuper();
    const off = (await db.query<{ banned: boolean }>(`select banned_until > now() as banned from auth.users where id = '${USER}'`)).rows[0];
    expect(off.banned).toBe(true);
    expect(await count(`select count(*) n from auth.sessions where user_id = '${USER}'`)).toBe(0);

    await as(ADMIN);
    const listed = (await db.query<{ username: string; is_active: boolean }>('select * from public.admin_list_users()')).rows.find((r) => r.username === 'normal');
    expect(listed?.is_active).toBe(false);

    await db.query(`select public.admin_set_user_active('${USER}', true)`);
    await asSuper();
    expect((await db.query<{ b: unknown }>(`select banned_until as b from auth.users where id = '${USER}'`)).rows[0].b).toBeNull();
  });

  it('un usuario normal no puede activar ni desactivar a nadie', async () => {
    await as(USER);
    await fails(`select public.admin_set_user_active('${ADMIN}', false)`, { code: '42501' });
    await asSuper();
    expect((await db.query<{ b: unknown }>(`select banned_until as b from auth.users where id = '${ADMIN}'`)).rows[0].b).toBeNull();
  });

  it('el admin no puede desactivarse a sí mismo', async () => {
    await as(ADMIN);
    await fails(`select public.admin_set_user_active('${ADMIN}', false)`, { code: '22023', message: /tu propia cuenta/ });
  });

  it('falla con un usuario inexistente', async () => {
    await as(ADMIN);
    await fails(`select public.admin_set_user_active('00000000-0000-0000-0000-00000000dead', false)`, { code: 'P0002' });
  });
});
