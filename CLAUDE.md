# CLAUDE.md

@STACK.md
<!-- Import del stack tecnológico estándar. Ruta relativa a propósito:
     STACK.md vive en la raíz de ESTE repo, así el equipo lo recibe
     automáticamente al clonar. -->

## Overview

CRM interno de productividad de Hello Minus. Mide el rendimiento de un equipo de
dos personas sobre sus proyectos de software (varios de una sola persona),
combinando actividad de GitHub, telemetría de agentes / Claude Code e
indicadores calculados. No es un CRM comercial: la capa comercial existe pero es
secundaria. Documentación de diseño en [docs/](docs/).

**En `docs/`, el `.md` es la fuente — el `.html` correspondiente en
`docs/fuente-html/` es el original del que se convirtió (2026-08-28), no algo
para leer de nuevo.** No abrir esos `.html` salvo que el usuario pida
puntualmente revisar el formato original: son 4 archivos de ~30-40 KB cada uno,
gastan contexto sin agregar nada que el `.md` no tenga ya.

## Flujo / arquitectura

- **Fuentes de datos**, ninguna lee la base de otro proyecto directamente:
  - **GitHub** — una sola GitHub App a nivel de la organización. Webhooks
    (validados con HMAC `X-Hub-Signature-256`) → Edge Function → tablas
    `commits` / `pull_requests`.
  - **Telemetría** — paquete `hello-minus-telemetry` por proyecto + Claude Code
    con `CLAUDE_CODE_ENABLE_TELEMETRY=1` → endpoint de ingesta (push, con API
    key propia) → `trazas_agente` / `sesiones_claude_code`.
  - **Push de agregados** — otros proyectos (incluido CRM Ventas) empujan
    números ya calculados a un endpoint de ingesta, nunca se lee su BD.
- **Cadena nocturna, orden obligatorio:** Sincronizador → Clasificador de
  commits → Motor de indicadores → Reconciliador + Vigía de alertas. Si el motor
  corre antes que el clasificador, calcula sobre commits sin etiquetar.
- **Indicadores:** snapshots por periodo en `indicador_snapshots`, no cálculo en
  vivo. El cálculo determinista vive en scripts; los agentes solo emiten juicio
  con evidencia (regla de STACK.md).
- **Agentes:** de 16 analizados, solo 5-6 necesitan LLM real; el resto son
  scripts. Ver [docs/agentes-crm-productividad-hello-minus.md](docs/agentes-crm-productividad-hello-minus.md).

## Reglas de negocio clave

- **Dos sistemas de fases distintos, no confundir:** las **9 etapas** son el
  ciclo de vida de cualquier proyecto (1-9, campo `proyectos.etapa_actual`); las
  **13 fases** son el plan de construcción de este CRM
  ([docs/fases-...](docs/fases-crm-productividad-hello-minus.md)).

  Definidas el 2026-09-17. No hay tabla catálogo — es vocabulario fijo, igual
  que un enum, documentado acá porque el "sale con" es texto largo:

  | # | Etapa | Qué se construye | Sale con |
  |---|---|---|---|
  | 1 | Descubrimiento y alcance | Nada técnico: notas, requisitos, para qué es y quién lo pidió | Claro para qué es el proyecto y quién lo pidió |
  | 2 | Diseño y arquitectura | Modelo de datos, elección del stack, lista de componentes | Esquema de datos y componentes listados. **Congela el alcance** (`alcance_congelado_en`) |
  | 3 | Configuración del entorno | Repos, hosting, variables de entorno, CI/CD, claves | El proyecto corre local y despliega un "hola mundo" |
  | 4 | Construcción del núcleo | Base de datos, backend (API) y frontend (pantallas) | Los tres funcionan de punta a punta, aunque sin pulir |
  | 5 | Construcción de agentes de IA | Prompts y herramientas de cada agente. También no-code (n8n, Zapier) **cuando decide algo**, no solo mueve datos | Cada agente cumple contra casos de prueba reales |
  | 6 | Integración | Webhooks, APIs externas, backend↔frontend. Acá n8n **orquesta** sistemas que ya existen | Un dato que entra por un canal llega correcto al otro extremo |
  | 7 | Pruebas y aseguramiento | Tests, evaluaciones de agentes, revisión de permisos y seguridad | Sin errores críticos conocidos; agentes evaluados, no solo probados a ojo |
  | 8 | Despliegue y piloto | Puesta en producción real, con vigilancia cercana | Corrió en producción un tiempo razonable sin incidentes graves |
  | 9 | Operación y mejora continua | Mantenimiento, features nuevas, correcciones del uso real | No sale — es la etapa de reposo mientras el proyecto siga activo |

  **Dónde cae una herramienta no-code** (n8n, Zapier, Make): no tiene etapa
  propia. Si *decide* algo, es etapa 5 como cualquier agente; si solo *mueve*
  datos entre sistemas, es etapa 6.

  Las dos columnas viven también en `frontend/dashboard/src/lib/etapas.ts`,
  que es de donde las lee la interfaz al elegir la etapa de un proyecto. Si
  cambian acá, cambian allá.

  **No todo proyecto pasa por las 9.** Es vocabulario compartido para que
  "en qué etapa está" se pueda comparar entre proyectos, no un camino
  obligatorio — `cambiar_etapa_proyecto()` ya permite saltar (ej. un proyecto
  sin IA salta de la 4 a la 6). La complejidad que no cabe en 9 etapas fijas
  vive un nivel más abajo, en el `checklist_items` y los `hitos` propios de
  cada proyecto — no se inventan etapas nuevas por proyecto.
- **Alcance congelado:** al cerrar la Etapa 2 se fija `alcance_congelado_en`.
  Eso es el 100% oficial. Todo lo detectado después entra como
  `candidatos_alcance` y no cuenta en el % hasta que una persona lo aprueba —
  ningún agente aprueba solo.
- **Modalidad del proyecto** (`individual` / `equipo`): decide qué indicadores
  aplican. `indicador_aplicabilidad` guarda los Grupos A/B/C.
- **Transparencia total entre los dos integrantes:** ambos leen todo (incluido
  lo comercial y la auditoría). La diferencia es de escritura: uno tiene
  `rol = 'admin'` y es el único que modifica clientes, montos, catálogos.
- **Ventana de 7 días** para editar `registro_tiempo`; después es inmutable.
- **Tablas de solo-sistema** (`commits`, `pull_requests`, `sesiones_claude_code`,
  `trazas_agente`, `indicador_snapshots`, `tarea_evidencia`, `auditoria_log`):
  se leen pero ningún usuario las escribe; la ingesta usa `service_role`.

## Backend — API de escritura (`backend/api/`)

Express 5 + TypeScript + Zod. Cubre la Fase 02: formularios de proyectos,
miembros y personas.

- **Lecturas: el frontend va directo a Supabase** con la sesión del usuario;
  RLS decide qué ve. La API no tiene rutas GET de datos, porque solo
  reenviarían a Supabase.
- **Escrituras con lógica pasan por la API.** Cada petición trae
  `Authorization: Bearer <access_token de Supabase>`; la API verifica el JWT
  (`getClaims`) y consulta con un cliente que lleva ese token, así que RLS
  sigue aplicando. **La API nunca usa `service_role`.**
