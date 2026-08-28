#!/usr/bin/env python3
"""
Verifica el estado de la base después de una migración.

    python scripts/verificar_migracion.py

Los dos modos de romper RLS son silenciosos, y esa es toda la razón de este
script:

  · Tabla con RLS habilitado y SIN política  -> Postgres deniega todo. La
    consulta devuelve vacío, sin error. Se busca el bug en el frontend
    durante medio día antes de mirar las políticas.

  · Tabla SIN RLS -> devuelve de más. Nadie se entera hasta que alguien lee
    datos que no debía.

Ninguno de los dos levanta una excepción. Por eso hay que ir a buscarlos.

Corre dos bloques:

  1. LOCAL  — siempre. Verifica que los archivos SQL que db/README.md declara
     como orden de ejecución existan de verdad.
  2. REMOTO — solo si hay DATABASE_URL en el entorno. Compara pg_tables
     contra pg_policies en la base real.

Sale con código 1 si encuentra algo, para poder engancharlo a un pre-commit o
a un script de npm sin más envoltorio.

DATABASE_URL sale de Supabase -> Project Settings -> Database -> Connection
string (URI). Conviene un rol de solo lectura, no el service_role: este
script no necesita escribir nada.
"""

import os
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
README = RAIZ / "db" / "README.md"

# Tablas cuya escritura es exclusiva del sistema: se leen desde la app, pero
# la ingesta entra por service_role. Si alguna aparece con una política de
# escritura para 'authenticated', es un error de permisos, no una mejora.
SOLO_SISTEMA = {
    "commits",
    "pull_requests",
    "sesiones_claude_code",
    "trazas_agente",
    "indicador_snapshots",
    "tarea_evidencia",
    "auditoria_log",
}


def problema(msg):
    print(f"  [X] {msg}")


def ok(msg):
    print(f"  [ok] {msg}")


# ---------------------------------------------------------------------------
# 1. Chequeos locales
# ---------------------------------------------------------------------------

def verificar_archivos():
    """Los archivos que el README declara como orden de ejecución, ¿existen?"""
    print("\nOrden de ejecución declarado en db/README.md")

    if not README.exists():
        problema(f"no se encuentra {README.relative_to(RAIZ)}")
        return 1

    # Solo las filas de la tabla de orden (empiezan con "|"). El README
    # menciona archivos en prosa también, y tomarlos a todos produce falsos
    # positivos: la misma migración aparece como `migrations/002_...sql` en la
    # tabla y como `002_...sql` en una nota, y la segunda no es una ruta.
    rutas = []
    for linea in README.read_text(encoding="utf-8").splitlines():
        if not linea.lstrip().startswith("|"):
            continue
        rutas += re.findall(r"`([^`]+\.sql)`", linea)

    # Las que llevan comodín describen una familia, no un archivo concreto.
    rutas = [r for r in rutas if "*" not in r]

    if not rutas:
        problema("el README no declara ningún archivo .sql concreto")
        return 1

    fallas = 0
    for ruta in dict.fromkeys(rutas):  # sin duplicados, conservando el orden
        destino = RAIZ / "db" / ruta
        if destino.exists():
            ok(f"db/{ruta}")
        else:
            problema(f"db/{ruta} — declarado en el README pero no existe")
            fallas += 1
    return fallas


# ---------------------------------------------------------------------------
# 2. Chequeos contra la base
# ---------------------------------------------------------------------------

CONSULTA = """
select
  t.tablename,
  c.relrowsecurity                              as rls_activo,
  count(p.policyname)                           as politicas,
  count(*) filter (where p.cmd <> 'SELECT')     as politicas_escritura
from pg_tables t
join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
left join pg_policies p on p.schemaname = 'public' and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename, c.relrowsecurity
order by t.tablename;
"""


def verificar_base(url):
    print("\nEstado de RLS en la base")

    try:
        import psycopg
        conectar = lambda: psycopg.connect(url)
    except ImportError:
        try:
            import psycopg2
            conectar = lambda: psycopg2.connect(url)
        except ImportError:
            problema("falta el driver de Postgres. Instalar con:")
            print("        pip install -r scripts/requirements.txt")
            return 1

    try:
        with conectar() as conexion:
            with conexion.cursor() as cur:
                cur.execute(CONSULTA)
                filas = cur.fetchall()
    except Exception as e:  # noqa: BLE001 — cualquier fallo de conexión sirve igual
        problema(f"no se pudo consultar la base: {e}")
        return 1

    fallas = 0
    sin_rls, mudas, escritura_indebida = [], [], []

    for tabla, rls_activo, politicas, politicas_escritura in filas:
        if not rls_activo:
            sin_rls.append(tabla)
        elif politicas == 0:
            mudas.append(tabla)
        if tabla in SOLO_SISTEMA and politicas_escritura > 0:
            escritura_indebida.append(tabla)

    if sin_rls:
        fallas += len(sin_rls)
        problema(f"{len(sin_rls)} tabla(s) SIN RLS — devuelven de más, sin avisar:")
        for t in sin_rls:
            print(f"        {t}")

    if mudas:
        fallas += len(mudas)
        problema(f"{len(mudas)} tabla(s) con RLS y SIN política — deniegan todo en silencio:")
        for t in mudas:
            print(f"        {t}")

    if escritura_indebida:
        fallas += len(escritura_indebida)
        problema(
            f"{len(escritura_indebida)} tabla(s) de solo-sistema con política de escritura "
            "para usuarios — se podría fabricar actividad:"
        )
        for t in escritura_indebida:
            print(f"        {t}")

    if not fallas:
        ok(f"{len(filas)} tablas, todas con RLS y al menos una política")

    return fallas


def main():
    print("Verificación de migración — CRM de Productividad Hello Minus")

    fallas = verificar_archivos()

    url = os.environ.get("DATABASE_URL")
    if url:
        fallas += verificar_base(url)
    else:
        print("\nEstado de RLS en la base")
        print("  [--] sin DATABASE_URL en el entorno; se omite. Ver el encabezado")
        print("       de este archivo para saber de dónde sacarla.")

    print()
    if fallas:
        print(f"{fallas} problema(s). Ver arriba.")
        sys.exit(1)
    print("Sin problemas.")


if __name__ == "__main__":
    main()
