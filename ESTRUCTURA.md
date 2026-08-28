# Estructura del proyecto — CRM Productividad Hello-Minus

**Avance:** 3 de 21 carpetas con contenido.

Generado por `scripts/estructura.py`. No editar a mano: se sobrescribe.

| | Carpeta | Para |
|---|---|---|
| ✅ | `docs/` | Documentación de negocio y técnica (CONTEXT.md, indicadores del dashboard, notas de decisiones, capturas de referencia) |
| ✅ | `db/` | Todo lo relacionado con la base de datos — 000_schema_inicial.sql (Supabase/Postgres) y README.md con el orden de ejecución viven acá |
| ⬜ | `db/migrations/` | Migraciones incrementales del schema, en orden cronológico (a partir de 000_schema_inicial.sql) |
| ✅ | `db/policies/` | Políticas RLS, en archivos separados del schema y de las migraciones (STACK.md lo exige) — RLS obligatorio desde el primer día |
| ⬜ | `backend/` | Capa de servidor completa |
| ⬜ | `backend/api/` | App Node.js + Express — capa delgada sobre Supabase, CORS explícito y acotado. Solo la lógica que Supabase no resuelve por sí solo |
| ⬜ | `backend/api/routes/` | Routers de Express por dominio (tareas/productividad, conversaciones/inbox, reportes) |
| ⬜ | `backend/api/middleware/` | Middleware compartido (verificación de sesión Supabase, CORS, manejo de errores) |
| ⬜ | `backend/functions/` | Edge Functions de Supabase — webhooks e integraciones de canales de mensajería para el inbox unificado (recepción de mensajes entrantes, normalización, alta del registro) |
| ⬜ | `backend/agent/` | Agente Claude aislado (@anthropic-ai/sdk) — system_prompt.md, output_schema.json (Structured Outputs), client.ts y parser.ts. Un agente por tarea; si emite veredicto, el cálculo determinista va en scripts, no en el prompt |
| ⬜ | `frontend/` | Capa de cliente completa |
| ⬜ | `frontend/dashboard/` | App React + Vite con la landing pública y el dashboard tras login |
| ⬜ | `frontend/dashboard/src/` | Código fuente de la app |
| ⬜ | `frontend/dashboard/src/pages/` | Páginas de nivel superior (Landing, Dashboard de reportes, Tablero de tareas/productividad, Inbox de conversaciones) |
| ⬜ | `frontend/dashboard/src/components/` | Componentes reutilizables de UI (tarjetas de tarea, hilo de conversación, filtros, tiles de indicadores) |
| ⬜ | `frontend/dashboard/src/charts/` | Wrappers de Recharts para los indicadores del dashboard (productividad por asesor, volumen de conversaciones, tareas cumplidas vs. vencidas) |
| ⬜ | `frontend/dashboard/src/hooks/` | Hooks de React, incluyendo la suscripción a Supabase Realtime (mensajes entrantes, cambios de estado de tareas) |
| ⬜ | `frontend/dashboard/src/lib/` | Clientes y utilidades compartidas (supabaseClient, helpers de fecha/formato) |
| ⬜ | `frontend/dashboard/src/services/` | Funciones async simples para llamadas a Supabase y APIs externas, un archivo por sistema externo (STACK.md lo exige) — authService, tareasService, conversacionesService, reportesService |
| ⬜ | `frontend/dashboard/src/stores/` | Stores de Zustand, un dominio por archivo, sin middleware salvo justificación puntual — authStore, tareasStore, inboxStore, themeStore |
| ⬜ | `frontend/dashboard/public/` | Assets estáticos servidos tal cual |

✅ con contenido · ⬜ vacía, pendiente · ❌ no existe en disco

Las carpetas vacías se dejan a propósito: sostienen la estructura completa
del full stack. Cada una lleva un `_VACIA.md` que la mantiene visible en el
explorador y versionada en Git. El marcador desaparece solo al agregar el
primer archivo real y volver a correr el script.
