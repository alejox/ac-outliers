-- Colecciones para agrupar los videos guardados. Cada guardado está en una colección o en ninguna.
-- Se puede ejecutar más de una vez sin dañar nada.

create table if not exists collections (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

alter table saved_videos add column if not exists collection_id uuid references collections (id) on delete set null;

alter table collections enable row level security;
grant select, insert, update, delete on table public.collections to service_role;
