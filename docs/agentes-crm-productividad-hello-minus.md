---
titulo: Agentes del CRM de Productividad — Hello Minus
fuente: fuente-html/agentes-crm-productividad-hello-minus.html
convertido: 2026-08-28
---

# Agentes del CRM de Productividad — Hello Minus

Clasificación completa: cuáles son muy importantes, cuáles importantes y cuáles poco necesarios — con si cada uno es un script o un agente con LLM, por qué, cuándo se ejecuta y en qué fase de construcción entra.

- **16** agentes analizados
- **6** necesitan LLM de verdad
- **3** niveles de importancia

Complementa la ruta de construcción y el esquema de base de datos de la Fase 01.

---

## Muy importantes (5 agentes)

Sin estos, el sistema no funciona. Todo lo demás depende de que estos cinco existan primero.

### 01 · Sincronizador GitHub — `Script`

- **Por qué:** Recibe un webhook, valida la firma HMAC e inserta filas. No hay nada que razonar.
- **Cuándo se ejecuta:** Por evento — cada webhook de GitHub.
- **Fase:** 05 · Conexión con GitHub

### 02 · Receptor de telemetría — `Script`

- **Por qué:** Valida el esquema del evento entrante y lo guarda. Mismo caso que el sincronizador.
- **Cuándo se ejecuta:** Por evento — cada envío al endpoint de ingesta.
- **Fase:** 06 · Telemetría de proyectos y agentes

### 03 · Motor de cálculo de indicadores — `Script + LLM parcial`

- **Por qué:** El 80% es aritmética pura (horas ÷ hitos, días entre estados). Solo inferir el área de un archivo ambiguo justifica un LLM pequeño.
- **Cuándo se ejecuta:** Cron nocturno, después del clasificador.
- **Fase:** 07 · Motor de indicadores

### 04 · Detector de rastro semanal — `Script`

- **Por qué:** Buscar si hay commits o sesiones en la ruta de un área es una consulta, no un juicio. Incluye la verificación de evidencia.
- **Cuándo se ejecuta:** Sábados 12:00.
- **Fase:** 03 · Etapas, checklist y tareas semanales

### 05 · Vigía de alertas — `Script`

- **Por qué:** Comparar un número contra un umbral es un `if`. El LLM es opcional, solo para redactar el mensaje.
- **Cuándo se ejecuta:** Cron diario.
- **Fase:** 08 · Agentes: analista, alertas y verificación

---

## Importantes (6 agentes)

Mejoran mucho el sistema y son los que de verdad necesitan un LLM — pero se puede arrancar sin ellos.

### 06 · Clasificador de commits/PRs — `Agente LLM`

- **Por qué:** Decidir si un commit es feature, fix o refactor requiere leer el mensaje y entender la intención. Reglas por palabra clave fallan en la práctica.
- **Cuándo se ejecuta:** Batch nocturno sobre lo del día.
- **Fase:** 06 · Telemetría de proyectos y agentes

### 07 · Redactor de narrativa semanal — `Agente LLM`

- **Por qué:** Escribir "conectó las vistas con la API" a partir de 6 commits es justo lo que un LLM hace bien y un script no puede hacer.
- **Cuándo se ejecuta:** Sábados 12:00, después del detector de rastro.
- **Fase:** 03 · Etapas, checklist y tareas semanales

### 08 · Reconciliador de doble cálculo — `Script`

- **Por qué:** Recalcula el mismo indicador por otro camino (SQL directo) y compara. Es literalmente comparar dos números.
- **Cuándo se ejecuta:** Cron nocturno, después del motor de indicadores.
- **Fase:** 08 · Agentes: analista, alertas y verificación

### 09 · Juez / evaluador (evals) — `Agente LLM`

- **Por qué:** Juzgar si una salida es correcta cuando no hay un match exacto requiere criterio, no comparación literal.
- **Cuándo se ejecuta:** Semanal, y antes de cada cambio de prompt o modelo.
- **Fase:** 08 · Agentes: analista, alertas y verificación

### 10 · Conversacional — `Agente LLM`

- **Por qué:** Entender una pregunta en lenguaje natural y traducirla a consultas reales es su razón de existir.
- **Cuándo se ejecuta:** Bajo demanda, cuando alguien pregunta.
- **Fase:** 11 · Dashboard con activación progresiva

### 11 · Agente Porcentaje de Avance — `Agente LLM`

- **Por qué:** Calcula el % real de avance del proyecto combinando varias señales — ninguna fuente por sí sola es confiable para detectar el alcance completo.
- **Cuándo se ejecuta:** Se dispara a las 12:00 a.m. del mismo día en que la persona hizo commits en el repositorio del proyecto. Si un día no hay commits, ese día no se dispara — no corre por calendario, corre por actividad real.
- **Fase:** 03 · Etapas, checklist y tareas semanales

**Variables a tener en cuenta para su construcción:**

