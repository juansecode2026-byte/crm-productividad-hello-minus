-- =============================================================================
-- 004_funciones_proyectos.sql — operaciones atómicas del núcleo de captura
-- =============================================================================
-- Fase 02. Dos operaciones tocan varias tablas a la vez y no pueden quedar a
-- medias: supabase-js no tiene transacciones entre llamadas, así que viven acá.
--
--   · crear_proyecto          proyecto + primera fila de historial_etapas
--                             + encargado como miembro con rol 'lider'
--   · cambiar_etapa_proyecto  cierra la etapa abierta, abre la nueva y congela
--                             el alcance al pasar la Etapa 2
--
-- SECURITY INVOKER a propósito: corren con los permisos de quien llama, así
-- que las políticas RLS de 001_baseline.sql siguen decidiendo quién puede.
-- Viven en `public` porque sí son API (se llaman por /rest/v1/rpc); por eso
-- se les quita EXECUTE a anon.
-- =============================================================================

-- Una persona no puede estar dos veces activa en el mismo proyecto. El unique
-- de la tabla incluye fecha_entrada y no lo impide.
create unique index if not exists miembro_activo_unico
  on miembros_proyecto (proyecto_id, persona_id)
  where fecha_salida is null;


create or replace function public.crear_proyecto(
  p_nombre          text,
  p_descripcion     text               default null,
  p_cliente_id      uuid               default null,
  p_encargado_id    uuid               default null,
  p_tipo            text               default null,
  p_prioridad       smallint           default null,
  p_modalidad       modalidad_proyecto default 'individual',
  p_etapa_inicial   smallint           default 1,
  p_fecha_inicio    date               default null,
  p_fecha_objetivo  date               default null,
  p_fecha_limite    date               default null,
  p_horas_estimadas numeric            default null
)
returns proyectos
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_persona  uuid := private.persona_actual();
  v_proyecto proyectos;
begin
  if v_persona is null then
    raise exception 'Tu usuario no está vinculado a una persona del equipo'
      using errcode = '42501';
  end if;

  if p_encargado_id is not null
     and not exists (select 1 from personas where id = p_encargado_id and activo) then
    raise exception 'El encargado no existe o está inactivo' using errcode = 'P0001';
  end if;

  -- Un proyecto que se registra ya pasada la Etapa 2 (los que existían antes
  -- del CRM) congela su alcance en el momento del alta: lo que haya hoy es el
  -- 100% oficial.
  insert into proyectos (
    nombre, descripcion, cliente_id, creado_por, encargado_id, tipo, prioridad,
    modalidad, etapa_actual, fecha_inicio, fecha_objetivo, fecha_limite,
    horas_estimadas, alcance_congelado_en
  ) values (
    p_nombre, p_descripcion, p_cliente_id, v_persona, p_encargado_id, p_tipo, p_prioridad,
    p_modalidad, p_etapa_inicial, p_fecha_inicio, p_fecha_objetivo, p_fecha_limite,
    p_horas_estimadas, case when p_etapa_inicial > 2 then now() end
  )
  returning * into v_proyecto;

  insert into historial_etapas (proyecto_id, etapa, entra_en)
  values (v_proyecto.id, p_etapa_inicial, now());

  if p_encargado_id is not null then
    insert into miembros_proyecto (proyecto_id, persona_id, rol_proyecto_id, fecha_entrada)
    values (
      v_proyecto.id,
      p_encargado_id,
      (select id from roles_proyecto where nombre = 'lider'),
      coalesce(p_fecha_inicio, current_date)
    );
  end if;

  return v_proyecto;
end;
$$;


create or replace function public.cambiar_etapa_proyecto(
  p_proyecto_id uuid,
  p_etapa       smallint
)
returns proyectos
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actual   smallint;
  v_proyecto proyectos;
begin
  if p_etapa not between 1 and 9 then
    raise exception 'La etapa tiene que estar entre 1 y 9' using errcode = 'P0001';
  end if;

  -- FOR UPDATE aplica la política de UPDATE: si no hay permiso la fila no
  -- aparece, igual que si no existiera. Se distingue abajo.
  select etapa_actual into v_actual
    from proyectos
   where id = p_proyecto_id
     for update;

  if not found then
    if exists (select 1 from proyectos where id = p_proyecto_id) then
      raise exception 'No tienes permiso para cambiar la etapa de este proyecto'
        using errcode = '42501';
    end if;
    raise exception 'El proyecto no existe' using errcode = 'P0002';
  end if;

  if v_actual = p_etapa then
    raise exception 'El proyecto ya está en la etapa %', p_etapa using errcode = 'P0001';
  end if;

  update historial_etapas
     set sale_en = now()
   where proyecto_id = p_proyecto_id
     and sale_en is null;

  insert into historial_etapas (proyecto_id, etapa, entra_en)
  values (p_proyecto_id, p_etapa, now());

  -- El congelamiento es definitivo: volver a una etapa anterior no lo borra.
  update proyectos
     set etapa_actual = p_etapa,
         alcance_congelado_en = coalesce(
           alcance_congelado_en,
           case when p_etapa > 2 then now() end
         )
   where id = p_proyecto_id
  returning * into v_proyecto;

  return v_proyecto;
end;
$$;


revoke execute on function public.crear_proyecto(
  text, text, uuid, uuid, text, smallint, modalidad_proyecto, smallint, date, date, date, numeric
) from public, anon;
grant execute on function public.crear_proyecto(
  text, text, uuid, uuid, text, smallint, modalidad_proyecto, smallint, date, date, date, numeric
) to authenticated;

revoke execute on function public.cambiar_etapa_proyecto(uuid, smallint) from public, anon;
grant execute on function public.cambiar_etapa_proyecto(uuid, smallint) to authenticated;
