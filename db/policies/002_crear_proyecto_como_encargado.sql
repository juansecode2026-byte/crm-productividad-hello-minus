-- =============================================================================
-- 002_crear_proyecto_como_encargado.sql — quién puede crear un proyecto
-- =============================================================================
-- Corre DESPUÉS de policies/001_baseline.sql y migrations/004. Aplicado el
-- 2026-09-15.
--
-- El problema: `gobernar_proyectos` era FOR ALL con
-- `private.lidera_proyecto(id)`. Esa función busca el proyecto en la tabla, y
-- durante un INSERT la fila todavía no existe: daba falso siempre. En la
-- práctica solo el admin podía crear proyectos, aunque la Fase 01 dice que el
-- líder también.
--
-- Qué es "líder" acá: ser el encargado de ESE proyecto, no el rol global. Es
-- lo mismo que ya usa `lidera_proyecto` para editar. Así, cualquier integrante
-- activo puede crear un proyecto siempre que quede a su cargo y a su nombre;
-- crear proyectos para otros sigue siendo del admin.
--
-- UPDATE y DELETE quedan exactamente como estaban.
-- =============================================================================

drop policy gobernar_proyectos on proyectos;

create policy crear_proyectos on proyectos
  for insert to authenticated
  with check (
    private.es_admin()
    or (
      encargado_id = private.persona_actual()
      and creado_por = private.persona_actual()
    )
  );

create policy editar_proyectos on proyectos
  for update to authenticated
  using      (private.es_admin() or private.lidera_proyecto(id))
  with check (private.es_admin() or private.lidera_proyecto(id));

create policy borrar_proyectos on proyectos
  for delete to authenticated
  using (private.es_admin() or private.lidera_proyecto(id));
