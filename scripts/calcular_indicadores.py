"""Fase 07 — Motor de indicadores. Escribe snapshots en indicador_snapshots.

Aritmética pura, sin Claude: el "LLM parcial" que preveía el diseño original
era para inferir el área de un archivo ambiguo, y eso ya lo resuelve
scripts/inferir_area.py desde la Fase 06. Por eso vive en scripts/.

Va en la cadena nocturna DESPUÉS del Clasificador de commits (CLAUDE.md,
"orden obligatorio"): varios indicadores leen tipo_inferido/area_inferida, y
correr antes calcularía sobre commits sin etiquetar.

Reglas que valen para todos los calculadores:

  - Un snapshot por semana. `periodo` es el lunes de la semana en que corre.
    Correr dos veces la misma semana pisa el valor (upsert contra
    snapshot_unico); las semanas pasadas no se tocan nunca — así el histórico
    no cambia retroactivamente, que es la razón de que existan los snapshots.

  - Sin datos no hay snapshot. No se escribe un cero cuando no hay de dónde
    sacar el número: la ausencia de fila ES la respuesta honesta. Un cero
    diría "se midió y dio cero", que es otra cosa.

  - Los indicadores de persona-dentro-de-un-proyecto se guardan con
    scope_type='proyecto' y el desglose por persona en `detalle`. No se puede
    usar scope_type='persona': el constraint único es
    (indicador_code, scope_type, scope_id, periodo), así que una persona en dos
    proyectos tendría dos valores para la misma semana y chocarían.

  - scope_type='portafolio' (compara TODA una modalidad contra la otra, no un
    proyecto puntual) usa PORTAFOLIO_SENTINEL como scope_id — nunca NULL.
    Postgres no considera iguales dos NULL en un UNIQUE, así que el upsert
    contra snapshot_unico no pisaría nada: duplicaría una fila por corrida.

Los 13 indicadores con fuente ✓ del catálogo (frontend/dashboard/src/lib/
indicadores.ts, FUENTE) — el esquema ya los respalda, sin esperar telemetría
que no llegó ni un dato que no se captura todavía. Ver CLAUDE.md, Fase 07,
para los 12 ◐ y 4 ○ que siguen pendientes.

  13_commits_proyecto     — acumulado. El primero, para probar el motor
                            contra algo que ya existía (dio 3).
  29_avance_atribuido     — acumulado. valor NULL a propósito: no hay un
                            número de proyecto, solo porciones por persona.
  01_throughput           — tareas cerradas ESTA semana, no acumulado.
  04_tiempo_primer_avance — acumulado. Días entre creado_en de la tarea y la
                            fecha REAL (no tarea_evidencia.detectado_en, que
                            es cuándo corrió el Detector) del primer
                            commit/PR/sesión que la respalda.
  14_consistencia         — ratio de esta semana contra el propio promedio de
                            las 8 semanas anteriores, con ceros reales en las
                            semanas sin cierres (no se ignoran).
  17_bus_factor           — acumulado. % de commits en quien más aportó; con
                            una sola persona da 100% solo, sin caso especial.
  20_estabilidad_equipo   — acumulado. Cuenta de gente que salió alguna vez.
  21_autosuficiencia      — acumulado. % de bloqueos resueltos por quien los
                            abrió, promediado por persona.
  24_documentacion        — acumulado. % de commits tipo_inferido=
                            'documentacion'.
  22_ritmo_sostenido      — coeficiente de variación de commits/semana sobre
                            las 8 semanas anteriores (varianza, no un ratio
                            puntual como 14 — un salto se lee comparando
                            snapshots en el tiempo).
  23_autocomparacion      — solo en proyectos individuales. Ritmo de tareas
                            cerradas por semana activa de ESTE proyecto
                            contra el promedio de los OTROS individuales de
                            la misma persona.
  26_bloqueo_individual_compartido — scope_type='portafolio'. valor NULL:
                            "individual: 2 días, equipo: 0.5" no cabe en un
                            número sin decir cuál es cuál.
  28_intervencion_cruzada — acumulado. Commits de alguien que no es el
                            encargado, en un proyecto marcado individual.

Uso:
    DATABASE_URL=postgresql://... python calcular_indicadores.py
"""

