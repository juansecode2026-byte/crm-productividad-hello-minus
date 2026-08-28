-- =============================================================================
-- 001_baseline.sql — Políticas RLS del CRM de Productividad Hello Minus
-- =============================================================================
-- Corre DESPUÉS de db/000_schema_inicial.sql, que ya habilitó RLS en las 32
-- tablas. Hasta que este archivo se aplique, la base deniega todo: ese es el
-- "restrictivo por defecto" que recomienda la documentación.
--
-- Estado aplicado en Supabase (proyecto qutqsyokdlitflybfrus) el 2026-08-28.
-- 61 políticas, 32 de 32 tablas cubiertas.
--
-- DECISIONES TOMADAS (2026-08-28) — ver docs/fases-crm-productividad-hello-minus.md
--
--   Punto A · indicadores personales : ambos ven los de ambos.
--   Punto B · detalle Tarea Semanal  : ambos ven el de ambos.
--
--   El equipo son dos personas y eligieron transparencia total. TODA la lectura
--   está abierta a cualquier integrante autenticado, incluido lo comercial y el
--   log de auditoría. La restricción vive en otros dos lugares:
--
--     1. ESCRITURA — cada quien escribe solo lo suyo. Ver el registro de tiempo
--        del otro no habilita a editarlo. Lo comercial y los catálogos solo los
--        modifica el admin. La diferencia entre los dos integrantes es esta, no
--        lo que alcanzan a ver.
--     2. TABLAS DE SOLO-SISTEMA — commits, pull_requests, sesiones_claude_code,
--        trazas_agente, indicador_snapshots, tarea_evidencia y auditoria_log se
--        leen, pero NINGÚN usuario las escribe. La ingesta entra por
--        service_role, que salta RLS por diseño. Si un usuario pudiera insertar
--        en commits, podría fabricarse actividad y los indicadores dejarían de
--        significar algo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Funciones auxiliares — en schema `private`, NO en `public`
-- -----------------------------------------------------------------------------
-- Por qué private: Supabase expone el schema public por PostgREST, así que una
-- función en public queda llamable como /rest/v1/rpc/<nombre>. Estas funciones
-- son plumbing de RLS, no API: viven en `private`, que PostgREST no expone.
--
-- Por qué SECURITY DEFINER: consultan tablas que a su vez tienen RLS. Sin
-- definer, la política de `personas` llamaría a una función que lee `personas`,
-- que dispara la política otra vez → recursión infinita. El search_path fijo
-- evita que un esquema temporal las secuestre.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;

create or replace function private.persona_actual()
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$ select id from public.personas where auth_user_id = auth.uid(); $$;

comment on function private.persona_actual() is
  'Traduce el auth.uid() de Supabase al id interno de personas. NULL si el usuario autenticado no tiene fila en personas.';

create or replace function private.es_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.personas
    where auth_user_id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function private.lidera_proyecto(p_proyecto_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.proyectos p
    where p.id = p_proyecto_id and p.encargado_id = private.persona_actual()
  );
$$;

create or replace function private.es_miembro(p_proyecto_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.miembros_proyecto m
    where m.proyecto_id = p_proyecto_id
      and m.persona_id  = private.persona_actual()
      and m.fecha_salida is null
  );
$$;

-- EXECUTE solo para quien lo necesita. anon tiene USAGE sobre el schema pero
-- ningún EXECUTE: no puede llamar nada. (Postgres concede EXECUTE a PUBLIC por
-- defecto al crear la función; por eso el revoke explícito.)
revoke execute on function private.persona_actual()      from public;
revoke execute on function private.es_admin()            from public;
revoke execute on function private.lidera_proyecto(uuid) from public;
revoke execute on function private.es_miembro(uuid)      from public;

grant execute on function private.persona_actual()      to authenticated, service_role;
grant execute on function private.es_admin()            to authenticated, service_role;
grant execute on function private.lidera_proyecto(uuid) to authenticated, service_role;
grant execute on function private.es_miembro(uuid)      to authenticated, service_role;


-- =============================================================================
-- LECTURA — transparencia total: todo integrante autenticado lee todo
-- =============================================================================

