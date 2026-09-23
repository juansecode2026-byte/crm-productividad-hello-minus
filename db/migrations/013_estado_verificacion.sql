-- El veredicto del agente deja de ser binario.
--
-- Hasta acá el Verificador solo podía decir dos cosas: "está hecho"
-- (`detectado_en` con fecha) o "no está hecho" (`detectado_en` nulo). En la
-- práctica se perdía la respuesta más común de todas: **está empezado**. Un
-- proyecto con tests para dos de diez módulos, o con un `CLAUDE.md` que
-- enumera sus propias brechas abiertas, no es ninguna de las dos cosas — y
-- aplanarlo a "no está hecho" hace que la pantalla se vea igual que un
-- proyecto donde nadie tocó nada.
--
-- Tres valores, ordenados de menos a más certeza:
--   sin_empezar  el agente buscó y no encontró ninguna señal
--   en_proceso   hay trabajo real, incompleto, y el agente puede decir por qué
--   hecho        lo que se ve respalda que está terminado (pide confirmación)
--
-- `completado` sigue intacto y sigue significando exactamente lo mismo: lo
-- marcó una persona. El agente nunca lo escribe — esa es la regla de la
-- migración 011 y no cambia acá.

create type estado_verificacion as enum ('sin_empezar', 'en_proceso', 'hecho');

alter table checklist_items
  add column estado_agente estado_verificacion,
  add column verificado_en timestamptz;

comment on column checklist_items.estado_agente is
  'Veredicto del Verificador de checklist. NULL = el agente nunca miró este '
  'ítem, que no es lo mismo que haber mirado y no encontrar nada '
  '(sin_empezar). Ninguno de los tres valores marca el ítem como completado.';

comment on column checklist_items.verificado_en is
  'Cuándo corrió el último veredicto sobre este ítem, sea cual sea. Antes esta '
  'fecha solo existía cuando el veredicto era afirmativo, así que no se podía '
  'distinguir "lo miró y no había nada" de "nunca lo miró".';

-- -----------------------------------------------------------------------------
-- Traducción de lo que ya está guardado
-- -----------------------------------------------------------------------------
-- `detectado_en` con fecha significaba "hecho". Sin fecha significaba dos cosas
-- distintas que ahora sí se separan: si hay evidencia, el agente lo miró y no
-- encontró nada (`sin_empezar`); si no hay evidencia, nunca lo miró (NULL).
-- Ninguna fila existente puede quedar en `en_proceso`: ese veredicto no existía
-- cuando se escribieron, y ponerlo acá sería inventar un juicio que nadie
-- emitió. Quedan como están hasta el próximo escaneo.
update checklist_items
   set estado_agente = case
         when detectado_en is not null then 'hecho'::estado_verificacion
         when evidencia is not null then 'sin_empezar'::estado_verificacion
         else null
       end,
       verificado_en = case
         when detectado_en is not null then detectado_en
         -- Se miró en algún momento, pero esa fecha nunca se guardó. Se deja
         -- en NULL en vez de inventar una: la evidencia sigue ahí para leer.
         else null
       end;

alter table checklist_items
  drop column detectado_en;
