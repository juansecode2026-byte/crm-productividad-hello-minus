"""Fase 04 — Registro de tiempo, 100% inferido: traduce sesiones_claude_code
en filas de registro_tiempo. No hay captura manual (DECISIONES.md, pregunta
abierta 1) — registro_tiempo es de solo-sistema, igual que commits o
sesiones_claude_code (db/migrations/009_registro_tiempo_inferido.sql).

Aritmética pura, sin llamadas a Claude — por eso vive en scripts/ y no en
backend/agent/ (regla del laboratorio: lo que llama a Claude es agente, esto
no llama a nada).

Reglas de traducción:
  - Un día = un bucket. Se agrupa por la fecha de `inicio` de la sesión — si
    una sesión cruza medianoche, todo su tiempo activo cae en el día en que
    empezó. Es la misma filosofía que "día calendario con commits" del
    Detector de rastro semanal (Fase 03): un límite simple y consistente, no
    el más preciso al segundo.
  - `area` sale de `sesiones_claude_code.area_inferida`. Sin área (sesión sin
    archivos claros) cae en el bucket 'sin_clasificar', nunca NULL — así el
    constraint único (persona_id, proyecto_id, fecha, area) funciona sin
    casos especiales.
  - `tipo` (facturable/interno) se decide por el proyecto: facturable si
    tiene cliente_id, interno si no (este mismo CRM, por ejemplo). No hay
    señal en sesiones_claude_code para decidirlo de otra forma.
  - Sesiones sin persona_id o sin proyecto_id resuelto (huérfanas, igual que
    un commit sin autor conocido) no se pueden facturar a nadie — se ignoran.
  - Cada corrida RECALCULA el total del día desde cero y hace upsert. Como
    una sesión puede seguir creciendo (registrar_sesion_claude_code hace
    merge por session_id), no hay forma de "sumar solo lo nuevo" sin volver a
    sumar todo — así que se abraza eso: idempotente por diseño, nunca duplica.

Uso:
    DATABASE_URL=postgresql://... python derivar_registro_tiempo.py
"""

from __future__ import annotations

import os
import sys

import psycopg

# El check (horas > 0 and horas <= 24) de la tabla es la única razón del
# `least(...)`: en teoría un día normal de trabajo nunca debería acercarse a
# 24 horas activas, así que si esto se activa señala un dato raro, no un caso
# esperado — no vale la pena que tumbe la corrida por eso.
DERIVAR = """
    insert into registro_tiempo (persona_id, proyecto_id, area, fecha, horas, tipo, origen)
    select
        s.persona_id,
        s.proyecto_id,
        coalesce(s.area_inferida, 'sin_clasificar')                       as area,
        (s.inicio::date)                                                  as fecha,
        least(sum(extract(epoch from s.duracion_activa) / 3600.0)::numeric(5,2), 24.00) as horas,
        case when p.cliente_id is not null then 'facturable' else 'interno' end::tipo_tiempo as tipo,
        'inferido'::origen_tiempo                                         as origen
      from sesiones_claude_code s
      join proyectos p on p.id = s.proyecto_id
     where s.persona_id is not null
       and s.duracion_activa is not null
     group by s.persona_id, s.proyecto_id, coalesce(s.area_inferida, 'sin_clasificar'), s.inicio::date, p.cliente_id
    on conflict (persona_id, proyecto_id, fecha, area)
    do update set horas = excluded.horas, tipo = excluded.tipo
"""


def derivar(conexion: psycopg.Connection) -> int:
    """Recalcula registro_tiempo completo desde sesiones_claude_code. Devuelve
    cuántas filas quedaron insertadas o actualizadas en esta corrida."""
    with conexion.cursor() as cur:
        cur.execute(DERIVAR)
        filas = cur.rowcount
    conexion.commit()
    return filas


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Falta DATABASE_URL en el entorno.", file=sys.stderr)
        sys.exit(1)

    with psycopg.connect(url) as conexion:
        filas = derivar(conexion)

    print(f"registro_tiempo: {filas} filas insertadas o actualizadas.")


if __name__ == "__main__":
    main()