create policy leer_personas          on personas          for select to authenticated using (private.persona_actual() is not null);
create policy leer_roles_proyecto    on roles_proyecto    for select to authenticated using (private.persona_actual() is not null);
create policy leer_proyectos         on proyectos         for select to authenticated using (private.persona_actual() is not null);
create policy leer_miembros          on miembros_proyecto for select to authenticated using (private.persona_actual() is not null);
create policy leer_historial_etapas  on historial_etapas  for select to authenticated using (private.persona_actual() is not null);
create policy leer_checklist         on checklist_items   for select to authenticated using (private.persona_actual() is not null);
create policy leer_hitos             on hitos             for select to authenticated using (private.persona_actual() is not null);
-- Punto B: ambos ven el detalle de Tarea Semanal del otro.
create policy leer_tareas_semanales  on tareas_semanales  for select to authenticated using (private.persona_actual() is not null);
create policy leer_tarea_evidencia   on tarea_evidencia   for select to authenticated using (private.persona_actual() is not null);
create policy leer_componentes       on componentes_proyecto for select to authenticated using (private.persona_actual() is not null);
create policy leer_puntos            on puntos_componente for select to authenticated using (private.persona_actual() is not null);
create policy leer_candidatos        on candidatos_alcance for select to authenticated using (private.persona_actual() is not null);
create policy leer_bloqueos          on bloqueos          for select to authenticated using (private.persona_actual() is not null);
create policy leer_registro_tiempo   on registro_tiempo   for select to authenticated using (private.persona_actual() is not null);
create policy leer_implementaciones  on implementaciones  for select to authenticated using (private.persona_actual() is not null);
create policy leer_repositorios      on repositorios      for select to authenticated using (private.persona_actual() is not null);
create policy leer_commits           on commits           for select to authenticated using (private.persona_actual() is not null);
create policy leer_pull_requests     on pull_requests     for select to authenticated using (private.persona_actual() is not null);
create policy leer_sesiones          on sesiones_claude_code for select to authenticated using (private.persona_actual() is not null);
create policy leer_trazas            on trazas_agente     for select to authenticated using (private.persona_actual() is not null);
-- Punto A: ambos ven los indicadores personales del otro.
create policy leer_snapshots         on indicador_snapshots for select to authenticated using (private.persona_actual() is not null);
create policy leer_catalogo          on indicador_catalogo for select to authenticated using (private.persona_actual() is not null);
create policy leer_aplicabilidad     on indicador_aplicabilidad for select to authenticated using (private.persona_actual() is not null);
create policy leer_madurez           on indicador_madurez for select to authenticated using (private.persona_actual() is not null);
create policy leer_eval_cases        on eval_cases        for select to authenticated using (private.persona_actual() is not null);
-- Comercial: lo ven los dos; escribirlo es solo del admin (más abajo).
create policy leer_clientes          on clientes          for select to authenticated using (private.persona_actual() is not null);
create policy leer_productos         on productos         for select to authenticated using (private.persona_actual() is not null);
create policy leer_canales_venta     on canales_venta     for select to authenticated using (private.persona_actual() is not null);
create policy leer_leads             on leads             for select to authenticated using (private.persona_actual() is not null);
create policy leer_ventas            on ventas            for select to authenticated using (private.persona_actual() is not null);
create policy leer_oportunidades     on oportunidades     for select to authenticated using (private.persona_actual() is not null);
-- Auditoría: la leen los dos, o sería unilateral. Nadie la escribe.
create policy leer_auditoria         on auditoria_log     for select to authenticated using (private.persona_actual() is not null);


-- =============================================================================
-- ESCRITURA — datos propios de la persona
-- =============================================================================

create policy crear_mi_tiempo on registro_tiempo
  for insert to authenticated
  with check (persona_id = private.persona_actual());

-- Ventana de edición de 7 días: pasado ese plazo el registro queda inmutable.
-- Si no, los indicadores históricos cambian retroactivamente y dejan de ser
-- confiables — un número que se mueve solo no sirve para decidir nada.
create policy editar_mi_tiempo on registro_tiempo
  for update to authenticated
  using      (persona_id = private.persona_actual() and fecha >= current_date - interval '7 days')
  with check (persona_id = private.persona_actual() and fecha >= current_date - interval '7 days');

create policy borrar_mi_tiempo on registro_tiempo
  for delete to authenticated
  using (persona_id = private.persona_actual() and fecha >= current_date - interval '7 days');

create policy crear_mi_tarea on tareas_semanales
  for insert to authenticated
  with check (persona_id = private.persona_actual() or private.es_admin());

create policy editar_mi_tarea on tareas_semanales
  for update to authenticated
  using      (persona_id = private.persona_actual() or private.es_admin())
  with check (persona_id = private.persona_actual() or private.es_admin());

create policy borrar_mi_tarea on tareas_semanales
  for delete to authenticated
  using (persona_id = private.persona_actual() or private.es_admin());


-- =============================================================================
-- ESCRITURA — datos de proyecto
-- =============================================================================
-- El miembro aporta sobre los proyectos donde participa; el líder y el admin
-- además gobiernan el proyecto.

