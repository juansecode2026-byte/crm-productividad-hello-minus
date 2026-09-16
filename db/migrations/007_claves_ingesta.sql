-- =============================================================================
-- 007_claves_ingesta.sql — Fase 06: credenciales del endpoint de telemetría
-- =============================================================================
-- Cada proyecto empuja su telemetría con SU propia clave. La clave en claro se
-- muestra UNA sola vez, al crearla: acá se guarda solo el SHA-256. Si se
-- pierde, se revoca y se emite otra — no hay forma de recuperarla, y eso es
-- deliberado.
--
-- `prefijo` son los primeros caracteres de la clave, para poder decir "esta es
-- la que está instalada en kairosplanner" en la UI sin revelar el secreto.
--
-- La clave identifica al PROYECTO, no a una persona: el endpoint saca el
-- proyecto_id de acá y nunca del cuerpo de la petición, así una clave no puede
-- escribir telemetría de un proyecto ajeno.
-- =============================================================================

create table claves_ingesta (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references proyectos(id) on delete cascade,
  nombre        text not null,
  hash_clave    text not null unique,
  prefijo       text not null,
  activa        boolean not null default true,
  creada_por    uuid references personas(id) on delete set null,
  creada_en     timestamptz not null default now(),
  ultimo_uso_en timestamptz
);

create index on claves_ingesta (proyecto_id) where activa;

alter table claves_ingesta enable row level security;

-- Se ven (para saber qué está instalado dónde), pero el hash no sirve para
-- reconstruir la clave. Crearlas y revocarlas: admin o quien lidera el proyecto.
create policy leer_claves_ingesta on claves_ingesta
  for select to authenticated using (private.persona_actual() is not null);

create policy gobernar_claves_ingesta on claves_ingesta
  for all to authenticated
  using      (private.es_admin() or private.lidera_proyecto(proyecto_id))
  with check (private.es_admin() or private.lidera_proyecto(proyecto_id));
