# Verificador de checklist

Tercer agente con LLM. Lo dispara el botón "Generar con agente IA" de la
pantalla de detalle de un proyecto: lee el repositorio y decide, ítem por ítem,
qué del checklist ya está hecho y qué falta — con su evidencia.

## La regla que gobierna todo esto

**El agente nunca escribe `completado`.** Solo llena `detectado_en` y
`evidencia` (migración 011). `completado` lo mueve una persona apretando
"Confirmar" en cada ítem.

No es formalidad. El agente infiere **desde afuera**: ve que existe
`trigger_router_sobre_messages`, no que procese un mensaje real. Si eso se
marcara solo como hecho, quedaría un dato falso alimentando el porcentaje de la
etapa y, más adelante, los indicadores — sin que nadie lo notara. Es la misma
regla que ya rige `candidatos_alcance`: ningún agente aprueba solo.

Por eso los ítems ya confirmados **ni siquiera se le mandan**: no hay nada que
pueda decir que cambie algo, y no gasta tokens en ellos.

## De dónde salen los ítems

De `checklist_plantilla` (migración 011) — los mismos ~31 ítems para todos los
proyectos, derivados del "qué se construye" y el "sale con" de cada etapa. Es
**tabla y no constante en el código**, a diferencia de las 9 etapas: se decidió
que se pueda ajustar sin desplegar.

El escaneo siembra en `checklist_items` lo que le falte al proyecto
(idempotente por `checklist_item_unico`) y después juzga. Si la plantilla creció
desde el último escaneo, los ítems nuevos entran solos en el siguiente.

## Qué ve

| Señal | Qué contesta |
|---|---|
| Carpetas, hasta 2 niveles | La forma general del proyecto |
| Archivos que delatan madurez, a cualquier profundidad | ¿Corre? ¿Tiene pruebas? ¿Se despliega? ¿Lleva IA? |
| Commits: total, última semana, primero y último | Hace cuánto vive y si sigue activo |
| Personas que commitearon, PRs abiertos | Tamaño real del equipo, trabajo a medio cerrar |
| **El `CLAUDE.md` del repo, si lo tiene** | Lo más fuerte: una persona declarando qué construyó |

**No ve el contenido del código.** Decisión deliberada: leer código contesta
"¿es buen código?", que no es la pregunta.

### Sobre el `CLAUDE.md`

Es la señal más directa cuando existe, pero el prompt le pide dos cuidados:
puede estar **desactualizado** (si declara tests y no hay carpeta de tests, hay
que desconfiar) y puede hablar de **planes** en vez de hechos ("vamos a agregar
despliegue" ≠ "el despliegue corre").

## Probado

Contra este mismo repositorio, a propósito: es el único donde se conoce la
verdad de campo. Con una trampa buscada — el `CLAUDE.md` dice "probado" muchas
veces, pero **no hay ni una carpeta de tests**.

- **No cayó en la trampa:** "Tests del flujo principal" quedó en `false`, con
  la evidencia *"no hay carpeta de tests ni configuración de test runner en
  ningún nivel del árbol"*.
- **Encontró un bug de diseño mío:** con el tope original de 12.000 caracteres,
  el `CLAUDE.md` de este repo (28 KB) llegaba al 43% y la sección del
  Clasificador quedaba afuera. El agente respondió que la declaración "probado
  con datos reales" no existía — tenía razón sobre lo que vio. Se subió el tope
  a 40.000 y ese ítem pasó a detectarse correctamente, citando la frase exacta.
  De 16 a 20 de 31 detectados.
- Los errores que quedan van todos hacia **abajo** (no detectar algo hecho), que
  es la dirección barata: un ítem de menos espera un clic; uno de más ensucia
  el porcentaje.

**Sin probar todavía:** la ruta HTTP completa (`POST
/proyectos/:id/checklist/escanear`) con una sesión real, y el escaneo contra un
repo ajeno que no sea este.

## Correr a mano

```bash
cd backend/agent
echo '{"owner":"...","repo":"...","items":[{"id":"1","etapa":4,"texto":"..."}]}' \
  | ANTHROPIC_API_KEY=... python -m verificador_checklist.ejecutar
```
