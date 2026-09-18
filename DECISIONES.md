# DECISIONES.md — CRM de Productividad Hello Minus

Registro de candidatos a automatización evaluados por el agente
`seleccionar-forma`. Cada entrada dice qué se aceptó, qué se rechazó y qué
quedó aplazado, con su motivo y su condición de activación.

Un aplazado sin condición útil es un rechazado disfrazado: si no se puede
nombrar qué tendría que cambiar para reconsiderarlo, va como rechazado.

<!-- FORMATO DE ENTRADA — no borrar
## [ID] Nombre del candidato
- **Estado:** ACEPTADO | RECHAZADO | APLAZADO
- **Forma:** script / subagente markdown / script SDK / Dynamic Workflow / ninguno
- **Vive en:** ruta concreta, o "—" si no se construye
- **Problema que resuelve:** una o dos frases
- **Procedencia:** de qué documento, línea de NOTAS.md u observación salió
- **Condición de activación:** obligatorio si APLAZADO. Qué tendría que cambiar.
- **Decidido:** AAAA-MM-DD
-->

---

## Nota de encuadre — modo inicial, 2026-08-28

`docs/agentes-crm-productividad-hello-minus.md` clasifica 16 agentes. **Trece de
ellos no son candidatos de este archivo**: son componentes de runtime del
producto, no automatización del laboratorio. El Sincronizador GitHub es una Edge
Function que valida HMAC en producción; el Motor de indicadores es un cron
nocturno; el Conversacional es una feature del dashboard. Un subagente markdown
solo existe dentro de una sesión de Claude Code — ahí nunca llegaría un webhook.

Su lugar ya está definido por `estructura.yaml`: `backend/functions/`,
`backend/api/routes/`, `backend/agent/`. Ver la sección "Rechazados" al pie.

Lo que sí se evaluó acá es lo que ese documento no cubre: qué del trabajo de
**construir** las 13 fases se repite, se rompe en silencio, o depende de que
alguien se acuerde.

---

## [1] Guardrails de base de datos remota y secretos

- **Estado:** ACEPTADO
- **Forma:** ninguno (configuración)
- **Vive en:** `.claude/settings.json`
- **Problema que resuelve:** el MCP de Supabase escribe directo contra el
  proyecto remoto `qutqsyokdlitflybfrus` sin entorno local intermedio. Un
  `DROP POLICY` o un `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` accidental
  abre la base **sin producir ningún error visible**: simplemente empieza a
  devolver filas que no debía. Protege además los cinco secretos previstos
  (`APP_ID`, `PRIVATE_KEY`, `WEBHOOK_SECRET`, `INSTALLATION_ID`,
  `service_role`) de terminar leídos dentro del contexto de una sesión.
