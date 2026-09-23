# Base de datos — CRM de Productividad Hello Minus

Supabase (Postgres 17). El schema corresponde a la **Fase 01** del plan de
construcción: 32 tablas en 9 bloques. Ver
[docs/fases-crm-productividad-hello-minus.md](../docs/fases-crm-productividad-hello-minus.md).

**Proyecto Supabase:** `qutqsyokdlitflybfrus` (`crm-productividad-hello-minus`,
región us-east-1). Schema y políticas **aplicados el 2026-08-28**: 32 tablas con
RLS, 61 políticas, 0 tablas sin cubrir, advisors de seguridad en limpio.

## Orden de ejecución

Los archivos se aplican en este orden y no en otro. Cada uno asume que el
anterior ya corrió.

| Orden | Archivo | Qué hace |
|---|---|---|
| 1 | `000_schema_inicial.sql` | Tipos, 32 tablas, índices. Habilita RLS en todas. |
| 2 | `policies/001_baseline.sql` | Schema `private`, funciones auxiliares y 61 políticas RLS. |
| 3 | `migrations/001_vincular_auth_y_catalogos.sql` | Trigger de vinculación con Auth + catálogos base. |
| 4 | `migrations/002_seed_personas.sql` | Los dos integrantes. Placeholder, reemplazado por el paso 5. |
| 5 | `migrations/003_actualizar_personas_reales.sql` | Datos reales de los dos integrantes. Aplicado 2026-09-15. |
| 6 | `migrations/004_funciones_proyectos.sql` | `crear_proyecto`, `cambiar_etapa_proyecto` y un solo miembro activo por proyecto. Aplicado 2026-09-15. |
| 7 | `migrations/005_repos_candidatos.sql` | Tabla `repos_candidatos`, sembrada con los 4 repos de Gabriel elegidos el 16 sep. |
| 8 | `migrations/006_mas_repos_candidatos.sql` | Suma los 2 repos privados de Juan. |
| 9 | `migrations/007_claves_ingesta.sql` | Claves por proyecto del endpoint de telemetría (solo el hash). |
| 10 | `migrations/008_registrar_sesion_claude_code.sql` | Fusión de los lotes de OpenTelemetry en una sola sesión. |
| 11 | `migrations/009_registro_tiempo_inferido.sql` | `registro_tiempo` pasa a ser de solo-sistema: se retiran las políticas de escritura de personas y se agrega el constraint único que necesita el derivador para hacer upsert. |
| 12 | `migrations/010_tarea_evidencia_unica.sql` | Constraint único para que el Detector de rastro no duplique evidencia al repetir corridas. |
| 13 | `migrations/011_checklist_plantilla.sql` | `checklist_plantilla` (ítems base por etapa, editables) + `detectado_en`/`evidencia` en `checklist_items` + constraint único para sembrar sin duplicar. Aplicada 2026-09-22. |
| 14 | `migrations/012_explicacion_simple.sql` | `explicacion_simple` en `checklist_plantilla`: qué significa cada ítem para alguien que no programa. Aplicada 2026-09-22. |
| 15 | `migrations/013_estado_verificacion.sql` | El veredicto del agente pasa de binario a tres valores (`estado_agente`, `verificado_en`); reemplaza `detectado_en`. |
| 16+ | `migrations/NNN_*.sql` | Cambios incrementales, en orden cronológico. |

**El paso 2 no es opcional.** El paso 1 habilita RLS sin crear políticas, y en
Postgres eso significa denegar todo: hasta que corran las políticas, la base
está cerrada para cualquier usuario. Es deliberado — el "restrictivo por
defecto" que recomienda la documentación de la Fase 01.

## Por qué el schema y las políticas van separados

Lo exige `STACK.md`, y la razón es práctica: las políticas cambian mucho más
seguido que las tablas. Tenerlas aparte permite revisar un cambio de permisos
sin leer 500 líneas de DDL, y permite reaplicar las políticas desde cero sin
tocar los datos.

## Decisiones de acceso ya tomadas (2026-08-28)

La documentación de la Fase 01 dejó tres puntos delicados sin resolver. Dos se
decidieron antes de escribir la primera política, como recomendaba:

- **Indicadores personales (punto A):** ambos integrantes ven los de ambos.
- **Detalle de Tarea Semanal (punto B):** ambos ven el del otro.

El equipo son dos personas y eligieron transparencia total: **ambos leen todo**,
incluido lo comercial y el log de auditoría. Por eso la restricción no está en
la lectura, sino en dos lugares distintos:

1. **Escritura** — cada quien escribe solo lo suyo. Ver que otro registró horas
   no habilita a editarlas.
2. **Tablas de solo-sistema** — `commits`, `pull_requests`,
   `sesiones_claude_code`, `trazas_agente`, `indicador_snapshots`,
   `tarea_evidencia` y `auditoria_log` se leen, pero nadie las escribe desde la
   app. Si un usuario pudiera insertar en `commits`, podría fabricarse
   actividad y todos los indicadores dejarían de significar algo. La ingesta
   entra por `service_role`, que salta RLS por diseño.

Lo **comercial** (`clientes`, `productos`, `leads`, `ventas`, `oportunidades`)
lo ven los dos, pero solo el admin lo modifica. La documentación de la Fase 01
lo proponía como solo-admin también para leer; el equipo decidió lo contrario a
propósito. Uno de los dos integrantes tiene rol `admin` y es el único que puede
tocar montos, clientes y pipeline: **la asimetría entre ambos está en la
escritura, no en lo que alcanzan a ver**.

`auditoria_log` sigue el mismo criterio y por una razón concreta: si solo el
admin pudiera ver quién consultó qué, la auditoría sería unilateral. Que la
vean los dos es lo que la hace simétrica. Nadie la escribe ni la edita.

El **punto C** (RLS en tablas derivadas) no era una decisión sino una
advertencia técnica: `indicador_snapshots` tiene `scope_type`/`scope_id`
genéricos y su política es más frágil que un `persona_id = auth.uid()`. Con
transparencia total quedó simple hoy; si mañana se restringe, ese es el lugar
donde más fácil se cuela un error de permisos.

## Registro de tiempo: 100% inferido, de solo-sistema

Decidido el 2026-09-17 (Fase 04): `registro_tiempo` no tiene captura manual.
Se llena solo, desde `sesiones_claude_code`, con
`scripts/derivar_registro_tiempo.py` — mismo estatus que `commits` o
`sesiones_claude_code`, nadie la escribe a mano y las políticas de escritura
de personas (`crear_mi_tiempo`, `editar_mi_tiempo`, `borrar_mi_tiempo`, con la
ventana de 7 días que tenían antes) se retiraron en la migración 009. La
lectura no cambió: transparencia total, los dos ven las horas del otro.

Consecuencia aceptada a propósito: solo se cuenta tiempo que pasó por Claude
Code. Reuniones, llamadas con cliente o trabajo sin el agente no entran —  es
la aproximación elegida a cambio de no depender de que alguien registre horas
a mano todos los días.

## La escala de certeza de `checklist_items`

Decidido el 2026-09-22 (migraciones 011 y 013). `completado` significa **una
persona lo marcó**, y nada más — es el único estado que cuenta para el
porcentaje del proyecto. El Verificador de checklist (agente) nunca lo toca:
escribe `estado_agente` y `evidencia`.

`estado_agente` tiene tres valores, de menos a más certeza:

| Valor | Significa | En pantalla |
|---|---|---|
| `sin_empezar` | El agente buscó y no hay ninguna señal | Rojo, "falta por construir" |
| `en_proceso` | Hay trabajo real pero incompleto, y puede decir qué falta | Cian, "en proceso" |
| `hecho` | Lo que se ve respalda que está terminado | Ámbar, con botón "Confirmar" |
| `NULL` | El agente **nunca miró** este ítem | Gris, "sin verificar" |

**`NULL` no es un cuarto veredicto, es la ausencia de veredicto**, y esa
distinción es la razón de ser de `verificado_en`: antes, un ítem sin detectar y
un ítem nunca escaneado se guardaban idénticos, así que la pantalla no podía
decir "todavía nadie miró esto".

**Por qué hizo falta `en_proceso`** (la migración 013): con el veredicto
binario, un proyecto con tests para dos de diez módulos y un proyecto donde
nadie escribió una sola línea se guardaban igual. La mayoría de los ítems de un
proyecto vivo caen ahí, así que aplanarlos borraba justo la información más
útil.

Solo `hecho` ofrece el botón "Confirmar" — no hay "confirmar todos", se
descartó a propósito: si dos detecciones de tres son buenas, aceptar el lote
entero obligaría a tragarse la mala.

Es la misma regla que ya rige `candidatos_alcance` — ningún agente aprueba
solo — y acá importa por lo mismo: el agente infiere **desde afuera** del
repositorio (ve que un archivo existe, no que funcione), así que un falso
positivo marcado solo ensuciaría el porcentaje de la etapa sin que nadie lo
revisara.