- Lo que tiene que ser atómico vive en Postgres
  (`db/migrations/004_funciones_proyectos.sql`), porque supabase-js no tiene
  transacciones: `crear_proyecto` y `cambiar_etapa_proyecto`.

| Método y ruta | Regla que agrega |
|---|---|
| `POST /proyectos` | Crea proyecto + historial de etapa + encargado como miembro `lider`. Alta en etapa ≥ 3 congela el alcance en ese momento |
| `PATCH /proyectos/:id` | Fechas coherentes, encargado activo. No acepta `etapa_actual`, `alcance_congelado_en` ni `creado_por` |
| `POST /proyectos/:id/etapa` | Cierra la etapa abierta, abre la nueva; pasar la Etapa 2 congela el alcance y volver atrás no lo descongela |
| `POST /proyectos/:id/miembros` | Persona activa, una sola membresía activa por proyecto |
| `PATCH /proyectos/:id/miembros/:miembroId` | Solo miembros activos: el historial de quien salió no se edita |
| `POST /proyectos/:id/miembros/:miembroId/salida` | No hay DELETE: se registra `fecha_salida` |
| `POST /personas` · `PATCH /personas/:id` | Solo admin (RLS). Nunca deja la base sin un admin activo |
| `GET /repos/candidatos` | `repos_candidatos` menos lo que ya está en `repositorios`, con métricas reales leídas en vivo de la API pública de GitHub (`services/github.ts`) |
| `POST /repos/vincular` | Crea el proyecto (`crear_proyecto`) y la fila en `repositorios` en un solo paso |
| `POST /repos/sugerir-etapa` | Lanza el Sugeridor de etapa (agente Python) y devuelve `{etapa, evidencia, dudas}`. Solo lo dispara el botón "Sugerir"; la persona confirma antes de guardar |
| `POST /proyectos/:id/tareas` | Tarea semanal. `persona_id` por defecto quien la crea; asignarla a otra solo si es admin (RLS). Chequeo extra: la persona debe ser miembro activo del proyecto |
| `PATCH` · `DELETE /proyectos/:id/tareas/:tareaId` | Solo quien la tiene asignada o admin (RLS). `PATCH` acepta `completado`; `completado_en` lo fija el servidor al marcar y lo limpia al desmarcar (migración 014) |
| `POST /proyectos/:id/bloqueos` | Abre un bloqueo — siempre a nombre de quien lo crea, no hay "abrir a nombre de otro" |
| `POST /proyectos/:id/bloqueos/:bloqueoId/resolver` | Cierra el bloqueo (`resuelto_en`, `resuelto_por` = quien resuelve). No se puede resolver dos veces |
| `POST` · `PATCH` · `DELETE /proyectos/:id/checklist[/:itemId]` | Ítem de checklist por etapa. `completado_por`/`completado_en` los fija el servidor al marcar; desmarcar los limpia. Miembro, líder o admin (RLS) |
| `POST /proyectos/:id/checklist/escanear` | Lanza el Verificador de checklist: siembra de `checklist_plantilla` lo que falte y escribe `estado_agente`/`evidencia`/`evidencia_archivo`, más la fecha de la evidencia en lo que da por hecho. **Nunca toca `completado`** — eso lo confirma una persona, ítem por ítem |
| `POST` · `PATCH` · `DELETE /proyectos/:id/hitos[/:hitoId]` | Hito, con `etapa` opcional. Marcar `estado = cumplido` sin `fecha_real` la fija en hoy; si el body la trae, se respeta (sirve para cargar historia vieja). Solo líder o admin (RLS) |

**`repos_candidatos`** (tabla nueva, `db/migrations/005`) es la lista de vigilancia
del admin — repos que interesa vincular, no un rastreo de toda una cuenta de
GitHub. Se siembra a mano por ahora; agregarlo automático es un candidato
aplazado en `DECISIONES.md`. El lector de `services/github.ts` **no usa la
GitHub App ni requiere token** — pega directo a la API pública de GitHub, así
que solo funciona con repos públicos. Repos privados (los tuyos, hoy) salen con
`disponible: false` hasta configurar `GITHUB_TOKEN`.

**`GITHUB_TOKEN` dejó de ser opcional en la práctica** (comprobado el
2026-09-18): sin él son 60 peticiones/hora **por IP**, y `GET /repos/candidatos`
gasta 12 cada vez que se carga la pantalla — dos por candidato. A las ~5
recargas, GitHub devuelve 403 y *todos* los repos aparecen como "sin acceso",
que se lee igual que si fueran privados. Con token son 5000/hora. Si la tabla
aparece toda en gris, es esto antes que cualquier otra cosa: se verifica con
`curl -s https://api.github.com/rate_limit`.

Errores: `{ "error": { "mensaje", "detalles"? } }` — 400 validación, 401
sesión, 403 permiso, 404, 409 duplicado, 422 regla de negocio.

**Correr local:** `cd backend/api && npm install`, crear `backend/api/.env`
con la sección Backend de `.env.example`, y `npm run dev`.

**Tras cada migración**, regenerar `backend/api/database.types.ts` (MCP de
Supabase `generate_typescript_types`) y correr `npm run typecheck`.

## Frontend — dashboard (`frontend/dashboard/`)

React + Vite + TypeScript + Zustand + CSS Modules + react-router-dom
(`DECISIONES.md [D2]`, 2026-09-18). Dirección visual **"Consola"** (elegida el
2026-09-16 entre 3 mockups): oscura y densa, IBM Plex Sans/Mono, acento cian —
barra lateral + tabla, no tarjetas. Sigue sin ser branding final de Hello
Minus, solo dejó de ser neutra-sin-decidir. Tokens en `src/lib/tokens.css`.

- **Rutas:** `/` (`Proyectos.tsx`, descubrimiento + lista) y `/proyectos/:id`
  (`Proyecto.tsx`, detalle — ver abajo).

- **Auth:** `Login.tsx` registra e inicia sesión directo contra Supabase Auth
  (`supabase.auth.signUp` / `signInWithPassword`). Es la forma real de que los
  dos integrantes entren al sistema — reemplaza invitarlos a mano desde el
  dashboard de Supabase.
- **Alta de proyectos es por descubrimiento, no por formulario.** `Proyectos.tsx`
  muestra los repos de `repos_candidatos` que todavía no tienen fila en
  `repositorios` (ver Backend abajo), con sus métricas reales de GitHub. Vincular
  uno crea el proyecto y el repo en un solo paso — la persona solo completa lo
  que GitHub no puede saber: etapa actual, fecha de inicio real, encargado.
- **`AppShell.tsx`** es el layout con barra lateral; las secciones que todavía
  no existen (Equipo, Actividad, Indicadores, Ajustes) se muestran marcadas
  "pronto", no como enlaces muertos. Tiene el selector de tema día/noche
  (`stores/themeStore.ts`, persiste en `localStorage`).
