-- Personas que entran con su cuenta de Google. El permiso para leer su canal se guarda cifrado.
-- Se puede ejecutar más de una vez sin dañar nada.

create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  google_sub        text not null unique,
  email             text not null,
  name              text,
  picture           text,
  channel_id        text,
  channel_title     text,
  refresh_token_enc text,
  scopes            text,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz not null default now()
);

alter table users enable row level security;
grant select, insert, update, delete on table public.users to service_role;
