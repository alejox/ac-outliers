-- Temas que sigues en todo YouTube. Sus resultados se guardan para que abrir la app no gaste cuota.
-- Se puede ejecutar más de una vez sin dañar nada.

create table if not exists topics (
  id          uuid primary key default gen_random_uuid(),
  query       text not null default '',
  category_id text not null default '',
  language    text not null default 'es',
  days        integer not null default 30,
  results     jsonb,                       -- canales y videos ya puntuados de la última búsqueda
  fetched_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (query, category_id, language)
);

alter table topics enable row level security;
grant select, insert, update, delete on table public.topics to service_role;