`checklist_plantilla`, en cambio, **sí es tabla editable** y no constante en el
código como las 9 etapas: son los ítems base que se copian a cada proyecto al
escanear, y se decidió que el admin pueda ajustarlos sin desplegar.

### `explicacion_simple`: para quien tiene que confirmar, no para quien programa

Agregada el 2026-09-22 (migración 012). El texto del ítem y la evidencia del
agente están escritos en jerga; quien mira la pantalla y decide si confirma
puede no programar. Esta columna dice, en una o dos frases sin jerga, qué
significa el ítem.

**Vive en `checklist_plantilla` y no en `checklist_items` a propósito:** es la
misma frase para todos los proyectos —a diferencia de `evidencia`, que sí es de
cada repositorio—, así que corregir una redacción la arregla en todas partes
sin necesidad de re-escanear nada. El frontend la busca por `(etapa, texto)`,
que es la clave que las dos tablas comparten. Un ítem agregado a mano fuera de
la plantilla simplemente no tiene explicación, y se muestra sin ella.

## Funciones auxiliares

Definidas en `policies/001_baseline.sql`, en el schema **`private`** (no en
`public`):

| Función | Devuelve |
|---|---|
| `private.persona_actual()` | El `personas.id` del usuario autenticado, o `NULL` si no tiene fila. |
| `private.es_admin()` | Si el usuario actual es admin y está activo. |
| `private.lidera_proyecto(uuid)` | Si es el `encargado_id` de ese proyecto. |
| `private.es_miembro(uuid)` | Si es miembro vigente (sin `fecha_salida`) de ese proyecto. |

**Por qué en `private`:** Supabase expone el schema `public` por PostgREST, así
que una función ahí queda llamable como `/rest/v1/rpc/<nombre>`. Estas son
plumbing de RLS, no API. `private` no lo expone PostgREST. El rol
`authenticated` tiene `USAGE` sobre el schema y `EXECUTE` sobre las cuatro
funciones; `anon` tiene `USAGE` pero ningún `EXECUTE`.

**Por qué `SECURITY DEFINER` con `search_path` fijo:** sin `DEFINER`, la
política de `personas` llamaría a una función que lee `personas`, que dispara la
política otra vez — recursión infinita. El `search_path` fijo evita que un
esquema temporal las secuestre.

## Cómo entra una persona al sistema

Tres piezas que tienen que coincidir, y el orden importa:

1. **Fila en `personas`** con su email real (`migrations/002_seed_personas.sql`).
2. **Registro en Supabase Auth** con **ese mismo email**. El trigger
   `al_crear_usuario_vincular_persona` enlaza el `auth_user_id` solo.
3. **`github_username`** con el usuario real de sus commits.

Si alguien se registra en Auth *antes* de que su email real esté en `personas`,
el trigger no engancha y hay que vincular a mano — el `UPDATE` está al pie de
`002_seed_personas.sql`.

Sin el paso 2 completo, `private.persona_actual()` devuelve `NULL` y RLS deja a
esa persona afuera de todo. Sin el paso 3, su actividad de GitHub llega pero
queda huérfana y sus indicadores individuales salen vacíos.

## Pendiente

- **Que los dos integrantes se registren en Supabase Auth** con su email real
  (`juansecode2026@gmail.com` y `monkeyotbz@gmail.com`) para que el trigger de
  `001_vincular_auth_y_catalogos.sql` los enlace. Hasta entonces
  `private.persona_actual()` devuelve `NULL` y RLS los deja afuera.
- Decidir si hace falta un **rol comercial** separado de admin.
- Decidir el origen del **registro de tiempo**: captura manual (precisa, exige
  disciplina) o estimación automática desde sesiones de Claude Code (cero
  fricción, subestima).
- Sembrar `indicador_catalogo` e `indicador_aplicabilidad` con los ~50
  indicadores del catálogo y los Grupos A/B/C de
  [indicadores-individuales](../docs/indicadores-individuales-hello-minus.md).
- Sembrar `roles_proyecto` y `canales_venta`.

## Notas de rendimiento

Los advisors marcan varias FK sin índice de cobertura (nivel INFO): columnas
como `creado_por`, `completado_por`, `resuelto_por`, `cliente_id`. Con dos
usuarios y poco volumen no afecta; se agregan índices cuando alguna consulta
real lo pida. Las FK que sí se usan para filtrar y unir (`persona_id`,
`proyecto_id`, `repo_id`) ya tienen índice en `000_schema_inicial.sql`.
