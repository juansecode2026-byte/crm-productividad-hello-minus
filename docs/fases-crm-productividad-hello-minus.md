---
titulo: Fases · CRM de Productividad Hello Minus
fuente: fases-crm-productividad-hello-minus.html
convertido: 2026-08-28
actualizado: 2026-08-28 (v2 — 32 tablas, 9 bloques, sección RLS ampliada)
---

# Fases · CRM de Productividad Hello Minus

> Hello Minus — 13 fases · Fase 01 detallada.
> Documento vivo: el detalle de cada fase se va agregando a medida que se cierra su planeación.

---

## Fase 01 — Esquema de base de datos y scaffolding · `Detallada`

**32 tablas · 9 bloques · 3 roles + sistema**

### Estructura de tablas

#### Núcleo — Personas y acceso

| Tabla | Campos |
|---|---|
| `personas` | id, nombre, email, auth_user_id, rol (admin/lider_proyecto/colaborador), github_username, activo, fecha_ingreso |
| `roles_proyecto` | separa el rol global del rol específico por proyecto, cuando difieren |

#### Proyectos y equipo

| Tabla | Campos |
|---|---|
| `clientes` | id, nombre, contacto, datos comerciales básicos |
| `proyectos` | id, nombre, descripcion, cliente_id, creado_por, encargado_id, tipo, prioridad, etapa_actual (1-9), estado (activo/pausado/archivado), modalidad (individual/equipo), fecha_inicio, fecha_objetivo, fecha_limite, alcance_congelado_en, horas_estimadas |
| `miembros_proyecto` | proyecto_id, persona_id, rol_en_proyecto, % dedicación declarada, fecha_entrada, fecha_salida |

#### Proceso — etapas, checklist, tareas semanales

| Tabla | Campos |
|---|---|
| `historial_etapas` | proyecto_id, etapa, entra_en, sale_en — alimenta Cycle time por estado |
| `checklist_items` | proyecto_id, etapa, texto, completado, completado_por, completado_en |
| `hitos` | proyecto_id, nombre, etapa, fecha_planeada, fecha_real, estado |
| `tareas_semanales` | id, proyecto_id, persona_id, semana_inicio, semana_fin, titulo, areas[], creado_por |
| `tarea_evidencia` | tarea_id, area, fuente (commit/PR/sesion_claude_code), referencia, detectado_en |

#### Alcance y avance del proyecto

| Tabla | Campos |
|---|---|
| `componentes_proyecto` | proyecto_id, nombre (Base de datos/Backend/Frontend/Agentes), peso_pct, orden — el nivel 1 del checklist |
| `puntos_componente` | componente_id, nombre, responsable_id, rutas_esperadas, verificado, verificado_en, origen (manual/sugerido_por_agente/CLAUDE.md) — nivel 2, de aquí sale el % atribuido por persona |
| `candidatos_alcance` | proyecto_id, nombre, fuente, detectado_en, estado (pendiente/aprobado/descartado/archivado) — no cuentan en el % hasta aprobarse |
| `bloqueos` | proyecto_id, persona_id, descripcion, abierto_en, resuelto_en, resuelto_por, tipo (interno/externo/cliente) |

#### Tiempo y actividad

| Tabla | Campos |
|---|---|
| `registro_tiempo` | persona_id, proyecto_id, area, fecha, horas, tipo (facturable/interno), origen (manual/inferido) |
| `implementaciones` | proyecto_id, persona_id, descripcion, area, commit_o_pr_vinculado, creado_en |

#### Integraciones externas

| Tabla | Campos |
|---|---|
| `repositorios` | id, proyecto_id, github_repo, github_installation_id |
| `commits` | repo_id, persona_id, sha, archivos_tocados, area_inferida |
| `pull_requests` | repo_id, persona_id, numero, archivos_tocados, area_inferida, mergeado_en |
| `sesiones_claude_code` | persona_id, proyecto_id, session_id, prompt_count, inicio, fin, duracion_activa, archivos_tocados, area_inferida |
| `trazas_agente` | run_id, proyecto_id, agent_id, agent_type, environment, iteration_index, node_name, tool_name, args_hash, tokens, duration, status |

#### Indicadores

| Tabla | Campos |
|---|---|
| `indicador_snapshots` | indicador_code, scope_type (persona/proyecto/portafolio), scope_id, periodo, valor, detalle (JSON para narrativa y composición), calculado_en |
| `indicador_madurez` | indicador_code, criterio_texto, meta, valor_actual, estado (maduracion/activo), activado_en |
| `indicador_catalogo` | indicador_code, nombre, categoria, plazo (inmediato/mediano/largo), depende_de (persona/cliente/mixto) — marca los 9 apartados por depender del cliente |
| `indicador_aplicabilidad` | indicador_code, modalidad (individual/equipo), aplica (bool), sustituye_comparacion — soporta los Grupos A/B/C de indicadores individuales |
| `eval_cases` | caso de prueba, resultado_esperado, agent_type, ultimo_puntaje — soporta el pilar Calidad y correctitud |

