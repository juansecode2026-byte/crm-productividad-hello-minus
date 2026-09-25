-- =============================================================================
-- 017_captura_indicadores_o.sql — Fase 07: los 4 campos que faltaban para los
-- indicadores ○ del catálogo (03, 06, 12, 19). Cada forma se decidió en
-- conversación con el usuario el 2026-09-25 — ver CLAUDE.md, Fase 07.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- #03 · Precisión de estimación
-- -----------------------------------------------------------------------------
-- Tabla aparte, no un campo en tareas_semanales: una estimación puede cubrir
-- un rango más preciso que la semana entera que declara la tarea ("esto me
-- toma 2 días" dentro de una tarea de toda la semana). El calculador compara
-- horas_estimadas contra la suma de registro_tiempo de esa persona/proyecto
-- dentro de [fecha_inicio, fecha_fin].
create table estimaciones_tarea (
  id              uuid primary key default gen_random_uuid(),
  tarea_id        uuid not null references tareas_semanales(id) on delete cascade,
  horas_estimadas numeric(6,2) not null check (horas_estimadas > 0),
  fecha_inicio    date not null,
  fecha_fin       date not null,
  creado_por      uuid references personas(id) on delete set null,
  creado_en       timestamptz not null default now(),
  constraint rango_estimacion_coherente check (fecha_fin >= fecha_inicio)
);

create index on estimaciones_tarea (tarea_id);

alter table estimaciones_tarea enable row level security;

create policy leer_estimaciones on estimaciones_tarea
  for select to authenticated using (private.persona_actual() is not null);

-- Solo quien tiene la tarea asignada puede estimarla — igual que quien
-- puede editar la propia tareas_semanales.
create policy escribir_estimaciones on estimaciones_tarea
  for insert to authenticated with check (
    creado_por = private.persona_actual()
    and exists (
      select 1 from tareas_semanales t
       where t.id = tarea_id and t.persona_id = private.persona_actual()
    )
  );

-- -----------------------------------------------------------------------------
-- #06 · Carga vs. capacidad
-- -----------------------------------------------------------------------------
-- Con historial (vigente_desde), no un solo campo en personas: la capacidad
-- declarada puede cambiar con el tiempo y perder el valor viejo rompería
-- indicadores calculados sobre semanas pasadas. Sin vigente_hasta a propósito:
-- se deriva del siguiente registro de esa persona (el más reciente
-- vigente_desde <= la semana que se calcula), así dos filas nunca pueden
-- contradecirse sobre cuándo terminó una vigencia.
create table capacidad_persona (
  id              uuid primary key default gen_random_uuid(),
  persona_id      uuid not null references personas(id) on delete cascade,
  horas_semanales numeric(5,2) not null check (horas_semanales > 0 and horas_semanales <= 168),
  vigente_desde   date not null default current_date,
  creado_en       timestamptz not null default now(),
  constraint capacidad_unica_por_fecha unique (persona_id, vigente_desde)
);

create index on capacidad_persona (persona_id, vigente_desde desc);

alter table capacidad_persona enable row level security;

create policy leer_capacidad on capacidad_persona
  for select to authenticated using (private.persona_actual() is not null);

-- Declarar la propia capacidad es como declarar la propia tarea: cada quien
-- la suya. Admin puede declarar la de cualquiera (transparencia total).
create policy escribir_capacidad on capacidad_persona
  for insert to authenticated
  with check (persona_id = private.persona_actual() or private.es_admin());

-- -----------------------------------------------------------------------------
-- #12 · Versatilidad entre tipos de proyecto
-- -----------------------------------------------------------------------------
-- Mismo patrón que canales_venta: tabla chica, no enum, para poder ajustar la
-- lista sin desplegar. tipo_id es NUEVO, separado de proyectos.tipo (texto
-- libre) que ya existía — no se migra el texto viejo a la fuerza: nunca se
-- sembró con disciplina, e inventar un mapeo sería adivinar, no migrar.
create table tipos_proyecto (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

insert into tipos_proyecto (nombre) values
  ('CRM'), ('Chatbot'), ('Dashboard'), ('Integración'), ('Sitio web'),
  ('Automatización'), ('Otro')
on conflict (nombre) do nothing;

alter table proyectos add column tipo_id uuid references tipos_proyecto(id);

alter table tipos_proyecto enable row level security;

create policy leer_tipos_proyecto on tipos_proyecto
  for select to authenticated using (true);

create policy gobernar_tipos_proyecto on tipos_proyecto
  for all to authenticated
  using      (private.es_admin())
  with check (private.es_admin());

-- -----------------------------------------------------------------------------
-- #19 · % de capacidad perdida en coordinación
-- -----------------------------------------------------------------------------
-- La ÚNICA captura manual de tiempo en todo el sistema — registro_tiempo
-- sigue siendo 100% inferido (decisión de Fase 04, sin tocar). Tabla aparte a
-- propósito, nunca mezclada con registro_tiempo, para que en el propio
-- esquema quede clarísimo cuál es inferido y cuál declarado a mano. Solo
-- tiene sentido dentro de un proyecto en equipo (el doc lo marca "No aplica"
-- en individual — no hay con quién coordinar), por eso proyecto_id es
-- obligatorio, a diferencia de reuniones con clientes u otras internas.
create table reuniones (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references personas(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  fecha       date not null,
  horas       numeric(4,2) not null check (horas > 0 and horas <= 24),
  descripcion text,
  creado_en   timestamptz not null default now()
);

create index on reuniones (persona_id, fecha);
create index on reuniones (proyecto_id);

alter table reuniones enable row level security;

create policy leer_reuniones on reuniones
  for select to authenticated using (private.persona_actual() is not null);

create policy escribir_reuniones on reuniones
  for insert to authenticated with check (persona_id = private.persona_actual());

create policy editar_reuniones on reuniones
  for update to authenticated
  using      (persona_id = private.persona_actual())
  with check (persona_id = private.persona_actual());

create policy borrar_reuniones on reuniones
  for delete to authenticated using (persona_id = private.persona_actual());
