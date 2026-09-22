import { Router } from 'express';
import { z } from 'zod';
import type { Database } from '../database.types.js';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, errorSinFila, validar } from '../middleware/errores.js';
import { escanearChecklist } from '../services/verificadorChecklist.js';

const esquemaCrear = z.strictObject({
  etapa: z.number().int().min(1).max(9),
  texto: z.string().trim().min(1).max(500),
});

// completado_por y completado_en no se aceptan del cliente: los fija el
// servidor a partir de quién hace la petición, igual que creado_por en otras
// rutas. Desmarcar un item los limpia — si no, quedaría la firma de quien lo
// completó la primera vez pegada a un ítem que ya no está completo.
const esquemaEditar = z
  .strictObject({
    texto: z.string().trim().min(1).max(500),
    completado: z.boolean(),
  })
  .partial()
  .refine((cambios) => Object.keys(cambios).length > 0, 'No hay campos para actualizar');

const esquemaProyecto = z.object({ proyectoId: z.uuid() });
const esquemaItem = z.object({ proyectoId: z.uuid(), itemId: z.uuid() });

export const checklist = Router({ mergeParams: true });

// Lo dispara el botón "Escanear con agente IA". Siembra los ítems de la
// plantilla que falten y marca cuáles el agente cree ya hechos — en
// `detectado_en`/`evidencia`, nunca en `completado`: eso lo mueve una persona
// confirmando ítem por ítem con el PATCH de abajo.
checklist.post('/escanear', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId } = validar(esquemaProyecto, req.params);

  res.json(await escanearChecklist(supabase, proyectoId));
});

checklist.post('/', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId } = validar(esquemaProyecto, req.params);
  const datos = validar(esquemaCrear, req.body);

  const { data, error } = await supabase
    .from('checklist_items')
    .insert({ proyecto_id: proyectoId, etapa: datos.etapa, texto: datos.texto })
    .select()
    .single();
  if (error) throw desdeSupabase(error);

  res.status(201).json(data);
});

checklist.patch('/:itemId', async (req, res) => {
  const { supabase, persona } = contexto(req);
  const { proyectoId, itemId } = validar(esquemaItem, req.params);
  const cambios = validar(esquemaEditar, req.body);

  const actualizacion: Database['public']['Tables']['checklist_items']['Update'] = {};
  if (cambios.texto !== undefined) actualizacion.texto = cambios.texto;
  if (cambios.completado !== undefined) {
    actualizacion.completado = cambios.completado;
    actualizacion.completado_por = cambios.completado ? persona.id : null;
    actualizacion.completado_en = cambios.completado ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from('checklist_items')
    .update(actualizacion)
    .eq('id', itemId)
    .eq('proyecto_id', proyectoId)
    .select()
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw await errorSinFila(supabase, 'checklist_items', itemId, 'ese ítem de checklist');

  res.json(data);
});

checklist.delete('/:itemId', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId, itemId } = validar(esquemaItem, req.params);

  const { data, error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', itemId)
    .eq('proyecto_id', proyectoId)
    .select()
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw await errorSinFila(supabase, 'checklist_items', itemId, 'ese ítem de checklist');

  res.status(204).end();
});
