"""Orquestador del Clasificador de commits — la parte de la cadena nocturna
que corre después del Sincronizador (canal de GitHub) y antes del Motor de
indicadores (CLAUDE.md: "si el motor corre antes que el clasificador, calcula
sobre commits sin etiquetar").

Vive en backend/agent/ y no en scripts/ a propósito, aunque orqueste trabajo
mayormente mecánico: llama a clasificar_commits(), que llama a Claude — la
regla del laboratorio es que si el código llama a Claude en algún punto, es
agente, y no se mezcla con lo determinístico de scripts/. area_inferida en
cambio SÍ es puramente determinístico (inferir_area, en scripts/): el límite
está en la llamada a la API, no en el archivo.

Uso:
    DATABASE_URL=postgresql://... python -m clasificador_commits.ejecutar
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg

from .cliente import MAX_LOTE, CommitParaClasificar, clasificar_commits

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from inferir_area import inferir_area  # noqa: E402

CONSULTA_PENDIENTES = """
    select id, sha, mensaje, archivos_tocados
      from commits
     where tipo_inferido is null
     order by fecha
     limit %s
"""

ACTUALIZAR = """
    update commits
       set tipo_inferido = %s,
           area_inferida = %s
     where id = %s
"""


def _lotes(items: list, tamano: int):
    for i in range(0, len(items), tamano):
        yield items[i : i + tamano]


def clasificar_pendientes(conexion: psycopg.Connection, *, limite: int = 500) -> dict[str, int]:
    """Clasifica hasta `limite` commits sin tipo_inferido. Devuelve un resumen.

    Un lote que falla (la API cae, o `RespuestaInconsistente`) no aborta la
    corrida entera: se cuenta como fallido y se sigue con el próximo — así un
    problema puntual no deja sin clasificar commits que sí se podían procesar.
    """
    resumen = {"clasificados": 0, "lotes_fallidos": 0, "sin_area": 0}

    with conexion.cursor() as cur:
        cur.execute(CONSULTA_PENDIENTES, (limite,))
        filas = cur.fetchall()

    if not filas:
        return resumen

    for lote in _lotes(filas, MAX_LOTE):
        # Se pasa el id de la fila como "sha" del clasificador, no el sha de
        # git: el sha de git solo es único POR REPO (constraint
        # sha_unico_por_repo), y acá hace falta una clave única en todo el
        # lote para poder actualizar por id después.
        commits = [
            CommitParaClasificar(sha=str(fila_id), mensaje=mensaje or "", archivos_tocados=list(archivos or []))
            for fila_id, _sha_git, mensaje, archivos in lote
        ]
        archivos_por_id = {str(fila_id): archivos for fila_id, _sha_git, _mensaje, archivos in lote}

        try:
            clasificaciones = clasificar_commits(commits)
        except Exception as error:  # noqa: BLE001 — un lote no tumba la corrida
            print(f"  [!] lote de {len(lote)} commits falló: {error}", file=sys.stderr)
            resumen["lotes_fallidos"] += 1
            continue

        with conexion.cursor() as cur:
            for clasificacion in clasificaciones:
                area = inferir_area(archivos_por_id.get(clasificacion.sha) or [])
                if area is None:
                    resumen["sin_area"] += 1
                cur.execute(ACTUALIZAR, (clasificacion.tipo, area, clasificacion.sha))
        conexion.commit()
        resumen["clasificados"] += len(clasificaciones)

    return resumen


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Falta DATABASE_URL en el entorno.", file=sys.stderr)
        sys.exit(1)

    with psycopg.connect(url) as conexion:
        resumen = clasificar_pendientes(conexion)

    print(
        f"Clasificados: {resumen['clasificados']} · "
        f"lotes fallidos: {resumen['lotes_fallidos']} · "
        f"sin área inferida: {resumen['sin_area']}"
    )
    sys.exit(1 if resumen["lotes_fallidos"] > 0 else 0)


if __name__ == "__main__":
    main()
