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
| `CORS_ORIGINS` | Orígenes permitidos por el backend, coma-separados. Nunca `*`. | config |
| `ANTHROPIC_API_KEY` | Features conversacionales / evaluación con Claude. | consola de Anthropic |

## Pendiente / en decisión

- **Poner los datos reales de los dos integrantes en `personas`.** Las filas
  existen pero con emails `.invalid` y `github_username` en NULL: hasta que se
  corrijan y cada quien se registre en Auth con ese mismo email, RLS deja la
  base cerrada. Ver [db/README.md](db/README.md).
- Rol comercial separado de admin: ¿hace falta?
- Origen del registro de tiempo: manual vs. inferido desde sesiones de Claude Code.
- Detalle de las fases 03-13 (solo tienen título).
- Sembrar catálogos: `indicador_catalogo`, `indicador_aplicabilidad`,
  `roles_proyecto`, `canales_venta`.