- **Procedencia:** `db/README.md` (32 tablas, 61 políticas aplicadas el
  2026-08-28); instrucciones del propio MCP de Supabase ("apply_migration
  carefully, changes go directly to the remote project").
- **Condición de activación:** —
- **Decidido:** 2026-08-28
- **Construido:** 2026-08-28 — `.claude/settings.json` (deny de `.env`, `.pem`,
  `.key`) + hook PreToolUse sobre `execute_sql` y `apply_migration` que corre
  `.claude/hooks/guardrail-sql.py`.

Aceptado sin evidencia de dolor previa porque un permiso no es automatización,
es prevención: agregarlo después de que algo se rompió no sirve de nada.

El guardrail distingue dos niveles a propósito. **Bloquea** lo que nunca tiene
razón de ser acá (`DISABLE ROW LEVEL SECURITY`, `DROP SCHEMA`, `TRUNCATE`) y
**pregunta** por lo que sí puede ser legítimo dentro de una migración
(`DROP POLICY`, `DROP TABLE`, `DROP FUNCTION`). Bloquear todo duro haría que
estorbe en la primera migración real y termine desactivado — y un guardrail
apagado no protege nada.

## [2] Verificador de migración: RLS, orden y advisors

- **Estado:** ACEPTADO
- **Forma:** script sin agente
- **Vive en:** `scripts/verificar_migracion.py`
- **Problema que resuelve:** después de cada migración hay que reverificar a
  mano que ninguna tabla quedó con RLS habilitado y sin política (Postgres
  deniega todo: la tabla devuelve vacío sin error) ni sin RLS (devuelve de
  más). **Ninguno de los dos modos de falla produce un error.**
- **Procedencia:** `db/README.md` — orden de ejecución obligatorio, "0 tablas
  sin cubrir, advisors en limpio"; punto C de la Fase 01 ("RLS en tablas
  derivadas es donde más fácil se cuela un error de permisos").
- **Condición de activación:** —
- **Decidido:** 2026-08-28
- **Construido:** 2026-08-28 — `scripts/verificar_migracion.py`.

La regla de las tres repeticiones ya estaba cumplida al decidirlo: 4 archivos
SQL aplicados en orden obligatorio y ~9 fases restantes que tocan la base.

Corre dos bloques. El **local** siempre: verifica que los archivos que
`db/README.md` declara como orden de ejecución existan de verdad. El **remoto**
solo si hay `DATABASE_URL` en el entorno: compara `pg_tables` contra
`pg_policies` y además revisa que ninguna tabla de solo-sistema tenga política
de escritura para usuarios. Sale con código 1 si encuentra algo, así se puede
enganchar a un pre-commit sin envoltorio extra.

## [3] Detallador de fases 03-13

- **Estado:** APLAZADO
- **Forma:** subagente markdown
- **Vive en:** `.claude/agents/detallar-fase.md`
- **Problema que resuelve:** 11 de 13 fases solo tienen título. Detallar cada
  una exige leer el schema real, el catálogo de indicadores y el doc de
  agentes, y producir la misma estructura que la Fase 01 — más las dos
  secciones que al molde todavía le faltan: dependencias entre fases y criterio
  de cierre.
- **Procedencia:** `docs/fases-crm-productividad-hello-minus.md`, sección "Lo
  que hace falta en esta fase".
- **Condición de activación:** cuando las fases 02 y 03 estén detalladas a
  mano. Con dos ejemplos del molde se sabe qué secciones pedir; con uno solo,
  el subagente congelaría un formato derivado de un único caso.
- **Decidido:** 2026-08-28

No va como Dynamic Workflow pese a tener 11 piezas: las fases dependen unas de
otras (la 09 necesita que la 06 funcione). Detallarlas en paralelo produciría 11
documentos coherentes por dentro e incoherentes entre sí.

## [4] Auditor de coherencia docs ↔ schema aplicado

- **Estado:** APLAZADO
- **Forma:** subagente markdown
- **Vive en:** `.claude/agents/auditar-coherencia-docs.md`
- **Problema que resuelve:** la verdad vive en tres lugares que se
  desincronizan solos — `docs/fases-...md` describe 32 tablas campo por campo,
  `db/000_schema_inicial.sql` es lo que realmente corrió, y `db/README.md`
  describe las decisiones de acceso. Cada migración los separa un poco más sin
  que nada avise. El resultado es documentación verosímil y falsa, que es el
  peor estado posible para un documento.
- **Procedencia:** `docs/fases-...md` está marcado "documento vivo · v2";
  `db/README.md` lista pendientes que van a cambiar el schema.
- **Condición de activación:** la primera vez que una migración incremental
  (`003_*` en adelante) modifique una tabla que los docs describen campo por
  campo.
- **Decidido:** 2026-08-28

## [5] Conector de proyecto (backfill + equipo histórico)

- **Estado:** APLAZADO
- **Forma:** script sin agente
- **Vive en:** `scripts/conectar_proyecto.py`
- **Problema que resuelve:** los 8 pasos de la Parte B se repiten una vez por
  cada uno de los 6+ proyectos. El backfill de 6-12 meses tiene límites de tasa
  reales, y el paso 09 —reconstruir quién estuvo en qué proyecto y desde
  cuándo— es trabajo manual tedioso que, si se salta, hace que bus factor y
  estabilidad del equipo den números incorrectos con apariencia de correctos.
- **Procedencia:** `docs/paso-a-paso-vincular-proyectos-hello-minus.md`, Parte
  B pasos 07-14 y la advertencia "El paso 9 es el que más se subestima".
- **Condición de activación:** que la Fase 05 esté hecha (GitHub App instalada)
  **y** que el proyecto de prueba del paso 15 se haya conectado a mano. El
  primero a mano enseña qué hace falta; del segundo en adelante se justifica el
  script.
- **Decidido:** 2026-08-28

Sigue siendo script y no agente porque *propone* filas de `miembros_proyecto`
para que una persona las revise; proponer no es decidir.

## [6] Sembrado del catálogo de indicadores (docs → SQL)

- **Estado:** RECHAZADO
- **Forma:** ninguno
- **Vive en:** — (el artefacto es `db/migrations/003_seed_indicadores.sql`,
  escrito a mano y versionado)
- **Problema que resuelve:** ~50 indicadores y los Grupos A/B/C viven en prosa
  y deben quedar como filas en `indicador_catalogo` e
  `indicador_aplicabilidad`. Hay juicio real (decidir `categoria`, `plazo`,
  `depende_de`), pero **se ejerce una sola vez**: construir algo que interprete
  la prosa cuesta más que interpretarla.
- **Procedencia:** `db/README.md`, sección Pendiente.
- **Condición de activación:** —
- **Decidido:** 2026-08-28

Rechazado como automatización, no como tarea: el sembrado hay que hacerlo
igual, a mano. Si el catálogo empezara a cambiar de forma recurrente (tres
re-sembrados o más) deja de ser tarea única y vuelve a la mesa.

## [7] Banco de evals de los prompts del producto

- **Estado:** APLAZADO
- **Forma:** script SDK, composición orquestador + 1 juez
- **Vive en:** `agentes-sdk/juez_evals.py` (los casos viven en `eval_cases`)
- **Problema que resuelve:** sin banco de evals, cada cambio de prompt o de
  modelo del Clasificador o del Redactor se valida leyendo la salida a ojo —
  justo lo que se olvida bajo presión.
- **Procedencia:** agente 09 de
  `docs/agentes-crm-productividad-hello-minus.md`; la tabla `eval_cases` ya
  existe en `000_schema_inicial.sql`.
- **Condición de activación:** que exista el primer prompt de producción
  escrito en `backend/agent/` **y** que se vaya a modificar por segunda vez.
  Hoy no hay ninguno: evaluaría la nada.
- **Decidido:** 2026-08-28

La separación orquestador/juez es por permisos, no por gusto: el juez recibe
solo `{caso, esperado, obtenido}`, arranca con contexto vacío, no sabe qué
prompt produjo la salida y no escribe el resultado. Quien juzga no puede ser el
mismo prompt que se evalúa.

## [8] Banco de prototipado de los agentes LLM del producto

- **Estado:** APLAZADO
- **Forma:** script SDK, una sola ejecución, sin loop
- **Vive en:** `agentes-sdk/prototipo-<nombre-agente>.py`
- **Problema que resuelve:** iterar los prompts de los agentes LLM contra repos
  reales antes de portarlos a `backend/agent/`. El más delicado es el de
  Porcentaje de Avance: 11 reglas de negocio ya escritas que, mal
  implementadas, producen porcentajes publicados que después nadie se anima a
  corregir hacia abajo.
- **Procedencia:** agentes 06, 07, 10 y 11 de
  `docs/agentes-crm-productividad-hello-minus.md`, en particular las "Variables
  a tener en cuenta" del agente 11.
- **Condición de activación:** resuelto el lenguaje (ver [D1] abajo), y que la
  Fase 06 esté entregando commits clasificables. Queda pendiente además cómo un
  prototipo local lee repos de otros proyectos sin violar la regla de
  aislamiento del `CLAUDE.md` del laboratorio.
- **Decidido:** 2026-08-28

---

# Decisiones de arquitectura

## [D2] Router en el frontend: react-router-dom

- **Estado:** ACEPTADO
- **Decidido:** 2026-09-18

`STACK.md` no menciona router porque nunca hizo falta: `App.tsx` era
literalmente `session ? <Proyectos /> : <Login />`, sin navegación. Al
construir la pantalla de detalle de proyecto (Fase 03) hacía falta decidir
cómo se llega a ella — un store de Zustand sin URL, o un router con URL propia
(`/proyectos/:id`).

Se elige **react-router-dom** por tres razones concretas, no por costumbre:
la barra lateral ya tiene 4 secciones marcadas "pronto" que también van a
necesitar URL propia; con dos personas trabajando los mismos proyectos,
mandar un link puntual es el flujo natural; y agregarlo ahora cuesta una
dependencia y ~20 líneas, mientras que agregarlo después de que existan 6
pantallas sin URL cuesta refactorizarlas todas.

## [D1] Lenguaje de los agentes: Python

- **Estado:** ACEPTADO
- **Decidido:** 2026-08-28

`STACK.md` decía Claude vía `@anthropic-ai/sdk` (Node), mientras que
`agentes-sdk/` del laboratorio es para Python con `claude_agent_sdk`. Esa
contradicción obligaba a escribir cada prompt dos veces —prototipo y
producción— con dos versiones que divergen.

Se resuelve unificando en **Python**: se modifica `STACK.md` de este proyecto y
los agentes se construyen en Python tanto para prototipar como para producción.

Consecuencia a tener presente: el backend de aplicación sigue siendo
Node/Express, así que los agentes quedan como un servicio Python aparte al que
Express llama. Son dos runtimes en el backend, no uno.

---

# Rechazados de forma definitiva

**Los 13 agentes del documento que son código del producto.** Sincronizador
GitHub, Receptor de telemetría, Motor de indicadores (con el Gestor de madurez
fusionado), Detector de rastro semanal (con el Verificador de evidencia
fusionado), Vigía de alertas, Reconciliador de doble cálculo, Clasificador de
commits, Redactor de narrativa semanal, Conversacional, Resumen ejecutivo,
Proyección comercial, Asistente de planeación, y el LLM parcial del motor.

No se rechaza construirlos —hay que construirlos— sino ponerlos en `.claude/`.
Su lugar es `backend/functions/`, `backend/api/routes/` y `backend/agent/`.

**El orquestador de la cadena nocturna.** La advertencia sobre el orden
obligatorio (Sincronizador → Clasificador → Motor → Reconciliador + Vigía) es
correcta e importante, pero es una restricción de diseño del backend —un cron
con dependencias— no un candidato del laboratorio. LangGraph no se justifica
para una cadena lineal.

**Dynamic Workflow, en todos los casos.** No hay hoy ninguna tarea de decenas o
cientos de piezas genuinamente independientes. Si algún día se hace backfill de
20+ repos de una sentada, se revisita.

---

# Preguntas abiertas que bloquean candidatos

1. ~~Registro de tiempo: manual, inferido o híbrido.~~ **Resuelto 2026-09-17:
   100% inferido.** El candidato que esto habilitaba
   (`scripts/derivar_registro_tiempo.py`) se construyó directo como código de
   producto, no pasó por `seleccionar-forma` — es aritmética pura sin Claude,
   mismo molde que el Sincronizador o el Receptor de telemetría (rechazados de
   forma definitiva más abajo, por ser componentes de runtime del producto y
   no automatización del laboratorio).
2. **Aislamiento vs. prototipo local.** El agente de % de Avance necesita leer
   repos de *otros* proyectos de Hello Minus. En producción no hay problema
   (corre en servidor contra la API de GitHub), pero un prototipo local
   violaría la regla de aislamiento del `CLAUDE.md` del laboratorio. Bloquea
   [8].
3. **Datos provisionales de `personas`.** Emails `.invalid` y
   `github_username` en NULL mantienen la base cerrada por RLS. Nada que
   dependa de la base se puede probar hasta arreglarlo.
