-- =============================================================================
-- 001_baseline.sql — Políticas RLS del CRM de Productividad Hello Minus
-- =============================================================================
-- Corre DESPUÉS de db/000_schema_inicial.sql, que ya habilitó RLS en las 32
-- tablas. Hasta que este archivo se aplique, la base deniega todo: ese es el
-- "restrictivo por defecto" que recomienda la documentación.
--
-- DECISIONES TOMADAS (2026-08-28) — ver docs/fases-crm-productividad-hello-minus.md
--
--   Punto A · indicadores personales : ambos ven los de ambos.
--   Punto B · detalle Tarea Semanal  : ambos ven el de ambos.
--
--   El equipo son dos personas y eligieron transparencia total. Por eso la
--   restricción de este archivo NO está en la lectura de datos de trabajo,
--   sino en dos lugares distintos:
--
--     1. ESCRITURA — cada quien escribe solo lo suyo. Que ambos vean el
--        registro de tiempo del otro no significa que puedan editarlo.
--     2. TABLAS DE SOLO-SISTEMA — commits, PRs, sesiones, trazas, snapshots y
--        evidencia se leen, pero nadie las escribe desde la app. Si un usuario
--        pudiera insertar en commits, podría fabricarse actividad y todos los
--        indicadores dejarían de significar algo.
--
--   Lo comercial (clientes, productos, leads, ventas, oportunidades) queda
--   restringido a admin, como indica la documentación: son datos de terceros,
--   no del equipo, y la decisión de transparencia se tomó sobre lo segundo.
--   Si se quiere abrir también, es un cambio de una línea por tabla — pero es
--   una decisión aparte y conviene tomarla a propósito.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Funciones auxiliares
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER a propósito: estas funciones consultan tablas que a su vez
-- tienen RLS. Sin definer, la política de personas llamaría a una función que
-- lee personas, que dispara la política otra vez → recursión infinita.
-- search_path fijo para que no puedan ser secuestradas por un esquema temporal.

create or replace function public.persona_actual()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.personas where auth_user_id = auth.uid();
$$;

comment on function public.persona_actual() is
  'Traduce el auth.uid() de Supabase al id interno de personas. Devuelve NULL si el usuario autenticado no tiene fila en personas.';

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.personas
    where auth_user_id = auth.uid()
      and rol = 'admin'
      and activo
  );
$$;

create or replace function public.lidera_proyecto(p_proyecto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.proyectos p
    where p.id = p_proyecto_id
      and p.encargado_id = public.persona_actual()
  );
$$;

create or replace function public.es_miembro(p_proyecto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.miembros_proyecto m
    where m.proyecto_id = p_proyecto_id
      and m.persona_id  = public.persona_actual()
      and m.fecha_salida is null
  );
$$;


-- =============================================================================
-- LECTURA — transparencia total entre el equipo
-- =============================================================================
-- Todo usuario autenticado que tenga fila activa en personas lee los datos de
-- trabajo. Es la decisión explícita del equipo, no un descuido de permisos.

create policy leer_personas on personas
  for select to authenticated using (persona_actual() is not null);

create policy leer_roles_proyecto on roles_proyecto
  for select to authenticated using (persona_actual() is not null);

create policy leer_proyectos on proyectos
  for select to authenticated using (persona_actual() is not null);

create policy leer_miembros on miembros_proyecto
  for select to authenticated using (persona_actual() is not null);

create policy leer_historial_etapas on historial_etapas
  for select to authenticated using (persona_actual() is not null);

create policy leer_checklist on checklist_items
  for select to authenticated using (persona_actual() is not null);

create policy leer_hitos on hitos
  for select to authenticated using (persona_actual() is not null);

-- Punto B: ambos ven el detalle de Tarea Semanal del otro.
create policy leer_tareas_semanales on tareas_semanales
  for select to authenticated using (persona_actual() is not null);

create policy leer_tarea_evidencia on tarea_evidencia
  for select to authenticated using (persona_actual() is not null);

create policy leer_componentes on componentes_proyecto
  for select to authenticated using (persona_actual() is not null);

create policy leer_puntos on puntos_componente
  for select to authenticated using (persona_actual() is not null);

