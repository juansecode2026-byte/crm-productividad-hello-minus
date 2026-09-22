-- Checklist por etapa generado por agente.
--
-- Tres cambios:
--   1. `checklist_plantilla` — los ítems base de cada etapa, iguales para todos
--      los proyectos. Es tabla y no constante en el código (a diferencia de las
--      9 etapas) porque se decidió que se pueda ajustar sin desplegar: quién
--      escribe un proyecto sabe mejor que nadie qué ítem falta o sobra.
--   2. `checklist_items` gana `detectado_en` y `evidencia` — el tercer estado.
--      `completado` sigue significando exactamente lo que significaba: lo marcó
--      una persona. El agente nunca lo toca; solo llena estas dos columnas
--      nuevas, y la persona decide si eso se convierte en `completado`.
--   3. Constraint único en `checklist_items` para que volver a escanear no
--      duplique ítems ya sembrados.

-- -----------------------------------------------------------------------------
-- 1. Plantilla editable
-- -----------------------------------------------------------------------------
create table checklist_plantilla (
  id     uuid primary key default gen_random_uuid(),
  etapa  smallint not null check (etapa between 1 and 9),
  texto  text not null,
  orden  smallint not null default 0,
  activo boolean not null default true,
  constraint plantilla_texto_unico unique (etapa, texto)
);

create index on checklist_plantilla (etapa, orden) where activo;

comment on table checklist_plantilla is
  'Ítems base de checklist por etapa, comunes a todos los proyectos. Se copian '
  'a checklist_items al escanear. Editable por el admin sin tocar código.';

alter table checklist_plantilla enable row level security;

-- Mismo criterio que el resto de los catálogos: todos leen, solo el admin
-- escribe — cambiar la plantilla afecta a todos los proyectos a la vez.
create policy leer_plantilla on checklist_plantilla
  for select to authenticated
  using (private.persona_actual() is not null);

create policy escribir_plantilla on checklist_plantilla
  for all to authenticated
  using      (private.es_admin())
  with check (private.es_admin());

-- -----------------------------------------------------------------------------
-- 2. El tercer estado en checklist_items
-- -----------------------------------------------------------------------------
alter table checklist_items
  add column detectado_en timestamptz,
  add column evidencia    text;

comment on column checklist_items.detectado_en is
  'Cuándo el agente creyó ver este ítem hecho. NO es lo mismo que completado: '
  'un ítem detectado no cuenta hasta que una persona lo confirma.';

comment on column checklist_items.evidencia is
  'Qué vio el agente en el repositorio para proponerlo. Es lo que lee la '
  'persona antes de confirmar, así que no puede ser genérico.';

-- -----------------------------------------------------------------------------
-- 3. Sembrar la plantilla sin duplicar en cada escaneo
-- -----------------------------------------------------------------------------
alter table checklist_items
  add constraint checklist_item_unico unique (proyecto_id, etapa, texto);

-- -----------------------------------------------------------------------------
-- Contenido inicial de la plantilla — sale de "qué se construye" y "sale con"
-- de cada etapa (CLAUDE.md, sección Reglas de negocio clave). Redactados para
-- que se puedan juzgar desde afuera del repositorio, que es todo lo que el
-- agente alcanza a ver.
-- -----------------------------------------------------------------------------
insert into checklist_plantilla (etapa, texto, orden) values
  (1, 'Está claro qué problema resuelve el proyecto', 1),
  (1, 'Está identificado para quién es o quién lo pidió', 2),
  (1, 'El alcance grueso está definido', 3),

  (2, 'Modelo de datos definido (tablas y relaciones)', 1),
  (2, 'Stack tecnológico elegido', 2),
  (2, 'Componentes del proyecto listados', 3),
  (2, 'Alcance congelado y registrado', 4),

  (3, 'Repositorio creado', 1),
  (3, 'Variables de entorno documentadas', 2),
  (3, 'El proyecto corre en local', 3),
  (3, 'Despliega un "hola mundo"', 4),

  (4, 'Esquema de base de datos aplicado', 1),
  (4, 'Backend: rutas principales funcionando', 2),
  (4, 'Frontend: pantallas principales', 3),
  (4, 'El flujo principal funciona de punta a punta', 4),

  (5, 'Prompts escritos', 1),
  (5, 'Herramientas de cada agente construidas', 2),
  (5, 'Probado contra casos de prueba reales', 3),

  (6, 'Canales externos conectados (webhooks, APIs)', 1),
  (6, 'Backend y frontend hablando entre sí', 2),
  (6, 'Telemetría o registro de actividad reportando', 3),
  (6, 'Verificado: un dato entra por un canal y llega correcto al otro extremo', 4),

  (7, 'Tests del flujo principal', 1),
  (7, 'Evaluaciones de los agentes', 2),
  (7, 'Revisión de permisos y seguridad', 3),
  (7, 'Sin errores críticos conocidos', 4),

  (8, 'Configuración de despliegue lista', 1),
  (8, 'Corriendo en producción', 2),
  (8, 'Período de vigilancia sin incidentes graves', 3),

  (9, 'Entregado y en uso real', 1),
  (9, 'Mantenimiento en curso', 2);
