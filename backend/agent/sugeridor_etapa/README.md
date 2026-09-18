# Sugeridor de etapa

Segundo agente con LLM del CRM, y el primero que **no** corre por horario:
lo dispara una persona apretando "Sugerir" en el panel de vinculación de un
repositorio, y espera la respuesta en pantalla.

Mira lo que se ve de un repo desde afuera —estructura de carpetas, archivos
que delatan madurez, ritmo de commits, quiénes commitean— y propone en cuál de
las 9 etapas del ciclo de vida está ese proyecto, con su evidencia.

## Sugiere, no decide

Lo que devuelve prellena el selector de etapa; una persona lo confirma o lo
cambia antes de que se guarde nada. No es una formalidad: **pasar de la etapa
2 congela el alcance del proyecto y eso no se revierte**
(`cambiar_etapa_proyecto()` en `db/migrations/004`). Por eso el prompt le pide
que ante la duda elija la etapa más temprana y explique qué le falta ver —
equivocarse hacia adelante cuesta caro, quedarse corto cuesta un clic.

Es la misma regla que ya rige para `candidatos_alcance`: ningún agente aprueba
solo.

## Archivos

| Archivo | Qué es |
|---|---|
| `modelos.py` | El esquema de salida (`EtapaSugerida`), como modelo de Pydantic. |
| `system_prompt.md` | Las 9 etapas con su criterio de salida y cómo decidir entre dos que compiten. |
| `cliente.py` | `sugerir_etapa()` — una llamada por repo, `effort: medium`. |
| `ejecutar.py` | El contrato con Node: JSON por stdin, JSON por stdout. No toca la base. |

`effort` va en `medium` y no en `low` como el Clasificador de commits a
propósito: decidir la etapa de un proyecto entero es inferencia sobre señales
que se contradicen (estructura completa pero repo nuevo, tests presentes pero
sin despliegue), no clasificar una frase.

## El puente con Node

Express corre en Node y los agentes son Python (`DECISIONES.md [D1]`). Este es
el primer caso del proyecto en que Node llama a un agente en caliente, así que
hubo que resolverlo: `backend/api/services/sugeridorEtapa.ts` lo lanza como
proceso hijo, le pasa el JSON por stdin y lee la respuesta de stdout.

Se eligió proceso hijo en vez de un servicio Python aparte porque esto se
ejecuta un puñado de veces en la vida del sistema — una por proyecto que se
vincula. **La letra chica:** asume que donde se despliegue el backend haya
Python con `backend/agent/requirements.txt` instalado. Hoy eso solo se cumple
en local, y la fase de hosting sigue sin decidirse.

## Probado

- El agente solo, con datos reales de este propio repo: pasó de sugerir etapa 2
  a etapa 4 cuando se le agregó la señal de archivos clave a cualquier
  profundidad — sin eso no veía los `package.json` de `backend/api/` y
  `frontend/dashboard/`, que son los que prueban que el proyecto corre.
  Detectó por su cuenta que la etapa 5 ya había arrancado (encontró el
  `system_prompt.md` del Clasificador) y explicó por qué se quedaba en 4 igual.
- El puente Node→Python, de punta a punta contra la API real de GitHub.

**Sin probar todavía:** la ruta HTTP completa (`POST /repos/sugerir-etapa`),
porque exige un JWT de sesión real. Falta apretar el botón en el navegador.

## Correr a mano

```bash
cd backend/agent
echo '{"owner":"...","repo":"...","carpetas":[],"archivos_clave":[],"commits_total":0}' \
  | ANTHROPIC_API_KEY=... python -m sugeridor_etapa.ejecutar
```
