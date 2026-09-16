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

Errores: `{ "error": { "mensaje", "detalles"? } }` — 400 validación, 401
sesión, 403 permiso, 404, 409 duplicado, 422 regla de negocio.

**Correr local:** `cd backend/api && npm install`, crear `backend/api/.env`
con la sección Backend de `.env.example`, y `npm run dev`.

**Tras cada migración**, regenerar `backend/api/database.types.ts` (MCP de
Supabase `generate_typescript_types`) y correr `npm run typecheck`.

## Frontend — dashboard (`frontend/dashboard/`)

React + Vite + TypeScript + Zustand + CSS Modules. **Provisional a propósito:**
cubre login/registro y el alta de proyectos para poder usar el CRM ya, sin
esperar a definir branding — paleta neutra en `src/lib/tokens.css`, para
reemplazar cuando se estudie el diseño (ver Pendiente).

- **Auth:** `Login.tsx` registra e inicia sesión directo contra Supabase Auth
  (`supabase.auth.signUp` / `signInWithPassword`). Es la forma real de que los
  dos integrantes entren al sistema — reemplaza invitarlos a mano desde el
  dashboard de Supabase.
- **Lecturas:** `services/` consulta Supabase directo con la sesión del
  usuario; RLS decide qué ve.
- **Escrituras con lógica:** pasan por `backend/api/` (`VITE_API_URL`), con
  `Authorization: Bearer <access_token>`.

**Correr local:** `cd frontend/dashboard && npm install`, crear
`frontend/dashboard/.env` con la sección Frontend de `.env.example`
(+ `VITE_API_URL`), y `npm run dev`. Necesita la API corriendo en paralelo
para crear proyectos.

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
| `ANTHROPIC_API_KEY` | Features conversacionales / evaluación con Claude. | consola de Anthropic |

## Pendiente / en decisión

- **Branding y diseño del dashboard.** `frontend/dashboard` es funcional pero
  provisional a propósito — paleta neutra, sin identidad visual — mientras se
  estudia el branding de Hello Minus. Cuando se defina, usar el skill
  `criterios-ux-ui` y actualizar `src/lib/tokens.css`.

- **Que los dos integrantes se registren en Supabase Auth.** `personas` ya
  tiene los datos reales (2026-09-15); falta que cada quien cree su cuenta con
  ese mismo email para que el trigger los enlace. Hasta entonces RLS deja la
  base cerrada. Ver [db/README.md](db/README.md).
- Rol comercial separado de admin: ¿hace falta?
- Origen del registro de tiempo: manual vs. inferido desde sesiones de Claude Code.
- Detalle de las fases 03-13 (solo tienen título).
- Sembrar catálogos: `indicador_catalogo`, `indicador_aplicabilidad`,
  `roles_proyecto`, `canales_venta`.
