#!/usr/bin/env python3
"""
Guardrail de SQL sobre la base remota de Supabase.

Se engancha como hook PreToolUse a execute_sql y apply_migration del MCP de
Supabase. Lee el evento por stdin, mira el SQL que se va a correr y decide.

Por qué existe: el MCP escribe directo contra el proyecto de producción, sin
entorno local intermedio. Los dos modos de romper RLS son silenciosos —
deshabilitarlo abre la base y no falla, y borrar una política la deja
denegando todo. Ninguno tira error: simplemente empiezan a devolver de más o
de menos.

Dos niveles a propósito:

  BLOQUEA  lo que nunca tiene una razón legítima en este proyecto.
  PREGUNTA lo que sí puede ser legítimo dentro de una migración — borrar una
           política para recrearla es normal, y bloquearlo duro haría que el
           guardrail estorbe hasta que alguien lo desactive. Un guardrail
           apagado no protege nada.

Decisión: db/policies/001_baseline.sql en el repo es la fuente de verdad de
las políticas. Si algo acá pide confirmación, la pregunta a hacerse es si el
cambio también va a quedar versionado ahí.
"""

import json
import re
import sys

# Nunca hay razón para correr esto contra la base de este proyecto.
BLOQUEAR = [
    (r"disable\s+row\s+level\s+security",
     "deshabilita RLS: la tabla queda legible por cualquiera y no produce ningún error"),
    (r"drop\s+schema",
     "elimina un schema completo (incluido 'private', donde viven las funciones de RLS)"),
    (r"drop\s+database",
     "elimina la base de datos"),
    (r"\btruncate\b",
     "vacía tablas sin pasar por las políticas ni dejar rastro recuperable"),
]

# Puede ser legítimo dentro de una migración, pero conviene mirarlo dos veces.
PREGUNTAR = [
    (r"drop\s+policy",
     "elimina una política RLS. Si no se recrea en la misma migración, la tabla queda denegando todo"),
    (r"drop\s+table",
     "elimina una tabla y sus datos"),
    (r"drop\s+function",
     "elimina una función; si es una de private.*, todas las políticas que la usan dejan de evaluar"),
    (r"drop\s+trigger",
     "elimina un trigger (p. ej. el que vincula personas con Auth)"),
    (r"delete\s+from\s+\w+\s*(;|$)",
     "DELETE sin WHERE: borra todas las filas de la tabla"),
]


def sin_comentarios(sql: str) -> str:
    """Quita comentarios para no bloquear por una palabra suelta en una nota.

    Sin esto, un `-- ojo: no correr drop policy acá` dispararía el guardrail y
    el hook se volvería ruido.
    """
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    sql = re.sub(r"--[^\n]*", " ", sql)
    return sql


def decidir(sql: str):
    """Devuelve (decision, motivo) o None si el SQL no toca nada sensible."""
    limpio = sin_comentarios(sql).lower()

    for patron, motivo in BLOQUEAR:
        if re.search(patron, limpio):
            return "deny", motivo
    for patron, motivo in PREGUNTAR:
        if re.search(patron, limpio):
            return "ask", motivo
    return None


def main():
    try:
        evento = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        # Un hook que se cae no debe frenar el trabajo: si no se entiende el
        # evento, se deja pasar y que decidan los permisos normales.
        sys.exit(0)

    entrada = evento.get("tool_input") or {}
    sql = entrada.get("query") or ""
    if not sql:
        sys.exit(0)

    veredicto = decidir(sql)
    if veredicto is None:
        sys.exit(0)

    decision, motivo = veredicto
    encabezado = (
        "Bloqueado por el guardrail de base de datos"
        if decision == "deny"
        else "Revisar antes de continuar"
    )

    salida = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": (
                f"{encabezado}: este SQL {motivo}. "
                f"Corre contra la base de produccion del CRM, sin entorno local intermedio. "
                f"Las politicas versionadas viven en db/policies/001_baseline.sql."
            ),
        }
    }
    # Windows: la consola es cp1252 y un caracter fuera de ese set rompe el
    # print. El mensaje va sin tildes y se fuerza UTF-8 por las dudas.
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(salida, ensure_ascii=True))
    sys.exit(0)


if __name__ == "__main__":
    main()
