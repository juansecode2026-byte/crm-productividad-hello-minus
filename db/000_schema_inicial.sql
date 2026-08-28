-- =============================================================================
-- 000_schema_inicial.sql — CRM de Productividad Hello Minus
-- =============================================================================
-- Fase 01 del plan de construcción: 32 tablas en 9 bloques.
-- Fuente: docs/fases-crm-productividad-hello-minus.md
--
-- Este archivo crea SOLO estructura (tipos, tablas, índices) y habilita RLS.
-- Las políticas viven aparte, en db/policies/ — nunca mezcladas con el schema.
--
-- IMPORTANTE: habilitar RLS sin políticas deniega todo acceso. Eso es
-- deliberado: es el "restrictivo por defecto" que recomienda la documentación.
-- Hasta que no corra 001_baseline.sql, nadie lee ni escribe nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type rol_global        as enum ('admin', 'lider_proyecto', 'colaborador');
create type estado_proyecto   as enum ('activo', 'pausado', 'archivado');
create type modalidad_proyecto as enum ('individual', 'equipo');
create type tipo_tiempo       as enum ('facturable', 'interno');
create type origen_tiempo     as enum ('manual', 'inferido');
create type fuente_evidencia  as enum ('commit', 'pull_request', 'sesion_claude_code');
create type origen_punto      as enum ('manual', 'sugerido_por_agente', 'claude_md');
create type estado_candidato  as enum ('pendiente', 'aprobado', 'descartado', 'archivado');
create type tipo_bloqueo      as enum ('interno', 'externo', 'cliente');
create type estado_hito       as enum ('pendiente', 'en_curso', 'cumplido', 'vencido');
create type ambito_indicador  as enum ('persona', 'proyecto', 'portafolio');
create type plazo_indicador   as enum ('inmediato', 'mediano', 'largo');
create type dependencia_indicador as enum ('persona', 'cliente', 'mixto');
create type estado_madurez    as enum ('maduracion', 'activo');
create type resultado_oportunidad as enum ('ganada', 'perdida', 'abierta');


-- =============================================================================
-- BLOQUE 1 — Núcleo: personas y acceso
-- =============================================================================

create table personas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  email           text not null unique,
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  rol             rol_global not null default 'colaborador',
  github_username text unique,
  activo          boolean not null default true,
  fecha_ingreso   date not null default current_date,
  creado_en       timestamptz not null default now()
);

comment on table personas is
  'Integrantes del equipo. github_username es la llave de atribución de commits: sin él, la actividad de GitHub llega pero no se puede asignar a nadie.';

-- Catálogo de roles que una persona puede tener DENTRO de un proyecto, cuando
-- difiere de su rol global. Ej: alguien colaborador en general pero líder en un
-- proyecto puntual.
create table roles_proyecto (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text
);


-- =============================================================================
-- BLOQUE 2 — Proyectos y equipo
-- =============================================================================

create table clientes (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  contacto  text,
  notas     text,
  creado_en timestamptz not null default now()
);

create table proyectos (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  descripcion         text,
  cliente_id          uuid references clientes(id) on delete set null,
  creado_por          uuid references personas(id) on delete set null,
  encargado_id        uuid references personas(id) on delete set null,
  tipo                text,
  prioridad           smallint check (prioridad between 1 and 5),
  etapa_actual        smallint not null default 1 check (etapa_actual between 1 and 9),
  estado              estado_proyecto not null default 'activo',
  modalidad           modalidad_proyecto not null default 'individual',
  fecha_inicio        date,
  fecha_objetivo      date,
  fecha_limite        date,
  -- Momento en que se cierra la Etapa 2 (Diseño y arquitectura). Lo que exista
  -- antes de esta fecha es el 100% oficial contra el que se mide el avance;
  -- todo lo detectado después entra como candidato, no como alcance.
  alcance_congelado_en timestamptz,
  horas_estimadas     numeric(8,2),
  creado_en           timestamptz not null default now()
);

create index on proyectos (estado);
create index on proyectos (encargado_id);

create table miembros_proyecto (
  id                uuid primary key default gen_random_uuid(),
  proyecto_id       uuid not null references proyectos(id) on delete cascade,
  persona_id        uuid not null references personas(id) on delete cascade,
  rol_proyecto_id   uuid references roles_proyecto(id) on delete set null,
  dedicacion_pct    smallint check (dedicacion_pct between 0 and 100),
  fecha_entrada     date not null default current_date,
  -- Se conserva a quien ya salió: sin historia, el bus factor y la estabilidad
  -- del equipo salen mal calculados.
  fecha_salida      date,
  constraint miembro_unico_por_periodo unique (proyecto_id, persona_id, fecha_entrada)
);