- **Equipo sin un único encargado.** `proyectos.encargado_id` es una sola
  persona (lo exige RLS para gobernar el proyecto), pero un proyecto en
  modalidad "Equipo" no tiene un dueño único de verdad. Al vincular en Equipo,
  el formulario no pregunta encargado: `POST /repos/vincular` pone como
  `encargado_id` a quien vincula (así pasa la política sin ser admin) y agrega
  a **todas las demás personas activas** como miembros con rol `lider` —
  las dos gobiernan el proyecto por igual. En Individual sigue preguntando.
- **Lecturas:** `services/` consulta Supabase directo con la sesión del
  usuario; RLS decide qué ve.
- **Escrituras con lógica:** pasan por `backend/api/` (`VITE_API_URL`), con
  `Authorization: Bearer <access_token>`.
- **`Ingeniería Agéntica` (`/agentes` y `/agentes/:id`)**, agregada el 2026-09-23:
  vitrina de los agentes que llaman a Claude en este CRM, mostrados por su
  **forma** — cuántos pasos tiene su grafo, si tiene loop, qué harness lo
  invoca — no por texto. Los datos viven en `frontend/dashboard/src/lib/agentes.ts`
  como constante (mismo criterio que `etapas.ts`: es un hecho del código, no algo
  que cambie por proyecto). Un solo componente, `components/GrafoAgente.tsx`,
  dibuja el grafo en dos tamaños (miniatura en la tarjeta, grande en el
  detalle) a partir de esa lista de pasos — agregar un agente nuevo es agregar
  una entrada en `agentes.ts`, nunca dibujar SVG a mano.

  **`tieneLoop` es un campo, no una regla fija.** Hoy los tres agentes (Clasificador,
  Sugeridor de etapa, Verificador de checklist) valen `false` — ninguno vuelve sobre
  su propia salida. `GrafoAgente` lo usa para decidir la lectura de la última flecha:
  si es `true`, la dibuja sólida y real; si es `false` y el agente tiene más de un
  paso, dibuja la misma flecha en gris punteado, rotulada "no ocurre" — enseña qué es
  un loop sin fingir que el agente lo tiene.

  La sección "Agentes de otros proyectos" hace una consulta real contra
  `trazas_agente` (`services/trazasAgenteService.ts`), no un cero fijo: hoy da 0
  porque ningún repo instaló `hello-minus-telemetry` todavía (verificado
  buscando la referencia en los 6 repos candidatos), pero el día que alguien lo
  instale este número cambia solo, sin tocar código.

- **`Indicadores` (`/indicadores`)**, agregada el 2026-09-23: el catálogo — la
  **definición** de cada indicador, no su número. Agrupado por tipo
  (Productividad, Efectividad...) con el Grupo A/B/C/Nuevo como etiqueta por
  fila; ver la sección Fase 07 para qué significa cada columna. Los valores
  calculados no viven acá: viven en cada proyecto.

