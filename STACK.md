# STACK.md — Stack tecnológico estándar

> Stack base que usan todos los proyectos. Las features propias de cada
> producto (integraciones, APIs externas, capacidades específicas) no van
> acá — se documentan en el CLAUDE.md de ese proyecto.

## Frontend
- React + Vite
- Zustand para estado global — sin middleware, un store por dominio (ej: `authStore`, `themeStore`)
- CSS Modules para estilos — un `.module.css` por página o componente
- `services/` exporta funciones async simples para llamadas a Supabase y APIs externas — sin capa de abstracción extra innecesaria

## Backend
- Node.js + Express como capa delgada sobre Supabase — no reimplementa lo que Supabase ya resuelve
- CORS explícito y acotado, nunca abierto por defecto

## Base de datos
- Supabase (Postgres) — Auth, Storage y Realtime incluidos
- Row Level Security (RLS) obligatorio desde el primer día, incluso con un solo cliente o un solo usuario
- Políticas RLS en archivos SQL separados del schema, nunca mezcladas
- SQL versionado y con orden de ejecución documentado

## IA / Agentes
- **Python** para todo lo que llame a Claude: `claude_agent_sdk` para agentes con herramientas, `anthropic` para llamadas sueltas
- Decidido el 2026-08-28 (ver `DECISIONES.md` [D1]). Antes esta línea decía Node con `@anthropic-ai/sdk`, lo que chocaba con `agentes-sdk/` del laboratorio, que es Python: cada prompt terminaba escrito dos veces —prototipo y producción— y las dos versiones divergían
- Consecuencia asumida: el backend de aplicación sigue siendo Node/Express, así que los agentes son un **servicio Python aparte** al que Express llama. Son dos runtimes, no uno
- Un agente por tarea — no multiagente salvo que se justifique explícitamente
- Si la tarea del agente implica cálculo o veredicto: el agente solo emite juicio con evidencia — el cálculo determinista vive siempre en scripts, nunca en el agente ni en el prompt

## Convenciones
- Interfaz de usuario en español
- Variables de entorno documentadas explícitamente en el CLAUDE.md o README de cada proyecto — nunca solo en el código
- Commits en español, en modo imperativo

## Control de versiones
- Un repositorio por proyecto — no monorepo, salvo decisión explícita en contrario
- Este archivo se copia en la raíz de cada proyecto nuevo, y el CLAUDE.md del proyecto lo importa con `@STACK.md` como primera línea
