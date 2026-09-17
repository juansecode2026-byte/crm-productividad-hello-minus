# hello-minus-telemetry

Cliente que instalan **los otros proyectos** de Hello Minus para reportar su
actividad al CRM de Productividad. Sin dependencias, JS plano, Node 18+.

No lee bases de datos ajenas ni expone nada del proyecto: solo empuja eventos
a un endpoint, autenticado con la clave de ese proyecto.

## Instalar

Todavía no está publicado en npm (ver "Distribución" abajo). Por ahora se copia
la carpeta al proyecto, o se instala por ruta:

```bash
npm install /ruta/a/paquetes/hello-minus-telemetry
```

## Configurar

Dos variables de entorno en el proyecto que reporta:

| Variable | Para qué |
|---|---|
| `HELLO_MINUS_TELEMETRY_KEY` | La clave del proyecto. Se emite desde el CRM (`POST /proyectos/:id/claves`) y se muestra una sola vez. |
| `HELLO_MINUS_TELEMETRY_URL` | Opcional. Por defecto apunta al endpoint de ingesta del CRM. |

**Sin clave el cliente queda inerte**, con un aviso por consola — un proyecto
sin configurar tiene que poder arrancar igual.

## Usar

```js
import { crearTelemetria } from 'hello-minus-telemetry';

const telemetria = crearTelemetria();

// Una traza por paso del agente
telemetria.traza({
  run_id: 'run-2026-09-16-01',
  agent_type: 'clasificador',
  node_name: 'clasificar',
  tool_name: 'leer_commit',
  tokens: 1200,
  duration_ms: 850,
  status: 'ok',
  iteration_index: 1,
});

// Una sesión de Claude Code (se puede reportar varias veces: la última gana)
telemetria.sesion({
  session_id: 'abc-123',
  persona: 'juansecode2026-byte', // email o usuario de GitHub
  inicio: '2026-09-16T14:00:00Z',
  fin: '2026-09-16T15:30:00Z',
  prompt_count: 21,
  duracion_activa_segundos: 5400,
  archivos_tocados: ['src/a.ts'],
});

// Antes de que el proceso termine
await telemetria.vaciar();
```

## Cómo se comporta

- **Agrupa** los eventos y los manda cada 5 s, o antes si se juntan 100.
- **Reintenta una vez** ante fallos de red o 5xx. Un 4xx no se reintenta: es un
  problema del esquema o de la clave, y reintentar no lo arregla.
- **Nunca lanza** hacia el proyecto que lo usa: los fallos salen por consola
  (o por `alFallar`, si se pasa). La telemetría no puede tumbar un proyecto.
- **No demora el cierre** del proceso: el temporizador interno va con `unref()`.

## Distribución — sin decidir

Hoy vive dentro del repo del CRM, así que instalarlo en otro proyecto implica
copiarlo o apuntar a la ruta local. Las opciones reales:

1. **Repo propio en GitHub** (`npm i github:juansecode2026-byte/hello-minus-telemetry`)
   — funciona nativo, gratis, y es lo más limpio.
2. **Publicar en npm** — hace falta cuenta y decidir si el paquete es público.
3. **Copiar el archivo** en cada proyecto — cero infraestructura, pero cada
   copia envejece por su cuenta.

Falta elegir una antes de instalarlo en los proyectos de verdad.
