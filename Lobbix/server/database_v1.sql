-- Lobbix 1.0 / SafeGuard 2.0. Additive schema; existing accounts and messages stay intact.
create schema if not exists lobbix_private;
revoke all on schema lobbix_private from public, anon;
grant usage on schema lobbix_private to authenticated, service_role;

alter table public.lobbix_lobbies add column if not exists empty_since timestamptz;
create table if not exists lobbix_private.room_passwords (
 lobby_id uuid primary key references public.lobbix_lobbies(id) on delete cascade,
 password_hash text not null
);
alter table lobbix_private.room_passwords enable row level security;
revoke all on lobbix_private.room_passwords from public, anon, authenticated, service_role;
create table if not exists lobbix_private.join_attempts (
 lobby_id uuid not null references public.lobbix_lobbies(id) on delete cascade,
 user_id uuid not null references auth.users(id),window_at timestamptz not null default now(),attempts integer not null default 1,
 primary key(lobby_id,user_id)
);
alter table lobbix_private.join_attempts enable row level security;
revoke all on lobbix_private.join_attempts from public,anon,authenticated,service_role;

create table if not exists public.lobbix_presence (
  lobby_id uuid not null references public.lobbix_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (length(client_id) between 1 and 80),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  activity_id uuid,
  primary key(lobby_id,user_id,client_id)
);
create index if not exists lobbix_presence_live on public.lobbix_presence(lobby_id,last_seen_at);

