# Base de datos — CRM de Productividad Hello Minus

Supabase (Postgres 17). El schema corresponde a la **Fase 01** del plan de
construcción: 32 tablas en 9 bloques. Ver
[docs/fases-crm-productividad-hello-minus.md](../docs/fases-crm-productividad-hello-minus.md).

## Orden de ejecución

Los archivos se aplican en este orden y no en otro. Cada uno asume que el
anterior ya corrió.

| Orden | Archivo | Qué hace |
|---|---|---|
| 1 | `000_schema_inicial.sql` | Tipos, 32 tablas, índices. Habilita RLS en todas. |
| 2 | `policies/001_baseline.sql` | Funciones auxiliares y políticas RLS. |
| 3+ | `migrations/NNN_*.sql` | Cambios incrementales, en orden cronológico. |

**El paso 2 no es opcional.** El paso 1 habilita RLS sin crear políticas, y en
Postgres eso significa denegar todo: hasta que corran las políticas, la base
está cerrada para cualquier usuario. Es deliberado — el "restrictivo por
defecto" que recomienda la documentación de la Fase 01.

## Por qué el schema y las políticas van separados

Lo exige `STACK.md`, y la razón es práctica: las políticas cambian mucho más
seguido que las tablas. Tenerlas aparte permite revisar un cambio de permisos
sin leer 500 líneas de DDL, y permite reaplicar las políticas desde cero sin
tocar los datos.

## Decisiones de acceso ya tomadas (2026-08-28)

La documentación de la Fase 01 dejó tres puntos delicados sin resolver. Dos se
decidieron antes de escribir la primera política, como recomendaba:

- **Indicadores personales (punto A):** ambos integrantes ven los de ambos.
- **Detalle de Tarea Semanal (punto B):** ambos ven el del otro.

El equipo son dos personas y eligieron transparencia total. Por eso la
restricción no está en la lectura, sino en dos lugares distintos:

1. **Escritura** — cada quien escribe solo lo suyo. Ver que otro registró horas
   no habilita a editarlas.
2. **Tablas de solo-sistema** — `commits`, `pull_requests`,
   `sesiones_claude_code`, `trazas_agente`, `indicador_snapshots`,
   `tarea_evidencia` y `auditoria_log` se leen, pero nadie las escribe desde la
   app. Si un usuario pudiera insertar en `commits`, podría fabricarse
   actividad y todos los indicadores dejarían de significar algo. La ingesta
   entra por `service_role`, que salta RLS por diseño.

Lo **comercial** (`clientes`, `productos`, `leads`, `ventas`, `oportunidades`)
quedó restringido a admin, incluso para leer. Son datos de terceros, no del
equipo, y la decisión de transparencia se tomó sobre lo segundo. Abrirlo es un
cambio de una línea por tabla, pero conviene decidirlo aparte.

El **punto C** (RLS en tablas derivadas) no era una decisión sino una
advertencia técnica: `indicador_snapshots` tiene `scope_type`/`scope_id`
genéricos y su política es más frágil que un `persona_id = auth.uid()`. Con
transparencia total quedó simple hoy; si mañana se restringe, ese es el lugar
donde más fácil se cuela un error de permisos.

## Ventana de edición del registro de tiempo

`registro_tiempo` se puede editar y borrar hasta **7 días** después de la fecha
registrada. Pasado ese plazo queda inmutable. Sin ese límite, los indicadores
históricos cambiarían retroactivamente y dejarían de ser confiables: un número
que se mueve solo no sirve para decidir nada.

## Funciones auxiliares

Definidas en `policies/001_baseline.sql`:

| Función | Devuelve |
|---|---|
| `persona_actual()` | El `personas.id` del usuario autenticado, o `NULL` si no tiene fila. |
| `es_admin()` | Si el usuario actual es admin y está activo. |
| `lidera_proyecto(uuid)` | Si es el `encargado_id` de ese proyecto. |
| `es_miembro(uuid)` | Si es miembro vigente (sin `fecha_salida`) de ese proyecto. |

Las cuatro son `SECURITY DEFINER` con `search_path` fijo. Es obligatorio: sin
`DEFINER`, la política de `personas` llamaría a una función que lee `personas`,
que dispara la política otra vez — recursión infinita. El `search_path` fijo
evita que un esquema temporal las secuestre.

## Pendiente

- Decidir si hace falta un **rol comercial** separado de admin.
- Decidir el origen del **registro de tiempo**: captura manual (precisa, exige
  disciplina) o estimación automática desde sesiones de Claude Code (cero
  fricción, subestima).
- Sembrar `indicador_catalogo` e `indicador_aplicabilidad` con los ~50
  indicadores del catálogo y los Grupos A/B/C de
  [indicadores-individuales](../docs/indicadores-individuales-hello-minus.md).
- Sembrar `roles_proyecto` y `canales_venta`.
