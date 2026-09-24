-- Siembra del catálogo de indicadores (Fase 07, la mitad que no depende de
-- que haya datos).
--
-- Fuente: docs/indicadores-individuales-hello-minus.md. Son los 29 con número;
-- quedan afuera los 9 que el propio doc marca "sin uso por ahora" porque
-- dependen 100% del cliente — medirlos evaluaría al cliente, no al equipo.
--
-- El doc dice "complementa el catálogo general de 50 indicadores", pero ese
-- catálogo general no existe en el repo (verificado el 2026-09-23: docs/ tiene
-- 4 archivos y ninguno lo es). 29 + 9 = 38, no 50. No se siembran filas para
-- completar un número que no corresponde a nada escrito.
--
-- Tres cosas que se dejan vacías a propósito, porque el doc no las decide:
--   - `plazo` (inmediato/mediano/largo): el doc no lo dice para ninguno.
--   - La fila `equipo` de los 9 "nuevos para individual" (21-29): el doc los
--     propone para trabajo individual y nunca dice si aplican en equipo. Que no
--     haya fila significa "no decidido", que no es lo mismo que aplica=false.
--   - `indicador_madurez`: se llena cuando exista el calculador de cada uno.
--
-- El código lleva el número del doc adelante (`29_avance_atribuido`) porque es
-- como se los nombra en la conversación y en el doc, y así ordenan solos.

insert into indicador_catalogo (indicador_code, nombre, categoria, depende_de, descripcion) values
  -- Grupo A: se muestran igual en individual y en equipo
  ('01_throughput',              'Throughput',                               'Productividad',     'persona', 'Hitos o tareas realmente cerradas por semana.'),
  ('02_ratio_facturable',        'Ratio horas facturables / no facturables', 'Productividad',     'persona', 'Proporción del tiempo en trabajo que factura vs. trabajo interno.'),
  ('03_precision_estimacion',    'Precisión de estimación',                  'Efectividad',       'persona', 'Qué tan cerca queda lo estimado de lo realmente tardado.'),
  ('04_tiempo_primer_avance',    'Tiempo hasta el primer avance visible',    'Efectividad',       'persona', 'Días desde que se asigna una tarea hasta el primer entregable parcial.'),
  ('05_dispersion',              'Dispersión',                               'Carga y Bienestar', 'persona', 'En cuántos proyectos activos distintos registra horas en la semana.'),
  ('06_carga_vs_capacidad',      'Carga vs. capacidad',                      'Carga y Bienestar', 'persona', 'Horas asignadas frente a horas disponibles en el periodo.'),
  ('07_continuidad_foco',        'Continuidad de foco',                      'Carga y Bienestar', 'persona', 'Horas seguidas en un mismo proyecto vs. saltos entre varios en un día.'),
  ('08_densidad_interrupciones', 'Densidad de interrupciones',               'Carga y Bienestar', 'persona', 'Número de cambios de tarea o proyecto dentro de un mismo día.'),
  ('09_horas_por_proyecto',      'Horas dedicadas por proyecto',             'Productividad',     'persona', 'Total de horas registradas en un proyecto específico.'),
  ('10_sesiones_claude_code',    'Sesiones de Claude Code',                  'Productividad',     'persona', 'Sesiones y prompts enviados por proyecto.'),
  ('11_perfil_especializacion',  'Perfil de especialización',                'Eficiencia',        'persona', '% de tiempo por tipo de trabajo: backend, frontend, agente, integración.'),
  ('12_versatilidad',            'Versatilidad entre tipos de proyecto',     'Productividad',     'persona', 'En cuántos tipos distintos de proyecto ha trabajado.'),
  ('13_commits_proyecto',        'Commits en el proyecto',                   'Productividad',     'persona', 'Número total de commits que la persona hizo en el repositorio de ese proyecto.'),

  -- Grupo B: se muestran, pero en individual cambia contra qué se comparan
  ('14_consistencia',            'Consistencia de trabajo',                  'Carga y Bienestar', 'persona', 'Ritmo de trabajo de esta semana comparado con semanas anteriores.'),
  ('15_rendimiento_hito',        'Rendimiento por hito',                     'Productividad',     'persona', 'Cuánto tiempo toma cerrar un hito.'),
  ('16_contribucion_ponderada',  'Contribución ponderada por tipo de trabajo','Eficiencia',       'persona', 'Cómo se reparte el trabajo entre tipos: backend, frontend, etc.'),

  -- Grupo C: no aplican en proyectos individuales
  ('17_bus_factor',              'Concentración de conocimiento (bus factor)','Riesgo',           'persona', 'Cuánto del conocimiento del proyecto depende de una sola persona.'),
  ('18_ratio_colaboradores',     'Ratio colaboradores / horas efectivas',    'Eficiencia',        'persona', 'Proporción entre la gente del proyecto y el avance logrado.'),
  ('19_capacidad_coordinacion',  '% de capacidad perdida en coordinación',   'Eficiencia',        'persona', 'Tiempo que se va en coordinar al equipo en vez de trabajar.'),
  ('20_estabilidad_equipo',      'Estabilidad del equipo (rotación)',        'Riesgo',            'persona', 'Qué tanto entra y sale gente del proyecto.'),

  -- Propuestos específicamente para trabajo individual
  ('21_autosuficiencia',         'Autosuficiencia',                          'Riesgo',            'persona', '% de bloqueos que la persona resolvió sola vs. los que escaló al otro integrante.'),
  ('22_ritmo_sostenido',         'Ritmo individual sostenido',               'Carga y Bienestar', 'persona', 'Varianza de actividad semana a semana, contra el propio histórico de la persona.'),
  ('23_autocomparacion',         'Auto-comparación entre proyectos propios', 'Productividad',     'persona', 'Velocidad de este proyecto vs. los proyectos individuales anteriores de la misma persona.'),
  ('24_documentacion',           'Documentación dejada',                     'Riesgo',            'persona', 'Comentarios, README y decisiones registradas, como seguro de vida del proyecto.'),
  ('25_modo_solitario',          '% de horas de la empresa en modo solitario','Riesgo',           'persona', 'De todas las horas trabajadas, cuántas fueron en proyectos de una sola persona.'),
  ('26_bloqueo_individual_compartido', 'Tiempo de bloqueo sin resolver — individual vs. compartido', 'Riesgo', 'persona', 'Cuánto dura un bloqueo en un proyecto solo vs. uno en equipo.'),
  ('27_balance_carga',           'Balance de carga total entre los dos',     'Carga y Bienestar', 'persona', 'Horas de cada persona sumando todos sus proyectos, comparadas entre las dos.'),
  ('28_intervencion_cruzada',    'Tasa de intervención cruzada',             'Riesgo',            'persona', 'Veces que la otra persona tuvo que meterse en un proyecto individual ajeno.'),
  ('29_avance_atribuido',        '% de avance atribuido a la persona',       'Productividad',     'persona', 'De los entregables de los que la persona es responsable, cuántos tiene completados.');

