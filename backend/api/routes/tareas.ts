import { Router } from 'express';
import { z } from 'zod';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, ErrorHttp, errorSinFila, validar } from '../middleware/errores.js';

// areas queda en texto libre a propósito: cada proyecto de Hello Minus tiene
// su propia estructura de carpetas y por lo tanto su propio vocabulario de
// áreas (scripts/inferir_area.py recibe las reglas por parámetro). No hay
// catálogo global contra el que validar. El Detector de rastro semanal hace
// el match por texto exacto contra area_inferida — escribir el área distinto
// a como aparece en los commits hace que la evidencia no se encuentre.
const camposEditables = {
  titulo: z.string().trim().min(1).max(300),
  semana_inicio: z.iso.date(),
  semana_fin: z.iso.date(),
  areas: z.array(z.string().trim().min(1)).min(1).max(20),
};

const esquemaCrear = z.strictObject(camposEditables).extend({
  // Quién la tiene asignada. Por defecto la propia persona; asignarla a otra
  // solo lo permite RLS (crear_mi_tarea) si quien la crea es admin.
  persona_id: z.uuid().optional(),
});

const esquemaEditar = z
  .strictObject(camposEditables)
  .partial()
  .refine((cambios) => Object.keys(cambios).length > 0, 'No hay campos para actualizar');

const esquemaProyecto = z.object({ proyectoId: z.uuid() });
const esquemaTarea = z.object({ proyectoId: z.uuid(), tareaId: z.uuid() });

function incoherenciaDeSemana(semana_inicio?: string, semana_fin?: string): string | null {
  if (semana_inicio && semana_fin && semana_fin < semana_inicio) {
    return 'La semana_fin no puede ser anterior a semana_inicio';
  }
  return null;
}

export const tareas = Router({ mergeParams: true });

tareas.post('/', async (req, res) => {
  const { supabase, persona } = contexto(req);
  const { proyectoId } = validar(esquemaProyecto, req.params);
  const datos = validar(esquemaCrear, req.body);

  const incoherencia = incoherenciaDeSemana(datos.semana_inicio, datos.semana_fin);
  if (incoherencia) throw new ErrorHttp(422, incoherencia);

  const personaId = datos.persona_id ?? persona.id;

  // Chequeo de integridad que RLS no cubre: crear_mi_tarea solo exige
  // persona_id = quien la crea (o admin), no que esa persona participe del
  // proyecto. Una tarea semanal de alguien ajeno al proyecto no tiene sentido.
  if (persona.rol !== 'admin') {
    const { data: miembro, error } = await supabase
      .from('miembros_proyecto')
      .select('id')
      .eq('proyecto_id', proyectoId)
      .eq('persona_id', personaId)
      .is('fecha_salida', null)
      .maybeSingle();
    if (error) throw desdeSupabase(error);
    if (!miembro) throw new ErrorHttp(422, 'Esa persona no es miembro activo de este proyecto');
  }

  const { data, error } = await supabase
    .from('tareas_semanales')
    .insert({
      proyecto_id: proyectoId,
      persona_id: personaId,
      titulo: datos.titulo,
      semana_inicio: datos.semana_inicio,
      semana_fin: datos.semana_fin,
      areas: datos.areas,
      creado_por: persona.id,
    })
    .select()
    .single();
  if (error) throw desdeSupabase(error);

  res.status(201).json(data);
});

tareas.patch('/:tareaId', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId, tareaId } = validar(esquemaTarea, req.params);
  const cambios = validar(esquemaEditar, req.body);

  if ('semana_inicio' in cambios || 'semana_fin' in cambios) {
    const { data: actual, error } = await supabase
      .from('tareas_semanales')
      .select('semana_inicio, semana_fin')
      .eq('id', tareaId)
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    if (error) throw desdeSupabase(error);
    if (!actual) throw new ErrorHttp(404, 'No existe esa tarea en el proyecto');

    const incoherencia = incoherenciaDeSemana(
      cambios.semana_inicio ?? actual.semana_inicio,
      cambios.semana_fin ?? actual.semana_fin,
    );
    if (incoherencia) throw new ErrorHttp(422, incoherencia);
  }

  const { data, error } = await supabase
    .from('tareas_semanales')
    .update(cambios)
    .eq('id', tareaId)
    .eq('proyecto_id', proyectoId)
    .select()
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw await errorSinFila(supabase, 'tareas_semanales', tareaId, 'esa tarea semanal');

  res.json(data);
});

tareas.delete('/:tareaId', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId, tareaId } = validar(esquemaTarea, req.params);

  const { data, error } = await supabase
    .from('tareas_semanales')
    .delete()
    .eq('id', tareaId)
    .eq('proyecto_id', proyectoId)
    .select()
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw await errorSinFila(supabase, 'tareas_semanales', tareaId, 'esa tarea semanal');

  res.status(204).end();
});
