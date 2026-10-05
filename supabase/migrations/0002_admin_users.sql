-- ============================================================
-- 0002 · Administración de usuarios desde la app
-- Pegar en Supabase → SQL Editor → Run (una sola vez). Es seguro volver a correrlo.
--
-- Permite que un administrador (profiles.is_admin = true) cree, liste, active y
-- desactive usuarios SIN terminal ni claves secretas en el navegador: la app solo
-- llama a estas funciones (rpc) y cada una comprueba por su cuenta que quien llama
-- es admin. Un usuario normal que las invoque recibe "no autorizado".
--
-- Las funciones son SECURITY DEFINER: se ejecutan con los permisos de quien las crea
-- (postgres, que sí puede escribir en el esquema auth), por eso la comprobación de
-- is_admin() es la barrera de seguridad y no debe quitarse.
--
-- Dominio del correo derivado del usuario: impostor.arista
-- (debe coincidir con EMAIL_DOMAIN en src/auth/session.ts).
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ¿Quien llama es administrador?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

-- Crea un usuario activo (correo confirmado). El trigger on_auth_user_created crea su perfil.
create or replace function public.admin_create_user(p_username text, p_pin text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_email    text;
  v_id       uuid := gen_random_uuid();
begin
  if not public.is_admin() then
    raise exception 'no tienes permiso para crear usuarios.' using errcode = '42501';
  end if;
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'el usuario debe tener de 3 a 20 caracteres: minúsculas, números o guion bajo.'
      using errcode = '22023';
  end if;
  if p_pin is null or char_length(p_pin) < 6 or char_length(p_pin) > 72 then
    raise exception 'el pin debe tener entre 6 y 72 caracteres.' using errcode = '22023';
  end if;

  v_email := v_username || '@impostor.arista';
  if exists (select 1 from auth.users u where u.email = v_email) then
    raise exception 'el usuario "%" ya existe.', v_username using errcode = '23505';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_pin, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  return v_username;
end $$;

-- Lista los usuarios con su estado.
create or replace function public.admin_list_users()
returns table (
  id uuid, username text, is_admin boolean, is_active boolean,
  created_at timestamptz, last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'no tienes permiso para ver los usuarios.' using errcode = '42501';
  end if;
  return query
    select p.id, p.username, p.is_admin,
           (u.banned_until is null or u.banned_until <= now()),
           p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at, p.username;
end $$;

-- Activa o desactiva el acceso de un usuario. Al desactivar también se cierran sus sesiones.
create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'no tienes permiso para cambiar usuarios.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'no puedes desactivar tu propia cuenta.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'el usuario no existe.' using errcode = 'P0002';
  end if;

  update auth.users
     set banned_until = case when p_active then null else now() + interval '100 years' end,
         updated_at = now()
   where id = p_user_id;

  if not p_active then
    delete from auth.sessions where user_id = p_user_id;
  end if;
end $$;

-- Solo usuarios con sesión pueden llamarlas (y cada una exige además ser admin).
revoke all on function public.is_admin()                              from public, anon;
revoke all on function public.admin_create_user(text, text)           from public, anon;
revoke all on function public.admin_list_users()                      from public, anon;
revoke all on function public.admin_set_user_active(uuid, boolean)    from public, anon;
grant execute on function public.is_admin()                           to authenticated;
grant execute on function public.admin_create_user(text, text)        to authenticated;
grant execute on function public.admin_list_users()                   to authenticated;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;
