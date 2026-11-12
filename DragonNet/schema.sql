-- DragonNet secure schema. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Membre' check (char_length(display_name) between 1 and 60),
 role text not null default 'member' check (role in ('member','admin')),
 created_at timestamptz not null default now()
);
create table if not exists public.sections (
 id bigint generated always as identity primary key,
 name text not null unique check (char_length(name) between 1 and 80),
 description text not null default '',
 access_level text not null default 'public' check (access_level in ('public','member','admin','password')),
 password_hash text,
 created_at timestamptz not null default now(),
 constraint section_password_required check ((access_level = 'password' and password_hash is not null) or (access_level <> 'password' and password_hash is null))
);
create table if not exists public.section_grants (
 section_id bigint not null references public.sections(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key (section_id,user_id)
);
create table if not exists public.articles (
 id bigint generated always as identity primary key,
 section_id bigint not null references public.sections(id) on delete restrict,
 author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 160),
 content text not null check (char_length(content) between 1 and 30000),
 category text not null default 'Général' check (char_length(category) between 1 and 40),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists articles_section_created_idx on public.articles(section_id,created_at desc);
create index if not exists articles_author_idx on public.articles(author_id);

create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name,role) values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Membre'),60),'member');
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;
create or replace function public.can_access_section(p_section_id bigint) returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.sections s where s.id=p_section_id and (
   s.access_level='public'
   or public.is_admin()
   or (s.access_level='member' and (select auth.uid()) is not null)
   or (s.access_level='password' and exists (
      select 1 from public.section_grants g where g.section_id=s.id and g.user_id=(select auth.uid())
   ))
  )
 );
$$;

-- Public section metadata is safe to expose, but hashes are never selected by the client.
-- Use a dedicated public view instead of granting SELECT on sections.
create or replace view public.section_catalog with (security_invoker = false) as
 select id,name,description,access_level,created_at from public.sections;
revoke all on public.section_catalog from public, anon, authenticated;
grant select on public.section_catalog to anon, authenticated;

create or replace function public.unlock_section(p_section_id bigint,p_password text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
 if (select auth.uid()) is null then raise exception 'Connexion requise'; end if;
 if p_password is null or char_length(p_password)>256 then return false; end if;
 select password_hash into v_hash from public.sections where id=p_section_id and access_level='password';
 if v_hash is null or v_hash <> extensions.crypt(p_password,v_hash) then return false; end if;
 insert into public.section_grants(section_id,user_id) values (p_section_id,(select auth.uid())) on conflict do nothing;
 return true;
end $$;

create or replace function public.admin_create_section(p_name text,p_description text,p_access text,p_password text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
 if not public.is_admin() then raise exception 'Accès refusé'; end if;
 if p_name is null or char_length(trim(p_name)) not between 1 and 80 or p_access not in ('public','member','admin','password') or char_length(coalesce(p_description,''))>1000 then raise exception 'Paramètres invalides'; end if;
 if p_access='password' and (p_password is null or char_length(p_password)<8 or char_length(p_password)>256) then raise exception 'Mot de passe: 8 à 256 caractères'; end if;
 insert into public.sections(name,description,access_level,password_hash)
 values (trim(p_name),coalesce(p_description,''),p_access,case when p_access='password' then extensions.crypt(p_password,extensions.gen_salt('bf')) else null end)
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.admin_delete_section(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise exception 'Accès refusé'; end if;
 delete from public.sections where id=p_id;
end $$;

create or replace function public.admin_set_role(p_user uuid,p_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() or p_role not in ('member','admin') then raise exception 'Accès refusé'; end if;
 if p_user=(select auth.uid()) and p_role<>'admin' then raise exception 'Impossible de retirer votre propre rôle admin'; end if;
 update public.profiles set role=p_role where id=p_user;
 if not found then raise exception 'Utilisateur introuvable'; end if;
end $$;

-- Grant RPC access only where needed.
revoke all on function public.create_profile() from public,anon,authenticated;
revoke all on function public.is_admin() from public,anon,authenticated;
revoke all on function public.can_access_section(bigint) from public,anon,authenticated;
revoke all on function public.unlock_section(bigint,text) from public,anon,authenticated;
revoke all on function public.admin_create_section(text,text,text,text) from public,anon,authenticated;
revoke all on function public.admin_delete_section(bigint) from public,anon,authenticated;
revoke all on function public.admin_set_role(uuid,text) from public,anon,authenticated;
grant execute on function public.is_admin() to anon,authenticated;
grant execute on function public.can_access_section(bigint) to anon,authenticated;
grant execute on function public.unlock_section(bigint,text) to authenticated;
grant execute on function public.admin_create_section(text,text,text,text) to authenticated;
grant execute on function public.admin_delete_section(bigint) to authenticated;
grant execute on function public.admin_set_role(uuid,text) to authenticated;

alter table public.profiles enable row level security;
alter table public.sections enable row level security;
alter table public.section_grants enable row level security;
alter table public.articles enable row level security;

-- Profiles: members see their own profile; admins see all.
create policy profiles_read on public.profiles for select to authenticated using (id=(select auth.uid()) or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
-- Role cannot be changed through a client update: column-level privilege.
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;

-- No direct section or grant access; use view and SECURITY DEFINER RPCs.
revoke all on public.sections from anon,authenticated;
revoke all on public.section_grants from anon,authenticated;

create policy articles_read on public.articles for select to anon,authenticated using (public.can_access_section(section_id));
create policy articles_insert on public.articles for insert to authenticated with check (author_id=(select auth.uid()) and public.can_access_section(section_id));
create policy articles_update on public.articles for update to authenticated using (author_id=(select auth.uid()) or public.is_admin()) with check ((author_id=(select auth.uid()) or public.is_admin()) and public.can_access_section(section_id));
create policy articles_delete on public.articles for delete to authenticated using (author_id=(select auth.uid()) or public.is_admin());
revoke all on public.articles from anon,authenticated;
grant select on public.articles to anon,authenticated;
grant insert(title,content,category,section_id) on public.articles to authenticated;
grant update(title,content,category,section_id) on public.articles to authenticated;
grant delete on public.articles to authenticated;
grant usage,select on all sequences in schema public to authenticated;

insert into public.sections(name,description,access_level) values ('Public','Articles visibles par tous','public') on conflict (name) do nothing;

-- AFTER SIGNING UP, promote your account manually in SQL Editor:
-- update public.profiles set role='admin' where id=(select id from auth.users where email='VOTRE_EMAIL');
-- Never paste service_role keys into HTML.
