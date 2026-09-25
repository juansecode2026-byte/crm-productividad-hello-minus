import { Router } from 'express';
import { z } from 'zod';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, ErrorHttp, validar } from '../middleware/errores.js';

const esquemaCrear = z.strictObject({
  horas_estimadas: z.number().positive().max(9999.99),
  fecha_inicio: z.iso.date(),
  fecha_fin: z.iso.date(),
});

const esquemaTarea = z.object({ proyectoId: z.uuid(), tareaId: z.uuid() });

export const estimaciones = Router({ mergeParams: true });

estimaciones.get('/', async (req, res) => {
  const { supabase } = contexto(req);
  const { tareaId } = validar(esquemaTarea, req.params);

  const { data, error } = await supabase
    .from('estimaciones_tarea')
    .select('id, tarea_id, horas_estimadas, fecha_inicio, fecha_fin, creado_por, creado_en')
    .eq('tarea_id', tareaId)
    .order('creado_en', { ascending: false });
  if (error) throw desdeSupabase(error);

  res.json(data);
});

// Sin PATCH ni DELETE: no hay política de RLS para editar o borrar una
// estimación ya hecha (escribir_estimaciones solo cubre insert) — una
// estimación es un compromiso fechado, corregirla es declarar una nueva, no
// reescribir la vieja. Solo quien tiene la tarea asignada puede estimarla,
// a diferencia de capacidad_persona donde el admin puede declarar por otro.
estimaciones.post('/', async (req, res) => {
  const { supabase, persona } = contexto(req);
  const { tareaId } = validar(esquemaTarea, req.params);
  const datos = validar(esquemaCrear, req.body);

  if (datos.fecha_fin < datos.fecha_inicio) {
    throw new ErrorHttp(422, 'La fecha_fin no puede ser anterior a fecha_inicio');
  }

  const { data, error } = await supabase
    .from('estimaciones_tarea')
    .insert({
      tarea_id: tareaId,
      horas_estimadas: datos.horas_estimadas,
      fecha_inicio: datos.fecha_inicio,
      fecha_fin: datos.fecha_fin,
      creado_por: persona.id,
    })
    .select()
    .single();
  if (error) throw desdeSupabase(error);

  res.status(201).json(data);
});
