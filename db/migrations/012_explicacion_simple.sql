-- Explicación en palabras simples para cada ítem del checklist.
--
-- El problema que resuelve: el texto del ítem ("Modelo de datos definido") y
-- la evidencia del agente ("23 migraciones en supabase/migrations/, FK
-- compuestas tenant_id+pad_id") están escritos para alguien que programa. Una
-- persona del equipo que no programa mira la pantalla y no puede juzgar si
-- confirmar o no — que es exactamente lo único que la interfaz le pide hacer.
--
-- Va en `checklist_plantilla` y NO en `checklist_items` a propósito: la
-- explicación es la misma para todos los proyectos (a diferencia de
-- `evidencia`, que sí es de cada repositorio). Guardarla una sola vez significa
-- que corregir una redacción la arregla en todos los proyectos a la vez, sin
-- re-escanear nada.

alter table checklist_plantilla
  add column explicacion_simple text;

comment on column checklist_plantilla.explicacion_simple is
  'Qué significa este ítem para alguien que no programa. Sin jerga, sin nombres '
  'de archivos ni de herramientas. Lo lee quien tiene que decidir si confirma.';

-- -----------------------------------------------------------------------------
-- Redacción de los 31 ítems sembrados en la migración 011.
--
-- Criterio: explicar qué significa el ítem para el proyecto, no repetir el
-- título con otras palabras ni resumir la evidencia técnica. Una o dos frases.
-- -----------------------------------------------------------------------------
update checklist_plantilla as p
   set explicacion_simple = t.explicacion
  from (values
    (1, 'Está claro qué problema resuelve el proyecto',
        'Está escrito qué problema viene a resolver este proyecto. Sin esto, se termina construyendo algo que nadie pidió.'),
    (1, 'Está identificado para quién es o quién lo pidió',
        'Se sabe quién va a usar el sistema y quién lo pidió. Es a esa persona a quien hay que preguntarle cuando algo no está claro.'),
    (1, 'El alcance grueso está definido',
        'Hay un acuerdo de qué entra y qué no entra en el proyecto, aunque sea a grandes rasgos.'),

    (2, 'Modelo de datos definido (tablas y relaciones)',
        'Ya está decidido qué información guarda el sistema y cómo se conecta entre sí — por ejemplo, que cada tarea sabe a qué proyecto pertenece.'),
    (2, 'Stack tecnológico elegido',
        'Ya se eligió con qué herramientas se construye: con qué se hacen las pantallas, dónde se guardan los datos. No se cambia a mitad de camino.'),
    (2, 'Componentes del proyecto listados',
        'Hay una lista de las piezas grandes que se van a construir, para no ir descubriéndolas sobre la marcha.'),
    (2, 'Alcance congelado y registrado',
        'Quedó fijado con fecha qué se acordó construir. Todo lo que aparezca después se anota aparte, así no se confunde con retraso.'),

    (3, 'Repositorio creado',
        'Existe el lugar donde vive el código, con su historial: se puede ver quién cambió qué y volver atrás si algo se rompe.'),
    (3, 'Variables de entorno documentadas',
        'Están anotadas las claves y direcciones que el proyecto necesita para funcionar, así otra persona puede ponerlo a andar sin adivinar.'),
    (3, 'El proyecto corre en local',
        'El proyecto arranca y funciona en la computadora de quien lo desarrolla, antes de estar publicado en internet.'),
    (3, 'Despliega un "hola mundo"',
        'Se comprobó que el proyecto se puede publicar en internet, aunque todavía no haga nada útil. Es la prueba de que ese camino existe.'),

    (4, 'Esquema de base de datos aplicado',
        'Las tablas donde se guarda la información ya existen de verdad en la base de datos, no solo en el papel.'),
    (4, 'Backend: rutas principales funcionando',
        'La parte que no se ve ya responde: guarda, consulta y revisa la información que le mandan las pantallas.'),
    (4, 'Frontend: pantallas principales',
        'Las pantallas con las que trabaja una persona ya existen y se pueden usar, aunque falte pulirlas.'),
    (4, 'El flujo principal funciona de punta a punta',
        'Se puede hacer el recorrido completo: escribir un dato en una pantalla, que se guarde, y verlo de vuelta. Sin atajos ni datos de mentira.'),

    (5, 'Prompts escritos',
        'Están escritas las instrucciones que recibe cada agente de IA: qué tiene que hacer, con qué criterio y qué no puede hacer.'),
    (5, 'Herramientas de cada agente construidas',
        'Cada agente ya tiene las acciones que puede ejecutar — leer un repositorio, consultar la base, guardar un resultado — no solo sus instrucciones.'),
    (5, 'Probado contra casos de prueba reales',
        'El agente se probó con casos de verdad, donde se sabía de antemano la respuesta correcta, para ver si acierta.'),

    (6, 'Canales externos conectados (webhooks, APIs)',
        'El sistema ya está conectado con los servicios de afuera de los que recibe información o a los que le manda.'),
    (6, 'Backend y frontend hablando entre sí',
        'Las pantallas y la parte que no se ve están conectadas de verdad: lo que se aprieta en una llega a la otra.'),
    (6, 'Telemetría o registro de actividad reportando',
        'El sistema deja rastro de lo que va pasando, así se puede saber si está funcionando sin tener que preguntarle a nadie.'),
    (6, 'Verificado: un dato entra por un canal y llega correcto al otro extremo',
        'Se siguió un dato real desde que entra hasta donde termina, y llegó bien. No se dio por hecho: se miró.'),

    (7, 'Tests del flujo principal',
        'Hay pruebas automáticas que revisan solas que lo importante siga funcionando cada vez que se cambia algo.'),
    (7, 'Evaluaciones de los agentes',
        'Se midió qué tan bien responden los agentes de IA con una tanda de casos, no mirando dos o tres respuestas sueltas.'),
    (7, 'Revisión de permisos y seguridad',
        'Se revisó que cada persona vea y modifique solo lo que le corresponde, y que nada haya quedado abierto por descuido.'),
    (7, 'Sin errores críticos conocidos',
        'No queda ningún problema grave sabido sin resolver. Los que quedan son molestias, no cosas que frenen el trabajo.'),

    (8, 'Configuración de despliegue lista',
        'Está resuelto cómo se publica el proyecto y cómo se vuelve a la versión anterior si una sale mal.'),
    (8, 'Corriendo en producción',
        'El proyecto ya está publicado y en uso real, no solo en la computadora de quien lo construyó.'),
    (8, 'Período de vigilancia sin incidentes graves',
        'Pasó un tiempo razonable funcionando con alguien mirándolo de cerca, y no se cayó ni rompió nada importante.'),

    (9, 'Entregado y en uso real',
        'Las personas para las que se hizo ya lo usan en su trabajo de todos los días.'),
    (9, 'Mantenimiento en curso',
        'Alguien sigue a cargo: corrige lo que aparece con el uso y agrega lo que se vaya necesitando.')
  ) as t (etapa, texto, explicacion)
 where p.etapa = t.etapa
   and p.texto = t.texto;
