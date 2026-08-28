# Base de datos — CRM de Productividad Hello Minus

Supabase (Postgres 17). El schema corresponde a la **Fase 01** del plan de
construcción: 32 tablas en 9 bloques. Ver
[docs/fases-crm-productividad-hello-minus.md](../docs/fases-crm-productividad-hello-minus.md).

**Proyecto Supabase:** `qutqsyokdlitflybfrus` (`crm-productividad-hello-minus`,
región us-east-1). Schema y políticas **aplicados el 2026-08-28**: 32 tablas con
RLS, 61 políticas, 0 tablas sin cubrir, advisors de seguridad en limpio.

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

El equipo son dos personas y eligieron transparencia total: **ambos leen todo**,
incluido lo comercial y el log de auditoría. Por eso la restricción no está en
la lectura, sino en dos lugares distintos:

1. **Escritura** — cada quien escribe solo lo suyo. Ver que otro registró horas
   no habilita a editarlas.
2. **Tablas de solo-sistema** — `commits`, `pull_requests`,
   `sesiones_claude_code`, `trazas_agente`, `indicador_snapshots`,
   `tarea_evidencia` y `auditoria_log` se leen, pero nadie las escribe desde la
   app. Si un usuario pudiera insertar en `commits`, podría fabricarse
   actividad y todos los indicadores dejarían de significar algo. La ingesta
   entra por `service_role`, que salta RLS por diseño.

Lo **comercial** (`clientes`, `productos`, `leads`, `ventas`, `oportunidades`)
lo ven los dos, pero solo el admin lo modifica. La documentación de la Fase 01
lo proponía como solo-admin también para leer; el equipo decidió lo contrario a
propósito. Uno de los dos integrantes tiene rol `admin` y es el único que puede
tocar montos, clientes y pipeline: **la asimetría entre ambos está en la
escritura, no en lo que alcanzan a ver**.

`auditoria_log` sigue el mismo criterio y por una razón concreta: si solo el
admin pudiera ver quién consultó qué, la auditoría sería unilateral. Que la
vean los dos es lo que la hace simétrica. Nadie la escribe ni la edita.

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

Definidas en `policies/001_baseline.sql`, en el schema **`private`** (no en
`public`):

| Función | Devuelve |
|---|---|
| `private.persona_actual()` | El `personas.id` del usuario autenticado, o `NULL` si no tiene fila. |
| `private.es_admin()` | Si el usuario actual es admin y está activo. |
| `private.lidera_proyecto(uuid)` | Si es el `encargado_id` de ese proyecto. |
| `private.es_miembro(uuid)` | Si es miembro vigente (sin `fecha_salida`) de ese proyecto. |

**Por qué en `private`:** Supabase expone el schema `public` por PostgREST, así
que una función ahí queda llamable como `/rest/v1/rpc/<nombre>`. Estas son
plumbing de RLS, no API. `private` no lo expone PostgREST. El rol
`authenticated` tiene `USAGE` sobre el schema y `EXECUTE` sobre las cuatro
funciones; `anon` tiene `USAGE` pero ningún `EXECUTE`.

**Por qué `SECURITY DEFINER` con `search_path` fijo:** sin `DEFINER`, la
política de `personas` llamaría a una función que lee `personas`, que dispara la
política otra vez — recursión infinita. El `search_path` fijo evita que un
esquema temporal las secuestre.

## Pendiente

- **Sembrar los dos integrantes en `personas`** con su `auth_user_id` (de
  Supabase Auth) y uno de ellos con `rol = 'admin'`. Sin esto,
  `private.persona_actual()` devuelve `NULL` y RLS deja a todos afuera: la base
  está cerrada hasta que existan esas dos filas. Va como migración de datos o
  seed, no a mano.
- Decidir si hace falta un **rol comercial** separado de admin.
- Decidir el origen del **registro de tiempo**: captura manual (precisa, exige
  disciplina) o estimación automática desde sesiones de Claude Code (cero
  fricción, subestima).
- Sembrar `indicador_catalogo` e `indicador_aplicabilidad` con los ~50
  indicadores del catálogo y los Grupos A/B/C de
  [indicadores-individuales](../docs/indicadores-individuales-hello-minus.md).
- Sembrar `roles_proyecto` y `canales_venta`.

## Notas de rendimiento

Los advisors marcan varias FK sin índice de cobertura (nivel INFO): columnas
como `creado_por`, `completado_por`, `resuelto_por`, `cliente_id`. Con dos
usuarios y poco volumen no afecta; se agregan índices cuando alguna consulta
real lo pida. Las FK que sí se usan para filtrar y unir (`persona_id`,
`proyecto_id`, `repo_id`) ya tienen índice en `000_schema_inicial.sql`.
