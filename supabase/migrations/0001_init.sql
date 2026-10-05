-- ============================================================
-- 0001 · Esquema inicial de impostor. by arista
-- Pegar en Supabase → SQL Editor → Run (una sola vez).
-- ============================================================

-- ---------- TABLAS ----------

create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.categories (
  id          smallint generated always as identity primary key,
  slug        text unique not null,
  name        text not null,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

create table public.words (
  id          bigint generated always as identity primary key,
  category_id smallint not null references public.categories on delete cascade,
  text        text not null,
  difficulty  smallint not null default 2 check (difficulty between 1 and 3),
  is_active   boolean not null default true
);
create unique index words_category_text on public.words (category_id, lower(text));

create table public.hints (
  id       bigint generated always as identity primary key,
  word_id  bigint not null references public.words on delete cascade,
  text     text not null
);
create unique index hints_word_text on public.hints (word_id, lower(text));

create table public.rounds (
  id          uuid primary key,   -- lo genera el cliente: reintentos idempotentes
  user_id     uuid not null default auth.uid() references public.profiles,
  word_id     bigint not null references public.words,
  players     smallint not null check (players between 3 and 30),
  impostors   smallint not null check (impostors >= 1),
  with_hints  boolean not null,
  played_at   timestamptz not null
);
create index rounds_user_played on public.rounds (user_id, played_at desc);

create table public.content_meta (
  id      boolean primary key default true check (id),   -- una sola fila
  version int not null default 1
);
insert into public.content_meta default values;

-- ---------- TRIGGER: crea el perfil al crear un usuario en Auth ----------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- SEGURIDAD (RLS) ----------

alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.words        enable row level security;
alter table public.hints        enable row level security;
alter table public.rounds       enable row level security;
alter table public.content_meta enable row level security;

-- Catálogo: solo lectura para usuarios con sesión (nadie escribe desde el cliente)
create policy "leer categorias" on public.categories   for select to authenticated using (true);
create policy "leer palabras"   on public.words        for select to authenticated using (true);
create policy "leer pistas"     on public.hints        for select to authenticated using (true);
create policy "leer version"    on public.content_meta for select to authenticated using (true);

-- Perfil y rondas: solo las propias
create policy "mi perfil"            on public.profiles for select to authenticated using (id = auth.uid());
create policy "mis rondas (leer)"    on public.rounds   for select to authenticated using (user_id = auth.uid());
create policy "mis rondas (guardar)" on public.rounds   for insert to authenticated with check (user_id = auth.uid());

-- Permisos de tabla (mínimos necesarios)
grant select on public.categories, public.words, public.hints,
                public.content_meta, public.profiles to authenticated;
grant select, insert on public.rounds to authenticated;

-- ---------- FUNCIONES RPC ----------

create function public.catalog_version() returns int
language sql stable as $$ select version from public.content_meta $$;

create function public.get_catalog() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'version', (select version from public.content_meta),
    'categories', coalesce(jsonb_agg(c order by c.sort_order), '[]'::jsonb)
  )
  from (
    select cat.slug, cat.name, cat.sort_order,
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', w.id, 'text', w.text, 'difficulty', w.difficulty,
          'hints', (select coalesce(jsonb_agg(h.text), '[]'::jsonb)
                    from public.hints h where h.word_id = w.id)
        )), '[]'::jsonb)
       from public.words w where w.category_id = cat.id and w.is_active) as words
    from public.categories cat where cat.is_active
  ) c
$$;

-- Solo usuarios con sesión pueden llamarlas
revoke execute on function public.catalog_version() from public, anon;
revoke execute on function public.get_catalog()     from public, anon;
grant  execute on function public.catalog_version() to authenticated;
grant  execute on function public.get_catalog()     to authenticated;
