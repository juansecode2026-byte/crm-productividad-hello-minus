"""Cliente del Verificador de checklist.

Una llamada por escaneo, con todos los ítems juntos y no de a uno: el agente
tiene que poder ver el checklist completo para no contradecirse entre etapas
(dar por hecha la etapa 7 mientras deja la 4 sin detectar, por ejemplo).

`effort` en "medium", igual que el Sugeridor de etapa: son señales que se
contradicen entre sí y hay que ponderarlas, no una frase que categorizar.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import anthropic

from .modelos import ChecklistVerificado, VeredictoItem

MODELO = "claude-opus-5"
MAX_ITEMS = 80  # Un checklist más largo que esto señala una plantilla mal armada.

_SYSTEM_PROMPT = (Path(__file__).parent / "system_prompt.md").read_text(encoding="utf-8")


@dataclass
class ItemParaVerificar:
    id: str
    etapa: int
    texto: str


@dataclass
class RepoParaVerificar:
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
    claude_md: str | None = None


class RespuestaInconsistente(RuntimeError):
    """El modelo devolvió ids que no se pidieron, o se dejó alguno sin juzgar."""


@dataclass
class UsoTokens:
    """Piloto del experimento de costo (2026-09-25): tokens de entrada y
    salida de una corrida, tal como vienen en la respuesta del SDK —
    ningún cálculo propio, ninguna llamada extra. Separados porque Opus
    cobra distinto por cada uno; sumarlos en un solo número perdería esa
    diferencia antes de que llegue a la base."""

    entrada: int
    salida: int


@dataclass
class ResultadoVerificacion:
    veredictos: list[VeredictoItem]
    uso: UsoTokens


def _describir_repo(repo: RepoParaVerificar) -> str:
    lineas = [f"## Repositorio: {repo.owner}/{repo.repo}", ""]

    if not repo.estructura_disponible:
        lineas.append(
            "ESTRUCTURA: no se pudo leer (repositorio privado o sin acceso). "
            "Con esto solo, casi ningún ítem se puede dar por hecho."
        )
    else:
        lineas.append(f"Archivos totales: {repo.total_archivos}")
        lineas.append(f"Archivos en la raíz: {', '.join(repo.archivos_raiz) or '(ninguno)'}")
        lineas.append(f"Carpetas (hasta 2 niveles): {', '.join(repo.carpetas) or '(ninguna)'}")
        lineas.append(
            "Archivos que delatan madurez (configuración, pruebas, despliegue, agentes): "
            f"{', '.join(repo.archivos_clave) or '(ninguno encontrado)'}"
        )

    lineas.append("")
    total = f"{repo.commits_total}{'+ (truncado)' if repo.commits_truncado else ''}"
    lineas.append(f"Commits leídos: {total}")
    lineas.append(f"Commits en los últimos 7 días: {repo.commits_semana}")
    lineas.append(f"Primer commit: {repo.primer_commit or 'no disponible'}")
    lineas.append(f"Último commit: {repo.ultimo_commit or 'no disponible'}")
    lineas.append(f"Pull requests abiertos: {repo.prs_abiertos}")
    lineas.append(f"Personas que commitearon: {', '.join(repo.colaboradores) or '(ninguna identificada)'}")

    if repo.claude_md:
        lineas.append("")
        lineas.append("## CLAUDE.md del repositorio")
        lineas.append(
            "Lo escribió el equipo que construye ese proyecto. Es la señal más fuerte que hay "
            "acá, con los cuidados del prompt (puede estar desactualizado, puede hablar de "
            "planes en vez de hechos):"
        )
        lineas.append("")
        lineas.append(repo.claude_md)
    else:
        lineas.append("")
        lineas.append("## CLAUDE.md del repositorio: no tiene, o no se pudo leer.")

    return "\n".join(lineas)


def _describir_items(items: list[ItemParaVerificar]) -> str:
    por_etapa: dict[int, list[ItemParaVerificar]] = {}
    for item in items:
        por_etapa.setdefault(item.etapa, []).append(item)

    lineas = ["## Ítems a verificar", ""]
    for etapa in sorted(por_etapa):
        lineas.append(f"### Etapa {etapa}")
        for item in por_etapa[etapa]:
            lineas.append(f"- id `{item.id}`: {item.texto}")
        lineas.append("")
    return "\n".join(lineas)


def verificar_checklist(
    repo: RepoParaVerificar,
    items: list[ItemParaVerificar],
    *,
    cliente: anthropic.Anthropic | None = None,
) -> ResultadoVerificacion:
    if not items:
        return ResultadoVerificacion(veredictos=[], uso=UsoTokens(entrada=0, salida=0))
    if len(items) > MAX_ITEMS:
        raise ValueError(f"Máximo {MAX_ITEMS} ítems por escaneo, llegaron {len(items)}.")

    cliente = cliente or anthropic.Anthropic()

    respuesta = cliente.messages.parse(
        model=MODELO,
        max_tokens=8192,
        output_config={"effort": "medium"},
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Decidí, para cada uno de estos {len(items)} ítems, en cuál de los tres "
                    "estados está según lo que se ve del repositorio: sin_empezar, en_proceso "
                    "o hecho.\n\n"
                    f"{_describir_repo(repo)}\n\n{_describir_items(items)}"
                ),
            }
        ],
        output_format=ChecklistVerificado,
    )

    veredictos = respuesta.parsed_output.veredictos
    _validar_cobertura(items, veredictos)

    # Piloto del experimento de costo: nada de esto le cuesta una llamada
    # extra — `usage` ya viene adentro de la misma respuesta que se pidió.
    uso = UsoTokens(
        entrada=respuesta.usage.input_tokens,
        salida=respuesta.usage.output_tokens,
    )
    return ResultadoVerificacion(veredictos=veredictos, uso=uso)


def _validar_cobertura(pedidos: list[ItemParaVerificar], resultado: list[VeredictoItem]) -> None:
    esperados = {item.id for item in pedidos}
    recibidos = {v.id for v in resultado}

    inventados = recibidos - esperados
    faltantes = esperados - recibidos
    if inventados or faltantes:
        detalle = []
        if faltantes:
            detalle.append(f"sin juzgar: {sorted(faltantes)}")
        if inventados:
            detalle.append(f"ids que no se pidieron: {sorted(inventados)}")
        raise RespuestaInconsistente("; ".join(detalle))
