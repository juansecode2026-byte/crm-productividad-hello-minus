"""Punto de entrada del Sugeridor de etapa — se invoca como proceso hijo.

A diferencia del Clasificador de commits, que lo dispara un cron y escribe él
mismo a la base, este agente **no toca la base**: recibe JSON por stdin,
devuelve JSON por stdout, y quien lo llamó (la API en Node) decide qué hacer
con eso. Es un agente sin efectos secundarios, a propósito — lo que sugiere
todavía tiene que pasar por una persona.

Ese contrato stdin/stdout es el puente entre los dos runtimes del backend:
Express corre en Node y los agentes son Python (DECISIONES.md [D1]). Es el
primer caso del proyecto en que Node llama a un agente en caliente, mientras
alguien espera en pantalla, y no por horario.

Uso:
    echo '{"owner":"...","repo":"..."}' | python -m sugeridor_etapa.ejecutar

Salida:
    {"etapa": 6, "evidencia": "...", "dudas": null}
    o, si algo falla:
    {"error": "mensaje para mostrar"}
"""

from __future__ import annotations

import json
import sys

from .cliente import RepoParaEvaluar, sugerir_etapa


def main() -> None:
    # Windows abre stdout en cp1252 y la salida va llena de acentos: sin esto,
    # "días" llega a Node como "d�as". Se fuerza acá y no en el entorno para
    # que el contrato del proceso hijo no dependa de cómo lo invoquen.
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

    repo = RepoParaEvaluar(
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
    )

    try:
        sugerencia = sugerir_etapa(repo)
    except Exception as error:  # noqa: BLE001 — cualquier fallo vuelve como JSON, no como traceback
        print(json.dumps({"error": f"El agente no pudo responder: {error}"}), flush=True)
        sys.exit(1)

    print(sugerencia.model_dump_json(), flush=True)


if __name__ == "__main__":
    main()
