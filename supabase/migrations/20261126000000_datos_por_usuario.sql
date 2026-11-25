-- Datos separados por usuario. Canales, videos y temas siguen siendo un catálogo compartido (son datos
-- públicos de YouTube y así un tema que siguen dos personas se refresca una sola vez); lo de cada
-- persona es qué canales y temas sigue, cuáles son suyos, sus guardados y sus colecciones.
-- Se puede ejecutar más de una vez sin dañar nada.

-- El dueño de la app: quien entra con la contraseña (y con la extensión conectada con ella).
alter table users add column if not exists is_owner boolean not null default false;

-- Si el dueño ya entró con Google, esa cuenta queda como dueña.
update users set is_owner = true
where email = 'alejoxcode@gmail.com' and not exists (select 1 from users where is_owner);

-- Si no, una cuenta provisional que su primer login con Google reclama (ver server/utils/user.ts).
insert into users (google_sub, email, is_owner)
select 'owner', 'alejoxcode@gmail.com', true
where not exists (select 1 from users where is_owner);

-- Canales que sigue cada persona.
create table if not exists user_channels (
  user_id    uuid not null references users (id) on delete cascade,
  channel_id text not null references channels (id) on delete cascade,
  is_mine    boolean not null default false,
  added_at   timestamptz not null default now(),
  primary key (user_id, channel_id)
);
insert into user_channels (user_id, channel_id, is_mine)
select (select id from users where is_owner limit 1), id, is_mine from channels
on conflict do nothing;

-- Temas que sigue cada persona.
create table if not exists user_topics (
  user_id  uuid not null references users (id) on delete cascade,
  topic_id uuid not null references topics (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
insert into user_topics (user_id, topic_id)
select (select id from users where is_owner limit 1), id from topics
on conflict do nothing;

-- Guardados de cada persona.
alter table saved_videos add column if not exists user_id uuid references users (id) on delete cascade;
update saved_videos set user_id = (select id from users where is_owner limit 1) where user_id is null;
alter table saved_videos alter column user_id set not null;
alter table saved_videos drop constraint if exists saved_videos_pkey;
alter table saved_videos add primary key (user_id, video_id);

-- Colecciones de cada persona: el nombre se repite entre personas, no dentro de una.
alter table collections add column if not exists user_id uuid references users (id) on delete cascade;
update collections set user_id = (select id from users where is_owner limit 1) where user_id is null;
alter table collections alter column user_id set not null;
alter table collections drop constraint if exists collections_name_key;
alter table collections drop constraint if exists collections_user_name_key;
alter table collections add constraint collections_user_name_key unique (user_id, name);

alter table user_channels enable row level security;
alter table user_topics enable row level security;
grant select, insert, update, delete on table public.user_channels to service_role;
grant select, insert, update, delete on table public.user_topics to service_role;
