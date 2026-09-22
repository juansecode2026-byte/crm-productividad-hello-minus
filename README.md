# CRM Productividad Hello-Minus

Herramienta interna de Hello Minus para medir cómo rinde el equipo (hoy dos
personas) sobre sus propios proyectos de software — combina actividad de
GitHub, telemetría de Claude Code y otros agentes, e indicadores calculados.
No es un CRM de ventas: la parte comercial existe, pero es secundaria.

Uso privado del equipo — no es software que se distribuya.

## Cómo correrlo local

Hacen falta dos servidores corriendo al mismo tiempo, en dos terminales.

**1. Backend**

```bash
cd backend/api
npm install
# crear backend/api/.env con la sección "Backend" de .env.example
npm run dev
```

Queda escuchando en `http://localhost:3001`.

**2. Frontend**

```bash
cd frontend/dashboard
npm install
# crear frontend/dashboard/.env con la sección "Frontend" de .env.example
npm run dev
```

Queda en `http://localhost:5173` — es lo que se abre en el navegador.

Las variables de entorno completas, qué hace cada una y de dónde se sacan
están en [.env.example](.env.example) y en `CLAUDE.md` (secciones Backend,
Frontend y "Variables de entorno").

## Cómo está organizado

```
backend/
├── api/           Express + TypeScript — las escrituras con lógica de negocio
├── agent/         Los agentes que llaman a Claude (clasificador_commits, sugeridor_etapa)
└── functions/     Edge Functions de Supabase — webhook de GitHub, ingesta de telemetría

frontend/
└── dashboard/     React + Vite — el dashboard que usa el equipo

db/
├── 000_schema_inicial.sql
├── migrations/    Cambios incrementales, en orden
└── policies/      Políticas de RLS

scripts/           Código determinístico que no llama a Claude
paquetes/          hello-minus-telemetry — paquete propio para que otros proyectos reporten
docs/              Documentos de diseño (el .md es la fuente; docs/fuente-html/ es el original ya convertido)
.github/workflows/ Los 3 crons: clasificador de commits, derivar horas, detectar rastro semanal
```

## El resto de la documentación

Este README solo orienta. El detalle real vive en otros archivos, cada uno con
su propio trabajo — no se repite acá para no terminar con dos versiones de la
misma verdad:

| Archivo | Qué encontrás ahí |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Arquitectura completa, reglas de negocio, qué está construido y qué falta por fase — la fuente de verdad técnica |
| [STACK.md](STACK.md) | El stack tecnológico y sus convenciones |
| [DECISIONES.md](DECISIONES.md) | Qué se evaluó automatizar, qué se aceptó, qué se rechazó y por qué |
| [docs/](docs/) | Documentos de diseño original: fases del proyecto, catálogo de indicadores, agentes |
| [NOTAS.md](NOTAS.md) | Bitácora — qué se repitió, qué falló, qué se aprendió en el camino |