#### Comercial

| Tabla | Campos |
|---|---|
| `productos` | id, proyecto_origen_id, nombre, descripcion, tipo |
| `canales_venta` | id, nombre (Chatbot, Referido, Outbound, Web, Alianza...) |
| `leads` | id, producto_id, canal_id, fecha_llegada, atendido_por (persona_id), atendido_por_agente_id, convertido, fecha_conversion |
| `ventas` | id, producto_id, cliente_id, lead_id, canal_id, atendido_por_agente_id, monto, fecha, vendido_por |
| `oportunidades` | cliente_id, proyecto_id, canal_venta_id, etapa_embudo, monto, probabilidad, creado_en, cerrado_en, resultado |

#### Gobernanza

| Tabla | Campos |
|---|---|
| `auditoria_log` | persona_id, accion, tabla_afectada, registro_id, timestamp — quién vio qué dato de qué cliente |

### Políticas RLS por rol

- **admin** — Acceso total a todas las tablas, sin excepción.
- **lider_proyecto** — Lectura/escritura completa solo sobre proyectos donde aparece como `encargado_id` o en `miembros_proyecto` con ese rol. Ve indicadores agregados de su equipo. Pendiente decidir si también ve el detalle granular de Tarea Semanal por persona.
- **colaborador** — Lee solo proyectos donde es miembro. Inserta/edita únicamente su propio `registro_tiempo` y sus propias `tareas_semanales`. Ve sus propios `indicador_snapshots` (scope=persona). No ve `oportunidades`, `ventas` ni `auditoria_log`.
- **solo-sistema** — `commits`, `pull_requests`, `sesiones_claude_code`, `trazas_agente`, `indicador_snapshots`: escritura solo con `service_role` de Supabase, nadie las edita a mano.

### Decisiones ya tomadas

- **Una sola GitHub App** — Todos los repos viven bajo la organización de Hello Minus, así que una instalación cubre todos los proyectos. No se necesita `organizaciones_github` para múltiples orgs externas.
- **CRM Ventas se conecta como cualquier otro proyecto** — Empuja sus eventos (lead creado, venta cerrada, canal de origen) a un endpoint de ingesta propio, con su propia API key — mismo patrón push que el resto, sin leer su base de datos directamente.
- **Proyecto vs. producto separados** — Un proyecto es el esfuerzo interno de construcción; un producto es lo que se vende y puede tener varias ventas por distintos canales y clientes.

### Pendiente de decidir

- ¿El líder de proyecto ve el detalle de Tarea Semanal de su equipo, o solo el agregado?
- ¿Se necesita un rol comercial separado de admin para manejar oportunidades y ventas?

### Lo que hace falta en esta fase

- Las otras 12 fases siguen sin detalle —solo tienen título—, les falta lo mismo que ya se le dio a la Fase 01.
- Dos decisiones sin resolver dentro de esta misma fase: si el líder ve el detalle de Tarea Semanal de su equipo o solo el agregado, y si hace falta un rol comercial aparte de admin.
- Decisión pendiente sobre el registro de tiempo: captura manual (precisa, requiere disciplina) o estimación automática desde sesiones de Claude Code (cero fricción, subestima).
- El scaffolding en sí no se ha detallado —el título dice "base de datos y scaffolding", pero solo se desarrolló la base de datos.
- No hay dependencias explícitas entre fases —por ejemplo, la Fase 09 necesita que la Fase 06 ya esté funcionando.
- Falta aclarar la diferencia entre las 9 etapas de un proyecto cualquiera y estas 13 fases de construcción del CRM —son dos sistemas distintos.
- No hay un criterio de cierre por fase, como sí lo tienen las 9 etapas (el "sale con"). Sin eso es difícil saber cuándo una fase está realmente terminada.

---

## Fase 02 — Núcleo de captura: proyectos, personas y equipo · `Pendiente`

### Lo que hace falta, en orden

Se deja marcado aquí de forma temporal. Se puede ir chuleando a medida que se completa cada paso, una vez cerrada la Fase 01.

- [x] Ejecutar el esquema de base de datos (Fase 01) — crear las tablas de verdad en Supabase.
- [ ] Configurar autenticación real (Supabase Auth) para que las sesiones de usuario sean reales, no un texto fijo.
- [ ] Construir el backend que valida y guarda cada formulario (proyectos, personas, `miembros_proyecto`).
- [ ] Reconstruir el frontend conectado a datos reales, usando el prototipo visual como referencia de diseño.