- **Resultados por indicador (`/indicadores/:codigo`)**, agregada el 2026-09-25:
  cada fila del catálogo tiene "Ver resultados →". La página lee todos los
  snapshots del indicador, los agrupa por alcance (chips: empresa / proyecto /
  persona) y elige **una sola forma** según el dato real de ESE alcance
  (`formaDe` en `pages/IndicadorDetalle.tsx`): `valor` NULL → solo el detalle
  cualitativo; 2+ semanas → serie de barras; 1 semana → número único. Nada de
  gráficos decorativos donde el dato no los pide, y el % de cambio va en color
  neutro (subir no siempre es bueno). El `detalle` jsonb lo dibuja un solo
  componente genérico (`components/DetalleSnapshot.tsx`) que entiende las tres
  formas que escribe el Motor — listas (`por_persona`, `por_area`), mapa por
  modalidad (#26) y campos sueltos —, así un calculador nuevo no obliga a tocar
  la pantalla. Proyecciones: descartadas a propósito por ahora (no hay
  historial para proyectar).

- **"Aporte por integrante"** en `Proyecto.tsx` (indicador #29): lee el último
  snapshot, no calcula en vivo — marcar una tarea terminada no mueve el número
  hasta que corre el motor, y la pantalla lo dice. **Todas las barras van en
  el mismo color**, a propósito: el mockup aprobado usaba verde/ámbar según el
  porcentaje, y eso leía "a uno le va bien y al otro mal", justo la comparación
  entre personas que el doc de indicadores prohíbe. Cada porcentaje se mide
  contra la porción de esa persona; nunca se muestran como partes de un total.

- **`Proyecto.tsx` (`/proyectos/:id`)** es el detalle de un proyecto —
  estructura "Consola de Proyecto" (una de 3 propuestas comparadas el
  2026-09-18, ver el historial de la conversación): rail de las 9 etapas
  arriba, dos columnas abajo (checklist + hitos · tarea semanal con su
  rastro + bloqueos). Deriva "saltada" vs. "pendiente" comparando
  `historial_etapas` contra `etapa_actual`, no viene de la base como campo.
  Actualización optimista solo en el toggle del checklist (revierte si la
  API rechaza); el resto espera la respuesta antes de reflejar el cambio.

**Correr local:** `cd frontend/dashboard && npm install`, crear
`frontend/dashboard/.env` con la sección Frontend de `.env.example`
(+ `VITE_API_URL`), y `npm run dev`. Necesita la API corriendo en paralelo
para crear proyectos.

## Fase 03 — Etapas, checklist, tareas semanales, bloqueos y Detector de rastro

`tareas_semanales`, `bloqueos`, `checklist_items` e `hitos` ya tenían RLS
completo desde la Fase 01 (`db/policies/001_baseline.sql`) — lo que faltaba
era la capa de API (rutas arriba) y el agente 04 del catálogo. Ninguna de las
cuatro necesitó migración.

**Quién escribe qué, según el RLS que ya existía:** `checklist_items` y
`bloqueos` los escribe cualquier miembro del proyecto (aportar no es
gobernar); `hitos` solo el líder o el admin (`gobernar_hitos`), igual que
`candidatos_alcance` — lo que mueve las fechas comprometidas del proyecto no
lo cambia cualquiera.

**Ese límite está verificado contra la base real** (2026-09-18), no solo
documentado: un miembro que no es encargado puede escribir `checklist_items`
y recibe `42501` al intentar escribir `hitos`; el encargado sí puede. La
prueba corrió dentro de una transacción revertida, sobrescribiendo
`private.persona_actual()` y forzando `private.es_admin() = false` para
aislar el camino de "encargado" del de "admin" — el DDL también se revierte,
y se verificó después que las dos funciones volvieran a su definición
original. **No se puede simular un usuario poniendo un `auth_user_id`
inventado:** hay un FK contra `auth.users` que lo impide (y está bien que
así sea).

**Detector de rastro semanal** (`scripts/detectar_rastro_semanal.py`), con el
Verificador de evidencia (agente 13) fusionado adentro por decisión de
`docs/agentes-crm-productividad-hello-minus.md` — no se construye aparte.
Corre los sábados a las 12:00 Colombia
(`.github/workflows/detectar-rastro-semanal.yml`).

- Por cada `tareas_semanales`, cruza las áreas declaradas contra
  `commits.area_inferida`, `pull_requests.area_inferida` y
  `sesiones_claude_code.area_inferida` de la misma persona, mismo proyecto,
  dentro de `[semana_inicio, semana_fin]`. Lo que encuentra queda en
  `tarea_evidencia`.
- Es consulta cruzada entre tablas, no juicio — determinístico, sin Claude.
- **Una tarea sin evidencia no es un error de la corrida:** es la señal en sí
  misma (alguien declaró un área en la que no dejó rastro). No se completa ni
  se corrige sola.
- Idempotente: `tarea_evidencia_unica` (`persona, área, fuente, referencia`)
  evita duplicar evidencia ya encontrada en corridas anteriores.
- Probado de punta a punta contra la base real: sembré una tarea con 2 áreas
  declaradas y evidencia real solo en una — confirmó que encuentra las 3
  fuentes en el área correcta y no inventa nada en la otra.

## Fase 07 — Motor de indicadores (`scripts/calcular_indicadores.py`)

**Arrancada el 2026-09-23.** Script, no agente: el "LLM parcial" del diseño
original era para inferir el área de un archivo, y eso ya lo resuelve
`scripts/inferir_area.py` desde la Fase 06.

**Disparador** (`.github/workflows/calcular-indicadores.yml`, 2026-09-24):
a diferencia de los otros tres workflows de este repo, que solo desfasan el
horario "para no pisarse", acá el orden con el Clasificador es una
dependencia real — varios calculadores leen `tipo_inferido`/`persona_id` de
commits recién clasificados. Por eso usa `workflow_run` (arranca cuando el
Clasificador de commits **terminó de verdad**, con `conclusion == 'success'`)
en vez de un cron con un horario detrás — un cron solo garantiza "ya debería
haber terminado", no que terminó.

**Catálogo sembrado** (migración 015): los 29 indicadores numerados de
`docs/indicadores-individuales-hello-minus.md` + su aplicabilidad por
modalidad. Quedan afuera los 9 que el doc marca "dependen 100% del cliente".
El doc habla de un "catálogo general de 50" que **no existe en el repo** —
29 + 9 = 38; no se sembraron filas para llegar a un número que no corresponde
a nada escrito. Tres cosas quedaron vacías porque el doc no las decide: el
`plazo` (inmediato/mediano/largo) de todos, la fila `equipo` de los 9 "nuevos
para individual" (sin fila = no decidido, que no es lo mismo que
`aplica = false`), e `indicador_madurez`.

**El Grupo A/B/C/Nuevo no se guarda en ninguna columna** — se deriva de
`indicador_aplicabilidad` (`grupoDe` en `frontend/dashboard/src/lib/indicadores.ts`).
Guardarlo además sería el mismo dato en dos lugares.

Reglas del motor, que valen para todo calculador que se agregue:

- **Un snapshot por semana**, `periodo` = el lunes. Correr dos veces la misma
  semana pisa (upsert contra `snapshot_unico`); las semanas pasadas no se tocan.
- **Sin datos no hay snapshot.** No se escribe un cero: la ausencia de fila es
  la respuesta honesta, un cero diría "se midió y dio cero".
- **Indicadores de persona-dentro-de-un-proyecto van con `scope_type = 'proyecto'`**
  y el desglose por persona en `detalle.por_persona`. No se puede usar
  `scope_type = 'persona'`: el constraint único es
  `(indicador_code, scope_type, scope_id, periodo)`, y una persona en dos
  proyectos chocaría consigo misma la misma semana.
- **`scope_type = 'portafolio'`** (compara toda una modalidad contra la otra,
  no un proyecto puntual) usa un UUID fijo (`PORTAFOLIO_SENTINEL`, todo ceros)
  como `scope_id`, nunca `NULL`: dos filas con `NULL` nunca chocan en un
  `UNIQUE` de Postgres, así que el upsert duplicaría una fila por corrida en
  vez de pisarla.

**Los 13 indicadores con fuente ✓ ya están construidos y probados** (2026-09-24,
con Sonnet — Opus solo arrancó el motor). El esquema los respalda sin esperar
telemetría ni datos que no se capturan todavía:

| Código | Ventana | Nota |
|---|---|---|
| `13_commits_proyecto` | acumulado | el primero — probó el motor contra datos reales (dio 3) |
| `29_avance_atribuido` | acumulado | `valor` NULL: no hay un número de proyecto, solo porciones |
| `01_throughput` | esta semana | tareas cerradas, no acumulado como los de arriba |
| `04_tiempo_primer_avance` | acumulado | fecha REAL del primer commit/PR/sesión, no `tarea_evidencia.detectado_en` (que es cuándo corrió el Detector) |
| `14_consistencia` | esta semana vs. 8 previas | ceros reales en semanas sin cierres, no se ignoran |
| `17_bus_factor` | acumulado | con una sola persona da 100% solo, sin caso especial por modalidad |
| `20_estabilidad_equipo` | acumulado | cuenta de gente que salió alguna vez |
| `21_autosuficiencia` | acumulado | % de bloqueos resueltos por quien los abrió |
| `24_documentacion` | acumulado | % de commits `tipo_inferido = 'documentacion'` |
| `22_ritmo_sostenido` | 8 semanas | coeficiente de variación de commits/semana — varianza, no un ratio puntual |
| `23_autocomparacion` | acumulado | solo individual: ritmo de este proyecto vs. otros individuales de la misma persona |
| `26_bloqueo_individual_compartido` | acumulado, portafolio | `valor` NULL: "individual 2 días, equipo 0.5" no cabe en un número |
| `28_intervencion_cruzada` | acumulado | commits de alguien que no es el encargado, en un proyecto individual |

Todos probados contra la base real dentro de transacciones revertidas
(sembrando datos de prueba cuando hacía falta, verificando el resultado
esperado a mano, y confirmando después que la base quedó igual que antes).

**Primera corrida real, 2026-09-24** (con confirmación explícita — escribir en
`indicador_snapshots` es un recurso compartido): `13_commits_proyecto`,
`17_bus_factor`, `20_estabilidad_equipo` (los dos proyectos) y
`24_documentacion` quedaron con snapshots reales. Los otros 9 corrieron sin
error pero no escribieron nada — no es un fallo, es "sin datos no hay
snapshot": `tareas_semanales` y `bloqueos` siguen vacías en producción.

**Los 12 indicadores ◐ también están construidos y probados** (2026-09-25, con
Sonnet, un día después de activar la telemetría de este mismo repo — ver
"Telemetría propia" más abajo). Mismo molde y mismas reglas que los 13 ✓:

| Código | Scope | Nota |
|---|---|---|
| `02_ratio_facturable` | persona | % facturable de TODO el tiempo de la persona, no de un proyecto puntual |
| `05_dispersion` | persona | proyectos distintos con horas registradas ESTA semana |
| `07_continuidad_foco` | persona | horas activas del día / proyectos distintos del día, promediado sobre la semana |
| `08_densidad_interrupciones` | persona | cambios de proyecto entre sesiones consecutivas del mismo día (`lag`) |
| `09_horas_por_proyecto` | proyecto | acumulado — igual que `13` pero con horas en vez de commits |
| `10_sesiones_claude_code` | proyecto | acumulado — el primero de los 12 con datos reales desde el día uno |
| `11_perfil_especializacion` | persona | % de tiempo por área, de TODOS los proyectos. `valor` NULL, como `26` y `29` |
| `15_rendimiento_hito` | proyecto | Grupo B, solo individual — horas/hito de este proyecto vs. el promedio de otros individuales de la misma persona, misma estructura que `23` |
| `16_contribucion_ponderada` | proyecto | Grupo B, solo individual — reparto del propio tiempo por área dentro de un proyecto, no compara contra nadie (a diferencia de `11`) |
| `18_ratio_colaboradores` | proyecto | acumulado — con 1 colaborador el número sale solo, sin caso especial (igual que `17`/`20`) |
| `25_modo_solitario` | portafolio | el único de los 12 con un número único honesto: % de horas de la empresa que fueron en proyectos individuales |
| `27_balance_carga` | portafolio | `PORTAFOLIO_SENTINEL`, `valor` NULL — es la única comparación directa entre personas que el propio doc pide (no viola la regla de "Aporte por integrante": ahí la prohibición es entre porcentajes dentro de un mismo proyecto, esto es un total de empresa) |

Probados en una sola transacción revertida, sembrando `registro_tiempo`,
`hitos`, `sesiones_claude_code` y un segundo proyecto individual efímero —
los 12 dieron el resultado esperado a mano, incluida una verificación cruzada
con datos reales que ya existían (una fila de `registro_tiempo` de 0.01
horas y sesiones reales adicionales, producto de que la telemetría de este
repo ya está viva).

**La columna "fuente" del catálogo es un hecho del esquema, no de los datos**
(`FUENTE` en `lib/indicadores.ts`): ✓ el esquema lo respalda, ◐ espera
telemetría de Claude Code, ○ falta capturar un dato. Regla: se mide lo que el
doc DEFINE, no un sustituto — si dice "% de tiempo", un proxy con commits sería
otro indicador con el mismo nombre. **Los 29 de 29 están construidos y
probados** (originalmente 13 ✓ + 12 ◐ + 4 ○, completado el 2026-09-25 — los
4 ○ pasaron a ✓ en `lib/indicadores.ts` apenas la migración 017 les dio
campo real; el esquema ya no distingue esos 4 de los primeros 13).

**Los 4 ○ necesitaron migración nueva** (`db/migrations/017_captura_indicadores_o.sql`),
decidida ítem por ítem con el usuario antes de escribir nada — 4 tablas, cada
una con su propia razón de forma:

| Código | Tabla nueva | Nota |
|---|---|---|
| `03_precision_estimacion` | `estimaciones_tarea` | tabla aparte de `tareas_semanales`, con su propio rango de fechas — una estimación puede cubrir menos que la semana entera de la tarea |
| `06_carga_vs_capacidad` | `capacidad_persona` | con historial (`vigente_desde`), no un solo campo en `personas` — perder el valor viejo rompería indicadores de semanas pasadas |
| `12_versatilidad` | `tipos_proyecto` + `proyectos.tipo_id` | mismo patrón que `canales_venta`: tabla chica, no enum. Sembrada con 7 tipos (CRM, Chatbot, Dashboard, Integración, Sitio web, Automatización, Otro). `proyectos.tipo` (texto libre) no se migra — nunca se sembró con disciplina |
| `19_capacidad_coordinacion` | `reuniones` | **la única captura manual de tiempo en todo el sistema** — `registro_tiempo` sigue 100% inferido (Fase 04, sin tocar). `proyecto_id` obligatorio: el doc marca esto "No aplica" en individual, así que ese caso nunca tiene filas, sin necesitar filtrar por modalidad en el SQL |

Probadas en una transacción revertida sembrando las 4 a la vez; sin datos
reales todavía. **Las 4 ya tienen pantalla** (2026-09-25, ver "Pendiente /
en decisión" más abajo): rutas nuevas en el backend
(`routes/estimaciones.ts`, `routes/capacidad.ts`, `routes/reuniones.ts`, y
`tipo_id` sumado al `PATCH /proyectos/:id` que ya existía) más su UI. Ninguna
tiene edición ni borrado más allá de lo que la propia RLS permite —
`estimaciones_tarea` y `capacidad_persona` son historial de solo-insert por
diseño (Fase 07 arriba); `reuniones` sí tiene DELETE, igual que bloqueos: si
se registró mal, se borra y se vuelve a crear, no hay PATCH de texto.

### Telemetría propia (2026-09-25)

Este repo fue el primer proyecto en activar telemetría real de Claude Code —
hasta entonces todo daba 0. Clave de ingesta creada por SQL directo (no hay
botón en el dashboard todavía — `POST /proyectos/:id/claves` existe en el
backend, sin pantalla); las 6 variables OTEL viven en
`.claude/settings.local.json` (gitignorado por una regla global, nunca en
`backend/api/.env`, que no lo lee Claude Code). Se encontró y corrigió un
desajuste real: `personas.email` de Juan no coincidía con el email de su
cuenta de Claude, lo que hubiera dejado cada sesión huérfana (sin
`persona_id`) — verificado que el trigger de `auth_user_id` (migración 001)
solo corre una vez al registrarse, así que corregir el email no rompe el
login. Confirmado con datos reales: aparecieron sesiones nuevas en
`sesiones_claude_code`, correctamente atribuidas.

**`tareas_semanales.completado`** (migración 014) existe para esto: #29 necesita
"esto es tuyo" + "esto está terminado", y ninguna tabla juntaba las dos
(`checklist_items` no tiene dueño, `hitos` ni siquiera tiene `persona_id`). Es
una declaración de la persona, no una verificación — la evidencia real sigue en
`tarea_evidencia`, y las dos señales juntas son lo que vale.

## Fase 04 — Registro de tiempo (`scripts/derivar_registro_tiempo.py`)

**100% inferido, sin captura manual** (decidido el 2026-09-17). `registro_tiempo`
es de solo-sistema, igual que `commits` o `sesiones_claude_code` — nadie la
escribe a mano (`db/migrations/009_registro_tiempo_inferido.sql` retiró las
políticas de escritura de personas). La llena sola
`scripts/derivar_registro_tiempo.py`, aritmética pura sin Claude de por medio,
disparada por `.github/workflows/derivar-registro-tiempo.yml` todos los días
a la 1 AM Colombia.

- **Un día = un bucket.** Se agrupa por la fecha de `inicio` de la sesión de
  Claude Code — si cruza medianoche, todo el tiempo activo cae en el día en
  que empezó.
- **`area`** sale de `sesiones_claude_code.area_inferida`; sin área cae en
  `'sin_clasificar'`, nunca NULL (lo exige el constraint único
  `persona_id, proyecto_id, fecha, area`).
- **`tipo`** (facturable/interno) se decide por el proyecto: facturable si
  tiene `cliente_id`, interno si no.
- **Idempotente por diseño:** cada corrida recalcula el total del día desde
  cero y hace upsert — como una sesión puede seguir creciendo (merge por
  `session_id`), no hay forma de "sumar solo lo nuevo" sin sumar todo de
  nuevo, así que se abraza eso en vez de tratar de evitarlo.
- **Consecuencia aceptada:** solo cuenta tiempo que pasó por Claude Code.
  Reuniones, llamadas con cliente o trabajo sin el agente no entran.

## Canal 1 — GitHub (`backend/functions/github-webhook/`)

Edge Function de Supabase (Deno). No llama a Claude: es script, pero vive acá
y no en `scripts/` porque la invoca GitHub por HTTP. **No moverla**: la URL de
la GitHub App apunta a ella.

- **URL:** `https://qutqsyokdlitflybfrus.supabase.co/functions/v1/github-webhook`
- **Despliegue:** MCP de Supabase `deploy_edge_function` con los tres archivos
  y `verify_jwt: false` — GitHub no manda JWT de Supabase; la autenticación es
  la firma HMAC (`X-Hub-Signature-256`) que valida `firma.ts`.
- **Escribe con la llave secreta** (`SUPABASE_SECRET_KEYS.default`), que salta
  RLS: `commits` y `pull_requests` son de solo-sistema.
- **Eventos:** `push` → `commits` (hasta 2048 por push, deduplicados por
  `repo_id + sha`); `pull_request` (opened, reopened, edited, closed,
  synchronize) → `pull_requests`; `ping` → 200. Todo lo demás → 202 ignorado.
- **Repos sin vincular se ignoran** (202) y quedan en los logs de la función.
  Vincular un repo a un proyecto es una fila en `repositorios` con
  `github_repo = "dueño/nombre"`; el `github_installation_id` lo llena el
  receptor solo.
- **Atribución:** `personas.github_username` sin distinguir mayúsculas; si el
  commit no trae usuario, por email. Sin coincidencia queda `persona_id` NULL.

Lo que este receptor **no** hace todavía: archivos tocados de un PR (el
payload no los trae; hace falta la API con credenciales de la App),
`area_inferida`/`tipo_inferido` (Clasificador nocturno), y seguir un repo
renombrado (se busca por nombre, no por id).

**Backfill del historial** (`scripts/backfill_commits.py`, 2026-09-25):
herramienta manual, no parte de la cadena nocturna — se corre una vez por
repo, cuando hace falta traer lo que pasó antes de vincularlo (el webhook
solo captura desde ese momento en adelante). Mismo criterio de atribución
que `eventos.ts` (usuario de GitHub primero, email de respaldo), y deja
`area_inferida`/`tipo_inferido` en NULL igual que el webhook — el
Clasificador los toma en su próxima corrida, sin distinguir "commit viejo"
de "commit nuevo". No escribe en Supabase directo: sin `DATABASE_URL` local
(es secreto solo de GitHub Actions) ni `SUPABASE_SERVICE_ROLE_KEY`
configurada, el script solo habla con GitHub y deja las filas listas en un
JSON — la inserción se hace aparte, con el conector de Supabase.

Corrido por primera vez este mismo día contra este repo: 38 commits
encontrados en GitHub desde el primer commit (28-ago), 37 insertados. Uno
quedó afuera por un falso positivo del guardrail de SQL local (`d3f422c8`,
el commit que agregó el propio guardrail — su mensaje describe en texto
"DISABLE ROW LEVEL SECURITY" y el hook lo lee como si fuera SQL real dentro
del `INSERT`, no como el contenido de un mensaje). Decisión del usuario:
dejarlo afuera, no vale la pena tocar el guardrail por un commit histórico.

## Canal 2 — Telemetría (`backend/functions/ingesta-telemetria/`)

Edge Function de Supabase, mismo patrón que el receptor de GitHub (validación
pura en `eventos.ts`, probable con Node sin desplegar). **Fase 06, parte 1 de 3.**

- **URL:** `https://qutqsyokdlitflybfrus.supabase.co/functions/v1/ingesta-telemetria`
- **Autenticación:** cabecera `X-API-Key` con una clave por proyecto. En
  `claves_ingesta` solo vive el SHA-256 — la clave en claro se muestra una sola
  vez al crearla (`POST /proyectos/:id/claves`) y no se puede recuperar.
- **El `proyecto_id` sale de la clave, nunca del cuerpo:** una clave no puede
  escribir telemetría de otro proyecto aunque lo intente.
- **Dos tipos de evento**, hasta 500 por petición:
  - `traza_agente` → `trazas_agente`. Requiere `run_id`.
  - `sesion_claude_code` → `sesiones_claude_code`. Requiere `session_id` e
    `inicio`; hace upsert por `session_id`, así una sesión se puede reportar
    varias veces mientras avanza (crece `prompt_count`, al final llega `fin`).
- **Atribución de personas:** el proyecto manda `persona` con un email o un
  usuario de GitHub; se resuelve sin distinguir mayúsculas. Sin coincidencia la
  sesión entra huérfana, igual que un commit sin autor conocido.

### Cómo reporta cada proyecto

**Sus propios agentes** → paquete `paquetes/hello-minus-telemetry` (JS plano,
sin dependencias). Agrupa, reintenta una vez, y **nunca lanza hacia el
proyecto que lo usa**: la telemetría no puede tumbar un proyecto. Sin
`HELLO_MINUS_TELEMETRY_KEY` queda inerte con un aviso. Su distribución
(repo propio vs. npm vs. copiar) está sin decidir — ver su README.

**Claude Code** → Edge Function `backend/functions/ingesta-otel/`, que habla
OTLP/JSON directo. **No hace falta el colector de OpenTelemetry** que asumía
`docs/paso-a-paso-vincular-proyectos-hello-minus.md`: Claude Code soporta
`http/json` y postea solo a `/v1/metrics` y `/v1/logs`. Se configura así en
cada proyecto:

```
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
OTEL_EXPORTER_OTLP_ENDPOINT=https://qutqsyokdlitflybfrus.supabase.co/functions/v1/ingesta-otel
OTEL_EXPORTER_OTLP_HEADERS=X-API-Key=<la clave del proyecto>
```

De ahí salen `session.id`, `user.email` (para atribuir la persona),
`claude_code.active_time.total` y el conteo de eventos
`claude_code.user_prompt`. **El contenido de los prompts no se envía**: Claude
Code no lo incluye salvo que se active a mano, y no se activa.

Los lotes llegan desordenados y con contadores acumulativos, así que la
fusión la hace `registrar_sesion_claude_code` en SQL
(`db/migrations/008`): la ventana solo crece (`least`/`greatest`), la duración
se queda con la mayor, los prompts se **suman** (cada lote trae solo los
suyos) y la persona resuelta no se pierde si un lote posterior llega sin email.

Métricas que hoy se descartan a propósito: costo, tokens, líneas de código,
commits y PRs de Claude Code — `sesiones_claude_code` no tiene columnas para
eso y no se inventa esquema por el camino. Es una decisión a tomar cuando se
construya el Motor de indicadores (Fase 07).

### Clasificador de commits (`backend/agent/clasificador_commits/`)

Fase 06, parte 3 de 3 — **completa**. El primer y único agente de este CRM
que llama a Claude. Usa `client.messages.parse()` con un modelo de Pydantic
como esquema de salida (no un `output_schema.json` suelto: el modelo de
Python ES el esquema — ver el archivo `modelos.py` para el porqué de esta
desviación del molde de `estructura.yaml`).

- **`tipo_inferido`** (funcionalidad / arreglo / refactor / documentacion /
  configuracion / otro) sale del LLM — necesita leer intención, no hay regla
  determinística razonable.
- **`area_inferida`** sale de `scripts/inferir_area.py`, puramente
  determinístico. El agente nunca la calcula — regla de STACK.md.
- `ejecutar.py` es el orquestador: lee `commits` sin clasificar, llama a los
  dos, actualiza. Un lote que falla no aborta la corrida.
- Probado con datos reales de este propio repo, contra la API de Claude y
  contra la base real de Supabase (sembrando y limpiando commits de prueba).
- **Disparador:** `.github/workflows/clasificador-commits.yml`, cada 3 días a
  las 2 AM Colombia. GitHub Actions y no `pg_cron` porque el clasificador está
  en Python y las Edge Functions solo corren Deno. Necesita los secretos
  `ANTHROPIC_API_KEY` y `DATABASE_URL` en GitHub — **configurados desde el
  2026-09-17** (verificado con `gh secret list` y con corridas reales
  exitosas por horario el 19 y el 22 de septiembre). `calcular-indicadores.yml`
  reusa el mismo `DATABASE_URL`, sin nada más que configurar.

### Sugeridor de etapa (`backend/agent/sugeridor_etapa/`)

Segundo agente con LLM, y el primero que **no** corre por horario: lo dispara
el botón "Sugerir" del panel de vinculación y una persona espera la respuesta
en pantalla. Mira la estructura del repo en GitHub (carpetas hasta 2 niveles +
archivos que delatan madurez a cualquier profundidad) más su actividad de
commits, y propone en cuál de las 9 etapas está el proyecto, con evidencia.

- **Sugiere, no decide.** Prellena el selector; la persona confirma. No es
  formalidad: pasar de la etapa 2 congela el alcance y no se revierte. El
  prompt le pide elegir la etapa **más temprana** ante la duda y decir qué le
  falta ver — misma regla que `candidatos_alcance`, ningún agente aprueba solo.
- **No toca la base.** Recibe JSON por stdin, devuelve JSON por stdout.
- `effort: medium` (el Clasificador usa `low`): acá hay señales que se
  contradicen entre sí, no una frase que categorizar.

**El puente Node→Python** (`backend/api/services/sugeridorEtapa.ts`) es
arquitectura nueva: Express corre en Node y los agentes son Python
(`DECISIONES.md [D1]`), y hasta ahora ningún agente se invocaba en caliente.
Se resolvió lanzándolo como **proceso hijo** porque se ejecuta un puñado de
veces en la vida del sistema. **Letra chica:** asume Python disponible donde
se despliegue el backend, con `backend/agent/requirements.txt` instalado — hoy
eso solo se cumple en local y la fase de hosting sigue sin decidirse. Si el
backend termina en un runtime sin Python, esto hay que repensarlo (servicio
Python aparte, o Edge Function si algún día los agentes fueran TypeScript).

Detalle importante de Windows: `ejecutar.py` fuerza `stdout` a UTF-8. Sin eso
Python escribe en cp1252 y los acentos llegan rotos a Node ("d�as").

### Verificador de checklist (`backend/agent/verificador_checklist/`)

Tercer agente con LLM. Lo dispara el botón "Generar con agente IA" de la
pantalla de detalle: lee el repositorio y decide, ítem por ítem, qué del
checklist ya está hecho, con evidencia. Ver su README para el detalle.

- **Nunca escribe `completado`.** Solo `estado_agente`, `verificado_en` y
  `evidencia` (migraciones 011 y 013). Confirmar es un clic humano, ítem por
  ítem — no hay "confirmar todos", se descartó a propósito: si 2 de 3
  detecciones son buenas y una no, aceptar el lote entero obligaría a tragarse
  la mala.
- **El veredicto tiene tres valores, no dos** (`sin_empezar` / `en_proceso` /
  `hecho`), más `NULL` para "nunca lo miró". `en_proceso` se agregó el
  2026-09-22 porque era la respuesta más común en proyectos vivos y la que se
  perdía: un repo con tests para 2 de 10 módulos se guardaba igual que uno sin
  una línea escrita. El prompt exige que la evidencia de `en_proceso` traiga
  **las dos mitades** — qué hay y qué falta — y que ante la duda entre dos
  estados se elija siempre el menor.
- Los ítems ya confirmados **no se le mandan**: no puede decir nada que cambie
  algo, y no gasta tokens.
- **Lee el `CLAUDE.md` del repo ajeno si lo tiene** (`leerClaudeMd` en
  `services/github.ts`). Es la señal más fuerte que hay —una persona
  declarando qué construyó, en vez de deducirlo de la forma de las carpetas—
  pero el prompt le pide desconfiar si contradice la estructura, y distinguir
  planes de hechos.
- **Fecha de la evidencia** (migración 016, 2026-09-24): a lo que el agente da
  por hecho se le muestra cuándo se hizo — con honestidad sobre de dónde sale,
  porque "cuándo se hizo" no está guardado en ningún lado. `verificado_en` es
  cuándo miró el agente y `completado_en` cuándo confirmó una persona; ninguna es
  la del trabajo. Se usa, en este orden: (1) el último commit del archivo que el
  agente citó, (2) una fecha escrita a mano en la frase citada, (3) el último
  commit del `CLAUDE.md`, solo si el veredicto se apoyó en él. Sin ninguna, no
  hay fecha. El origen se guarda aparte (`evidencia_fecha_origen`) y la
  pantalla lo dice en el rótulo, con un ⓘ que lo explica al tocarlo.
  **Lo único que pone el agente es `archivo_evidencia`**; elegir la fecha es
  aritmética (`services/fechaEvidencia.ts`) y consultas a GitHub
  (`ultimoCommitDeArchivo`). Cero tokens extra de Claude. La ruta del agente se
  valida contra los archivos que se le mostraron — una inventada no llega a la
  base ni dispara una consulta.
- El tope de lectura de ese archivo son **40.000 caracteres**, subido desde
  12.000 el 2026-09-22 tras una prueba real: con el tope viejo, el `CLAUDE.md`
  de este repo (28 KB) llegaba al 43% y el agente respondía que faltaban
  declaraciones que sí estaban, más abajo.

**`checklist_plantilla`** (migración 011) son los ~31 ítems base por etapa,
iguales para todos los proyectos. **Es tabla y no constante en el código**, a
diferencia de las 9 etapas, porque se decidió que se pueda ajustar sin
desplegar. El escaneo siembra en `checklist_items` lo que falte (idempotente
por `checklist_item_unico`) y después juzga.

**La escala de certeza en pantalla** (dirección "Escala de certeza", elegida el
2026-09-22 entre 2 propuestas): los estados son una escala de menos a más certeza
y cada paso tiene su color, reusando el significado que ese color ya tenía en el
producto — rojo `--error` "falta por construir", cian `--acento` "en proceso"
(el mismo de los hitos en curso), ámbar `--alerta` con botón "Confirmar", verde
`--ok` confirmado. Gris `--dormido` para "sin verificar", que no es un juicio del
agente sino su ausencia.

Dos reglas que no se negocian al tocar esto:

- **Solo `hecho` tiene forma de botón.** Es el único estado que le pide algo a una
  persona; los otros son etiquetas redondeadas sin cursor, para que no inviten a
  tocarlas.
- **El color nunca va solo.** Cada estado lleva su símbolo (`○ ◐ ✓`) porque rojo
  contra verde es justo el par que no distingue un daltónico, y porque la
  jerarquía tiene que sostenerse en escala de grises. Si alguien saca los
  símbolos "porque el color ya se entiende", rompe las dos cosas a la vez.

**`explicacion_simple`** (migración 012) es la misma plantilla, una columna más:
qué significa cada ítem para alguien que no programa. La pantalla la muestra
sobre la evidencia del agente, en violeta (`--guia` en `tokens.css`, un color
que no es ninguno de los estados bien/ojo/mal). Queda en la plantilla y no se
copia a `checklist_items` porque es igual para todos los proyectos — corregir
una redacción la arregla en todas partes sin re-escanear.

**El puente Node→Python se movió** a `services/agentePython.ts` cuando
apareció el segundo agente de este tipo: `sugeridorEtapa.ts` y
`verificadorChecklist.ts` lo comparten en vez de repetir el manejo de proceso.

**Piloto del experimento de costo** (`services/telemetria.ts`, 2026-09-25):
único agente instrumentado hasta ahora, a propósito — antes de tocar los
otros dos se quería probar el patrón con uno solo. `cliente.py` captura
`respuesta.usage` (viene gratis en la misma respuesta del SDK, cero llamadas
extra) y `ejecutar.py` lo suma al JSON de salida como `uso`.
`verificadorChecklist.ts` lo reenvía con el **propio paquete**
`hello-minus-telemetry` — este backend se reporta a sí mismo exactamente
como lo haría cualquier otro proyecto, sin atajos. Como `trazas_agente.tokens`
es una sola columna, cada escaneo genera **dos** filas (`node_name`
`'tokens_entrada'` / `'tokens_salida'`), compartiendo `run_id` para poder
volver a juntarlas — sumarlas en una sola fila hubiera perdido la diferencia
de precio entre token de entrada y de salida, que es todo el punto del
experimento. Clave de ingesta propia (`Backend API — trazas de agentes`,
separada de la de Claude Code para poder revocar una sin apagar la otra) en
`HELLO_MINUS_TELEMETRY_KEY` de `backend/api/.env`. Probado end-to-end con un
envío manual: las dos filas llegaron con el `proyecto_id` resuelto
correctamente por la clave, después borradas (eran de prueba).

## Base de datos

Supabase, proyecto **`qutqsyokdlitflybfrus`** (`crm-productividad-hello-minus`).
Schema y RLS aplicados. Orden de ejecución y decisiones en [db/README.md](db/README.md).

## Variables de entorno

Ver [.env.example](.env.example). `.env` está en `.gitignore`.

| Variable | Para qué | Dónde se consigue |
|---|---|---|
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | `https://qutqsyokdlitflybfrus.supabase.co` | fijo |
| `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` | Cliente Supabase (frontend y backend). Publishable key, respeta RLS. | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo backend / agentes de ingesta. Salta RLS. Nunca en el frontend ni en el repo. | Supabase → Settings → API |
| `CORS_ORIGINS` | Orígenes permitidos por el backend, coma-separados. Nunca `*` (la API no arranca si lo tiene). | config |
| `PORT` | Puerto de la API. Opcional, por defecto `3001`. | config |
| `GITHUB_WEBHOOK_SECRET` | Firma de los webhooks de la GitHub App. **No va en `.env`**: es secreto de Edge Functions. Mismo valor en la App y en Supabase. | Se genera una vez; Supabase → Edge Functions → Secrets |
| `GITHUB_TOKEN` | Backend, opcional. Sube el límite de la API pública de GitHub y permite leer repos privados propios en `GET /repos/candidatos`. | Personal access token, solo lectura |
| `ANTHROPIC_API_KEY` | `backend/agent/`. El Clasificador la toma de los secretos de GitHub Actions; el Sugeridor de etapa la hereda del entorno de la API, así que para ese va **en `backend/api/.env`**. Sin ella la API arranca igual y el botón "Sugerir" responde 503. | consola de Anthropic |
| `PYTHON_BIN` | Opcional. Qué binario de Python usa la API para lanzar al Sugeridor de etapa. Por defecto `python` en Windows, `python3` en el resto. | config |
| `HELLO_MINUS_TELEMETRY_KEY` | `backend/api/.env`. Clave para que este backend reporte su propia telemetría de agentes con `paquetes/hello-minus-telemetry` (piloto: solo el Verificador de checklist). Sin ella, `services/telemetria.ts` queda inerte, no rompe nada. | `POST /proyectos/:id/claves` de este mismo CRM, la clave se ve una sola vez |

## Pendiente / en decisión

- **Branding y diseño del dashboard.** `frontend/dashboard` es funcional pero
  provisional a propósito — paleta neutra, sin identidad visual — mientras se
  estudia el branding de Hello Minus. Cuando se defina, usar el skill
  `criterios-ux-ui` y actualizar `src/lib/tokens.css`.

- **Falta que Gabriel se registre en Supabase Auth.** Juan ya está enlazado
  (verificado el 2026-09-18: el trigger de la migración 001 hizo su trabajo).
  Gabriel todavía no, así que para él RLS sigue cerrada. Ver
  [db/README.md](db/README.md).
- Rol comercial separado de admin: ¿hace falta?
- Detalle de las fases 05 y 07-13 (solo tienen título; la 03 y la 04 ya están
  detalladas arriba).
- Sembrar catálogos: `roles_proyecto`, `canales_venta`.
  (`indicador_catalogo` e `indicador_aplicabilidad` ya se sembraron — migración 015.)
- **Motor de indicadores: los 29 de 29 están construidos y probados**,
  disparador (`calcular-indicadores.yml`) pusheado y con `DATABASE_URL` ya
  configurado — confirmado disparándose solo el 2026-09-25 (salió `skipped`
  porque el Clasificador de ese día falló por un error de conexión
  transitorio, no un bug: el `if: conclusion == 'success'` hizo lo que debía).
  Falta verlo correr de punta a punta un día que el Clasificador sí termine
  bien.
- **Las 4 tablas de los indicadores ○ (migración 017) ya tienen pantalla**
  (2026-09-25): `estimaciones_tarea` desde cada tarea semanal
  (`components/EstimacionTarea.tsx`), `reuniones` como sección propia del
  proyecto (`components/Reuniones.tsx`), `tipo_id` desde "Editar" en la
  cabecera del proyecto (`components/EditarProyecto.tsx`), y
  `capacidad_persona` desde la página nueva `/equipo`
  (`pages/Equipo.tsx`) — salió de "pronto" en `AppShell.tsx`. Las cuatro
  siguen sin datos reales todavía: recién se puede empezar a declarar.
