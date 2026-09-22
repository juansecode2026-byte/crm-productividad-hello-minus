"""Esquema de salida del Verificador de checklist.

Mismo criterio que los otros dos agentes: el modelo de Pydantic ES el esquema.

La diferencia de fondo con el Sugeridor de etapa: aquel elige **una** etapa
para el proyecto entero; este emite un veredicto **por cada ítem** del
checklist. Y ninguno de esos veredictos marca nada como hecho — lo que sale de
acá llena `detectado_en` y `evidencia`, nunca `completado`. Esa columna solo la
mueve una persona apretando "Confirmar" (ver migración 011).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class VeredictoItem(BaseModel):
    id: str = Field(
        description="El id exacto del ítem, tal como se lo pasaron. No se inventa ni se acorta."
    )
    detectado: bool = Field(
        description=(
            "True solo si lo que se ve del repositorio respalda que este ítem ya está hecho. "
            "Ante la duda, False: proponer de más obliga a la persona a desconfiar de todo."
        )
    )
    evidencia: str = Field(
        description=(
            "Qué se vio concretamente que respalda el veredicto — carpetas, archivos, "
            "commits, o una frase del CLAUDE.md del propio repo. Si detectado es False, "
            "explica qué falta para darlo por hecho. Nunca genérico."
        )
    )


class ChecklistVerificado(BaseModel):
    veredictos: list[VeredictoItem]
