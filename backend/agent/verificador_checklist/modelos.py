"""Esquema de salida del Verificador de checklist.

Mismo criterio que los otros dos agentes: el modelo de Pydantic ES el esquema.

La diferencia de fondo con el Sugeridor de etapa: aquel elige **una** etapa
para el proyecto entero; este emite un veredicto **por cada ítem** del
checklist. Y ninguno de esos veredictos marca nada como hecho — lo que sale de
acá llena `estado_agente` y `evidencia`, nunca `completado`. Esa columna solo la
mueve una persona apretando "Confirmar" (ver migración 011).
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class EstadoItem(str, Enum):
    """Ordenados de menos a más certeza. El orden importa: la regla del prompt
    es que ante la duda se baja un escalón, nunca se sube."""

    SIN_EMPEZAR = "sin_empezar"
    EN_PROCESO = "en_proceso"
    HECHO = "hecho"


class VeredictoItem(BaseModel):
    id: str = Field(
        description="El id exacto del ítem, tal como se lo pasaron. No se inventa ni se acorta."
    )
    estado: EstadoItem = Field(
        description=(
            "'hecho' si lo que se ve respalda que está terminado. 'en_proceso' si hay "
            "trabajo real pero incompleto, y se puede decir qué falta. 'sin_empezar' si "
            "no hay ninguna señal. Ante la duda entre dos, siempre el menor de los dos."
        )
    )
    evidencia: str = Field(
        description=(
            "Qué se vio concretamente que respalda el veredicto — carpetas, archivos, "
            "commits, o una frase del CLAUDE.md del propio repo. En 'en_proceso' tiene "
            "que decir las dos mitades: qué hay y qué falta. Nunca genérico."
        )
    )


class ChecklistVerificado(BaseModel):
    veredictos: list[VeredictoItem]