create index on miembros_proyecto (persona_id);
create index on miembros_proyecto (proyecto_id);


-- =============================================================================
-- BLOQUE 3 — Proceso: etapas, checklist, tareas semanales
-- =============================================================================

create table historial_etapas (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  etapa       smallint not null check (etapa between 1 and 9),
  entra_en    timestamptz not null,
  sale_en     timestamptz,
  constraint salida_posterior_a_entrada check (sale_en is null or sale_en >= entra_en)
);

comment on table historial_etapas is 'Alimenta el indicador Cycle time por estado.';

create index on historial_etapas (proyecto_id, etapa);

create table checklist_items (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references proyectos(id) on delete cascade,
  etapa          smallint not null check (etapa between 1 and 9),
  texto          text not null,
  completado     boolean not null default false,
  completado_por uuid references personas(id) on delete set null,
  completado_en  timestamptz
);

create index on checklist_items (proyecto_id, etapa);

create table hitos (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references proyectos(id) on delete cascade,
  nombre         text not null,
  etapa          smallint check (etapa between 1 and 9),
  fecha_planeada date,
  fecha_real     date,
  estado         estado_hito not null default 'pendiente'
);

create index on hitos (proyecto_id);

create table tareas_semanales (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references proyectos(id) on delete cascade,
  persona_id    uuid not null references personas(id) on delete cascade,
  semana_inicio date not null,
  semana_fin    date not null,
  titulo        text not null,
  areas         text[] not null default '{}',
  creado_por    uuid references personas(id) on delete set null,
  creado_en     timestamptz not null default now(),
  constraint semana_coherente check (semana_fin >= semana_inicio)
);

create index on tareas_semanales (persona_id, semana_inicio);

-- Escrita por el Detector de rastro semanal, nunca a mano: es la prueba de que
-- la tarea declarada tiene respaldo real en código o en sesiones.
create table tarea_evidencia (
  id           uuid primary key default gen_random_uuid(),
  tarea_id     uuid not null references tareas_semanales(id) on delete cascade,
  area         text not null,
  fuente       fuente_evidencia not null,
  referencia   text not null,
  detectado_en timestamptz not null default now()
);

create index on tarea_evidencia (tarea_id);


-- =============================================================================
-- BLOQUE 4 — Alcance y avance del proyecto
-- =============================================================================

-- Nivel 1 del checklist de alcance: los componentes generales.
create table componentes_proyecto (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  nombre      text not null,
  peso_pct    numeric(5,2) not null default 0 check (peso_pct between 0 and 100),
  orden       smallint not null default 0,
  constraint componente_unico unique (proyecto_id, nombre)
);

-- Nivel 2: los puntos concretos de cada componente. De aquí sale el % de avance
-- atribuido a cada persona.
create table puntos_componente (
  id              uuid primary key default gen_random_uuid(),
  componente_id   uuid not null references componentes_proyecto(id) on delete cascade,
  nombre          text not null,
  responsable_id  uuid references personas(id) on delete set null,
  rutas_esperadas text[] not null default '{}',
  verificado      boolean not null default false,
  verificado_en   timestamptz,
  origen          origen_punto not null default 'manual'
);

create index on puntos_componente (componente_id);
create index on puntos_componente (responsable_id);

-- Lo detectado después de congelar el alcance. No cuenta en el % hasta que una
-- persona lo aprueba explícitamente — el agente nunca lo agrega solo.
create table candidatos_alcance (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  nombre       text not null,
  fuente       text not null,
  detectado_en timestamptz not null default now(),
  estado       estado_candidato not null default 'pendiente',
  resuelto_por uuid references personas(id) on delete set null,
  resuelto_en  timestamptz
);

create index on candidatos_alcance (proyecto_id, estado);

create table bloqueos (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  persona_id   uuid not null references personas(id) on delete cascade,
  descripcion  text not null,
  tipo         tipo_bloqueo not null default 'interno',
  abierto_en   timestamptz not null default now(),
  resuelto_en  timestamptz,
  resuelto_por uuid references personas(id) on delete set null
);

create index on bloqueos (proyecto_id) where resuelto_en is null;


-- =============================================================================
-- BLOQUE 5 — Tiempo y actividad
-- =============================================================================

