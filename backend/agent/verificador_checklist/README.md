# Verificador de checklist

Tercer agente con LLM. Lo dispara el botón "Generar con agente IA" de la
pantalla de detalle de un proyecto: lee el repositorio y decide, ítem por ítem,
qué del checklist ya está hecho y qué falta — con su evidencia.

## Los tres veredictos

Desde la migración 013 el veredicto no es un sí/no. Son tres valores, de menos a
más certeza, y la diferencia importa: con el modelo binario, un repo con tests
para dos de diez módulos se guardaba igual que uno sin una sola línea escrita.

| Estado | Cuándo | En pantalla |
|---|---|---|
| `sin_empezar` | Buscó y no hay ninguna señal | Rojo, "falta por construir" |
| `en_proceso` | Hay trabajo real pero incompleto | Cian, "en proceso" |
| `hecho` | Lo que se ve respalda que está terminado | Ámbar, con "Confirmar" |

**`en_proceso` no es el cajón de lo dudoso.** El prompt solo lo admite cuando el
agente puede nombrar **las dos mitades**: qué hay y qué falta. Si no puede, baja
un escalón — entre `hecho` y `en_proceso` elige `en_proceso`; entre
`en_proceso` y `sin_empezar`, elige `sin_empezar`. Siempre hacia abajo, que es
la dirección barata.

## El archivo de la evidencia (2026-09-24)

Además del veredicto y la evidencia en prosa, el agente devuelve
`archivo_evidencia`: la ruta del único archivo que más respalda su veredicto,
`CLAUDE.md` si se apoyó en lo que declara ese archivo, o `null`. Va aparte de
la prosa para que el backend pueda preguntarle a GitHub cuándo se tocó ese
archivo por última vez — y con eso mostrar una fecha de cuándo se hizo el ítem.

El agente solo nombra el archivo; la fecha la eligen `services/fechaEvidencia.ts`
y la API de GitHub, sin Claude. El backend además descarta cualquier ruta que
no esté entre las que se le mostraron al agente.

**Probado contra este repo, 4 ítems:** las rutas salieron limpias y reales
(`STACK.md`, `db/000_schema_inicial.sql`, `CLAUDE.md`), ninguna inventada, y las
fechas cierran con la historia — las dos primeras dan 2026-08-28, el día que se
creó el repo.

**Algo que apareció en esa prueba y quedó sin resolver:** "Tests del flujo
principal" salió `en_proceso`, cuando la semana anterior había sido
`sin_empezar`. El agente contó como avance las verificaciones manuales que el
`CLAUDE.md` describe (la prueba de RLS con transacción revertida). No son tests
automáticos, que es lo que el ítem pide — el prompt probablemente necesita
decirlo explícito.

## La regla que gobierna todo esto

**El agente nunca escribe `completado`.** Solo llena `estado_agente`,
`verificado_en` y `evidencia`. `completado` lo mueve una persona apretando
"Confirmar" en cada ítem, y solo aparece ese botón en los `hecho`.

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

### Los tres estados, probados contra `Monkeyotbz/crm-ventas` (2026-09-22)

Nueve ítems, con tres casos donde se conocía la verdad de campo. Los tres
salieron bien, y el reparto fue 3 `hecho` · 4 `en_proceso` · 2 `sin_empezar`:

- **`sin_empezar`** — "Tests del flujo principal": *"no aparece ninguna carpeta
  de tests ni configuración de test runner en el árbol"*. La trampa de siempre
  (el `CLAUDE.md` habla de pruebas manuales) no lo movió.
- **`en_proceso`** — "Sin errores críticos conocidos": citó las dos mitades sin
  que se le insistiera — *"0 advertencias del linter de seguridad y todas las
  tablas con RLS, pero también lista brechas abiertas: el widget sin límite de
  velocidad, el camino de plantilla de WhatsApp sin probar contra Meta"*.
- **`en_proceso`** — "Corriendo en producción" fue el caso que justifica toda la
  migración: con el veredicto binario esto caía en "no" a secas. Ahora dice que
  el Supabase real existe con datos reales **pero** `getcandycrm.com` todavía no
  está desplegado.

**Sin probar todavía:** la ruta HTTP completa (`POST
/proyectos/:id/checklist/escanear`) con una sesión real contra la migración 013
aplicada.

## Correr a mano

```bash
cd backend/agent
echo '{"owner":"...","repo":"...","items":[{"id":"1","etapa":4,"texto":"..."}]}' \
  | ANTHROPIC_API_KEY=... python -m verificador_checklist.ejecutar
```
