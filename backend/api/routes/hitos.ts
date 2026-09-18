import { Router } from 'express';
import { z } from 'zod';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, errorSinFila, validar } from '../middleware/errores.js';

const esquemaCrear = z.strictObject({
  nombre: z.string().trim().min(1).max(300),
  etapa: z.number().int().min(1).max(9).nullable().optional(),
  fecha_planeada: z.iso.date().nullable().optional(),
});

const esquemaEditar = z
  .strictObject({
    nombre: z.string().trim().min(1).max(300),
    etapa: z.number().int().min(1).max(9).nullable(),
    fecha_planeada: z.iso.date().nullable(),
    fecha_real: z.iso.date().nullable(),
    estado: z.enum(['pendiente', 'en_curso', 'cumplido', 'vencido']),
  })
  .partial()
  .refine((cambios) => Object.keys(cambios).length > 0, 'No hay campos para actualizar');

const esquemaProyecto = z.object({ proyectoId: z.uuid() });
const esquemaHito = z.object({ proyectoId: z.uuid(), hitoId: z.uuid() });

export const hitos = Router({ mergeParams: true });

hitos.post('/', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId } = validar(esquemaProyecto, req.params);
  const datos = validar(esquemaCrear, req.body);

  const { data, error } = await supabase
    .from('hitos')
    .insert({
      proyecto_id: proyectoId,
      nombre: datos.nombre,
      etapa: datos.etapa ?? null,
      fecha_planeada: datos.fecha_planeada ?? null,
    })
    .select()
    .single();
  if (error) throw desdeSupabase(error);

  res.status(201).json(data);
});

hitos.patch('/:hitoId', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId, hitoId } = validar(esquemaHito, req.params);
  const cambios = validar(esquemaEditar, req.body);

  // Marcar cumplido sin traer fecha_real es el caso normal (se cierra hoy);
  // si el body la trae, se respeta — así también sirve para cargar historia
  // vieja con su fecha real, no solo la de hoy.
  if (cambios.estado === 'cumplido' && cambios.fecha_real === undefined) {
    cambios.fecha_real = new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await supabase
    .from('hitos')
    .update(cambios)
    .eq('id', hitoId)
    .eq('proyecto_id', proyectoId)
    .select()
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw await errorSinFila(supabase, 'hitos', hitoId, 'ese hito');

  res.json(data);
});

hitos.delete('/:hitoId', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId, hitoId } = validar(esquemaHito, req.params);

  const { data, error } = await supabase
    .from('hitos')
    .delete()
    .eq('id', hitoId)
    .eq('proyecto_id', proyectoId)
    .select()
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw await errorSinFila(supabase, 'hitos', hitoId, 'ese hito');

  res.status(204).end();
});
