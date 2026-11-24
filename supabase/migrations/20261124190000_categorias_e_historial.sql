-- Categoría de cada video, cifras del canal e historial para medir el ritmo reciente.
-- Se puede ejecutar más de una vez sin dañar nada.

alter table videos   add column if not exists category_id text;
alter table channels add column if not exists view_count  bigint;
alter table channels add column if not exists video_count bigint;

-- Hora exacta de cada foto de vistas: con ella se calculan las vistas por hora recientes.
alter table video_snapshots add column if not exists captured_at timestamptz;
update video_snapshots s
   set captured_at = v.updated_at
  from videos v
 where s.video_id = v.id
   and s.captured_at is null
   and s.captured_on = (v.updated_at at time zone 'utc')::date;
alter table video_snapshots alter column captured_at set default now();

-- Una foto diaria de cada canal: base para las gráficas de crecimiento de suscriptores.
create table if not exists channel_snapshots (
  channel_id       text not null references channels (id) on delete cascade,
  captured_on      date not null default current_date,
  subscriber_count bigint,
  view_count       bigint,
  video_count      bigint,
  primary key (channel_id, captured_on)
);

alter table channel_snapshots enable row level security;
grant select, insert, update, delete on table public.channel_snapshots to service_role;
