-- Videos que guardas desde la app o desde la extensión del navegador.
-- Se guarda la foto del video al momento de guardarlo (con su score), así verlos no gasta cuota.
-- Se puede ejecutar más de una vez sin dañar nada.

create table if not exists saved_videos (
  video_id   text primary key,
  video      jsonb not null,
  channel    jsonb,
  saved_at   timestamptz not null default now()
);

alter table saved_videos enable row level security;
grant select, insert, update, delete on table public.saved_videos to service_role;
