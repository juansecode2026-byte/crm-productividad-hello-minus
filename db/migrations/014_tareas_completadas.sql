-- Una tarea semanal puede marcarse como terminada.
--
-- Hasta acá `tareas_semanales` sabía de quién es cada tarea y en qué proyecto,
-- pero no si se cerró. Eso dejaba sin fuente a dos indicadores del catálogo:
--   #01 Throughput                        tareas realmente cerradas por semana
--   #29 % de avance atribuido a la persona de lo que le tocaba, cuánto terminó
-- Ninguna otra tabla junta las dos cosas: `checklist_items` tiene completado
-- pero no dueño (cualquiera lo marca), `hitos` tiene estado pero ni siquiera
-- `persona_id`. Se extiende la tabla más cercana en vez de crear una nueva.
--
-- Encaja con algo que ya existía: el Detector de rastro (`tarea_evidencia`)
-- cruza cada tarea contra actividad real. Ahora hay dos señales
-- independientes sobre la misma tarea — "la persona dice que la terminó" y
-- "dejó rastro de haberla hecho" — y un indicador puede mirar las dos.
--
-- Quién la marca: la misma política de escritura que ya regía la tarea
-- (quien la tiene asignada, o admin). No hace falta política nueva.

alter table tareas_semanales
  add column completado    boolean not null default false,
  add column completado_en timestamptz;

comment on column tareas_semanales.completado is
  'La persona asignada declara la tarea terminada. Es una declaración, no una '
  'verificación: la evidencia real vive aparte, en tarea_evidencia.';

comment on column tareas_semanales.completado_en is
  'Lo fija el servidor al marcar y lo limpia al desmarcar — nunca el cliente. '
  'Es la fecha que usa Throughput para decidir en qué semana cae el cierre.';

-- Coherencia que no depende del backend: no puede haber fecha de cierre en
-- una tarea abierta, ni tarea cerrada sin fecha.
alter table tareas_semanales
  add constraint cierre_coherente
  check ((completado and completado_en is not null) or (not completado and completado_en is null));
