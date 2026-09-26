"""Cliente del Clasificador de commits.

Clasifica en lote (más barato que un commit por llamada) y valida que la
respuesta tenga exactamente los shas que se le pidieron — ni de más ni de
menos. `area_inferida` NO sale de acá: eso lo calcula
`scripts/inferir_area.py`, determinista, sin tocar la API.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import anthropic

from .modelos import ClasificacionCommit, LoteClasificado

MODELO = "claude-opus-5"
MAX_LOTE = 50  # Forzar chunking explícito del que llama, no uno silencioso acá.

_SYSTEM_PROMPT = (Path(__file__).parent / "system_prompt.md").read_text(encoding="utf-8")


@dataclass
class CommitParaClasificar:
    sha: str
    mensaje: str
    archivos_tocados: list[str] | None = None


class RespuestaInconsistente(RuntimeError):
    """El modelo devolvió shas que no pidieron, o se dejó alguno sin clasificar."""


def _formatear_commit(commit: CommitParaClasificar, indice: int) -> str:
    lineas = [f"### Commit {indice}", f"sha: {commit.sha}", f"mensaje: {commit.mensaje or '(sin mensaje)'}"]
    if commit.archivos_tocados:
        vista = commit.archivos_tocados[:15]
        extra = f" (+{len(commit.archivos_tocados) - 15} más)" if len(commit.archivos_tocados) > 15 else ""
        lineas.append(f"archivos tocados ({len(commit.archivos_tocados)}): {', '.join(vista)}{extra}")
    return "\n".join(lineas)


def clasificar_commits(
    commits: list[CommitParaClasificar],
    *,
    cliente: anthropic.Anthropic | None = None,
) -> list[ClasificacionCommit]:
    if not commits:
        return []
    if len(commits) > MAX_LOTE:
        raise ValueError(f"Máximo {MAX_LOTE} commits por lote, llegaron {len(commits)}. Dividilo antes de llamar.")

    # .strip(): un secreto de GitHub Actions con un salto de línea de más al
    # pegarlo produce una cabecera HTTP ilegal (httpcore2.LocalProtocolError,
    # "Illegal header value b'***\n'") que httpx2 rechaza antes de llegar a la
    # red — se ve idéntico a un problema de conexión, encontrado el
    # 2026-09-26 con un traceback completo. .strip() no le hace nada a una
    # clave bien pegada, pero blinda contra esa clase de error entera.
    if cliente is None:
        clave = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        cliente = anthropic.Anthropic(api_key=clave) if clave else anthropic.Anthropic()

    cuerpo = "\n\n".join(_formatear_commit(commit, i) for i, commit in enumerate(commits, start=1))
    mensaje_usuario = (
        f"Clasificá estos {len(commits)} commits. Devolvé exactamente una clasificación por cada uno, "
        f"en cualquier orden, usando el sha tal como aparece acá:\n\n{cuerpo}"
    )

    respuesta = cliente.messages.parse(
        model=MODELO,
        max_tokens=4096,
        # Clasificar es juicio simple, no un problema que se beneficie de
        # pensar mucho — bajar el esfuerzo abarata sin perder calidad acá.
        output_config={"effort": "low"},
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": mensaje_usuario}],
        output_format=LoteClasificado,
    )

    resultado = respuesta.parsed_output.clasificaciones
    _validar_cobertura(commits, resultado)
    return resultado


def _validar_cobertura(pedidos: list[CommitParaClasificar], resultado: list[ClasificacionCommit]) -> None:
    esperados = {c.sha for c in pedidos}
    recibidos = {c.sha for c in resultado}

    inventados = recibidos - esperados
    faltantes = esperados - recibidos
    if inventados or faltantes:
        detalle = []
        if faltantes:
            detalle.append(f"sin clasificar: {sorted(faltantes)}")
        if inventados:
            detalle.append(f"shas que no se pidieron: {sorted(inventados)}")
        raise RespuestaInconsistente("; ".join(detalle))
