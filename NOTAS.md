# NOTAS.md — CRM de Productividad Hello Minus

Bitácora del proyecto: qué se repitió, qué falló, qué se aprendió.

No es un changelog — el historial de git ya cuenta qué cambió. Acá va lo que el
código no registra: fricciones, sorpresas, decisiones que costaron y cosas que
hubo que rehacer. Es el insumo del agente `seleccionar-forma` en modo
incremental y en modo cierre; sin esto, más adelante no hay forma de saber qué
se repitió lo suficiente como para justificar automatizarlo.

**Cómo anotar:** fecha, qué pasó, y —si aplica— qué costó. Una línea alcanza.
Lo importante es que quede, no que esté bien redactado.

---

## 2026-08-28

- **El `estructura.yaml` del skill `fullstack` no era genérico.** Estaba pisado
  con el manifiesto del proyecto Callcenter. Se resolvió con una copia propia en
  la raíz de este proyecto, invocando el script con `--manifiesto`. Pendiente
  reconstruir un molde neutro en el skill.

- **`PLANTILLA/` no existe en la raíz del laboratorio**, aunque el `CLAUDE.md`
  universal la describe como el molde de todo proyecto. Por eso este proyecto
  arrancó sin `DECISIONES.md`, `NOTAS.md`, `.claude/`, `scripts/` ni
  `agentes-sdk/`: se crearon a mano hoy.

- **El script `estructura.py` falla al imprimir en la consola de Windows.**
  Tira `UnicodeEncodeError` con el emoji ⬜ del resumen final. Los archivos se
  crean bien; es solo el `print`. Workaround: `PYTHONIOENCODING=utf-8
  PYTHONUTF8=1`. Si vuelve a molestar, arreglarlo en el skill.

- **Límite de 2 proyectos activos en Supabase free.** Hubo que pausar
  `calificacion-llamadas-callcenter` para poder crear este. Verificar el cupo
  *antes* de intentar crear un proyecto nuevo.

- **Las funciones de RLS en `public` quedaban expuestas por PostgREST.** Los
  advisors marcaron que `es_admin()` y compañía eran llamables como
  `/rest/v1/rpc/*`. Se movieron al schema `private`. Dos trampas en el camino:
  (a) al revocar permisos se quitó también el `USAGE` que las políticas
  necesitan, y la base quedó inaccesible para todos — se detectó probando con
  `set role authenticated`, no a ojo; (b) revocar `EXECUTE` de `anon` no hace
  nada, porque Postgres lo concede a `PUBLIC` por defecto al crear la función.
  **Lección: verificar RLS ejecutando como el rol, no leyendo el SQL.**

- **Decisión de acceso tomada antes de escribir la primera política.** La
  documentación lo recomendaba y funcionó: transparencia total en lectura entre
  los dos integrantes, asimetría solo en escritura. Escribir las políticas fue
  directo porque la decisión ya estaba.

- **`jq` no está instalado en esta máquina.** Los ejemplos de hooks de Claude
  Code lo dan por hecho. El guardrail de SQL se escribió en Python, que sí
  está (3.12) y además es el lenguaje que el proyecto ya eligió para agentes.

- **Un hook nuevo no toma efecto en la sesión donde se crea.** Se creó
  `.claude/settings.json` y se verificó que el script bloquea correctamente
  por pipe-test, pero al llamar de verdad al MCP de Supabase el hook no
  disparó: el watcher de configuración solo observa carpetas que ya existían
  al arrancar la sesión, y `.claude/` no existía. Hay que abrir `/hooks` una
  vez o reiniciar. **Al agregar hooks en el futuro, contar con ese paso.**

- **El primer chequeo del verificador de migración dio un falso positivo.**
  Extraía rutas de todos los backticks del README, incluidas menciones en
  prosa, y reportaba como faltante un archivo que existe con otra ruta. Se
  acotó a las filas de la tabla de orden. Lección chica pero repetible: un
  verificador que grita en falso se termina ignorando.

## 2026-09-15

- **`restore_project` sobre un proyecto pausado por inactividad no queda listo
  al instante.** Justo después de reactivarlo, `list_tables` y
  `list_migrations` devolvieron vacío y un `UPDATE` sobre `personas` falló con
  "relation does not exist" — parecía que se había perdido toda la base. No
  era así: el proyecto seguía en estado `COMING_UP` y esas respuestas eran
  transitorias, no el estado real. Se diagnosticó mal como pérdida de datos y
  se re-aplicaron `000_schema_inicial.sql` y `policies/001_baseline.sql`
  contra una base que en realidad seguía completa; no rompió nada solo porque
  esos dos archivos fallan limpio ante objetos que ya existen (el resto de las
  migraciones sí son idempotentes a propósito — `create or replace`,
  `on conflict do nothing` — y por eso corrieron dos veces sin daño, aunque
  dejaron temporalmente 4 filas en `personas` en vez de 2, hasta que se
  detectó y se borraron los placeholders). **Lección: esperar a `status:
  ACTIVE_HEALTHY` (`get_project`) antes de asumir que una base recién
  restaurada está realmente vacía.**
- **Los dos integrantes reales quedaron cargados en `personas`** (Juan
  Sebastian Correa Ramírez como admin, Gabriel Carvajal como colaborador) vía
  `db/migrations/003_actualizar_personas_reales.sql`. Falta que cada uno se
  registre en Supabase Auth con su email real para que el trigger los enlace.

- **Probar funciones con RLS sin dejar rastro: bloque `DO` que termina en
  `raise exception`.** Adentro se crean personas y usuarios de Auth de prueba,
  se hace `set local role authenticated` + `request.jwt.claims`, se ejercitan
  las reglas y el resultado sale en el mensaje de la excepción. La excepción
  garantiza el rollback aunque la herramienta no respete un `ROLLBACK`
  explícito. Usar emails `.invalid`: un usuario de Auth de prueba con un email
  real quedaría enlazado y bloquearía el registro verdadero.
- **`getClaims` de supabase-js lanza (no devuelve `error`) si el token no se
  puede decodificar.** Un `Bearer abc.def.ghi` daba 500 en vez de 401. Se
  envolvió en try/catch.
- **En Windows, detener la tarea en segundo plano no mata el `node` hijo de
  `npx tsx`.** El puerto quedó ocupado y el reinicio falló con `EADDRINUSE`.
  Hubo que buscar el proceso por puerto y cerrarlo a mano.
- **Hallazgo de RLS, corregido:** la política `gobernar_proyectos` usaba
  `lidera_proyecto(id)` también para INSERT, y durante el insert el proyecto
  todavía no existe, así que daba falso siempre — en la práctica solo el admin
  podía crear proyectos, aunque la Fase 01 dice que el líder también. Se
  reemplazó por tres políticas separadas
  (`db/policies/002_crear_proyecto_como_encargado.sql`): crear exige ser
  admin o quedar como `encargado_id` y `creado_por` del proyecto que se crea;
  editar y borrar siguen igual que antes (admin o `lidera_proyecto`).
  **Lección: `FOR ALL` con una condición que lee la fila (`lidera_proyecto`
  hace `select ... where p.id = ...`) no sirve para INSERT — ahí la fila
  todavía no existe. Separar INSERT del resto cuando la condición depende de
  la fila.**
- **`estructura.yaml` tenía una contradicción con `DECISIONES.md` [D1].**
  Describía `backend/agent/` con `@anthropic-ai/sdk` (Node), pero el proyecto
  ya había decidido Python para todo lo que llama a Claude. Corregido en el
  manifiesto y regenerado el marcador.
