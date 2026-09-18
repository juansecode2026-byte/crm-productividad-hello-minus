"""Esquema de salida del Sugeridor de etapa.

Mismo criterio que el Clasificador de commits: el modelo de Pydantic ES el
esquema, no un `output_schema.json` suelto (ver `clasificador_commits/modelos.py`
para el porqué de esa desviación del molde de `estructura.yaml`).

La diferencia con el Clasificador: esto **sugiere**, no decide. Lo que devuelve
acá termina prellenando un campo que una persona confirma antes de que se
guarde — porque elegir una etapa > 2 congela el alcance del proyecto de forma
definitiva (`cambiar_etapa_proyecto()`: volver atrás no lo descongela). Por eso
`evidencia` no es decorativa: es lo que la persona lee para decidir si le cree.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class EtapaSugerida(BaseModel):
    etapa: int = Field(
        ge=1,
        le=9,
        description="Número de la etapa del ciclo de vida, de 1 a 9, en la que parece estar el proyecto hoy.",
    )
    evidencia: str = Field(
        description=(
            "Qué se vio en el repositorio que lleva a esa etapa, en una o dos frases. "
            "Cita cosas concretas del proyecto (carpetas, archivos, ritmo de commits), "
            "no generalidades. Se le muestra a la persona para que decida si acepta la sugerencia."
        )
    )
    dudas: str | None = Field(
        default=None,
        description=(
            "Qué falta ver para estar seguro, si aplica. Se usa cuando dos etapas son "
            "igual de plausibles con lo que se alcanza a ver desde afuera del repo."
        ),
    )