from __future__ import annotations

import os
import sys

import psycopg

# Cuántos commits hizo cada persona en cada proyecto, en total (no por semana:
# el indicador es acumulado). `valor` es el total del proyecto; los commits sin
# autor conocido cuentan en el total y se informan aparte, no se reparten.
COMMITS_PROYECTO = """
    with por_persona as (
        select r.proyecto_id, c.persona_id, count(*) as commits
          from commits c
          join repositorios r on r.id = c.repo_id
         where r.proyecto_id is not null
         group by r.proyecto_id, c.persona_id
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '13_commits_proyecto',
        'proyecto'::ambito_indicador,
        proyecto_id,
        date_trunc('week', current_date)::date,
        sum(commits),
        jsonb_build_object(
            'por_persona', coalesce(
                jsonb_agg(jsonb_build_object('persona_id', persona_id, 'commits', commits)
                          order by commits desc) filter (where persona_id is not null),
                '[]'::jsonb),
            'sin_atribuir', coalesce(sum(commits) filter (where persona_id is null), 0)
        )
      from por_persona
     group by proyecto_id
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# De las tareas que tiene asignadas cada persona en un proyecto, cuántas marcó
# terminadas. `valor` queda en NULL a propósito: el doc aclara que este
# indicador NO es el avance del proyecto, sino el de la porción de cada quien —
# no existe un número único del proyecto que lo represente, y sumar o promediar
# las dos porciones inventaría uno.
AVANCE_ATRIBUIDO = """
    with por_persona as (
        select proyecto_id, persona_id,
               count(*)                              as asignadas,
               count(*) filter (where completado)    as completadas
          from tareas_semanales
         group by proyecto_id, persona_id
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '29_avance_atribuido',
        'proyecto'::ambito_indicador,
        proyecto_id,
        date_trunc('week', current_date)::date,
        null,
        jsonb_build_object(
            'por_persona', jsonb_agg(jsonb_build_object(
                'persona_id',  persona_id,
                'asignadas',   asignadas,
                'completadas', completadas,
                'porcentaje',  round(100.0 * completadas / asignadas, 1)
            ) order by persona_id)
        )
      from por_persona
     group by proyecto_id
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# Tareas que se cerraron ESTA semana (no acumulado, a diferencia de
# commits_proyecto): el doc dice "cerradas por semana", así que cuenta
# completado_en dentro de la semana que corre, no el histórico completo.
# Un proyecto sin cierres esta semana no aparece — no es un cero, es que
# todavía no corrió el motor con nada que reportar.
THROUGHPUT = """
    with cerradas as (
        select proyecto_id, persona_id, count(*) as cerradas
          from tareas_semanales
         where completado
           and completado_en >= date_trunc('week', current_date)
           and completado_en <  date_trunc('week', current_date) + interval '7 days'
         group by proyecto_id, persona_id
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '01_throughput',
        'proyecto'::ambito_indicador,
        proyecto_id,
        date_trunc('week', current_date)::date,
        sum(cerradas),
        jsonb_build_object(
            'por_persona', jsonb_agg(jsonb_build_object('persona_id', persona_id, 'cerradas', cerradas)
                                      order by cerradas desc)
        )
      from cerradas
     group by proyecto_id
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# Días entre que se asigna una tarea (tareas_semanales.creado_en) y su primer
# rastro real — no tarea_evidencia.detectado_en, que es cuándo CORRIÓ el
# Detector (sábados), sino la fecha real del commit/PR/sesión que esa fila
# referencia. Mismo problema que resolvimos para el checklist (migración
# 016): la fecha de "cuándo se encontró" no es la fecha de "cuándo pasó".
# Cada fuente se une distinto (commits y pull_requests pasan por
# repositorios; sesiones_claude_code ya trae proyecto_id), igual que en
# detectar_rastro_semanal.py.
#
# Acumulado, no "de esta semana": es una duración por tarea, no un conteo de
# eventos — más muestras solo lo hacen más representativo. Una tarea sin
# evidencia todavía no entra: no tiene primer avance que medir.
TIEMPO_PRIMER_AVANCE = """
    with evidencia_fecha as (
        select te.tarea_id, c.fecha as fecha
          from tarea_evidencia te
          join tareas_semanales t on t.id = te.tarea_id
          join repositorios r on r.proyecto_id = t.proyecto_id
          join commits c on c.repo_id = r.id and c.sha = te.referencia
         where te.fuente = 'commit'
        union all
        select te.tarea_id, p.abierto_en as fecha
          from tarea_evidencia te
          join tareas_semanales t on t.id = te.tarea_id
          join repositorios r on r.proyecto_id = t.proyecto_id
          join pull_requests p on p.repo_id = r.id and p.numero::text = te.referencia
         where te.fuente = 'pull_request' and p.abierto_en is not null
        union all
        select te.tarea_id, s.inicio as fecha
          from tarea_evidencia te
          join sesiones_claude_code s on s.session_id = te.referencia
         where te.fuente = 'sesion_claude_code'
    ),
    primer_avance as (
        select tarea_id, min(fecha) as primera_fecha
          from evidencia_fecha
         group by tarea_id
    ),
    -- Un promedio por persona primero (una persona cuenta igual que otra en
    -- el número del proyecto, sin importar cuántas tareas tenga cada una).
    dias_por_persona as (
        select t.proyecto_id, t.persona_id,
               avg(pa.primera_fecha::date - t.creado_en::date) as dias_promedio,
               count(*) as tareas
          from primer_avance pa
          join tareas_semanales t on t.id = pa.tarea_id
         group by t.proyecto_id, t.persona_id
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '04_tiempo_primer_avance',
        'proyecto'::ambito_indicador,
        proyecto_id,
        date_trunc('week', current_date)::date,
        round(avg(dias_promedio), 1),
        jsonb_build_object(
            'por_persona', jsonb_agg(jsonb_build_object(
                'persona_id',    persona_id,
                'dias_promedio', round(dias_promedio, 1),
                'tareas',        tareas
            ) order by persona_id)
        )
      from dias_por_persona
     group by proyecto_id
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# Ritmo de esta semana contra el propio ritmo reciente (Grupo B: antes
# comparaba contra el equipo, ahora contra la propia persona en el tiempo).
# "Reciente" no lo define el doc — es una decisión nuestra, explícita:
# las 8 semanas anteriores a la que corre, con ceros de verdad en las que no
# cerró nada (no las semanas vacías se ignoran silenciosamente, que inflaría
# el promedio con solo las semanas "buenas"). Se arma con generate_series
# porque tareas_semanales solo tiene filas de lo que SÍ pasó.
#
# ratio = 1.0 es "igual a como siempre", <1 es una caída respecto a sí mismo,
# nunca respecto a la otra persona. Solo entra quien tiene promedio histórico
# > 0 — alguien sin ritmo previo todavía no tiene con qué compararse.
CONSISTENCIA = """
    with semanas as (
        select gs::date as semana
          from generate_series(
                 date_trunc('week', current_date)::date - interval '56 days',
                 date_trunc('week', current_date)::date - interval '7 days',
                 interval '7 days'
               ) as gs
    ),
    personas_proyecto as (
        select distinct proyecto_id, persona_id from tareas_semanales
    ),
    grilla as (
        select pp.proyecto_id, pp.persona_id, s.semana
          from personas_proyecto pp
          cross join semanas s
    ),
    cierres_semanales as (
        select proyecto_id, persona_id, date_trunc('week', completado_en)::date as semana, count(*) as cerradas
          from tareas_semanales
         where completado
         group by proyecto_id, persona_id, date_trunc('week', completado_en)::date
    ),
    historico as (
        select g.proyecto_id, g.persona_id, avg(coalesce(c.cerradas, 0)) as promedio_historico
          from grilla g
          left join cierres_semanales c
            on c.proyecto_id = g.proyecto_id and c.persona_id = g.persona_id and c.semana = g.semana
         group by g.proyecto_id, g.persona_id
        having avg(coalesce(c.cerradas, 0)) > 0
    ),
    esta_semana as (
        select proyecto_id, persona_id, cerradas
          from cierres_semanales
         where semana = date_trunc('week', current_date)::date
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '14_consistencia',
        'proyecto'::ambito_indicador,
        h.proyecto_id,
        date_trunc('week', current_date)::date,
        round(avg(coalesce(es.cerradas, 0)::numeric / h.promedio_historico), 2),
        jsonb_build_object(
            'por_persona', jsonb_agg(jsonb_build_object(
                'persona_id',          h.persona_id,
                'cerradas_esta_semana', coalesce(es.cerradas, 0),
                'promedio_historico',   round(h.promedio_historico, 2),
                'ratio',                round(coalesce(es.cerradas, 0)::numeric / h.promedio_historico, 2)
            ) order by h.persona_id)
        )
      from historico h
      left join esta_semana es on es.proyecto_id = h.proyecto_id and es.persona_id = h.persona_id
     group by h.proyecto_id
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# Concentración de conocimiento: % de los commits que quedan en la persona
# que más aportó, sobre el total del proyecto. No se distingue por modalidad
# a propósito — el doc dice que en un proyecto de una sola persona esto tiene
# que dar 100% "por definición", y la misma fórmula lo hace sola: con un solo
# contribuyente, max(commits) = total. Los commits sin persona_id conocido no
# entran ni al numerador ni al denominador — no sabemos de quién es ese
# conocimiento, así que no se le puede atribuir a nadie.
BUS_FACTOR = """
    with por_persona as (
        select r.proyecto_id, c.persona_id, count(*) as commits
          from commits c
          join repositorios r on r.id = c.repo_id
         where r.proyecto_id is not null and c.persona_id is not null
         group by r.proyecto_id, c.persona_id
    ),
    totales as (
        select proyecto_id, sum(commits) as total
          from por_persona
         group by proyecto_id
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '17_bus_factor',
        'proyecto'::ambito_indicador,
        pp.proyecto_id,
        date_trunc('week', current_date)::date,
        round(100.0 * max(pp.commits) / t.total, 1),
        jsonb_build_object(
            'por_persona', jsonb_agg(jsonb_build_object(
                'persona_id', pp.persona_id,
                'commits',    pp.commits,
                'porcentaje', round(100.0 * pp.commits / t.total, 1)
            ) order by pp.commits desc)
        )
      from por_persona pp
      join totales t on t.proyecto_id = pp.proyecto_id
     group by pp.proyecto_id, t.total
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# Rotación acumulada, no "de esta semana" — igual que 13 y 04, es un conteo
# de estado, no un evento puntual. Un proyecto individual nunca tuvo a nadie
# irse, así que da 0 solo, sin caso especial por modalidad.
ESTABILIDAD_EQUIPO = """
    with resumen as (
        select proyecto_id,
               count(*)                                    as historico,
               count(*) filter (where fecha_salida is null) as activos,
               count(*) filter (where fecha_salida is not null) as salieron
          from miembros_proyecto
         group by proyecto_id
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '20_estabilidad_equipo',
        'proyecto'::ambito_indicador,
        proyecto_id,
        date_trunc('week', current_date)::date,
        salieron,
        jsonb_build_object('historico', historico, 'activos', activos, 'salieron', salieron)
      from resumen
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# % de los bloqueos que cada quien resolvió sola contra los que escaló al
# otro integrante. Solo cuenta bloqueos ya resueltos (uno abierto todavía no
# tiene con qué responder esta pregunta). Promedio por persona, no por
# bloqueo — misma razón que 04 y 14: nadie pesa más que otro en el número del
# proyecto solo por tener más bloqueos.
AUTOSUFICIENCIA = """
    with por_persona as (
        select proyecto_id, persona_id,
               count(*) as total_resueltos,
               count(*) filter (where resuelto_por = persona_id) as solo
          from bloqueos
         where resuelto_en is not null
         group by proyecto_id, persona_id
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '21_autosuficiencia',
        'proyecto'::ambito_indicador,
        proyecto_id,
        date_trunc('week', current_date)::date,
        round(avg(100.0 * solo / total_resueltos), 1),
        jsonb_build_object(
            'por_persona', jsonb_agg(jsonb_build_object(
                'persona_id',      persona_id,
                'total_resueltos', total_resueltos,
                'solo',            solo,
                'porcentaje',      round(100.0 * solo / total_resueltos, 1)
            ) order by persona_id)
        )
      from por_persona
     group by proyecto_id
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# % de commits clasificados como 'documentacion' por el Clasificador. Los
# commits sin clasificar todavía (tipo_inferido NULL) cuentan en el total
# pero no en el numerador — no sabemos qué son, así que no se dan por
# documentación ni por lo contrario.
DOCUMENTACION = """
    with por_persona as (
        select r.proyecto_id, c.persona_id,
               count(*) as total_commits,
               count(*) filter (where c.tipo_inferido = 'documentacion') as documentacion
          from commits c
          join repositorios r on r.id = c.repo_id
         where r.proyecto_id is not null and c.persona_id is not null
         group by r.proyecto_id, c.persona_id
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '24_documentacion',
        'proyecto'::ambito_indicador,
        proyecto_id,
        date_trunc('week', current_date)::date,
        round(avg(100.0 * documentacion / total_commits), 1),
        jsonb_build_object(
            'por_persona', jsonb_agg(jsonb_build_object(
                'persona_id',    persona_id,
                'total_commits', total_commits,
                'documentacion', documentacion,
                'porcentaje',    round(100.0 * documentacion / total_commits, 1)
            ) order by persona_id)
        )
      from por_persona
     group by proyecto_id
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# Estabilidad del ritmo de commits semana a semana, contra el propio
# histórico — no un ratio puntual como 14, sino la varianza en sí (el doc lo
# llama por su nombre: "varianza de actividad"). Coeficiente de variación
# (desviación / promedio) sobre las 8 semanas anteriores: más bajo es más
# parejo, un salto de una corrida a la siguiente es la señal de cansancio que
# describe el ejemplo — eso se lee comparando snapshots en el tiempo, no acá.
RITMO_SOSTENIDO = """
    with semanas as (
        select gs::date as semana
          from generate_series(
                 date_trunc('week', current_date)::date - interval '56 days',
                 date_trunc('week', current_date)::date - interval '7 days',
                 interval '7 days'
               ) as gs
    ),
    personas_proyecto as (
        select distinct r.proyecto_id, c.persona_id
          from commits c
          join repositorios r on r.id = c.repo_id
         where r.proyecto_id is not null and c.persona_id is not null
    ),
    grilla as (
        select pp.proyecto_id, pp.persona_id, s.semana
          from personas_proyecto pp
          cross join semanas s
    ),
    commits_semanales as (
        select r.proyecto_id, c.persona_id, date_trunc('week', c.fecha)::date as semana, count(*) as commits
          from commits c
          join repositorios r on r.id = c.repo_id
         where r.proyecto_id is not null and c.persona_id is not null
         group by r.proyecto_id, c.persona_id, date_trunc('week', c.fecha)::date
    ),
    serie as (
        select g.proyecto_id, g.persona_id, coalesce(cs.commits, 0) as commits
          from grilla g
          left join commits_semanales cs
            on cs.proyecto_id = g.proyecto_id and cs.persona_id = g.persona_id and cs.semana = g.semana
    ),
    stats as (
        select proyecto_id, persona_id, avg(commits) as promedio, stddev_pop(commits) as desviacion
          from serie
         group by proyecto_id, persona_id
        having avg(commits) > 0
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '22_ritmo_sostenido',
        'proyecto'::ambito_indicador,
        proyecto_id,
        date_trunc('week', current_date)::date,
        round(avg(desviacion / promedio), 2),
        jsonb_build_object(
            'por_persona', jsonb_agg(jsonb_build_object(
                'persona_id',       persona_id,
                'promedio_semanal', round(promedio, 2),
                'desviacion',       round(desviacion, 2),
                'coef_variacion',   round(desviacion / promedio, 2)
            ) order by persona_id)
        )
      from stats
     group by proyecto_id
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# Grupo B: solo tiene sentido en proyectos individuales — compara el ritmo de
# ESTE proyecto contra el ritmo de OTROS proyectos individuales de la misma
# persona. "Ritmo" = tareas cerradas por semana activa (semanas desde la
# primera tarea asignada). Sin al menos otro proyecto individual con ritmo
# propio > 0, no hay con qué comparar — no entra, no es un cero.
AUTOCOMPARACION = """
    with individuales as (
        select id as proyecto_id from proyectos where modalidad = 'individual'
    ),
    actividad as (
        select t.proyecto_id, t.persona_id,
               count(*) filter (where t.completado) as completadas,
               greatest(1, ceil(extract(epoch from (now() - min(t.creado_en))) / (7 * 86400))) as semanas_activas
          from tareas_semanales t
          join individuales i on i.proyecto_id = t.proyecto_id
         group by t.proyecto_id, t.persona_id
    ),
    ritmo as (
        select proyecto_id, persona_id, completadas / semanas_activas as tareas_por_semana
          from actividad
    ),
    historico as (
        select r1.persona_id, r1.proyecto_id as proyecto_actual,
               avg(r2.tareas_por_semana) as ritmo_historico
          from ritmo r1
          join ritmo r2 on r2.persona_id = r1.persona_id and r2.proyecto_id <> r1.proyecto_id
         group by r1.persona_id, r1.proyecto_id
        having avg(r2.tareas_por_semana) > 0
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '23_autocomparacion',
        'proyecto'::ambito_indicador,
        h.proyecto_actual,
        date_trunc('week', current_date)::date,
        round(avg(r.tareas_por_semana / h.ritmo_historico), 2),
        jsonb_build_object(
            'por_persona', jsonb_agg(jsonb_build_object(
                'persona_id',      h.persona_id,
                'ritmo_actual',    round(r.tareas_por_semana, 2),
                'ritmo_historico', round(h.ritmo_historico, 2),
                'ratio',           round(r.tareas_por_semana / h.ritmo_historico, 2)
            ) order by h.persona_id)
        )
      from historico h
      join ritmo r on r.proyecto_id = h.proyecto_actual and r.persona_id = h.persona_id
     group by h.proyecto_actual
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# Único indicador de scope_type='portafolio' construido hasta ahora: compara
# TODA la modalidad individual contra TODA la modalidad equipo, no un
# proyecto contra otro. scope_id es NULL-able en el esquema, pero dos filas
# con NULL nunca chocan en un UNIQUE de Postgres — el on conflict de abajo no
# pisaría nada, duplicaría una fila por corrida. Por eso este UUID fijo: es
# la convención para "portafolio completo" en cualquier indicador futuro de
# este scope, no un truco de una sola vez.
PORTAFOLIO_SENTINEL = "00000000-0000-0000-0000-000000000000"

# valor queda NULL a propósito, mismo criterio que 29: "individual: 2 días,
# equipo: 0.5 días" no cabe en un solo número sin mentir sobre cuál es cuál.
BLOQUEO_MODALIDAD = f"""
    with duraciones as (
        select p.modalidad, extract(epoch from (b.resuelto_en - b.abierto_en)) / 86400.0 as dias
          from bloqueos b
          join proyectos p on p.id = b.proyecto_id
         where b.resuelto_en is not null
    ),
    resumen as (
        select modalidad, avg(dias) as promedio_dias, count(*) as bloqueos
          from duraciones
         group by modalidad
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '26_bloqueo_individual_compartido',
        'portafolio'::ambito_indicador,
        '{PORTAFOLIO_SENTINEL}'::uuid,
        date_trunc('week', current_date)::date,
        null,
        jsonb_object_agg(modalidad, jsonb_build_object('promedio_dias', round(promedio_dias, 2), 'bloqueos', bloqueos))
      from resumen
     having count(*) > 0
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

# Commits de alguien que NO es el encargado, en un proyecto marcado
# individual. Solo tiene sentido en individual: en equipo no hay un único
# "dueño" contra quien medir una intervención cruzada (CLAUDE.md: al vincular
# en Equipo, todas las personas activas quedan como líder por igual).
INTERVENCION_CRUZADA = """
    with cruzados as (
        select r.proyecto_id, c.persona_id, count(*) as commits
          from commits c
          join repositorios r on r.id = c.repo_id
          join proyectos p on p.id = r.proyecto_id
         where p.modalidad = 'individual'
           and c.persona_id is not null
           and c.persona_id <> p.encargado_id
         group by r.proyecto_id, c.persona_id
    )
    insert into indicador_snapshots (indicador_code, scope_type, scope_id, periodo, valor, detalle)
    select
        '28_intervencion_cruzada',
        'proyecto'::ambito_indicador,
        proyecto_id,
        date_trunc('week', current_date)::date,
        sum(commits),
        jsonb_build_object(
            'por_persona', jsonb_agg(jsonb_build_object('persona_id', persona_id, 'commits', commits) order by commits desc)
        )
      from cruzados
     group by proyecto_id
    on conflict (indicador_code, scope_type, scope_id, periodo)
    do update set valor = excluded.valor, detalle = excluded.detalle, calculado_en = now()
"""

CALCULADORES: list[tuple[str, str]] = [
    ("13_commits_proyecto", COMMITS_PROYECTO),
    ("29_avance_atribuido", AVANCE_ATRIBUIDO),
    ("01_throughput", THROUGHPUT),
    ("04_tiempo_primer_avance", TIEMPO_PRIMER_AVANCE),
    ("14_consistencia", CONSISTENCIA),
    ("17_bus_factor", BUS_FACTOR),
    ("20_estabilidad_equipo", ESTABILIDAD_EQUIPO),
    ("21_autosuficiencia", AUTOSUFICIENCIA),
    ("24_documentacion", DOCUMENTACION),
    ("22_ritmo_sostenido", RITMO_SOSTENIDO),
    ("23_autocomparacion", AUTOCOMPARACION),
    ("26_bloqueo_individual_compartido", BLOQUEO_MODALIDAD),
    ("28_intervencion_cruzada", INTERVENCION_CRUZADA),
]


def calcular(conexion: psycopg.Connection) -> dict[str, int | str]:
    """Corre cada calculador en su propia transacción: si uno falla, los demás
    igual escriben — un indicador roto no deja a todos sin snapshot."""
    resumen: dict[str, int | str] = {}
    for codigo, consulta in CALCULADORES:
        try:
            with conexion.transaction(), conexion.cursor() as cur:
                cur.execute(consulta)
                resumen[codigo] = cur.rowcount
        except psycopg.Error as error:
            resumen[codigo] = f"falló: {error}"
    return resumen


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Falta DATABASE_URL en el entorno.", file=sys.stderr)
        sys.exit(1)

    with psycopg.connect(url, autocommit=True) as conexion:
        resumen = calcular(conexion)

    for codigo, resultado in resumen.items():
        print(f"{codigo}: {resultado} snapshots" if isinstance(resultado, int) else f"{codigo}: {resultado}")


if __name__ == "__main__":
    main()
