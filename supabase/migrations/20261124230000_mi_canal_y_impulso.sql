-- "Es mi canal", impulso diario de los temas y videos de referencia de cada tema.
-- Se puede ejecutar más de una vez sin dañar nada.

-- Los canales que marcas como tuyos: Inicio muestra sus logros y busca competidores de su tamaño.
alter table channels add column if not exists is_mine boolean not null default false;

-- Los últimos videos largos de cada canal encontrado en un tema (los que ya se traen para puntuarlos).
-- Sirven para analizar un resultado de Tendencias sin volver a gastar cuota.
alter table topics add column if not exists context jsonb;

-- Una foto diaria del impulso de cada tema: suma de vistas por hora de sus videos largos de 2× o más.
create table if not exists topic_snapshots (
  topic_id    uuid not null references topics (id) on delete cascade,
  captured_on date not null default current_date,
  momentum    double precision not null default 0,
  outliers    integer not null default 0,
  videos      integer not null default 0,
  primary key (topic_id, captured_on)
);

alter table topic_snapshots enable row level security;
grant select, insert, update, delete on table public.topic_snapshots to service_role;