create table registro_tiempo (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references personas(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  area        text,
  fecha       date not null,
  horas       numeric(5,2) not null check (horas > 0 and horas <= 24),
  tipo        tipo_tiempo not null default 'interno',
  origen      origen_tiempo not null default 'manual',
  creado_en   timestamptz not null default now()
);

create index on registro_tiempo (persona_id, fecha);
create index on registro_tiempo (proyecto_id, fecha);

create table implementaciones (
  id                    uuid primary key default gen_random_uuid(),
  proyecto_id           uuid not null references proyectos(id) on delete cascade,
  persona_id            uuid not null references personas(id) on delete cascade,
  descripcion           text not null,
  area                  text,
  commit_o_pr_vinculado text,
  creado_en             timestamptz not null default now()
);

create index on implementaciones (proyecto_id);


-- =============================================================================
-- BLOQUE 6 — Integraciones externas  (escritura exclusiva del sistema)
-- =============================================================================

create table repositorios (
  id                     uuid primary key default gen_random_uuid(),
  proyecto_id            uuid not null references proyectos(id) on delete cascade,
  github_repo            text not null unique,
  github_installation_id bigint,
  creado_en              timestamptz not null default now()
);

create table commits (
  id              uuid primary key default gen_random_uuid(),
  repo_id         uuid not null references repositorios(id) on delete cascade,
  persona_id      uuid references personas(id) on delete set null,
  sha             text not null,
  mensaje         text,
  archivos_tocados text[] not null default '{}',
  area_inferida   text,
  tipo_inferido   text,
  fecha           timestamptz not null,
  constraint sha_unico_por_repo unique (repo_id, sha)
);

create index on commits (persona_id, fecha);

create table pull_requests (
  id               uuid primary key default gen_random_uuid(),
  repo_id          uuid not null references repositorios(id) on delete cascade,
  persona_id       uuid references personas(id) on delete set null,
  numero           integer not null,
  titulo           text,
  archivos_tocados text[] not null default '{}',
  area_inferida    text,
  abierto_en       timestamptz,
  mergeado_en      timestamptz,
  constraint pr_unico_por_repo unique (repo_id, numero)
);

create index on pull_requests (persona_id);

create table sesiones_claude_code (
  id               uuid primary key default gen_random_uuid(),
  persona_id       uuid references personas(id) on delete set null,
  proyecto_id      uuid references proyectos(id) on delete set null,
  session_id       text not null unique,
  prompt_count     integer not null default 0,
  inicio           timestamptz not null,
  fin              timestamptz,
  duracion_activa  interval,
  archivos_tocados text[] not null default '{}',
  area_inferida    text
);

create index on sesiones_claude_code (persona_id, inicio);

create table trazas_agente (
  id              uuid primary key default gen_random_uuid(),
  run_id          text not null,
  proyecto_id     uuid references proyectos(id) on delete set null,
  agent_id        text,
  agent_type      text,
  environment     text,
  iteration_index integer,
  node_name       text,
  tool_name       text,
  args_hash       text,
  tokens          integer,
  duration_ms     integer,
  status          text,
  registrado_en   timestamptz not null default now()
);

create index on trazas_agente (run_id);
create index on trazas_agente (proyecto_id, registrado_en);


-- =============================================================================
-- BLOQUE 7 — Indicadores
-- =============================================================================

-- Catálogo: qué mide cada indicador y de quién depende realmente. El campo
-- depende_de marca los 9 indicadores que dependen del cliente y que por eso
-- quedaron apartados del uso actual.
create table indicador_catalogo (
  indicador_code text primary key,
  nombre         text not null,
  categoria      text,
  plazo          plazo_indicador,
  depende_de     dependencia_indicador not null default 'persona',
  descripcion    text
);

-- Grupos A/B/C de los indicadores individuales: si un indicador aplica en
-- proyectos de una sola persona y, si aplica, contra qué se compara ahora.
create table indicador_aplicabilidad (
  indicador_code        text not null references indicador_catalogo(indicador_code) on delete cascade,
  modalidad             modalidad_proyecto not null,
  aplica                boolean not null default true,
  sustituye_comparacion text,
  primary key (indicador_code, modalidad)
);

-- Snapshots, no cálculo en vivo: el valor se congela por periodo para que el
-- histórico no cambie retroactivamente.
create table indicador_snapshots (
  id             uuid primary key default gen_random_uuid(),
  indicador_code text not null references indicador_catalogo(indicador_code) on delete cascade,
  scope_type     ambito_indicador not null,
  scope_id       uuid,
  periodo        date not null,
  valor          numeric(14,4),
  detalle        jsonb,
  calculado_en   timestamptz not null default now(),
  constraint snapshot_unico unique (indicador_code, scope_type, scope_id, periodo)
);

create index on indicador_snapshots (scope_type, scope_id, periodo);

create table indicador_madurez (
  indicador_code text primary key references indicador_catalogo(indicador_code) on delete cascade,
  criterio_texto text,
  meta           numeric(14,4),
  valor_actual   numeric(14,4),
  estado         estado_madurez not null default 'maduracion',
  activado_en    timestamptz
);

create table eval_cases (
  id                 uuid primary key default gen_random_uuid(),
  agent_type         text not null,
  caso               text not null,
  resultado_esperado text not null,
  ultimo_puntaje     numeric(5,2),
  ultima_corrida     timestamptz
);


-- =============================================================================
-- BLOQUE 8 — Comercial
-- =============================================================================

create table productos (
  id                 uuid primary key default gen_random_uuid(),
  proyecto_origen_id uuid references proyectos(id) on delete set null,
  nombre             text not null,
  descripcion        text,
  tipo               text
);

create table canales_venta (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

create table leads (
  id                    uuid primary key default gen_random_uuid(),
  producto_id           uuid references productos(id) on delete set null,
  canal_id              uuid references canales_venta(id) on delete set null,
  fecha_llegada         timestamptz not null default now(),
  atendido_por          uuid references personas(id) on delete set null,
  atendido_por_agente_id text,
  convertido            boolean not null default false,
  fecha_conversion      timestamptz
);

create index on leads (canal_id, fecha_llegada);

create table ventas (
  id                     uuid primary key default gen_random_uuid(),
  producto_id            uuid references productos(id) on delete set null,
  cliente_id             uuid references clientes(id) on delete set null,
  lead_id                uuid references leads(id) on delete set null,
  canal_id               uuid references canales_venta(id) on delete set null,
  atendido_por_agente_id text,
  monto                  numeric(14,2) not null,
  fecha                  date not null,
  vendido_por            uuid references personas(id) on delete set null
);

create index on ventas (fecha);

create table oportunidades (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid references clientes(id) on delete set null,
  proyecto_id    uuid references proyectos(id) on delete set null,
  canal_venta_id uuid references canales_venta(id) on delete set null,
  etapa_embudo   text,
  monto          numeric(14,2),
  probabilidad   smallint check (probabilidad between 0 and 100),
  creado_en      timestamptz not null default now(),
  cerrado_en     timestamptz,
  resultado      resultado_oportunidad not null default 'abierta'
);


-- =============================================================================
-- BLOQUE 9 — Gobernanza
-- =============================================================================

-- Quién vio qué dato de qué cliente. Append-only por política: nadie puede
-- editar ni borrar sus propias entradas, o el log deja de servir.
create table auditoria_log (
  id             uuid primary key default gen_random_uuid(),
  persona_id     uuid references personas(id) on delete set null,
  accion         text not null,
  tabla_afectada text not null,
  registro_id    uuid,
  ocurrido_en    timestamptz not null default now()
);

create index on auditoria_log (persona_id, ocurrido_en);


-- =============================================================================
-- RLS: se habilita en TODAS las tablas.
-- Sin políticas esto deniega todo. Las políticas están en db/policies/.
-- =============================================================================

alter table personas               enable row level security;
alter table roles_proyecto         enable row level security;
alter table clientes               enable row level security;
alter table proyectos              enable row level security;
alter table miembros_proyecto      enable row level security;
alter table historial_etapas       enable row level security;
alter table checklist_items        enable row level security;
alter table hitos                  enable row level security;
alter table tareas_semanales       enable row level security;
alter table tarea_evidencia        enable row level security;
alter table componentes_proyecto   enable row level security;
alter table puntos_componente      enable row level security;
alter table candidatos_alcance     enable row level security;
alter table bloqueos               enable row level security;
alter table registro_tiempo        enable row level security;
alter table implementaciones       enable row level security;
alter table repositorios           enable row level security;
alter table commits                enable row level security;
alter table pull_requests          enable row level security;
alter table sesiones_claude_code   enable row level security;
alter table trazas_agente          enable row level security;
alter table indicador_catalogo     enable row level security;
alter table indicador_aplicabilidad enable row level security;
alter table indicador_snapshots    enable row level security;
alter table indicador_madurez      enable row level security;
alter table eval_cases             enable row level security;
alter table productos              enable row level security;
alter table canales_venta          enable row level security;
alter table leads                  enable row level security;
alter table ventas                 enable row level security;
alter table oportunidades          enable row level security;
alter table auditoria_log          enable row level security;
