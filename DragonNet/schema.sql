-- DragonNet JSONB v1: une seule table de documents JSONB.
-- Exécuter dans Supabase SQL Editor. Les anciennes tables restent intactes.
create extension if not exists pgcrypto;
create table if not exists public.dragon_documents (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('article','ban')),
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists dragon_docs_kind_created on public.dragon_documents(kind,created_at desc);
create index if not exists dragon_docs_client on public.dragon_documents ((payload->>'client_id'));
alter table public.dragon_documents enable row level security;
revoke all on public.dragon_documents from public,anon,authenticated;

-- La fonction d'admin utilise le rôle enregistré dans profiles, sans exposer la table.
create or replace function public.dragon_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role='admin');
$$;

-- Lecture publique : seuls les articles visibles. Les admins voient aussi les masqués.
drop policy if exists dragon_read on public.dragon_documents;
create policy dragon_read on public.dragon_documents for select to anon,authenticated
using (kind='article' and (coalesce(payload->>'status','visible')='visible' or public.dragon_is_admin()));
grant select on public.dragon_documents to anon,authenticated;

-- Publication anonyme : contrôle du JSON et bannissement du navigateur.
create or replace function public.dragon_publish(p_doc jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_client text; v_title text; v_author text; v_body text; v_category text;
begin
 v_client := p_doc->>'client_id'; v_title := btrim(p_doc->>'title');
 v_author := btrim(p_doc->>'author'); v_body := btrim(p_doc->>'body');
 v_category := btrim(coalesce(p_doc->>'category','Général'));
 if v_client is null or v_client !~ '^[a-f0-9-]{36}$' or
    char_length(v_title) not between 1 and 160 or
    char_length(v_author) not between 1 and 40 or
    char_length(v_body) not between 1 and 10000 or
    char_length(v_category) not between 1 and 40 then
   raise exception 'Données invalides';
 end if;
 if exists(select 1 from public.dragon_documents d where d.kind='ban'
    and d.payload->>'client_id'=v_client
    and (d.payload->>'until')::timestamptz > now()) then
   raise exception 'Publication temporairement interdite';
 end if;
 -- Limite indicative par navigateur (ne protège pas contre des identifiants changés).
 if (select count(*) from public.dragon_documents d where d.kind='article'
     and d.payload->>'client_id'=v_client and d.created_at>now()-interval '1 hour')>=12 then
   raise exception 'Limite de 12 articles par heure atteinte';
 end if;
 insert into public.dragon_documents(kind,payload) values ('article',jsonb_build_object(
  'client_id',v_client,'title',v_title,'author',v_author,'body',v_body,
  'category',v_category,'status','visible')) returning id into v_id;
 return v_id;
end $$;

create or replace function public.dragon_admin_article(p_id uuid,p_action text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.dragon_is_admin() then raise exception 'Accès admin requis'; end if;
 if p_action='delete' then
   delete from public.dragon_documents where id=p_id and kind='article';
 elsif p_action in ('hide','show') then
   update public.dragon_documents set payload=jsonb_set(payload,'{status}',to_jsonb(case when p_action='hide' then 'hidden' else 'visible' end))
   where id=p_id and kind='article';
 else raise exception 'Action inconnue'; end if;
end $$;

create or replace function public.dragon_admin_ban(p_client text,p_hours integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.dragon_is_admin() then raise exception 'Accès admin requis'; end if;
 if p_client is null or p_client !~ '^[a-f0-9-]{36}$' then raise exception 'Identifiant invalide'; end if;
 delete from public.dragon_documents where kind='ban' and payload->>'client_id'=p_client;
 if p_hours is not null and p_hours>0 then
   if p_hours>8760 then raise exception 'Durée maximale : 8760 heures'; end if;
   insert into public.dragon_documents(kind,payload) values ('ban',jsonb_build_object(
     'client_id',p_client,'until',now()+make_interval(hours=>p_hours)));
 end if;
end $$;

-- Liste des bannissements, accessible seulement à l'admin.
create or replace function public.dragon_admin_bans() returns table(client_id text, until_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select d.payload->>'client_id', (d.payload->>'until')::timestamptz
 from public.dragon_documents d where d.kind='ban' and public.dragon_is_admin()
 and (d.payload->>'until')::timestamptz>now()
 order by (d.payload->>'until')::timestamptz desc;
$$;
revoke all on function public.dragon_is_admin() from public,anon,authenticated;
revoke all on function public.dragon_publish(jsonb) from public,anon,authenticated;
revoke all on function public.dragon_admin_article(uuid,text) from public,anon,authenticated;
revoke all on function public.dragon_admin_ban(text,integer) from public,anon,authenticated;
revoke all on function public.dragon_admin_bans() from public,anon,authenticated;
grant execute on function public.dragon_is_admin() to authenticated;
grant execute on function public.dragon_publish(jsonb) to anon,authenticated;
grant execute on function public.dragon_admin_article(uuid,text) to authenticated;
grant execute on function public.dragon_admin_ban(text,integer) to authenticated;
grant execute on function public.dragon_admin_bans() to authenticated;
-- IMPORTANT : la clé service_role ne doit jamais être utilisée dans le HTML.