- Orden de confianza de las fuentes: CLAUDE.md (alta, texto explícito y versionado) > estructura de carpetas del scaffolding (declaración de alcance al iniciar) > conversación/prompts (candidatos) > rastro en código (confirma que un punto ya no es intención, sino hecho).
- Checklist de 2 niveles solamente: componentes generales (Base de datos, Backend, Frontend, Agentes) y, dentro de Agentes, el nombre de cada uno — sin desglosar el resto en más detalle.
- Alcance congelado al cerrar la Etapa 2 (Diseño y arquitectura) = el 100% oficial contra el que se mide el avance.
- Todo lo detectado después de ese punto de congelamiento entra como "candidato" y no cuenta en el % hasta que se aprueba explícitamente.
- Regla de persistencia para candidatos por conversación: mencionado y luego abandonado no entra; mencionado en 2+ sesiones o con trabajo sostenido, sí.
- Candidatos sin confirmar en 10-14 días se archivan a un backlog, para que no se acumulen como preguntas abiertas indefinidas.
- Nunca agrega un componente al % solo — siempre requiere aprobación explícita de una persona, incluso cuando la fuente es de alta confianza.
- Reutiliza el pipeline del Sincronizador GitHub: cuando el archivo modificado es CLAUDE.md, se enruta al Clasificador en vez de tratarse como código normal.
- El disparo es por día calendario con commits, no por sesión ni por logout: si el repositorio no recibió ningún commit ese día, el agente no corre ese día — evita cálculos sobre nada nuevo.
- Decisión pendiente: filosofía scope-boxed (alcance fijo, la fecha se ajusta) vs. time-boxed (fecha fija, el alcance se prioriza) — con fecha límite real, probablemente un híbrido.

---

## Poco necesarios (5 agentes)

No se construirían ahora — algunos se fusionan con otro agente, otros se aplazan por falta de datos o de volumen.

### 12 · Gestor de madurez — `Script · fusionar`

- **Por qué:** Comparar `valor_actual` contra la meta y cambiar un estado son ~20 líneas. No merece ser un componente aparte.
- **Cuándo se ejecuta:** Se fusiona dentro del Motor de cálculo de indicadores.
- **Fase:** 07 · Motor de indicadores

### 13 · Verificador de evidencia (standalone) — `Script · fusionar`

- **Por qué:** Confirmar que un commit existe es una llamada a la API de GitHub. Ya vive dentro del Detector de rastro semanal.
- **Cuándo se ejecuta:** Se fusiona dentro del Detector de rastro semanal.
- **Fase:** 03 · Etapas, checklist y tareas semanales

### 14 · Resumen ejecutivo — `Agente LLM · aplazar`

- **Por qué:** Es un agente LLM legítimo, pero con 6 proyectos se lee el dashboard en 2 minutos. Tiene sentido con 20+.
- **Cuándo se ejecuta:** Aplazado — depende de volumen de proyectos, no de esfuerzo.
- **Fase:** 10 · Capa comercial y proyección de ventas

### 15 · Proyección comercial — `Agente LLM · aplazar`

- **Por qué:** El pipeline ponderado ya es una multiplicación simple. "Refinar con patrones históricos" necesita un histórico que aún no existe.
- **Cuándo se ejecuta:** Aplazado — indicador de largo plazo, falta historia.
- **Fase:** 10 · Capa comercial y proyección de ventas

### 16 · Asistente de planeación inicial — `Agente LLM · aplazar`

- **Por qué:** Sugeriría el checklist de entregables de un proyecto nuevo comparando contra proyectos similares cerrados — pero sin proyectos cerrados, solo adivinaría.
- **Cuándo se ejecuta:** Aplazado — se activa cuando existan proyectos cerrados comparables.
- **Fase:** 02 · Núcleo de captura: proyectos, personas y equipo

---

## Detalles importantes a tener en cuenta (advertencias)

- **La cadena nocturna tiene un orden obligatorio** — Sincronizador → Clasificador → Motor de indicadores → Reconciliador + Vigía. Si el motor corre antes que el clasificador, calcula sobre commits sin etiquetar y los indicadores de área salen vacíos.
- **Los agentes "fusionar" no deben construirse como piezas aparte** — Gestor de madurez y Verificador de evidencia van dentro del Motor de indicadores y del Detector de rastro respectivamente — construirlos separados multiplica piezas que hacen lo mismo.
- **Solo 5 de 15 necesitan LLM de verdad** — El resto son scripts deterministas: más baratos, más rápidos, y no pueden "alucinar" una verificación equivocada. Vale la pena revisar este balance si el sistema crece y empieza a necesitar juicio en más partes.
- **LangGraph no se justifica con este diseño** — La cadena de dependencias es lineal, sin ramas condicionales complejas. Un cron o un job simple alcanza — agregar LangGraph aquí sería una dependencia sin necesidad real detrás.
- **Los "aplazar" lo son por falta de datos, no por prioridad** — Resumen ejecutivo necesita volumen (20+ proyectos), Proyección comercial necesita historial de cierres, y el Asistente de planeación necesita proyectos ya cerrados para comparar. Construirlos antes sería adivinar, no automatizar.
