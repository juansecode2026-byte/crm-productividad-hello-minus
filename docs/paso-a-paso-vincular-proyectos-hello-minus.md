---
titulo: Paso a Paso para Vincular Proyectos — Hello Minus
fuente: paso-a-paso-vincular-proyectos-hello-minus.html
convertido: 2026-08-28
---

# Paso a Paso para Vincular Proyectos al CRM de Productividad

Proceso para conectar todos los proyectos ya existentes de Hello Minus. Se divide en lo que se hace una sola vez para toda la organización, y lo que se repite por cada proyecto que se conecta.

**17 pasos · 3 partes · 9 herramientas.**

Complementa el esquema de base de datos de la Fase 01 y la ruta de construcción general.

---

## Parte A — Una sola vez · Preparación

Se hace para toda la organización, no se repite por proyecto.

| # | Paso | Detalle |
|---|---|---|
| 01 | Crear la GitHub App en la organización de Hello Minus | Permisos de solo lectura: Contents, Metadata, Pull requests, Issues, Commit statuses. Suscrita a push, pull_request, issues, release. |
| 02 | Instalarla sobre la organización | Elegir "todos los repositorios" para que un proyecto nuevo no requiera volver a tocar la instalación. |
| 03 | Levantar el endpoint receptor de webhooks | Edge Function de Supabase que valida la firma HMAC (`X-Hub-Signature-256`) antes de aceptar cualquier evento. |
| 04 | Levantar el endpoint de ingesta de telemetría | El que recibe trazas de agentes y eventos de proyectos — modelo push, con validación de esquema y rate limiting. |
| 05 | Construir la tabla de mapeo `github_username → persona_id` | Sin esto los commits llegan pero no se pueden atribuir a nadie — bloquea casi todos los indicadores de persona. |
| 06 | Definir las reglas de inferencia de área | Qué rutas corresponden a qué área (`/db` → Backend/Datos, `/agents` → Agente, etc.) — de esto depende la narrativa semanal. |

---

## Parte B — Por cada proyecto existente

Este bloque se repite una vez por cada proyecto que se conecta.

| # | Paso | Detalle |
|---|---|---|
| 07 | Crear el proyecto en el CRM | Nombre, cliente (si aplica), tipo, prioridad, fecha de inicio real — no la de hoy. |
| 08 | Vincular sus repositorios | Un proyecto puede tener varios: backend, frontend, agente. Se registran en la tabla `repositorios`. |
| 09 | Registrar el equipo con fechas históricas | Quién participó y desde cuándo, incluyendo gente que ya salió — si no, el bus factor y la estabilidad del equipo salen mal calculados. |
| 10 | Ejecutar el backfill de GitHub | Traer 6-12 meses de commits y PRs vía API. Proyecto por proyecto, no todos a la vez: los límites de tasa de la API son reales. |
| 11 | Ubicar el proyecto en su etapa actual (1-9) | Y cargar el `historial_etapas` aproximado si se puede reconstruir. Si no, se marca desde hoy. |
| 12 | Instalar el paquete de telemetría en el proyecto | `hello-minus-telemetry` + su API key propia — desde aquí el proyecto reporta solo. |
| 13 | Activar la telemetría de Claude Code | `CLAUDE_CODE_ENABLE_TELEMETRY=1` apuntando al endpoint de ingesta, para las sesiones de ese proyecto. |
| 14 | Validar que los datos llegan correctos | Revisar que los commits se atribuyeron a las personas correctas y que las áreas se infirieron bien. |

---

## Parte C — Cierre

El orden en que se conectan los proyectos, y cómo se marca el corte de confiabilidad.

| # | Paso | Detalle |
|---|---|---|
| 15 | Conectar primero un solo proyecto de prueba | Idealmente uno pequeño y reciente — validar el flujo completo antes de tocar los demás. |
| 16 | Conectar el resto en orden de importancia | Los activos primero; los archivados pueden esperar o quedarse sin conectar si ya no aportan información útil. |
| 17 | Marcar la fecha de corte de datos | Anotar desde cuándo los datos son confiables por proyecto — el backfill mezcla datos menos precisos con datos en vivo. |

---

## Detalles a tener en cuenta (advertencias)

- **El backfill no reconstruye todo** — Trae commits, PRs e issues — pero no trae trazas de agentes ni sesiones de Claude Code de proyectos pasados. Eso solo existe desde que se instrumenta. Los indicadores de Loop/Harness/Graph y los de Claude Code arrancan en cero para todos los proyectos existentes, sin excepción.
- **El paso 9 es el que más se subestima** — Reconstruir quién estuvo en qué proyecto y cuándo es trabajo manual y tedioso, y es tentador saltárselo — pero sin eso, varios indicadores de persona van a dar números incorrectos con apariencia de correctos, que es peor que no tenerlos.

---

## Herramientas necesarias (stack requerido)

### Integración con GitHub

- **GitHub App** — instalada a nivel de organización, permisos de solo lectura.
- **GitHub REST / GraphQL API** — para el backfill de 6-12 meses de historia.
- **Validación HMAC** — `X-Hub-Signature-256` para verificar cada webhook entrante.

### Infraestructura propia

- **Supabase** — Postgres, Edge Functions, RLS y autenticación.
- **Endpoint de ingesta de telemetría** — con validación de esquema y rate limiting.
- **Tabla de mapeo `github_username → persona_id`** — atribución de commits a personas.

### Telemetría de agentes y código

