# PRÓXIMOS PASOS — CRM de Productividad Hello Minus

Punto de retomada al **2026-08-28**. Dos listas: lo que sigue en construcción,
en orden, y lo que está pendiente de decidir o resolver.

Para el registro de qué se automatiza y por qué, ver [DECISIONES.md](DECISIONES.md).
Para la bitácora de qué falló y qué se aprendió, ver [NOTAS.md](NOTAS.md).

---

## Ya está hecho

| | Qué |
|---|---|
| ✅ | Repo en GitHub (privado, `main`) |
| ✅ | Estructura de 21 carpetas con marcadores de pendientes |
| ✅ | 4 documentos de diseño convertidos a Markdown en `docs/` |
| ✅ | Base de datos en Supabase: 32 tablas, RLS, 61 políticas, 0 sin cubrir |
| ✅ | Trigger de vinculación automática con Supabase Auth |
| ✅ | Catálogos base sembrados: `canales_venta`, `roles_proyecto` |
| ✅ | `DECISIONES.md` con 8 candidatos evaluados |
| ✅ | Guardrail de SQL + verificador de migración |

**Estado real: la base está cerrada.** No hay personas con `auth_user_id`, así
que RLS deja a todos afuera. Nada que dependa de la base se puede probar hasta
resolver el punto 2 de la lista de abajo.

---

# A. En construcción — lo que sigue, en orden

### 1. Activar el hook del guardrail

Abrir `/hooks` una vez, o reiniciar Claude Code. El hook está escrito y
probado, pero el watcher de configuración solo observa carpetas que ya
existían al arrancar la sesión, y `.claude/` se creó después. **Hasta que se
haga, el guardrail no protege nada.**

Verificación: pedir un `execute_sql` con `select 'truncate'` y comprobar que
lo bloquea. Si lo ejecuta, todavía no está activo.

### 2. Datos reales de los dos integrantes

Bloquea todo lo demás que toque la base.

1. Reemplazar los emails `.invalid` y los `github_username` en NULL de
   `personas`. El `UPDATE` está al pie de `db/migrations/002_seed_personas.sql`.
2. Cada quien se registra en Supabase Auth **con ese mismo email**. El trigger
   enlaza el `auth_user_id` solo.
3. Verificar que `private.persona_actual()` ya no devuelve NULL.

El `github_username` tiene que ser el usuario real de los commits, o toda la
actividad de GitHub llega y queda huérfana.

### 3. Sembrar el catálogo de indicadores

`db/migrations/003_seed_indicadores.sql`, a mano. Los ~50 indicadores y los
Grupos A/B/C de `docs/indicadores-individuales-hello-minus.md` pasan a filas de
`indicador_catalogo` e `indicador_aplicabilidad`.

Se decidió **no** automatizarlo (candidato [6], rechazado): hay juicio real
—decidir `categoria`, `plazo`, `depende_de`— pero se ejerce una sola vez, y
construir algo que interprete la prosa cuesta más que interpretarla.

### 4. Fase 02 — Núcleo de captura

La fase ya tiene su checklist en
`docs/fases-crm-productividad-hello-minus.md`. En orden:

1. Autenticación real con Supabase Auth (sesiones de verdad, no un texto fijo).
2. Scaffolding del frontend: Vite + React, Zustand por dominio, CSS Modules.
3. Backend Express que valida y guarda proyectos, personas y
   `miembros_proyecto`.
4. Frontend conectado a datos reales, usando el prototipo visual como
   referencia de diseño.

### 5. Fase 03 — Etapas, checklist y tareas semanales

Sin detalle todavía (ver pendiente B4).

### 6. Fase 04 — Registro de tiempo y dedicación

**Depende de la decisión B1.** Qué se construye cambia por completo según sea
manual, inferido o híbrido.

### 7. Fase 05 — Conexión con GitHub

GitHub App a nivel de organización, Edge Function que valida HMAC, tabla de
mapeo `github_username → persona_id`, reglas de inferencia de área. El paso a
paso completo está en
`docs/paso-a-paso-vincular-proyectos-hello-minus.md` (Parte A).

