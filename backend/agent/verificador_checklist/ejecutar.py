"""Punto de entrada del Verificador de checklist — proceso hijo, igual que el
Sugeridor de etapa.

No toca la base: recibe JSON por stdin (el repo + los ítems), devuelve JSON por
stdout (un veredicto por ítem). Quien lo llamó —la API en Node— decide qué
escribir, y lo que escribe es `detectado_en` y `evidencia`, nunca `completado`.

Uso:
    echo '{"owner":"...","repo":"...","items":[...]}' | python -m verificador_checklist.ejecutar

Salida:
    {"veredictos": [{"id": "...", "detectado": true, "evidencia": "..."}, ...]}
    o, si algo falla:
    {"error": "mensaje para mostrar"}
"""

from __future__ import annotations

import json
import sys

from .cliente import ItemParaVerificar, RepoParaVerificar, verificar_checklist


def main() -> None:
    # Windows abre stdout en cp1252 y la evidencia viene llena de acentos.
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdin.reconfigure(encoding="utf-8")

    try:
        entrada = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        print(json.dumps({"error": f"Entrada inválida: {error}"}), flush=True)
        sys.exit(1)

    if not entrada.get("owner") or not entrada.get("repo"):
        print(json.dumps({"error": "Faltan owner y repo"}), flush=True)
        sys.exit(1)

    items_crudos = entrada.get("items") or []
    if not items_crudos:
        print(json.dumps({"veredictos": []}), flush=True)
        return

    repo = RepoParaVerificar(
        owner=entrada["owner"],
        repo=entrada["repo"],
        carpetas=entrada.get("carpetas") or [],
        archivos_raiz=entrada.get("archivos_raiz") or [],
        archivos_clave=entrada.get("archivos_clave") or [],
        total_archivos=entrada.get("total_archivos") or 0,
        estructura_disponible=entrada.get("estructura_disponible", True),
        commits_total=entrada.get("commits_total") or 0,
        commits_truncado=entrada.get("commits_truncado", False),
        commits_semana=entrada.get("commits_semana") or 0,
        primer_commit=entrada.get("primer_commit"),
        ultimo_commit=entrada.get("ultimo_commit"),
        prs_abiertos=entrada.get("prs_abiertos") or 0,
        colaboradores=entrada.get("colaboradores") or [],
        claude_md=entrada.get("claude_md"),
    )

    items = [
        ItemParaVerificar(id=str(i["id"]), etapa=int(i["etapa"]), texto=str(i["texto"]))
        for i in items_crudos
    ]

    try:
        veredictos = verificar_checklist(repo, items)
    except Exception as error:  # noqa: BLE001 — cualquier fallo vuelve como JSON, no como traceback
        print(json.dumps({"error": f"El agente no pudo responder: {error}"}), flush=True)
        sys.exit(1)

    salida = {"veredictos": [v.model_dump() for v in veredictos]}
    print(json.dumps(salida, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