-- -----------------------------------------------------------------------------
-- Aplicabilidad por modalidad (Grupos A/B/C del doc)
-- -----------------------------------------------------------------------------

-- Grupo A: aplica igual en las dos modalidades.
insert into indicador_aplicabilidad (indicador_code, modalidad, aplica)
select code, m::modalidad_proyecto, true
  from unnest(array[
    '01_throughput','02_ratio_facturable','03_precision_estimacion','04_tiempo_primer_avance',
    '05_dispersion','06_carga_vs_capacidad','07_continuidad_foco','08_densidad_interrupciones',
    '09_horas_por_proyecto','10_sesiones_claude_code','11_perfil_especializacion',
    '12_versatilidad','13_commits_proyecto'
  ]) as code
  cross join unnest(array['individual','equipo']) as m;

-- Grupo B: aplica en las dos, pero en individual la comparación cambia.
insert into indicador_aplicabilidad (indicador_code, modalidad, aplica, sustituye_comparacion) values
  ('14_consistencia',           'individual', true, 'El propio histórico semanal de la persona (en equipo: el ritmo de los demás integrantes).'),
  ('14_consistencia',           'equipo',     true, null),
  ('15_rendimiento_hito',       'individual', true, 'Los proyectos individuales anteriores de la misma persona (en equipo: otros proyectos del equipo).'),
  ('15_rendimiento_hito',       'equipo',     true, null),
  ('16_contribucion_ponderada', 'individual', true, 'Cómo se reparte el propio tiempo entre tipos de trabajo (en equipo: cuánto aportó cada quien).'),
  ('16_contribucion_ponderada', 'equipo',     true, null);

-- Grupo C: no aplican en individual — con una sola persona dan siempre el mismo
-- valor por definición (el bus factor es 100%), y mostrarlos sería mentir de
-- forma constante.
insert into indicador_aplicabilidad (indicador_code, modalidad, aplica)
select code, m.modalidad::modalidad_proyecto, m.aplica
  from unnest(array['17_bus_factor','18_ratio_colaboradores','19_capacidad_coordinacion','20_estabilidad_equipo']) as code
  cross join (values ('individual', false), ('equipo', true)) as m(modalidad, aplica);

-- Nuevos para individual: solo la fila individual. Sin fila de equipo = no
-- decidido todavía (ver encabezado).
insert into indicador_aplicabilidad (indicador_code, modalidad, aplica)
select code, 'individual'::modalidad_proyecto, true
  from unnest(array[
    '21_autosuficiencia','22_ritmo_sostenido','23_autocomparacion','24_documentacion',
    '25_modo_solitario','26_bloqueo_individual_compartido','27_balance_carga',
    '28_intervencion_cruzada','29_avance_atribuido'
  ]) as code;
