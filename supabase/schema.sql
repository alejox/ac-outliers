-- AC Outliers: esquema inicial.
-- Pégalo completo en Supabase > SQL Editor y ejecútalo una vez.

create table if not exists channels (
  id               text primary key,          -- ID del canal en YouTube (UC...)
  title            text not null,
  handle           text,
  thumbnail_url    text,
  subscriber_count bigint,
  added_at         timestamptz not null default now(),
  last_synced_at   timestamptz
);

create table if not exists videos (
  id               text primary key,          -- ID del video en YouTube
  channel_id       text not null references channels (id) on delete cascade,
  title            text not null,
  thumbnail_url    text,
  published_at     timestamptz not null,
  duration_seconds integer not null default 0,
  is_short         boolean not null default false,
  views            bigint not null default 0,
  likes            bigint,
  comments         bigint,
  updated_at       timestamptz not null default now()
);
create index if not exists videos_channel_idx on videos (channel_id);

-- Una foto de las vistas por video y por día: el historial que la API de YouTube no entrega.
create table if not exists video_snapshots (
  video_id    text not null references videos (id) on delete cascade,
  captured_on date not null default current_date,
  views       bigint not null,
  primary key (video_id, captured_on)
);

-- RLS activado y sin políticas: solo el servidor (con la clave secreta) puede leer y escribir.
-- Cuando haya usuarios, se agrega una tabla user_channels (user_id, channel_id) con sus políticas;
-- channels y videos siguen compartidos para no gastar cuota dos veces en el mismo canal.
alter table channels        enable row level security;
alter table videos          enable row level security;
alter table video_snapshots enable row level security;
