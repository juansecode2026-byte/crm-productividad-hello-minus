"""Infiere el área de un commit a partir de las rutas que tocó.

Determinista a propósito (regla de STACK.md: el cálculo vive en scripts, el
agente solo emite juicio con evidencia). El Clasificador de commits llama a
esto para `area_inferida`; para `tipo_inferido` sí hace falta al LLM, porque
"feature" vs. "fix" vs. "refactor" depende de leer el mensaje.

Las reglas son las de ESTE proyecto (docs/paso-a-paso-vincular-proyectos-hello-minus.md,
paso 06, deja el ejemplo "/db -> Backend/Datos" pero no una tabla completa —
había que definirla). Cada proyecto de Hello Minus tiene su propia estructura
de carpetas, así que las reglas se pasan por parámetro; estas son solo el
valor por defecto para este repo.
"""

from __future__ import annotations

import re
from collections import Counter

# Orden de especificidad: más específico primero, porque el primer patrón que
# matchea una ruta es el que cuenta — "backend/agent/" tiene que ganarle a
# un eventual "backend/" genérico si algún día se agrega uno.
REGLAS_POR_DEFECTO: list[tuple[str, str]] = [
    (r"^backend/api/", "Backend — API"),
    (r"^backend/functions/", "Backend — Funciones"),
    (r"^backend/agent/", "Agente"),
    (r"^frontend/", "Frontend"),
    (r"^db/", "Base de datos"),
    (r"^paquetes/", "Paquetes"),
    (r"^scripts/", "Scripts"),
    (r"^agentes-sdk/", "Agentes SDK"),
    (r"^docs/", "Documentación"),
    (r"^\.claude/", "Configuración de Claude Code"),
]

AREA_SIN_REGLA = "Raíz / configuración"


def _area_de_ruta(ruta: str, reglas: list[tuple[str, str]]) -> str:
    for patron, area in reglas:
        if re.match(patron, ruta):
            return area
    return AREA_SIN_REGLA


def inferir_area(
    archivos_tocados: list[str],
    reglas: list[tuple[str, str]] | None = None,
) -> str | None:
    """El área que tocó más archivos en el commit. `None` si no vino ninguno.

    Un commit que toca 8 archivos de frontend y 1 de docs es "Frontend", no
    "Mixto" — mixto solo cuando hay un empate real entre dos áreas distintas.
    """
    if not archivos_tocados:
        return None

    reglas = reglas if reglas is not None else REGLAS_POR_DEFECTO
    conteo = Counter(_area_de_ruta(ruta, reglas) for ruta in archivos_tocados)

    maximo = max(conteo.values())
    ganadoras = [area for area, n in conteo.items() if n == maximo]

    if len(ganadoras) == 1:
        return ganadoras[0]

    # Empate: mismo criterio que "más específico primero" en las reglas, para
    # que el resultado sea reproducible y no dependa del orden de iteración
    # de un dict.
    orden = {area: i for i, (_, area) in enumerate(reglas)}
    orden[AREA_SIN_REGLA] = len(reglas)
    return min(ganadoras, key=lambda area: orden.get(area, len(reglas)))