create policy escribir_checklist on checklist_items
  for all to authenticated
  using      (private.es_admin() or private.es_miembro(proyecto_id) or private.lidera_proyecto(proyecto_id))
  with check (private.es_admin() or private.es_miembro(proyecto_id) or private.lidera_proyecto(proyecto_id));

create policy escribir_bloqueos on bloqueos
  for all to authenticated
  using      (private.es_admin() or private.es_miembro(proyecto_id) or private.lidera_proyecto(proyecto_id))
  with check (private.es_admin() or private.es_miembro(proyecto_id) or private.lidera_proyecto(proyecto_id));

create policy escribir_implementaciones on implementaciones
  for all to authenticated
  using      (private.es_admin() or private.es_miembro(proyecto_id) or private.lidera_proyecto(proyecto_id))
  with check (private.es_admin() or private.es_miembro(proyecto_id) or private.lidera_proyecto(proyecto_id));

create policy escribir_puntos on puntos_componente
  for all to authenticated
  using (
    private.es_admin() or exists (
      select 1 from componentes_proyecto c
      where c.id = puntos_componente.componente_id
        and (private.es_miembro(c.proyecto_id) or private.lidera_proyecto(c.proyecto_id))
    )
  )
  with check (
    private.es_admin() or exists (
      select 1 from componentes_proyecto c
      where c.id = puntos_componente.componente_id
        and (private.es_miembro(c.proyecto_id) or private.lidera_proyecto(c.proyecto_id))
    )
  );

-- Aprobar un candidato de alcance cambia el 100% oficial del proyecto: solo el
-- líder o el admin. El agente nunca aprueba solo, por diseño.
create policy escribir_candidatos on candidatos_alcance
  for all to authenticated
  using      (private.es_admin() or private.lidera_proyecto(proyecto_id))
  with check (private.es_admin() or private.lidera_proyecto(proyecto_id));

create policy gobernar_proyectos on proyectos
  for all to authenticated
  using      (private.es_admin() or private.lidera_proyecto(id))
  with check (private.es_admin() or private.lidera_proyecto(id));

create policy gobernar_miembros on miembros_proyecto
  for all to authenticated
  using      (private.es_admin() or private.lidera_proyecto(proyecto_id))
  with check (private.es_admin() or private.lidera_proyecto(proyecto_id));

create policy gobernar_componentes on componentes_proyecto
  for all to authenticated
  using      (private.es_admin() or private.lidera_proyecto(proyecto_id))
  with check (private.es_admin() or private.lidera_proyecto(proyecto_id));

create policy gobernar_hitos on hitos
  for all to authenticated
  using      (private.es_admin() or private.lidera_proyecto(proyecto_id))
  with check (private.es_admin() or private.lidera_proyecto(proyecto_id));

create policy gobernar_historial_etapas on historial_etapas
  for all to authenticated
  using      (private.es_admin() or private.lidera_proyecto(proyecto_id))
  with check (private.es_admin() or private.lidera_proyecto(proyecto_id));

create policy gobernar_repositorios on repositorios
  for all to authenticated
  using      (private.es_admin() or private.lidera_proyecto(proyecto_id))
  with check (private.es_admin() or private.lidera_proyecto(proyecto_id));


-- =============================================================================
-- ESCRITURA — catálogos y comercial: solo admin
-- =============================================================================
-- La lectura de todo esto ya está abierta arriba. En Postgres las políticas
-- permisivas se suman con OR: la de SELECT abre la lectura, estas mantienen
-- cerrada la escritura a todos menos al admin.

create policy admin_personas        on personas          for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_roles_proyecto  on roles_proyecto    for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_catalogo        on indicador_catalogo for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_aplicabilidad   on indicador_aplicabilidad for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_madurez         on indicador_madurez for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_eval_cases      on eval_cases        for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_canales_venta   on canales_venta     for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_clientes        on clientes          for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_productos       on productos         for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_leads           on leads             for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_ventas          on ventas            for all to authenticated using (private.es_admin()) with check (private.es_admin());
create policy admin_oportunidades   on oportunidades     for all to authenticated using (private.es_admin()) with check (private.es_admin());


-- =============================================================================
-- TABLAS DE SOLO-SISTEMA
-- =============================================================================
-- commits · pull_requests · sesiones_claude_code · trazas_agente ·
-- indicador_snapshots · tarea_evidencia · auditoria_log
--
-- Tienen SELECT (arriba) y ninguna política de escritura, a propósito. La
-- ingesta corre con service_role, que salta RLS por diseño en Supabase. La
-- ausencia de política de escritura ES la política.
-- =============================================================================