create table if not exists public.lobbix_activities (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbix_lobbies(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  kind text not null check(kind in ('draw','wheel','poll','tictactoe','quiz')),
  title text not null check(length(title) between 1 and 120),
  state jsonb not null default '{}',
  revision bigint not null default 1,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lobbix_activities_room on public.lobbix_activities(lobby_id,is_open,created_at);
create table if not exists public.lobbix_strokes (
  id uuid primary key,
  activity_id uuid not null references public.lobbix_activities(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  color text not null check(color ~ '^#[0-9a-fA-F]{6}$'),
  width integer not null check(width between 1 and 20),
  points jsonb not null,
  revision bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists lobbix_strokes_board on public.lobbix_strokes(activity_id,created_at);
create table if not exists public.lobbix_scores (
  lobby_id uuid not null references public.lobbix_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  points integer not null default 0,
  wins integer not null default 0,
  primary key(lobby_id,user_id)
);
create table if not exists public.lobbix_awards (
  activity_id uuid not null references public.lobbix_activities(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  points integer not null,
  primary key(activity_id,user_id)
);
create table if not exists public.lobbix_screen_sessions (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbix_lobbies(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  owner_client text not null,
  started_at timestamptz not null default now(),
  deadline timestamptz not null default (now()+interval '10 minutes'),
  heartbeat_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists lobbix_screen_owner on public.lobbix_screen_sessions(owner_id,started_at desc);
create index if not exists lobbix_screen_room on public.lobbix_screen_sessions(lobby_id,started_at desc);
create table if not exists public.lobbix_screen_signals (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.lobbix_screen_sessions(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  sender_client text not null,
  recipient_id uuid not null references auth.users(id),
  recipient_client text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists lobbix_screen_inbox on public.lobbix_screen_signals(recipient_id,recipient_client,id);
create table if not exists public.lobbix_activity_reports (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbix_lobbies(id),
  target_id uuid not null,
  target_kind text not null check(target_kind in ('activity','screen')),
  reporter_id uuid not null references auth.users(id),
  reason text not null check(length(reason) between 10 and 250),
  status text not null default 'pending' check(status in ('pending','reviewed')),
  created_at timestamptz not null default now(),
  unique(target_id,reporter_id)
);

-- New tables are deliberately available only through the validated RPCs.
alter table public.lobbix_presence enable row level security;
alter table public.lobbix_activities enable row level security;
alter table public.lobbix_strokes enable row level security;
alter table public.lobbix_scores enable row level security;
alter table public.lobbix_awards enable row level security;
alter table public.lobbix_screen_sessions enable row level security;
alter table public.lobbix_screen_signals enable row level security;
alter table public.lobbix_activity_reports enable row level security;
revoke all on public.lobbix_presence, public.lobbix_activities, public.lobbix_strokes,
  public.lobbix_scores, public.lobbix_awards, public.lobbix_screen_sessions,
  public.lobbix_screen_signals, public.lobbix_activity_reports from public, anon, authenticated;

create or replace function lobbix_private.room_open(p_room uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select
    (r.is_random or ((r.expires_at is null or r.expires_at>now()) and (
      exists(select 1 from public.lobbix_presence p where p.lobby_id=r.id and p.left_at is null and p.last_seen_at>now()-interval '90 seconds')
      or now()<coalesce(
        (select max(coalesce(p.left_at,p.last_seen_at+interval '90 seconds')) from public.lobbix_presence p where p.lobby_id=r.id),
        r.empty_since,r.created_at)+make_interval(mins=>r.empty_timeout_minutes)
    ))) from public.lobbix_lobbies r where r.id=p_room),false)
$$;
create or replace function lobbix_private.present(p_room uuid,p_actor uuid,p_client text default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lobbix_presence p where p.lobby_id=p_room and p.user_id=p_actor
   and (p_client is null or p.client_id=p_client) and p.left_at is null and p.last_seen_at>now()-interval '90 seconds')
$$;
create or replace function lobbix_private.require_member(p_room uuid,p_actor uuid,p_client text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_actor is null or not exists(select 1 from public.lobbix_profiles where id=p_actor) then raise exception 'Profil requis'; end if;
 if not lobbix_private.room_open(p_room) then raise exception 'Ce lobby a expiré ou est fermé'; end if;
 if not lobbix_private.present(p_room,p_actor,p_client) then raise exception 'Rejoins le lobby pour continuer'; end if;
end $$;

create or replace function lobbix_private.award(p_activity uuid,p_actor uuid,p_points integer,p_win boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_room uuid;
begin
 select lobby_id into v_room from public.lobbix_activities where id=p_activity;
 insert into public.lobbix_awards(activity_id,user_id,points) values(p_activity,p_actor,p_points) on conflict do nothing;
 if found then
  insert into public.lobbix_scores(lobby_id,user_id,points,wins) values(v_room,p_actor,p_points,case when p_win then 1 else 0 end)
  on conflict(lobby_id,user_id) do update set points=lobbix_scores.points+excluded.points,wins=lobbix_scores.wins+excluded.wins;
 end if;
end $$;

create or replace function lobbix_private.board_cleanup(p_room uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_board uuid;
begin
 for v_board in select a.id from public.lobbix_activities a where a.lobby_id=p_room and a.kind='draw'
  and not exists(select 1 from public.lobbix_presence p where p.activity_id=a.id and p.left_at is null and p.last_seen_at>now()-interval '90 seconds')
  and (exists(select 1 from public.lobbix_strokes s where s.activity_id=a.id) or a.state ? 'clear_votes')
 loop
  perform 1 from public.lobbix_activities where id=v_board for update;
  if not exists(select 1 from public.lobbix_presence p where p.activity_id=v_board and p.left_at is null and p.last_seen_at>now()-interval '90 seconds') then
   delete from public.lobbix_strokes where activity_id=v_board;
   update public.lobbix_activities set state=jsonb_build_object('cleared_revision',revision+1),revision=revision+1,updated_at=now() where id=v_board;
  end if;
 end loop;
end $$;

create or replace function lobbix_private.activity_view(p_id uuid,p_actor uuid,p_since bigint default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.lobbix_activities%rowtype; s jsonb; me jsonb; q jsonb; v_players jsonb;
begin
 select * into a from public.lobbix_activities where id=p_id;
 if not found then return null; end if;
 s:=a.state;
 if a.kind='draw' then
  s:=s||jsonb_build_object('strokes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'color',color,'width',width,'points',points) order by created_at,id) from public.lobbix_strokes where activity_id=a.id and revision>p_since),'[]'::jsonb),
    'participants',coalesce((select jsonb_agg(distinct p.user_id) from public.lobbix_presence p where p.activity_id=a.id and p.left_at is null and p.last_seen_at>now()-interval '90 seconds'),'[]'::jsonb));
 elsif a.kind='quiz' then
  me:=s->'players'->p_actor::text;
  q:=s->'questions'->coalesce((me->>'progress')::integer,0);
  select coalesce(jsonb_object_agg(key,value-'last_answer'),'{}'::jsonb) into v_players from jsonb_each(coalesce(s->'players','{}'::jsonb));
  s:=jsonb_build_object('players',v_players,'question',q-'answer','question_index',coalesce((me->>'progress')::integer,0),
   'total',jsonb_array_length(s->'questions'),'feedback',me->'last_answer','closes_at',s->'closes_at');
 end if;
 return jsonb_build_object('id',a.id,'kind',a.kind,'title',a.title,'owner_id',a.owner_id,'state',s,'revision',a.revision,'is_open',a.is_open,'created_at',a.created_at);
end $$;

create or replace function lobbix_private.action(p_room uuid,p_client text,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); r public.lobbix_lobbies%rowtype; a public.lobbix_activities%rowtype;
 sh public.lobbix_screen_sessions%rowtype; aid uuid; sid uuid; v_id uuid; s jsonb; me jsonb;
 v_count integer; v_move integer; v_index integer; v_answer integer; v_n integer; v_x integer; v_y integer;
 v_line integer[]; v_board jsonb; v_mark text; v_winner text; v_players jsonb; v_votes jsonb;
 v_start timestamptz; v_end timestamptz; v_target uuid; v_recipient uuid; v_recipient_client text;
 v_questions jsonb:='[]'; v_options jsonb; v_question text; v_answer_text text;
 v_hash text; v_message public.lobbix_messages%rowtype; v_joined timestamptz;
begin
 if u is null or not exists(select 1 from public.lobbix_profiles where id=u) then raise exception 'Connexion et profil requis'; end if;
 if p_client is null or p_client !~ '^[a-zA-Z0-9-]{1,80}$' then raise exception 'Onglet invalide'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>70000 then raise exception 'Données invalides'; end if;
 select * into r from public.lobbix_lobbies where id=p_room for update;
 if not found then raise exception 'Lobby introuvable'; end if;

 if p_action='join' then
  if not lobbix_private.room_open(p_room) then raise exception 'Ce lobby a expiré ou est fermé'; end if;
  select password_hash into v_hash from lobbix_private.room_passwords where lobby_id=p_room;
  if not r.is_public then
   insert into lobbix_private.join_attempts(lobby_id,user_id) values(p_room,u)
    on conflict(lobby_id,user_id) do update set attempts=case when join_attempts.window_at<now()-interval '1 minute' then 1 else join_attempts.attempts+1 end,window_at=case when join_attempts.window_at<now()-interval '1 minute' then now() else join_attempts.window_at end
    returning attempts into v_n;
   if v_n>5 then return jsonb_build_object('ok',false,'message','Trop de tentatives : attends une minute avant de réessayer'); end if;
  end if;
  if not r.is_public and (v_hash is null or length(coalesce(p_data->>'password',''))>128 or
    extensions.crypt(coalesce(p_data->>'password',''),v_hash)<>v_hash) then return jsonb_build_object('ok',false,'message','Mot de passe du lobby incorrect'); end if;
  if not r.is_public then delete from lobbix_private.join_attempts where lobby_id=p_room and user_id=u; end if;
  select count(distinct user_id) into v_count from public.lobbix_presence where lobby_id=p_room and left_at is null and last_seen_at>now()-interval '90 seconds';
  if v_count>=25 and not lobbix_private.present(p_room,u) then raise exception 'Lobby complet : 25 membres maximum'; end if;
  insert into public.lobbix_presence(lobby_id,user_id,client_id) values(p_room,u,p_client)
   on conflict(lobby_id,user_id,client_id) do update set joined_at=case when lobbix_presence.left_at is null and lobbix_presence.last_seen_at>now()-interval '90 seconds' then lobbix_presence.joined_at else now() end,last_seen_at=now(),left_at=null,activity_id=null;
  update public.lobbix_lobbies set empty_since=null where id=p_room;
  -- Keep legacy moderation/reporting compatible, without moving another tab out of its room.
  insert into public.lobbix_members(lobby_id,user_id) values(p_room,u) on conflict(user_id) do nothing;
  return jsonb_build_object('ok',true,'id',r.id,'name',r.name,'joined_at',(select joined_at from public.lobbix_presence where lobby_id=p_room and user_id=u and client_id=p_client));
 end if;
 if p_action='leave' then
  update public.lobbix_presence set left_at=now(),activity_id=null where lobby_id=p_room and user_id=u and client_id=p_client and left_at is null;
  update public.lobbix_screen_sessions set ended_at=least(now(),deadline) where lobby_id=p_room and owner_id=u and owner_client=p_client and ended_at is null;
  if not lobbix_private.present(p_room,u) then delete from public.lobbix_members where lobby_id=p_room and user_id=u; end if;
  if not exists(select 1 from public.lobbix_presence where lobby_id=p_room and left_at is null and last_seen_at>now()-interval '90 seconds') then update public.lobbix_lobbies set empty_since=now() where id=p_room; end if;
  perform lobbix_private.board_cleanup(p_room);
  return jsonb_build_object('ok',true);
 end if;
 perform lobbix_private.require_member(p_room,u,p_client);
 update public.lobbix_presence set last_seen_at=now() where lobby_id=p_room and user_id=u and client_id=p_client;
 update public.lobbix_screen_sessions set ended_at=least(deadline,heartbeat_at+interval '30 seconds') where ended_at is null and least(deadline,heartbeat_at+interval '30 seconds')<=now();

 if p_action='activity_leave' then
  update public.lobbix_presence set activity_id=null where lobby_id=p_room and user_id=u and client_id=p_client;
  perform lobbix_private.board_cleanup(p_room);
  return jsonb_build_object('ok',true);
 elsif p_action='game_create' then
  if p_data->>'kind' not in ('tictactoe','quiz','draw') then raise exception 'Activité inconnue'; end if;
  if (select count(*) from public.lobbix_activities where lobby_id=p_room and is_open)>=16 then raise exception 'Ferme une activité avant d’en créer une nouvelle'; end if;
  if exists(select 1 from public.lobbix_activities where owner_id=u and created_at>now()-interval '3 seconds') then raise exception 'Attends quelques secondes avant de créer une activité'; end if;
  if p_data->>'kind'='tictactoe' then
   s:=jsonb_build_object('players',jsonb_build_array(u),'board',jsonb_build_array('','','','','','','','',''),'turn','X','winner',null);
   v_question:='Morpion';
  elsif p_data->>'kind'='draw' then s:='{}';v_question:='Tableau blanc';
  else
   for v_index in 1..5 loop
    v_x:=1+floor(random()*20)::int;v_y:=1+floor(random()*20)::int;v_answer:=floor(random()*4)::int;
    v_options:='[]';
    for v_move in 0..3 loop v_options:=v_options||jsonb_build_array((v_x+v_y+(v_move-v_answer)*2)::text); end loop;
    v_questions:=v_questions||jsonb_build_array(jsonb_build_object('label',v_x::text||' + '||v_y::text||' = ?','options',v_options,'answer',v_answer));
   end loop;
   s:=jsonb_build_object('questions',v_questions,'players',jsonb_build_object(u::text,jsonb_build_object('progress',0,'score',0,'started_at',now())),'closes_at',now()+interval '10 minutes');
   v_question:='Défi calcul';
  end if;
  insert into public.lobbix_activities(lobby_id,owner_id,kind,title,state) values(p_room,u,p_data->>'kind',v_question,s) returning id into aid;
  return jsonb_build_object('ok',true,'activity_id',aid);
 elsif p_action='screen_start' then
  delete from public.lobbix_screen_signals where created_at<now()-interval '15 minutes';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lobbix-screen:'||u::text));
  select max(ended_at) into v_end from public.lobbix_screen_sessions where owner_id=u;
  if v_end>now()-interval '1 minute' then raise exception 'Attends une minute après la fin de ton dernier partage'; end if;
  if exists(select 1 from public.lobbix_screen_sessions where (lobby_id=p_room or owner_id=u) and ended_at is null) then raise exception 'Un partage est déjà en cours'; end if;
  insert into public.lobbix_screen_sessions(lobby_id,owner_id,owner_client) values(p_room,u,p_client) returning * into sh;
  return jsonb_build_object('ok',true,'share',jsonb_build_object('id',sh.id,'owner_id',sh.owner_id,'owner_client',sh.owner_client,'deadline',sh.deadline));
 elsif p_action='screen_stop' then
  update public.lobbix_screen_sessions set ended_at=least(now(),deadline) where id=(p_data->>'session_id')::uuid and owner_id=u and owner_client=p_client and ended_at is null;
  return jsonb_build_object('ok',true);
 elsif p_action='screen_signal' then
  select * into sh from public.lobbix_screen_sessions where id=(p_data->>'session_id')::uuid and lobby_id=p_room and ended_at is null and deadline>now() and heartbeat_at>now()-interval '30 seconds';
  if not found then raise exception 'Partage terminé'; end if;
  v_recipient:=(p_data->>'recipient_id')::uuid;v_recipient_client:=p_data->>'recipient_client';
  if not lobbix_private.present(p_room,v_recipient,v_recipient_client) or (u<>sh.owner_id and v_recipient<>sh.owner_id) or
    (u=sh.owner_id and p_client<>sh.owner_client) or (v_recipient=sh.owner_id and v_recipient_client<>sh.owner_client) then raise exception 'Destinataire non autorisé'; end if;
  if p_data->'signal'->>'type' not in ('request','offer','answer','ice','bye') or octet_length((p_data->'signal')::text)>65000 then raise exception 'Signal invalide'; end if;
  if (select count(*) from public.lobbix_screen_signals where sender_id=u and created_at>now()-interval '1 minute')>=600 or
    (select coalesce(sum(octet_length(payload::text)),0) from public.lobbix_screen_signals where sender_id=u and created_at>now()-interval '1 minute')>500000 then raise exception 'Trop de signaux'; end if;
  insert into public.lobbix_screen_signals(session_id,sender_id,sender_client,recipient_id,recipient_client,payload) values(sh.id,u,p_client,v_recipient,v_recipient_client,p_data->'signal');
  return jsonb_build_object('ok',true);
 elsif p_action='report_message' then
  select * into v_message from public.lobbix_messages where id=(p_data->>'message_id')::bigint and lobby_id=p_room;
  select joined_at into v_joined from public.lobbix_presence where lobby_id=p_room and user_id=u and client_id=p_client;
  if v_message.id is null or v_message.created_at<v_joined then raise exception 'Message non accessible'; end if;
  if length(trim(coalesce(p_data->>'reason',''))) not between 10 and 250 then raise exception 'Motif : 10 à 250 caractères'; end if;
  if exists(select 1 from public.lobbix_reports where reporter_id=u and created_at>now()-interval '30 seconds') then raise exception 'Attends avant de signaler à nouveau'; end if;
  insert into public.lobbix_reports(message_id,reporter_id,reason) values(v_message.id,u,trim(p_data->>'reason'));
  return jsonb_build_object('ok',true);
 elsif p_action='report_activity' then
  v_target:=(p_data->>'target_id')::uuid;
  if p_data->>'kind'='activity' then
   if not exists(select 1 from public.lobbix_activities where id=v_target and lobby_id=p_room) then raise exception 'Activité introuvable'; end if;
  elsif p_data->>'kind'='screen' then
   if not exists(select 1 from public.lobbix_screen_sessions where id=v_target and lobby_id=p_room) then raise exception 'Partage introuvable'; end if;
  else raise exception 'Signalement invalide'; end if;
  if length(trim(coalesce(p_data->>'reason',''))) not between 10 and 250 then raise exception 'Motif : 10 à 250 caractères'; end if;
  if exists(select 1 from public.lobbix_activity_reports where reporter_id=u and created_at>now()-interval '30 seconds') then raise exception 'Attends avant de signaler à nouveau'; end if;
  insert into public.lobbix_activity_reports(lobby_id,target_id,target_kind,reporter_id,reason) values(p_room,v_target,p_data->>'kind',u,trim(p_data->>'reason')) on conflict(target_id,reporter_id) do nothing;
  return jsonb_build_object('ok',true);
 end if;

 aid:=(p_data->>'activity_id')::uuid;
 select * into a from public.lobbix_activities where id=aid and lobby_id=p_room for update;
 if not found then raise exception 'Activité introuvable'; end if;
 if not a.is_open then raise exception 'Cette activité est terminée'; end if;
 s:=a.state;
 if p_action='activity_close' then
  if a.owner_id<>u and not public.lobbix_is_admin() and (lobbix_private.present(p_room,a.owner_id) or exists(select 1 from public.lobbix_presence where activity_id=aid and left_at is null and last_seen_at>now()-interval '90 seconds')) then raise exception 'Seul le créateur peut fermer cette activité'; end if;
  update public.lobbix_activities set is_open=false,revision=revision+1,updated_at=now() where id=aid;
  return jsonb_build_object('ok',true);
 elsif p_action='activity_join' then
  update public.lobbix_presence set activity_id=aid where lobby_id=p_room and user_id=u and client_id=p_client;
  if a.kind='tictactoe' and not (s->'players' @> jsonb_build_array(u)) and jsonb_array_length(s->'players')<2 then s:=jsonb_set(s,'{players}',s->'players'||jsonb_build_array(u));
  elsif a.kind='quiz' and s->'players'->u::text is null then
   if (s->>'closes_at')::timestamptz<=now() then raise exception 'Défi terminé'; end if;
   s:=jsonb_set(s,array['players',u::text],jsonb_build_object('progress',0,'score',0,'started_at',now()));
  end if;
 elsif p_action='draw_stroke' and a.kind='draw' then
  if not exists(select 1 from public.lobbix_presence where lobby_id=p_room and user_id=u and client_id=p_client and activity_id=aid) then raise exception 'Ouvre le tableau avant de dessiner'; end if;
  if p_data->>'color' !~ '^#[0-9a-fA-F]{6}$' or (p_data->>'width')::int not between 1 and 20 or jsonb_typeof(p_data->'points')<>'array' or jsonb_array_length(p_data->'points') not between 1 and 300 then raise exception 'Tracé invalide'; end if;
  if exists(select 1 from jsonb_array_elements(p_data->'points') point where jsonb_typeof(point)<>'array' or jsonb_array_length(point)<>2 or jsonb_typeof(point->0)<>'number' or jsonb_typeof(point->1)<>'number' or (point->>0)::numeric not between 0 and 1 or (point->>1)::numeric not between 0 and 1) then raise exception 'Coordonnées invalides'; end if;
  if (select count(*) from public.lobbix_strokes where activity_id=aid)>=1500 then raise exception 'Tableau plein : demande un effacement par vote'; end if;
  if (select count(*) from public.lobbix_strokes where user_id=u and created_at>now()-interval '1 second')>=12 then raise exception 'Dessine un peu plus lentement'; end if;
  insert into public.lobbix_strokes(id,activity_id,user_id,color,width,points,revision) values((p_data->>'stroke_id')::uuid,aid,u,p_data->>'color',(p_data->>'width')::int,p_data->'points',a.revision+1) on conflict(id) do nothing;
 elsif p_action='draw_clear_vote' and a.kind='draw' then
  if not exists(select 1 from public.lobbix_presence where lobby_id=p_room and user_id=u and client_id=p_client and activity_id=aid) then raise exception 'Ouvre le tableau avant de voter'; end if;
  v_votes:=coalesce(s->'clear_votes','{}'::jsonb)||jsonb_build_object(u::text,true);
  select count(distinct user_id) into v_count from public.lobbix_presence where activity_id=aid and left_at is null and last_seen_at>now()-interval '90 seconds';
  select count(distinct p.user_id) into v_n from public.lobbix_presence p where p.activity_id=aid and p.left_at is null and p.last_seen_at>now()-interval '90 seconds' and v_votes ? p.user_id::text;
  if v_n>v_count/2 then delete from public.lobbix_strokes where activity_id=aid;s:=jsonb_build_object('cleared_revision',a.revision+1);
  else s:=jsonb_set(s,'{clear_votes}',v_votes); end if;
 elsif p_action='poll_vote' and a.kind='poll' then
  v_index:=(p_data->>'option')::integer;
  if v_index is null or v_index<0 or v_index>=jsonb_array_length(s->'options') then raise exception 'Choix invalide'; end if;
  s:=jsonb_set(s,'{votes}',coalesce(s->'votes','{}'::jsonb)||jsonb_build_object(u::text,v_index));
 elsif p_action='wheel_spin' and a.kind='wheel' then
  if a.updated_at>now()-interval '2 seconds' and s ? 'result' then raise exception 'Attends avant de relancer la roue'; end if;
  v_index:=floor(random()*jsonb_array_length(s->'items'))::integer;
  s:=s||jsonb_build_object('result',s->'items'->v_index,'spun_by',u,'spun_at',now());
 elsif p_action='ttt_move' and a.kind='tictactoe' then
  if s->>'winner' is not null then raise exception 'Partie terminée'; end if;
  if jsonb_array_length(s->'players')<>2 then raise exception 'Attends un deuxième joueur'; end if;
  v_mark:=s->>'turn';v_index:=case when v_mark='X' then 0 else 1 end;
  if s->'players'->>v_index<>u::text then raise exception 'Ce n’est pas ton tour'; end if;
  v_move:=(p_data->>'cell')::integer;
  if v_move is null or v_move not between 0 and 8 or s->'board'->>v_move<>'' then raise exception 'Case indisponible'; end if;
  v_board:=jsonb_set(s->'board',array[v_move::text],to_jsonb(v_mark));
  foreach v_line slice 1 in array array[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]] loop
   if v_board->>v_line[1]=v_mark and v_board->>v_line[2]=v_mark and v_board->>v_line[3]=v_mark then v_winner:=v_mark; end if;
  end loop;
  if v_winner is not null then perform lobbix_private.award(aid,u,3,true);
  elsif not exists(select 1 from jsonb_array_elements_text(v_board) value where value='') then
   v_winner:='draw';perform lobbix_private.award(aid,(s->'players'->>0)::uuid,1,false);perform lobbix_private.award(aid,(s->'players'->>1)::uuid,1,false);
  end if;
  s:=s||jsonb_build_object('board',v_board,'turn',case when v_mark='X' then 'O' else 'X' end,'winner',v_winner);
 elsif p_action='quiz_answer' and a.kind='quiz' then
  me:=s->'players'->u::text;
  if me is null then raise exception 'Rejoins ce défi'; end if;
  v_index:=(me->>'progress')::integer;
  if v_index>=jsonb_array_length(s->'questions') or p_data->>'question' is null or (p_data->>'question')::int<>v_index then raise exception 'Question déjà validée'; end if;
  if now()>(me->>'started_at')::timestamptz+interval '2 minutes' then raise exception 'Temps du défi écoulé'; end if;
  v_answer:=(p_data->>'option')::integer;
  if v_answer is null or v_answer not between 0 and 3 then raise exception 'Réponse invalide'; end if;
  v_n:=(me->>'score')::integer+case when v_answer=(s->'questions'->v_index->>'answer')::integer then 2 else 0 end;
  me:=me||jsonb_build_object('progress',v_index+1,'score',v_n,'last_answer',v_answer=(s->'questions'->v_index->>'answer')::integer);
  s:=jsonb_set(s,array['players',u::text],me);
  if v_index+1=jsonb_array_length(s->'questions') then perform lobbix_private.award(aid,u,v_n,v_n=10); end if;
 else raise exception 'Action indisponible pour cette activité'; end if;
 update public.lobbix_activities set state=s,revision=revision+1,updated_at=now() where id=aid;
 return jsonb_build_object('ok',true,'activity_id',aid);
end $$;

create or replace function lobbix_private.publish(p_actor uuid,p_room uuid,p_kind text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_password text; v_public boolean; s jsonb; v_item jsonb; v_message bigint;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Publication serveur requise'; end if;
 if p_actor is null or not exists(select 1 from public.lobbix_profiles where id=p_actor) then raise exception 'Profil requis'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>12000 then raise exception 'Publication invalide'; end if;
 if p_kind='lobby' then
  v_public:=coalesce((p_data->>'is_public')::boolean,true);
  v_password:=p_data->>'password';
  if not v_public and length(coalesce(v_password,'')) not between 8 and 128 then raise exception 'Mot de passe privé : 8 à 128 caractères'; end if;
  v_id:=public.lobbix_sg_create_lobby(p_actor,p_data->>'name',coalesce(p_data->>'description',''),(p_data->>'hours')::integer,(p_data->>'empty_minutes')::integer);
  update public.lobbix_lobbies set is_public=v_public,empty_since=now() where id=v_id;
  if not v_public then insert into lobbix_private.room_passwords(lobby_id,password_hash) values(v_id,extensions.crypt(v_password,extensions.gen_salt('bf',8))); end if;
  return jsonb_build_object('ok',true,'lobby_id',v_id);
 end if;
 perform lobbix_private.require_member(p_room,p_actor);
 if p_kind='message' then
  -- The existing sender supplies length, duplicate and rate controls.
  -- A short-lived compatibility row is not needed for a V1 presence in another room.
  if length(trim(coalesce(p_data->>'text',''))) not between 1 and 2000 then raise exception 'Message limité à 2000 caractères'; end if;
  insert into public.lobbix_sg_state(user_id) values(p_actor) on conflict do nothing;
  perform 1 from public.lobbix_sg_state where user_id=p_actor for update;
  if exists(select 1 from public.lobbix_sg_state where user_id=p_actor and muted_until>now()) then raise exception 'Envoi suspendu temporairement'; end if;
  if exists(select 1 from public.lobbix_sg_state where user_id=p_actor and last_message_at>now()-interval '1500 milliseconds') then raise exception 'Ralentis : un message toutes les 1,5 secondes'; end if;
  if (select count(*) from public.lobbix_messages where sender_id=p_actor and created_at>now()-interval '30 seconds')>=8 then raise exception 'Trop de messages : attends un peu'; end if;
  if exists(select 1 from public.lobbix_messages where sender_id=p_actor and lobby_id=p_room and body=trim(p_data->>'text') and created_at>now()-interval '45 seconds') then raise exception 'Message identique déjà envoyé'; end if;
  insert into public.lobbix_messages(lobby_id,sender_id,body) values(p_room,p_actor,trim(p_data->>'text')) returning id into v_message;
  update public.lobbix_sg_state set last_message_at=now() where user_id=p_actor;
  return jsonb_build_object('ok',true,'message_id',v_message);
 end if;
 perform 1 from public.lobbix_lobbies where id=p_room for update;
 if (select count(*) from public.lobbix_activities where lobby_id=p_room and is_open)>=16 then raise exception 'Ferme une activité avant d’en créer une nouvelle'; end if;
 if exists(select 1 from public.lobbix_activities where owner_id=p_actor and created_at>now()-interval '3 seconds') then raise exception 'Attends quelques secondes'; end if;
 if p_kind='poll' then
  if length(trim(coalesce(p_data->>'question',''))) not between 1 and 120 or jsonb_typeof(p_data->'options') is distinct from 'array' or jsonb_array_length(p_data->'options') not between 2 and 8 then raise exception 'Sondage : une question et 2 à 8 réponses'; end if;
  for v_item in select * from jsonb_array_elements(p_data->'options') loop
   if jsonb_typeof(v_item)<>'string' or length(trim(v_item#>>'{}')) not between 1 and 80 then raise exception 'Réponse de sondage invalide'; end if;
  end loop;
  s:=jsonb_build_object('options',p_data->'options','votes','{}'::jsonb);
  insert into public.lobbix_activities(lobby_id,owner_id,kind,title,state) values(p_room,p_actor,'poll',trim(p_data->>'question'),s) returning id into v_id;
 elsif p_kind='wheel' then
  if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items') not between 2 and 30 then raise exception 'Roue : 2 à 30 propositions'; end if;
  for v_item in select * from jsonb_array_elements(p_data->'items') loop
   if jsonb_typeof(v_item)<>'string' or length(trim(v_item#>>'{}')) not between 1 and 80 then raise exception 'Proposition invalide'; end if;
  end loop;
  s:=jsonb_build_object('items',p_data->'items');
  insert into public.lobbix_activities(lobby_id,owner_id,kind,title,state) values(p_room,p_actor,'wheel','Roue de choix',s) returning id into v_id;
 else raise exception 'Type de publication inconnu'; end if;
 return jsonb_build_object('ok',true,'activity_id',v_id);
end $$;

create or replace function lobbix_private.room_state(p_room uuid,p_client text,p_activity uuid,p_version bigint,p_after bigint,p_signal_after bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.lobbix_lobbies%rowtype; v_joined timestamptz; sh public.lobbix_screen_sessions%rowtype; v_cooldown timestamptz; v_activity jsonb;
begin
 if u is null then raise exception 'Connexion requise'; end if;
 select * into r from public.lobbix_lobbies where id=p_room;
 if not found then return jsonb_build_object('closed',true,'reason','Lobby introuvable','server_now',now()); end if;
 if not lobbix_private.room_open(p_room) then return jsonb_build_object('closed',true,'reason','Ce lobby a expiré. Tu peux revenir à l’accueil.','server_now',now()); end if;
 if not lobbix_private.present(p_room,u,p_client) then return jsonb_build_object('unjoined',true,'reason','Ta présence a expiré. Rejoins à nouveau ce lobby.','server_now',now()); end if;
 update public.lobbix_presence set last_seen_at=now() where lobby_id=p_room and user_id=u and client_id=p_client returning joined_at into v_joined;
 update public.lobbix_screen_sessions set ended_at=least(deadline,heartbeat_at+interval '30 seconds') where ended_at is null and least(deadline,heartbeat_at+interval '30 seconds')<=now();
 update public.lobbix_screen_sessions set heartbeat_at=now() where lobby_id=p_room and owner_id=u and owner_client=p_client and ended_at is null;
 select * into sh from public.lobbix_screen_sessions where lobby_id=p_room and ended_at is null order by started_at desc limit 1;
 select max(ended_at)+interval '1 minute' into v_cooldown from public.lobbix_screen_sessions where owner_id=u;
 perform lobbix_private.board_cleanup(p_room);
 if p_activity is not null and exists(select 1 from public.lobbix_activities where id=p_activity and lobby_id=p_room and revision>p_version) then v_activity:=lobbix_private.activity_view(p_activity,u,p_version); end if;
 return jsonb_build_object('server_now',now(),'room',jsonb_build_object('id',r.id,'name',r.name,'is_public',r.is_public,'is_random',r.is_random,'expires_at',r.expires_at),
  'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'nickname',pr.nickname,'client_id',p.client_id,'joined_at',p.joined_at,'activity_id',p.activity_id)) from public.lobbix_presence p join public.lobbix_profiles pr on pr.id=p.user_id where p.lobby_id=p_room and p.left_at is null and p.last_seen_at>now()-interval '90 seconds'),'[]'::jsonb),
  'messages',coalesce((select jsonb_agg(x order by x.id) from (select m.id,m.sender_id,m.body,m.created_at,m.deleted_at,pr.nickname from public.lobbix_messages m join public.lobbix_profiles pr on pr.id=m.sender_id where m.lobby_id=p_room and m.id>p_after and m.created_at>=v_joined and (not r.is_random or m.created_at>now()-interval '24 hours') order by m.id limit 100) x),'[]'::jsonb),
  'removed_messages',coalesce((select jsonb_agg(id) from public.lobbix_messages where lobby_id=p_room and deleted_at is not null and created_at>=v_joined and id<=p_after),'[]'::jsonb),
  'activities',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title,'owner_id',owner_id,'revision',revision,'is_open',is_open) order by created_at) from public.lobbix_activities where lobby_id=p_room and is_open),'[]'::jsonb),
  'activity',v_activity,'share',case when sh.id is null then null else jsonb_build_object('id',sh.id,'owner_id',sh.owner_id,'owner_client',sh.owner_client,'deadline',sh.deadline,'valid_until',least(sh.deadline,sh.heartbeat_at+interval '30 seconds')) end,
  'cooldown_until',v_cooldown,
  'signals',coalesce((select jsonb_agg(jsonb_build_object('id',id,'session_id',session_id,'sender_id',sender_id,'sender_client',sender_client,'signal',payload) order by id) from public.lobbix_screen_signals where recipient_id=u and recipient_client=p_client and id>p_signal_after and session_id=sh.id and created_at>now()-interval '5 minutes'),'[]'::jsonb),
  'scores',coalesce((select jsonb_agg(x order by x.points desc,x.nickname) from (select p.user_id,pr.nickname,p.points,p.wins from public.lobbix_scores p join public.lobbix_profiles pr on pr.id=p.user_id where p.lobby_id=p_room order by p.points desc limit 25) x),'[]'::jsonb));
end $$;

create or replace function lobbix_private.list_rooms()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 return coalesce((select jsonb_agg(x order by x.is_random desc,x.current_players desc,x.created_at desc) from (
  select r.id,r.name,r.description,r.is_random,r.is_public,r.expires_at,r.created_at,
   (select count(distinct user_id) from public.lobbix_presence p where p.lobby_id=r.id and p.left_at is null and p.last_seen_at>now()-interval '90 seconds') as current_players
  from public.lobbix_lobbies r where lobbix_private.room_open(r.id) and (r.is_public or r.created_by=auth.uid() or lobbix_private.present(r.id,auth.uid()))
 ) x),'[]'::jsonb);
end $$;

create or replace function lobbix_private.admin_reports(p_review uuid default null,p_close boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_report public.lobbix_activity_reports%rowtype;
begin
 if auth.uid() is null or not public.lobbix_is_admin() then raise exception 'Administration requise'; end if;
 if p_review is not null then
  select * into v_report from public.lobbix_activity_reports where id=p_review for update;
  if not found then raise exception 'Signalement introuvable'; end if;
  if p_close and v_report.target_kind='activity' then update public.lobbix_activities set is_open=false,revision=revision+1 where id=v_report.target_id;
  elsif p_close and v_report.target_kind='screen' then update public.lobbix_screen_sessions set ended_at=least(now(),deadline) where id=v_report.target_id and ended_at is null; end if;
  update public.lobbix_activity_reports set status='reviewed' where id=p_review;
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',rp.id,'lobby_name',r.name,'kind',rp.target_kind,'reason',rp.reason,'created_at',rp.created_at,'nickname',p.nickname) order by rp.created_at) from public.lobbix_activity_reports rp join public.lobbix_lobbies r on r.id=rp.lobby_id join public.lobbix_profiles p on p.id=rp.reporter_id where rp.status='pending'),'[]'::jsonb);
end $$;

-- Public entry points are security invoker wrappers; the checked definer code stays private.
create or replace function public.lobbix_v1_action(p_lobby uuid,p_client text,p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select lobbix_private.action(p_lobby,p_client,p_action,p_data) $$;
create or replace function public.lobbix_v1_state(p_lobby uuid,p_client text,p_activity uuid default null,p_version bigint default 0,p_after bigint default 0,p_signal_after bigint default 0) returns jsonb language sql security invoker set search_path='' as $$ select lobbix_private.room_state(p_lobby,p_client,p_activity,p_version,p_after,p_signal_after) $$;
create or replace function public.lobbix_v1_list() returns jsonb language sql security invoker set search_path='' as $$ select lobbix_private.list_rooms() $$;
create or replace function public.lobbix_v1_publish(p_actor uuid,p_lobby uuid,p_kind text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select lobbix_private.publish(p_actor,p_lobby,p_kind,p_data) $$;
create or replace function public.lobbix_v1_admin(p_review uuid default null,p_close boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select lobbix_private.admin_reports(p_review,p_close) $$;

revoke all on all functions in schema lobbix_private from public, anon, authenticated, service_role;
grant execute on function lobbix_private.action(uuid,text,text,jsonb), lobbix_private.room_state(uuid,text,uuid,bigint,bigint,bigint),lobbix_private.list_rooms(),lobbix_private.admin_reports(uuid,boolean) to authenticated;
grant execute on function lobbix_private.publish(uuid,uuid,text,jsonb) to service_role;
revoke all on function public.lobbix_v1_action(uuid,text,text,jsonb),public.lobbix_v1_state(uuid,text,uuid,bigint,bigint,bigint),public.lobbix_v1_list(),public.lobbix_v1_admin(uuid,boolean) from public,anon;
grant execute on function public.lobbix_v1_action(uuid,text,text,jsonb),public.lobbix_v1_state(uuid,text,uuid,bigint,bigint,bigint),public.lobbix_v1_list(),public.lobbix_v1_admin(uuid,boolean) to authenticated;
revoke all on function public.lobbix_v1_publish(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.lobbix_v1_publish(uuid,uuid,text,jsonb) to service_role;

-- The legacy sender already validates moderation/rate limits; add the V1 membership/expiry gate.
create or replace function lobbix_private.message_gate() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not lobbix_private.room_open(new.lobby_id) then raise exception 'Ce lobby a expiré ou est fermé'; end if;
 if not lobbix_private.present(new.lobby_id,new.sender_id) and not exists(select 1 from public.lobbix_members where lobby_id=new.lobby_id and user_id=new.sender_id) then raise exception 'Rejoins le lobby pour discuter'; end if;
 return new;
end $$;
drop trigger if exists lobbix_v1_message_gate on public.lobbix_messages;
create trigger lobbix_v1_message_gate before insert on public.lobbix_messages for each row execute function lobbix_private.message_gate();
revoke all on function lobbix_private.message_gate() from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