---

## Fases 03–13 (solo título, sin detalle aún)

| # | Fase |
|---|---|
| 03 | Etapas, checklist y tareas semanales |
| 04 | Registro de tiempo y dedicación |
| 05 | Conexión con GitHub |
| 06 | Telemetría de proyectos y agentes |
| 07 | Motor de indicadores |
| 08 | Agentes: analista, alertas y verificación |
| 09 | Panel de agentes: Loop, Harness y Graph |
| 10 | Capa comercial y proyección de ventas |
| 11 | Dashboard con activación progresiva |
| 12 | Pruebas y piloto |
| 13 | Producción interna y operación |

---

## Tener en cuenta para las políticas RLS

> Seguridad y acceso. Análisis por tipo de tabla, porque el patrón de acceso cambia según de dónde vienen los datos.

### Por tipo de tabla

#### Tablas de solo-sistema

`commits` · `pull_requests` · `sesiones_claude_code` · `trazas_agente` · `indicador_snapshots` · `tarea_evidencia`

- **Escritura:** Solo `service_role` (los agentes de ingesta). Ningún usuario, ni admin, puede insertar aquí.
- **Lectura:** Según a quién pertenece el dato (ver reglas de "Datos propios" y "Datos de proyecto").
- **Por qué importa:** Si un usuario pudiera insertar en `commits`, podría fabricarse actividad. La integridad de todo el catálogo depende de que estas tablas sean de escritura exclusiva del sistema.

#### Tablas de catálogo

`indicador_catalogo` · `indicador_aplicabilidad` · `indicador_madurez` · `canales_venta` · `eval_cases`

- **Lectura:** Todos los usuarios autenticados — necesitan saber qué significa cada indicador.
- **Escritura:** Solo admin.

#### Datos propios de la persona

`registro_tiempo` · `tareas_semanales`

- **Colaborador:** Lee y escribe solo sus propias filas (`persona_id = auth.uid()`).
- **Ventana de edición:** Se recomienda un límite de 7 días para editar un registro de tiempo pasado. Después queda inmutable, o los indicadores históricos cambian retroactivamente y dejan de ser confiables.

#### Datos de proyecto

`proyectos` · `miembros_proyecto` · `componentes_proyecto` · `puntos_componente` · `hitos` · `checklist_items` · `historial_etapas` · `bloqueos` · `implementaciones` · `candidatos_alcance` · `repositorios`

- **Colaborador:** Lee solo proyectos donde es miembro. Escribe en `checklist_items`, `puntos_componente` y `bloqueos` de esos proyectos.
- **Líder:** Todo lo anterior en sus proyectos, más crear/editar el proyecto, gestionar miembros y aprobar candidatos de alcance.
- **Admin:** Todo.

#### Comercial — el más restringido

`clientes` · `productos` · `ventas` · `leads` · `oportunidades`

- **Acceso:** Solo admin. Colaboradores y líderes no ven montos, márgenes ni pipeline.
- **Por qué:** Es información sensible del negocio y ninguno de los indicadores que ellos usan la necesita.

#### Auditoría

`auditoria_log`

- **Acceso:** Lectura y escritura solo `service_role`, más lectura para admin.
- **Regla clave:** Nadie puede borrar sus propias entradas — si un admin pudiera editarlo, el log no sirve de nada.

### Los tres puntos delicados que quedan sin resolver

- **A. Los indicadores personales del compañero** — Con solo dos personas, esta es la política más sensible de todas. Si un admin puede ver los `indicador_snapshots` personales de su compañero, hay asimetría — uno mide al otro. Tres opciones: cada quien ve solo los suyos (simétrico pero limita al admin); ambos ven los de ambos (transparencia total, requiere confianza explícita); o solo se ven agregados de empresa, nunca por persona. Es una decisión de cultura, no técnica — pero se implementa en RLS y conviene decidirla antes de escribir la primera política.
- **B. El detalle de Tarea Semanal** — Ya se marcó como pendiente en la Fase 01. Si el líder ve el detalle de cumplimiento de cada persona, el sistema empieza a sentirse vigilancia — justo lo que se quería evitar al diseñarlo automático.
- **C. RLS en tablas derivadas es difícil de hacer bien** — `indicador_snapshots` tiene `scope_type` + `scope_id` genéricos. La política tiene que resolver "si `scope_type` es persona, comparar con `auth.uid()`; si es proyecto, verificar membresía". Es más complejo que un simple `user_id = auth.uid()` y es donde más fácil se cuela un error de permisos.

### Recomendación práctica

Empezar con RLS **restrictivo por defecto** (denegar todo, abrir explícitamente), y para los puntos A y B, decidir primero cómo quieren trabajar los dos, y después escribir la política. Al revés no funciona.
