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

  | # | Etapa | Sale con |
  |---|---|---|
  | 1 | Descubrimiento y alcance | Claro para qué es el proyecto y quién lo pidió |
  | 2 | Diseño y arquitectura | Esquema de datos y componentes listados. **Congela el alcance** (`alcance_congelado_en`) |
  | 3 | Configuración del entorno | El proyecto corre local y despliega un "hola mundo" |
  | 4 | Construcción del núcleo | Base de datos + backend + frontend funcionan de punta a punta, aunque sin pulir |
  | 5 | Construcción de agentes de IA | Cada agente cumple contra casos de prueba reales |
  | 6 | Integración | Un dato que entra por un canal llega correcto al otro extremo |
  | 7 | Pruebas y aseguramiento | Sin errores críticos conocidos; agentes evaluados, no solo probados a ojo |
  | 8 | Despliegue y piloto | Corrió en producción un tiempo razonable sin incidentes graves |
  | 9 | Operación y mejora continua | No sale — es la etapa de reposo mientras el proyecto siga activo |

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
| `POST /proyectos/:id/tareas` | Tarea semanal. `persona_id` por defecto quien la crea; asignarla a otra solo si es admin (RLS). Chequeo extra: la persona debe ser miembro activo del proyecto |
| `PATCH` · `DELETE /proyectos/:id/tareas/:tareaId` | Solo quien la tiene asignada o admin (RLS) |
| `POST /proyectos/:id/bloqueos` | Abre un bloqueo — siempre a nombre de quien lo crea, no hay "abrir a nombre de otro" |
| `POST /proyectos/:id/bloqueos/:bloqueoId/resolver` | Cierra el bloqueo (`resuelto_en`, `resuelto_por` = quien resuelve). No se puede resolver dos veces |
| `POST` · `PATCH` · `DELETE /proyectos/:id/checklist[/:itemId]` | Ítem de checklist por etapa. `completado_por`/`completado_en` los fija el servidor al marcar; desmarcar los limpia. Miembro, líder o admin (RLS) |
| `POST` · `PATCH` · `DELETE /proyectos/:id/hitos[/:hitoId]` | Hito, con `etapa` opcional. Marcar `estado = cumplido` sin `fecha_real` la fija en hoy; si el body la trae, se respeta (sirve para cargar historia vieja). Solo líder o admin (RLS) |

**`repos_candidatos`** (tabla nueva, `db/migrations/005`) es la lista de vigilancia
del admin — repos que interesa vincular, no un rastreo de toda una cuenta de
GitHub. Se siembra a mano por ahora; agregarlo automático es un candidato
aplazado en `DECISIONES.md`. El lector de `services/github.ts` **no usa la
GitHub App ni requiere token** — pega directo a la API pública de GitHub, así
que solo funciona con repos públicos. Repos privados (los tuyos, hoy) salen con
`disponible: false` hasta configurar `GITHUB_TOKEN` (opcional, sube el límite
de 60 a 5000 peticiones/hora y habilita leer privados propios).

Errores: `{ "error": { "mensaje", "detalles"? } }` — 400 validación, 401
sesión, 403 permiso, 404, 409 duplicado, 422 regla de negocio.

**Correr local:** `cd backend/api && npm install`, crear `backend/api/.env`
con la sección Backend de `.env.example`, y `npm run dev`.

**Tras cada migración**, regenerar `backend/api/database.types.ts` (MCP de
Supabase `generate_typescript_types`) y correr `npm run typecheck`.

## Frontend — dashboard (`frontend/dashboard/`)

React + Vite + TypeScript + Zustand + CSS Modules. Dirección visual **"Consola"**
(elegida el 2026-09-16 entre 3 mockups): oscura y densa, IBM Plex Sans/Mono,
acento cian — barra lateral + tabla, no tarjetas. Sigue sin ser branding final
de Hello Minus, solo dejó de ser neutra-sin-decidir. Tokens en `src/lib/tokens.css`.

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
payload no los trae; hace falta la API con credenciales de la App), backfill
del historial, `area_inferida`/`tipo_inferido` (Clasificador nocturno), y
seguir un repo renombrado (se busca por nombre, no por id).

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
  `ANTHROPIC_API_KEY` y `DATABASE_URL` en GitHub — sin configurar todavía, ver
  el README de la carpeta.

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
| `ANTHROPIC_API_KEY` | `backend/agent/` — el Clasificador de commits y los que sigan. | consola de Anthropic |

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
- **Nada de la Fase 03 tiene interfaz todavía.** Tareas semanales, bloqueos,
  checklist e hitos existen solo como API — el dashboard sigue teniendo dos
  pantallas (Login y Proyectos). Falta la pantalla de detalle de proyecto
  (`/proyectos/:id`), que es donde irían las cuatro. Propuesta visual hecha el
  2026-09-18, sobre los tokens de "Consola":
  https://claude.ai/artifact/SgJVfxEV5NxFqm9mdVyyLW
- Sembrar catálogos: `indicador_catalogo`, `indicador_aplicabilidad`,
  `roles_proyecto`, `canales_venta`.
