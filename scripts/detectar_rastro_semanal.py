"""Fase 03 — Detector de rastro semanal (agente 04 del catálogo, con el
Verificador de evidencia standalone ya fusionado adentro — agente 13, no se
construye aparte).

Por cada tarea_semanal, busca si de verdad hubo commits, pull requests o
sesiones de Claude Code en las áreas que la persona declaró, dentro de esa
semana y en ese proyecto. Lo que encuentra queda en tarea_evidencia. Es una
consulta cruzada entre tablas, no un juicio — de ahí que sea un script y no
un agente, aunque el nombre diga "Detector".

Aritmética/consultas puras, sin llamadas a Claude. Vive en scripts/ por la
misma regla que el resto de esta fase.

Una tarea sin ninguna evidencia encontrada simplemente no genera filas en
tarea_evidencia — la ausencia de evidencia es en sí misma la señal (alguien
declaró un área en la que no dejó rastro), no un error de la corrida.

Uso:
    DATABASE_URL=postgresql://... python detectar_rastro_semanal.py
"""

from __future__ import annotations

import os
import sys

import psycopg

# Las tres fuentes de fuente_evidencia. Cada una es su propio INSERT porque
# el join hacia la evidencia es distinto por fuente (commits y pull_requests
# pasan por repositorios; sesiones_claude_code ya trae proyecto_id directo).
# Separarlas también aísla el fallo: si una fuente tiene un problema, las
# otras dos igual se procesan.
DETECTAR_COMMITS = """
    insert into tarea_evidencia (tarea_id, area, fuente, referencia)
    select t.id, a.area, 'commit'::fuente_evidencia, c.sha
      from tareas_semanales t
      cross join lateral unnest(t.areas) as a(area)
      join repositorios r on r.proyecto_id = t.proyecto_id
      join commits c
        on c.repo_id = r.id
       and c.persona_id = t.persona_id
       and c.area_inferida = a.area
       and c.fecha::date between t.semana_inicio and t.semana_fin
    on conflict (tarea_id, area, fuente, referencia) do nothing
"""

DETECTAR_PULL_REQUESTS = """
    insert into tarea_evidencia (tarea_id, area, fuente, referencia)
    select t.id, a.area, 'pull_request'::fuente_evidencia, p.numero::text
      from tareas_semanales t
      cross join lateral unnest(t.areas) as a(area)
      join repositorios r on r.proyecto_id = t.proyecto_id
      join pull_requests p
        on p.repo_id = r.id
       and p.persona_id = t.persona_id
       and p.area_inferida = a.area
       and p.abierto_en::date between t.semana_inicio and t.semana_fin
    on conflict (tarea_id, area, fuente, referencia) do nothing
"""

DETECTAR_SESIONES = """
    insert into tarea_evidencia (tarea_id, area, fuente, referencia)
    select t.id, a.area, 'sesion_claude_code'::fuente_evidencia, s.session_id
      from tareas_semanales t
      cross join lateral unnest(t.areas) as a(area)
      join sesiones_claude_code s
        on s.proyecto_id = t.proyecto_id
       and s.persona_id = t.persona_id
       and s.area_inferida = a.area
       and s.inicio::date between t.semana_inicio and t.semana_fin
    on conflict (tarea_id, area, fuente, referencia) do nothing
"""


def detectar(conexion: psycopg.Connection) -> dict[str, int]:
    """Corre las tres detecciones. Devuelve cuántas filas nuevas de evidencia
    dejó cada fuente (0 no es un error: puede que no haya nada nuevo)."""
    resumen: dict[str, int] = {}
    for nombre, consulta in (
        ("commits", DETECTAR_COMMITS),
        ("pull_requests", DETECTAR_PULL_REQUESTS),
        ("sesiones_claude_code", DETECTAR_SESIONES),
    ):
        with conexion.cursor() as cur:
            cur.execute(consulta)
            resumen[nombre] = cur.rowcount
        conexion.commit()
    return resumen


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Falta DATABASE_URL en el entorno.", file=sys.stderr)
        sys.exit(1)

    with psycopg.connect(url) as conexion:
        resumen = detectar(conexion)

    total = sum(resumen.values())
    detalle = " · ".join(f"{fuente}: {n}" for fuente, n in resumen.items())
    print(f"tarea_evidencia: {total} filas nuevas ({detalle})")


if __name__ == "__main__":
    main()
