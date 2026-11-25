-- Historial de cambios de título y miniatura de los videos de los canales que sigues.
-- Se puede ejecutar más de una vez sin dañar nada.

-- Huella y copia pequeña de la miniatura actual (solo videos recientes): con ellas se nota un cambio
-- y se puede mostrar cómo era antes.
alter table videos add column if not exists thumb_hash text;
alter table videos add column if not exists thumb_data text;

create table if not exists video_changes (
  id         bigint generated always as identity primary key,
  video_id   text not null references videos (id) on delete cascade,
  kind       text not null check (kind in ('title', 'thumbnail')),
  before     text,
  after      text,
  changed_at timestamptz not null default now()
);
create index if not exists video_changes_video_idx on video_changes (video_id, changed_at desc);

alter table video_changes enable row level security;
grant select, insert, update, delete on table public.video_changes to service_role;
