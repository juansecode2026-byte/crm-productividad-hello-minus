-- Fecha de la evidencia de un ítem del checklist, y de dónde salió.
--
-- Pedido: a lo que el agente da por hecho, mostrarle cuándo se hizo. Pero
-- "cuándo se hizo" no está guardado en ningún lado, y las fechas que sí hay
-- dicen otra cosa: `verificado_en` es cuándo MIRÓ el agente, `completado_en`
-- es cuándo CONFIRMÓ una persona. Ninguna de las dos es la del trabajo.
--
-- Esta columna guarda la mejor aproximación disponible, y la columna de
-- origen dice qué tan buena es — no es lo mismo una fecha que alguien escribió
-- a mano que la de un archivo que pudo editarse por otra razón. En orden de
-- preferencia (lo decide services/fechaEvidencia.ts, no el agente):
--
--   commit_archivo    último commit del archivo que el agente citó como prueba
--   texto             fecha escrita dentro de la frase citada ("aplicada 2026-09-23")
--   commit_claude_md  último commit del CLAUDE.md — la más débil: el archivo
--                     pudo editarse mucho después, por algo que no tiene nada
--                     que ver con este ítem
--
-- Sin ninguna de las tres, las dos columnas quedan en NULL. No se inventa.
--
-- Todo esto es aritmética y consultas a GitHub, sin Claude: lo único que pone
-- el agente es `evidencia_archivo` (cuál archivo respalda su veredicto), que
-- el backend además valida contra los archivos que realmente le mostró.

create type origen_fecha_evidencia as enum ('commit_archivo', 'texto', 'commit_claude_md');

alter table checklist_items
  add column evidencia_archivo      text,
  add column evidencia_fecha        date,
  add column evidencia_fecha_origen origen_fecha_evidencia;

comment on column checklist_items.evidencia_archivo is
  'Ruta del archivo que el agente citó como prueba de su veredicto, validada '
  'contra los archivos que se le mostraron. NULL si el veredicto se apoyó en '
  'la forma general de las carpetas o en el ritmo de commits.';

comment on column checklist_items.evidencia_fecha is
  'Mejor aproximación a cuándo se hizo lo que el ítem describe. NO es la '
  'fecha en que el agente miró ni la de la confirmación. Ver '
  'evidencia_fecha_origen para saber qué tan confiable es.';

-- Una fecha sin origen no se puede leer (¿es fuerte o débil?), y un origen
-- sin fecha no dice nada. Van juntas o no van.
alter table checklist_items
  add constraint fecha_evidencia_coherente
  check ((evidencia_fecha is null) = (evidencia_fecha_origen is null));
