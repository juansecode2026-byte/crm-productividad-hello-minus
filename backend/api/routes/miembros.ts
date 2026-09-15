import { Router } from 'express';
import { z } from 'zod';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, ErrorHttp, validar } from '../middleware/errores.js';

// Las fechas las manda el formulario: el servidor y la base corren en UTC y
// "hoy" no es el mismo día que para quien registra la entrada o la salida.
const esquemaAlta = z.strictObject({
  persona_id: z.uuid(),
  rol_proyecto_id: z.uuid().nullable().optional(),
  dedicacion_pct: z.number().int().min(0).max(100).nullable().optional(),
  fecha_entrada: z.iso.date(),
});

const esquemaEditar = z
  .strictObject({
    rol_proyecto_id: z.uuid().nullable(),
    dedicacion_pct: z.number().int().min(0).max(100).nullable(),
  })
  .partial()
  .refine((cambios) => Object.keys(cambios).length > 0, 'No hay campos para actualizar');

const esquemaSalida = z.strictObject({ fecha_salida: z.iso.date() });

const esquemaProyecto = z.object({ proyectoId: z.uuid() });
const esquemaMiembro = z.object({ proyectoId: z.uuid(), miembroId: z.uuid() });

export const miembros = Router({ mergeParams: true });

miembros.post('/', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId } = validar(esquemaProyecto, req.params);
  const datos = validar(esquemaAlta, req.body);

  const { data: persona, error: errorPersona } = await supabase
    .from('personas')
    .select('activo')
    .eq('id', datos.persona_id)
    .maybeSingle();
  if (errorPersona) throw desdeSupabase(errorPersona);
  if (!persona?.activo) throw new ErrorHttp(422, 'La persona no existe o está inactiva');

  const { data, error } = await supabase
    .from('miembros_proyecto')
    .insert({ ...datos, proyecto_id: proyectoId })
    .select()
    .single();
  if (error) throw desdeSupabase(error);

  res.status(201).json(data);
});

miembros.patch('/:miembroId', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId, miembroId } = validar(esquemaMiembro, req.params);
  const cambios = validar(esquemaEditar, req.body);

  const { data: actual, error: errorActual } = await supabase
    .from('miembros_proyecto')
    .select('fecha_salida')
    .eq('id', miembroId)
    .eq('proyecto_id', proyectoId)
    .maybeSingle();
  if (errorActual) throw desdeSupabase(errorActual);
  if (!actual) throw new ErrorHttp(404, 'No existe ese miembro en el proyecto');
  // El paso de alguien que ya salió es historia: de ahí salen el bus factor y
  // la estabilidad del equipo.
  if (actual.fecha_salida) throw new ErrorHttp(409, 'Ese miembro ya salió del proyecto; su historial no se edita');

  const { data, error } = await supabase
    .from('miembros_proyecto')
    .update(cambios)
    .eq('id', miembroId)
    .is('fecha_salida', null)
    .select()
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw new ErrorHttp(403, 'No tienes permiso para modificar los miembros de este proyecto');

  res.json(data);
});

// No hay DELETE: quien sale queda registrado con su fecha de salida.
miembros.post('/:miembroId/salida', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId, miembroId } = validar(esquemaMiembro, req.params);
  const { fecha_salida } = validar(esquemaSalida, req.body);

  const { data: actual, error: errorActual } = await supabase
    .from('miembros_proyecto')
    .select('fecha_entrada, fecha_salida')
    .eq('id', miembroId)
    .eq('proyecto_id', proyectoId)
    .maybeSingle();
  if (errorActual) throw desdeSupabase(errorActual);
  if (!actual) throw new ErrorHttp(404, 'No existe ese miembro en el proyecto');
  if (actual.fecha_salida) throw new ErrorHttp(409, 'Ese miembro ya salió del proyecto');
  if (fecha_salida < actual.fecha_entrada) {
    throw new ErrorHttp(422, 'La fecha de salida no puede ser anterior a la fecha de entrada');
  }

  const { data, error } = await supabase
    .from('miembros_proyecto')
    .update({ fecha_salida })
    .eq('id', miembroId)
    .is('fecha_salida', null)
    .select()
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw new ErrorHttp(403, 'No tienes permiso para modificar los miembros de este proyecto');

  res.json(data);
});