create policy leer_candidatos on candidatos_alcance
  for select to authenticated using (persona_actual() is not null);

create policy leer_bloqueos on bloqueos
  for select to authenticated using (persona_actual() is not null);

create policy leer_registro_tiempo on registro_tiempo
  for select to authenticated using (persona_actual() is not null);

create policy leer_implementaciones on implementaciones
  for select to authenticated using (persona_actual() is not null);

create policy leer_repositorios on repositorios
  for select to authenticated using (persona_actual() is not null);

create policy leer_commits on commits
  for select to authenticated using (persona_actual() is not null);

create policy leer_pull_requests on pull_requests
  for select to authenticated using (persona_actual() is not null);

create policy leer_sesiones on sesiones_claude_code
  for select to authenticated using (persona_actual() is not null);

create policy leer_trazas on trazas_agente
  for select to authenticated using (persona_actual() is not null);

-- Punto A: ambos ven los indicadores personales del otro.
create policy leer_snapshots on indicador_snapshots
  for select to authenticated using (persona_actual() is not null);

create policy leer_catalogo on indicador_catalogo
  for select to authenticated using (persona_actual() is not null);

create policy leer_aplicabilidad on indicador_aplicabilidad
  for select to authenticated using (persona_actual() is not null);

create policy leer_madurez on indicador_madurez
  for select to authenticated using (persona_actual() is not null);

create policy leer_eval_cases on eval_cases
  for select to authenticated using (persona_actual() is not null);


-- =============================================================================
-- ESCRITURA — cada quien lo suyo
-- =============================================================================

-- --- Datos propios de la persona ---------------------------------------------

create policy crear_mi_tiempo on registro_tiempo
  for insert to authenticated
  with check (persona_id = persona_actual());

-- Ventana de edición de 7 días: pasado ese plazo el registro queda inmutable.
-- Si no, los indicadores históricos cambian retroactivamente y dejan de ser
-- confiables — un número que se mueve solo no sirve para decidir nada.
create policy editar_mi_tiempo on registro_tiempo
  for update to authenticated
  using  (persona_id = persona_actual() and fecha >= current_date - interval '7 days')
  with check (persona_id = persona_actual() and fecha >= current_date - interval '7 days');

create policy borrar_mi_tiempo on registro_tiempo
  for delete to authenticated
  using (persona_id = persona_actual() and fecha >= current_date - interval '7 days');

create policy crear_mi_tarea on tareas_semanales
  for insert to authenticated
  with check (persona_id = persona_actual() or es_admin());

create policy editar_mi_tarea on tareas_semanales
  for update to authenticated
  using      (persona_id = persona_actual() or es_admin())
  with check (persona_id = persona_actual() or es_admin());

create policy borrar_mi_tarea on tareas_semanales
  for delete to authenticated
  using (persona_id = persona_actual() or es_admin());

-- --- Datos de proyecto --------------------------------------------------------
-- El colaborador aporta sobre los proyectos donde es miembro; el líder y el
-- admin además gobiernan el proyecto.

create policy escribir_checklist on checklist_items
  for all to authenticated
  using      (es_admin() or es_miembro(proyecto_id) or lidera_proyecto(proyecto_id))
  with check (es_admin() or es_miembro(proyecto_id) or lidera_proyecto(proyecto_id));

create policy escribir_bloqueos on bloqueos
  for all to authenticated
  using      (es_admin() or es_miembro(proyecto_id) or lidera_proyecto(proyecto_id))
  with check (es_admin() or es_miembro(proyecto_id) or lidera_proyecto(proyecto_id));

create policy escribir_implementaciones on implementaciones
  for all to authenticated
  using      (es_admin() or es_miembro(proyecto_id) or lidera_proyecto(proyecto_id))
  with check (es_admin() or es_miembro(proyecto_id) or lidera_proyecto(proyecto_id));

create policy escribir_puntos on puntos_componente
  for all to authenticated
  using (
    es_admin() or exists (
      select 1 from componentes_proyecto c
      where c.id = puntos_componente.componente_id
        and (es_miembro(c.proyecto_id) or lidera_proyecto(c.proyecto_id))
    )
  )
  with check (
    es_admin() or exists (
      select 1 from componentes_proyecto c
      where c.id = puntos_componente.componente_id
        and (es_miembro(c.proyecto_id) or lidera_proyecto(c.proyecto_id))
    )
  );

