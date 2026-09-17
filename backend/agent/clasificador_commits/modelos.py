"""Esquema de salida del Clasificador de commits.

Desviación consciente del molde de `estructura.yaml` (que preveía un
`output_schema.json` suelto): con `client.messages.parse()` el modelo de
Pydantic ES el esquema — se valida con tipos reales, no con JSON Schema a
mano que puede desincronizarse del código que lo consume. Ver CLAUDE.md.

`Tipo` es un vocabulario cerrado a propósito: seis categorías que ya cubren
el estilo de commits de este propio repo (ver system_prompt.md para el porqué
de cada una). Un séptimo tipo que aparezca seguido es señal de que falta una
categoría, no de que "otro" está fallando.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Tipo = Literal["funcionalidad", "arreglo", "refactor", "documentacion", "configuracion", "otro"]


class ClasificacionCommit(BaseModel):
    sha: str = Field(description="El sha exacto del commit, tal como se lo pasaron. No se inventa ni se acorta.")
    tipo: Tipo
    evidencia: str = Field(
        description="Una frase corta del propio mensaje del commit que justifica el tipo elegido. No una paráfrasis genérica."
    )


class LoteClasificado(BaseModel):
    clasificaciones: list[ClasificacionCommit]
