const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
async function fixture() {
 const db = new PGlite({ extensions: { pgcrypto } });
 await db.exec(`
 create schema auth; create schema extensions;
 create extension pgcrypto with schema extensions;
 create role anon; create role authenticated; create role service_role;
 grant usage on schema auth,public to anon,authenticated,service_role;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create table auth.users(id uuid primary key);
 create table public.profiles(id uuid primary key references auth.users(id),role text default 'member');
 create table public.lobbix_profiles(id uuid primary key references auth.users(id),nickname text not null unique,created_at timestamptz default now());
 create table public.lobbix_lobbies(id uuid primary key default gen_random_uuid(),name text not null,description text not null default '',is_public boolean not null default true,is_random boolean not null default false,created_by uuid references auth.users(id),created_at timestamptz not null default now(),expires_at timestamptz,empty_timeout_minutes integer not null default 10);
 create table public.lobbix_members(lobby_id uuid not null references public.lobbix_lobbies(id),user_id uuid not null unique references auth.users(id),joined_at timestamptz not null default now(),primary key(lobby_id,user_id));
 create table public.lobbix_messages(id bigint generated always as identity primary key,lobby_id uuid not null references public.lobbix_lobbies(id),sender_id uuid not null references auth.users(id),body text not null,created_at timestamptz not null default now(),deleted_at timestamptz);
 create table public.lobbix_reports(id bigint generated always as identity primary key,message_id bigint references public.lobbix_messages(id),reporter_id uuid references auth.users(id),reason text,created_at timestamptz not null default now(),status text default 'pending',reviewed_by uuid,reviewed_at timestamptz);
 create table public.lobbix_sg_state(user_id uuid primary key references auth.users(id),strike_window timestamptz not null default now(),strikes integer not null default 0,muted_until timestamptz,last_message_at timestamptz,last_lobby_at timestamptz);
 create function public.lobbix_is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
 create function public.lobbix_my_profile() returns jsonb language sql stable security definer set search_path='' as $$ select jsonb_build_object('id',id,'nickname',nickname) from public.lobbix_profiles where id=auth.uid() $$;
 create function public.lobbix_sg_create_lobby(p_actor uuid,p_name text,p_description text,p_hours integer,p_empty_minutes integer) returns uuid language plpgsql security definer set search_path='' as $$
 declare v_id uuid;
 begin
 if not exists(select 1 from public.lobbix_profiles where id=p_actor) then raise exception 'Profil requis'; end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 60 or length(coalesce(p_description,''))>150 or lower(trim(p_name))='random' then raise exception 'Nom / description invalide'; end if;
 if p_hours is not null and p_hours not between 1 and 24 then raise exception 'Durée invalide'; end if;
 if p_empty_minutes is null or p_empty_minutes not between 1 and 30 then raise exception 'Délai invalide'; end if;
 insert into public.lobbix_lobbies(name,description,created_by,expires_at,empty_timeout_minutes) values(p_name,coalesce(p_description,''),p_actor,case when p_hours is null then null else now()+make_interval(hours=>p_hours) end,p_empty_minutes) returning id into v_id;
 return v_id;
 end $$;
 revoke all on function public.lobbix_sg_create_lobby(uuid,text,text,integer,integer) from public,anon,authenticated;
 grant execute on function public.lobbix_sg_create_lobby(uuid,text,text,integer,integer) to service_role;
 `);
 await db.exec(fs.readFileSync(__dirname + '/../server/database_v1.sql','utf8'));
 const ids = Array.from({length:5},(_,i)=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
 for (let i=0;i<ids.length;i++) {
  await db.query('insert into auth.users(id) values($1)',[ids[i]]);
  await db.query('insert into public.lobbix_profiles(id,nickname) values($1,$2)',[ids[i],'Joueur'+i]);
  await db.query('insert into public.profiles(id,role) values($1,$2)',[ids[i],i===4?'admin':'member']);
 }
 let queue=Promise.resolve();
 function as(actor,sql,params=[],role='authenticated') {
  const call=queue.then(async()=>{
   await db.exec('set role '+role);
   await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[actor||'',JSON.stringify({sub:actor,role})]);
   try { return (await db.query(sql,params)).rows; }
   finally { await db.exec('reset role'); }
  });queue=call.catch(()=>{});return call;
 }
 const action=async(actor,room,act,data={},client='tab-'+ids.indexOf(actor))=>(await as(actor,'select public.lobbix_v1_action($1,$2,$3,$4) as value',[room,client,act,JSON.stringify(data)]))[0].value;
 const state=async(actor,room,activity=null,version=0,after=0,signalAfter=0,client='tab-'+ids.indexOf(actor))=>(await as(actor,'select public.lobbix_v1_state($1,$2,$3,$4,$5,$6) as value',[room,client,activity,version,after,signalAfter]))[0].value;
 const publish=async(actor,room,kind,data)=>(await as(null,'select public.lobbix_v1_publish($1,$2,$3,$4) as value',[actor,room,kind,JSON.stringify(data)],'service_role'))[0].value;
 return {db,ids,as,action,state,publish};
}
module.exports={fixture};
