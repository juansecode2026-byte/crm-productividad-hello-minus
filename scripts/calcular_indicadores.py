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

Calculadores construidos hoy (los demás del catálogo, todavía no):

  13_commits_proyecto  — el único con datos reales al 2026-09-23 (3 commits).
                         Sirve para probar el motor contra algo que existe.
  29_avance_atribuido  — alimenta "Aporte por integrante" en Proyecto.tsx.
                         Depende de tareas_semanales.completado (migración 014).

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

CALCULADORES: list[tuple[str, str]] = [
    ("13_commits_proyecto", COMMITS_PROYECTO),
    ("29_avance_atribuido", AVANCE_ATRIBUIDO),
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
