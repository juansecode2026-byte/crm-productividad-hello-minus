"""Cliente del Sugeridor de etapa.

Una llamada por repositorio, no en lote: esto se dispara cuando una persona
aprieta un botón y espera la respuesta en pantalla, a diferencia del
Clasificador de commits que procesa de a 50 en un cron nocturno.

`effort` va en "medium" y no en "low" como el Clasificador a propósito: decidir
la etapa de un proyecto entero es inferencia real sobre varias señales que se
contradicen entre sí (estructura completa pero repo nuevo, tests presentes pero
sin despliegue), no una categorización de una frase. Sigue siendo barato
porque se ejecuta un puñado de veces en la vida del sistema.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import anthropic

from .modelos import EtapaSugerida

MODELO = "claude-opus-5"

_SYSTEM_PROMPT = (Path(__file__).parent / "system_prompt.md").read_text(encoding="utf-8")


@dataclass
class RepoParaEvaluar:
    owner: str
    repo: str
    carpetas: list[str] = field(default_factory=list)
    archivos_raiz: list[str] = field(default_factory=list)
    archivos_clave: list[str] = field(default_factory=list)
    total_archivos: int = 0
    estructura_disponible: bool = True
    commits_total: int = 0
    commits_truncado: bool = False
    commits_semana: int = 0
    primer_commit: str | None = None
    ultimo_commit: str | None = None
    prs_abiertos: int = 0
    colaboradores: list[str] = field(default_factory=list)


def _describir(repo: RepoParaEvaluar) -> str:
    lineas = [f"Repositorio: {repo.owner}/{repo.repo}", ""]

    if not repo.estructura_disponible:
        lineas.append(
            "ESTRUCTURA: no se pudo leer (repositorio privado o sin acceso). "
            "Decidí solo con la actividad de commits de abajo, y dejalo dicho en las dudas."
        )
    else:
        lineas.append(f"Archivos totales: {repo.total_archivos}")
        lineas.append(f"Archivos en la raíz: {', '.join(repo.archivos_raiz) or '(ninguno)'}")
        lineas.append(f"Carpetas (hasta 2 niveles): {', '.join(repo.carpetas) or '(ninguna)'}")
        lineas.append(
            "Archivos que delatan madurez (configuración, pruebas, despliegue, agentes), "
            f"a cualquier profundidad: {', '.join(repo.archivos_clave) or '(ninguno encontrado)'}"
        )

    lineas.append("")
    total = f"{repo.commits_total}{'+ (truncado)' if repo.commits_truncado else ''}"
    lineas.append(f"Commits leídos: {total}")
    lineas.append(f"Commits en los últimos 7 días: {repo.commits_semana}")
    lineas.append(f"Primer commit: {repo.primer_commit or 'no disponible'}")
    lineas.append(f"Último commit: {repo.ultimo_commit or 'no disponible'}")
    lineas.append(f"Pull requests abiertos: {repo.prs_abiertos}")
    lineas.append(f"Personas que commitearon: {', '.join(repo.colaboradores) or '(ninguna identificada)'}")

    return "\n".join(lineas)


def sugerir_etapa(
    repo: RepoParaEvaluar,
    *,
    cliente: anthropic.Anthropic | None = None,
) -> EtapaSugerida:
    cliente = cliente or anthropic.Anthropic()

    respuesta = cliente.messages.parse(
        model=MODELO,
        max_tokens=2048,
        output_config={"effort": "medium"},
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "Decidí en qué etapa del ciclo de vida está este proyecto, "
                    f"con lo que se ve desde afuera:\n\n{_describir(repo)}"
                ),
            }
        ],
        output_format=EtapaSugerida,
    )

    return respuesta.parsed_output