Al cerrarse, se desbloquea el candidato [5] (conector de proyecto) — pero
recién después de conectar el primer proyecto a mano.

### 8. Fase 06 — Telemetría de proyectos y agentes

Paquete `hello-minus-telemetry`, endpoint de ingesta, colector OpenTelemetry,
`CLAUDE_CODE_ENABLE_TELEMETRY=1`.

### 9. Fase 07 — Motor de indicadores

Cálculo determinista en scripts, snapshots por periodo. El Gestor de madurez va
fusionado acá, no aparte.

### 10. Fases 08 a 13

Agentes (analista, alertas, verificación) · Panel de Loop/Harness/Graph · Capa
comercial · Dashboard con activación progresiva · Pruebas y piloto · Producción
interna.

**Recordatorio de orden:** la cadena nocturna es Sincronizador → Clasificador →
Motor de indicadores → Reconciliador + Vigía. Si el motor corre antes que el
clasificador, calcula sobre commits sin etiquetar y los indicadores de área
salen vacíos.

---

# B. Pendiente de decidir o resolver

### 1. Registro de tiempo: manual, inferido o híbrido

Bloquea la Fase 04. Ninguna fuente automática da horas trabajadas: GitHub dice
qué commits hubo, no cuántas horas; la telemetría da la duración de sesiones de
Claude Code, no el tiempo de diseñar, reunirse o pensar.

**Recomendación: híbrido con confirmación semanal.** El sistema propone horas
derivadas de las sesiones más la ventana entre primer y último commit del día;
la persona ajusta el sábado, cuando ya va a estar mirando su Tarea Semanal.
Confirmar toma dos minutos; reconstruir la semana de memoria toma veinte y sale
mal. Encaja con la ventana de edición de 7 días que ya está en RLS, y el campo
`origen` permite medir después si la inferencia es buena.

Si se elige inferido o híbrido, aparece un candidato de automatización nuevo
que hoy no existe.

### 2. ¿Hace falta un rol comercial separado de admin?

Pendiente desde la Fase 01. Hoy lo comercial lo lee todo el equipo y solo el
admin lo modifica.

### 3. Aislamiento vs. prototipo local de agentes

Bloquea el candidato [8]. El agente de % de Avance necesita leer repos de
*otros* proyectos de Hello Minus. En producción no hay problema (corre en
servidor contra la API de GitHub), pero un prototipo local violaría la regla de
aislamiento del `CLAUDE.md` del laboratorio.

### 4. Detallar las fases 03 a 13

Once fases solo tienen título. El candidato [3] (subagente detallador) está
aplazado hasta tener **dos** fases detalladas a mano: con un solo ejemplo, el
subagente congelaría un formato derivado de un único caso.

Al molde de la Fase 01 le faltan además dos secciones que el propio documento
señala: dependencias explícitas entre fases y criterio de cierre —el
equivalente al "sale con" de las 9 etapas.

### 5. `DATABASE_URL` para el verificador de migración

Sin esa variable, `scripts/verificar_migracion.py` solo hace los chequeos
locales y se salta el estado real de RLS, que es la mitad que importa. Sale de
Supabase → Project Settings → Database → Connection string. Conviene un rol de
solo lectura, **no** el `service_role`.

### 6. El `estructura.yaml` del skill `fullstack` no es genérico

Está pisado con el manifiesto del proyecto Callcenter. Este proyecto tiene su
copia propia, así que no molesta acá — pero el próximo proyecto que se cree lo
va a heredar mal. Falta reconstruir un molde neutro en el skill.

### 7. `PLANTILLA/` no existe en la raíz del laboratorio

El `CLAUDE.md` universal la describe como el molde de todo proyecto, pero la
carpeta no está. Por eso este proyecto arrancó sin `DECISIONES.md`, `NOTAS.md`,
`.claude/`, `scripts/` ni `agentes-sdk/` — se crearon a mano.

### 8. Límite de 2 proyectos activos en Supabase

Plan free. Hoy están activos `crm-ventas` y este. `calificacion-llamadas-callcenter`
quedó pausado para hacer lugar. Verificar el cupo antes de crear cualquier
proyecto nuevo.
