-- Etiquetas de cada video (las que puso el creador), para "Palabras de los outliers".
-- Llegan en la misma llamada a la API que ya se hace: no gastan cuota extra.
alter table public.videos add column if not exists tags text[];