-- Aprobar un candidato de alcance cambia el 100% oficial del proyecto: solo el
-- líder o el admin. El agente nunca aprueba solo, por diseño.
create policy escribir_candidatos on candidatos_alcance
  for all to authenticated
  using      (es_admin() or lidera_proyecto(proyecto_id))
  with check (es_admin() or lidera_proyecto(proyecto_id));

create policy gobernar_proyectos on proyectos
  for all to authenticated
  using      (es_admin() or lidera_proyecto(id))
  with check (es_admin() or lidera_proyecto(id));

create policy gobernar_miembros on miembros_proyecto
  for all to authenticated
  using      (es_admin() or lidera_proyecto(proyecto_id))
  with check (es_admin() or lidera_proyecto(proyecto_id));

create policy gobernar_componentes on componentes_proyecto
  for all to authenticated
  using      (es_admin() or lidera_proyecto(proyecto_id))
  with check (es_admin() or lidera_proyecto(proyecto_id));

create policy gobernar_hitos on hitos
  for all to authenticated
  using      (es_admin() or lidera_proyecto(proyecto_id))
  with check (es_admin() or lidera_proyecto(proyecto_id));

create policy gobernar_historial_etapas on historial_etapas
  for all to authenticated
  using      (es_admin() or lidera_proyecto(proyecto_id))
  with check (es_admin() or lidera_proyecto(proyecto_id));

create policy gobernar_repositorios on repositorios
  for all to authenticated
  using      (es_admin() or lidera_proyecto(proyecto_id))
  with check (es_admin() or lidera_proyecto(proyecto_id));

-- --- Catálogos: los lee todo el equipo, los escribe solo admin ---------------

create policy admin_personas on personas
  for all to authenticated using (es_admin()) with check (es_admin());

create policy admin_roles_proyecto on roles_proyecto
  for all to authenticated using (es_admin()) with check (es_admin());

create policy admin_catalogo on indicador_catalogo
  for all to authenticated using (es_admin()) with check (es_admin());

create policy admin_aplicabilidad on indicador_aplicabilidad
  for all to authenticated using (es_admin()) with check (es_admin());

create policy admin_madurez on indicador_madurez
  for all to authenticated using (es_admin()) with check (es_admin());

create policy admin_eval_cases on eval_cases
  for all to authenticated using (es_admin()) with check (es_admin());

create policy admin_canales_venta on canales_venta
  for all to authenticated using (es_admin()) with check (es_admin());


-- =============================================================================
-- COMERCIAL — solo admin, también para leer
-- =============================================================================
-- Datos de terceros, no del equipo. Ningún indicador que use un colaborador
-- necesita montos ni pipeline.

create policy admin_clientes on clientes
  for all to authenticated using (es_admin()) with check (es_admin());

create policy admin_productos on productos
  for all to authenticated using (es_admin()) with check (es_admin());

create policy admin_leads on leads
  for all to authenticated using (es_admin()) with check (es_admin());

create policy admin_ventas on ventas
  for all to authenticated using (es_admin()) with check (es_admin());

create policy admin_oportunidades on oportunidades
  for all to authenticated using (es_admin()) with check (es_admin());


-- =============================================================================
-- AUDITORÍA — se lee, no se toca
-- =============================================================================
-- Solo lectura para admin. Ninguna política de insert/update/delete para
-- usuarios: si un admin pudiera editar el log, el log no sirve de nada.
-- La escritura entra por service_role.

create policy leer_auditoria on auditoria_log
  for select to authenticated using (es_admin());


-- =============================================================================
-- TABLAS DE SOLO-SISTEMA
-- =============================================================================
-- commits · pull_requests · sesiones_claude_code · trazas_agente ·
-- indicador_snapshots · tarea_evidencia · auditoria_log
--
-- Arriba se les dio SELECT y nada más. No llevan política de escritura a
-- propósito: la ingesta corre con service_role, que salta RLS por diseño en
-- Supabase. La ausencia de política ES la política.
-- =============================================================================
