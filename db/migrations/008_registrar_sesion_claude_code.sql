-- =============================================================================
-- 008_registrar_sesion_claude_code.sql — Fase 06, ruta OpenTelemetry
-- =============================================================================
-- Claude Code exporta por OTLP en lotes: cada 60 s las métricas, cada 5 s los
-- logs. Eso significa que de una misma sesión llegan muchas peticiones, sin
-- orden garantizado y con contadores acumulativos.
--
-- Un upsert normal pisaría datos: un lote viejo que llega tarde retrocedería
-- el `inicio` o el `fin`. Esta función fusiona en vez de pisar:
--
--   · inicio / fin        → la ventana solo puede crecer (least / greatest)
--   · duracion_activa     → métrica acumulativa de OTel: gana la mayor
--   · prompt_count        → los logs traen SOLO los eventos de ese lote,
--                           así que se SUMA, no se compara
--   · persona_id          → una vez resuelta no se pierde, aunque un lote
--                           posterior llegue sin `user.email`
-- =============================================================================

create or replace function public.registrar_sesion_claude_code(
  p_proyecto_id       uuid,
  p_session_id        text,
  p_visto_en          timestamptz,
  p_persona_id        uuid    default null,
  p_prompts_nuevos    integer default 0,
  p_duracion_segundos integer default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  insert into sesiones_claude_code (
    proyecto_id, session_id, persona_id, inicio, fin, prompt_count, duracion_activa
  ) values (
    p_proyecto_id,
    p_session_id,
    p_persona_id,
    p_visto_en,
    p_visto_en,
    coalesce(p_prompts_nuevos, 0),
    case when p_duracion_segundos is null then null else make_interval(secs => p_duracion_segundos) end
  )
  on conflict (session_id) do update set
    inicio          = least(sesiones_claude_code.inicio, excluded.inicio),
    -- GREATEST ignora los NULL, así que un lote sin `fin` no borra el que ya había.
    fin             = greatest(sesiones_claude_code.fin, excluded.fin),
    prompt_count    = sesiones_claude_code.prompt_count + coalesce(p_prompts_nuevos, 0),
    duracion_activa = greatest(sesiones_claude_code.duracion_activa, excluded.duracion_activa),
    persona_id      = coalesce(sesiones_claude_code.persona_id, excluded.persona_id);
end;
$$;

-- Solo la ingesta la usa, con la llave secreta. Nadie más la necesita.
revoke execute on function public.registrar_sesion_claude_code(uuid, text, timestamptz, uuid, integer, integer)
  from public, anon, authenticated;
