-- Lo normal de cada canal que la extensión del navegador ya calculó, para no volver a gastar cuota
-- de YouTube durante un día. Se puede ejecutar más de una vez sin dañar nada.

create table if not exists channel_baselines (
  channel_id   text not null,
  is_short     boolean not null,
  median_views double precision,
  sample       integer not null default 0,
  computed_at  timestamptz not null default now(),
  primary key (channel_id, is_short)
);

alter table channel_baselines enable row level security;
grant select, insert, update, delete on table public.channel_baselines to service_role;