- **`hello-minus-telemetry`** — paquete propio (npm/pip) instalado por proyecto.
- **Claude Agent SDK / Claude Code** — con `CLAUDE_CODE_ENABLE_TELEMETRY=1` y exportador OpenTelemetry.
- **Colector OpenTelemetry** — destino de las trazas antes de llegar a Supabase.

---

## GitHub App — configuración paso a paso

Cómo se crea e instala la GitHub App mencionada en Herramientas necesarias, con las pantallas y campos exactos de GitHub.

| # | Paso | Detalle |
|---|---|---|
| 01 | Ir a la configuración de la organización | En GitHub: Settings de la organización Hello Minus → Developer settings → GitHub Apps → New GitHub App. |
| 02 | Datos básicos de la App | GitHub App name (ej. `hello-minus-productividad`), Homepage URL (la URL del CRM), Webhook URL (el endpoint de la Edge Function de Supabase que recibe los eventos). |
| 03 | Webhook secret | Generar una clave y guardarla — es la que se usa para validar la firma HMAC (`X-Hub-Signature-256`) de cada evento entrante. |
| 04 | Permisos de repositorio (Repository permissions) | Contents: Read-only · Metadata: Read-only · Pull requests: Read-only · Issues: Read-only · Commit statuses: Read-only. Ningún permiso de escritura. |
| 05 | Suscribirse a eventos (Subscribe to events) | Push, Pull request, Issues, Release — son los que disparan el webhook hacia el CRM. |
| 06 | Dónde puede instalarse | "Only on this account" — restringe la App a la organización de Hello Minus, no la deja instalable por cualquiera. |
| 07 | Generar la clave privada | Al guardar la App, GitHub ofrece "Generate a private key" (`.pem`) — se usa para autenticar las llamadas a la API como la App, se guarda en el gestor de secretos, nunca en el repositorio. |
| 08 | Instalar la App | Desde la página de la App → Install App → elegir la organización Hello Minus → seleccionar "All repositories" → Install. |
| 09 | Guardar el Installation ID | GitHub lo genera al instalar (visible en la URL de instalación o vía API) — se guarda en la tabla `repositorios`/config del CRM, es lo que identifica esa instalación en cada llamada. |
| 10 | Configurar variables de entorno en el backend | `APP_ID`, `PRIVATE_KEY`, `WEBHOOK_SECRET` e `INSTALLATION_ID` — con estas cuatro el backend ya puede autenticarse y validar los eventos que lleguen. |

---

## Qué aporta cada fuente de datos (síntesis)

Ninguna fuente por sí sola cubre el catálogo completo. Se complementan, no se solapan — y ninguna requiere conectarse directamente a la base de datos de un proyecto.

### GitHub

Actividad real de construcción: quién tocó qué, cuándo y con qué frecuencia.

- **Throughput (PROD-01)** — Cuenta cuántas tareas cerró de verdad una persona esta semana, no cuántas horas dijo que trabajó.
- **Concentración de conocimiento / bus factor (RIE-01)** — Avisa si todo el conocimiento de una parte del proyecto está solo en la cabeza de una persona.
- **Antigüedad sin movimiento (RIE-02)** — Avisa cuando un proyecto lleva muchos días sin que nadie le toque nada.
- **Tasa de retrabajo (EFI-04)** — Mide cuánto se repite trabajo que ya se había dado por terminado.
- **Ratio colaboradores / horas efectivas (EFI-07)** — Muestra si hay demasiada gente metida en un proyecto para lo poco que está avanzando.
- **Cycle time por estado (EFI-02)** — Dice en qué parte del proceso se quedan atascados los proyectos casi siempre.
- **Contribución ponderada por tipo de trabajo** — Muestra qué tipo de trabajo hizo cada persona —base de datos, frontend, etc.— no solo cuánto código escribió.
- **Aporte por etapa del proyecto** — Dice en cuáles etapas del proyecto participó cada persona.
- **Registro de Implementaciones por Proyecto** — Deja anotado quién construyó cada parte específica del proyecto.

### Telemetría (Agentes + Claude Code)

Lo único que ve dentro de la ejecución de un agente — GitHub no tiene forma de verlo.

- **Los 7 indicadores de Loop** — Dicen si el agente llega a la respuesta correcta rápido, o si da vueltas sin avanzar.
- **Los 6 indicadores de Harness** — Dicen si las herramientas y el contexto que le dimos al agente le sirven, o si le estamos poniendo trabas.
- **Los 5 indicadores de Graph** — Dicen en qué parte de un proceso con varios pasos se traba el trabajo.
- **Sesiones de Claude Code** — Cuenta cuánto usa cada persona a Claude Code para programar.
- **Costo por tarea resuelta (LOOP-07)** — Dice cuánto cuesta en dinero que un agente termine una tarea.

### Base de datos / push de agregados

No se lee la base de datos directamente — el proyecto empuja el número ya calculado, igual que con CRM Ventas.

- **Costo de inferencia proyectado en producción** — Calcula cuánto va a costar tener el agente funcionando de verdad con usuarios reales.
- **Ratio código generado vs. código revisado** — Muestra cuánto del código que escribió la IA fue realmente revisado por una persona.
- **Efectividad de canal / agente comercial** — Dice qué tan bien vende cada canal —o el chatbot— comparado con los demás.
- **Uptime y salud del proyecto en producción** — Dice si el proyecto ya en funcionamiento se cae o tiene fallas.
- **Conversión real de un chatbot con usuarios reales** — Mide cuántas personas que hablaron con el chatbot terminaron comprando de verdad.
- **Madurez del agente vs. criterios de aceptación** — Dice qué tan cerca está el agente de cumplir lo pedido desde el inicio, para no quedarse en "ya casi está listo" para siempre.
