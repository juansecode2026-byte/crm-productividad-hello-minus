import { Router } from 'express';
import { z } from 'zod';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, ErrorHttp, errorSinFila, validar } from '../middleware/errores.js';

const esquemaCrear = z.strictObject({
  descripcion: z.string().trim().min(1).max(2000),
  tipo: z.enum(['interno', 'externo', 'cliente']).optional(),
});

const esquemaProyecto = z.object({ proyectoId: z.uuid() });
const esquemaBloqueo = z.object({ proyectoId: z.uuid(), bloqueoId: z.uuid() });

export const bloqueos = Router({ mergeParams: true });

// Quién abre el bloqueo es siempre quien hace la petición — a diferencia de
// miembros_proyecto, no hay caso de uso para "abrir un bloqueo a nombre de
// otra persona". escribir_bloqueos permite a cualquier miembro o líder del
// proyecto escribir, así que esto no necesita el chequeo extra de membresía
// que sí hace falta en tareas.ts (esa política ya lo exige por su cuenta).
bloqueos.post('/', async (req, res) => {
  const { supabase, persona } = contexto(req);
  const { proyectoId } = validar(esquemaProyecto, req.params);
  const datos = validar(esquemaCrear, req.body);

  const { data, error } = await supabase
    .from('bloqueos')
    .insert({
      proyecto_id: proyectoId,
      persona_id: persona.id,
      descripcion: datos.descripcion,
      tipo: datos.tipo,
    })
    .select()
    .single();
  if (error) throw desdeSupabase(error);

  res.status(201).json(data);
});

// No hay PATCH de texto: la descripción y el tipo se fijan al abrir. La
// única transición que le importa al negocio es cerrarlo — de ahí sale
// "tiempo de bloqueo sin resuelto" (indicador 26).
bloqueos.post('/:bloqueoId/resolver', async (req, res) => {
  const { supabase, persona } = contexto(req);
  const { proyectoId, bloqueoId } = validar(esquemaBloqueo, req.params);

  const { data: actual, error: errorActual } = await supabase
    .from('bloqueos')
    .select('resuelto_en')
    .eq('id', bloqueoId)
    .eq('proyecto_id', proyectoId)
    .maybeSingle();
  if (errorActual) throw desdeSupabase(errorActual);
  if (!actual) throw await errorSinFila(supabase, 'bloqueos', bloqueoId, 'ese bloqueo');
  if (actual.resuelto_en) throw new ErrorHttp(409, 'Ese bloqueo ya está resuelto');

  const { data, error } = await supabase
    .from('bloqueos')
    .update({ resuelto_en: new Date().toISOString(), resuelto_por: persona.id })
    .eq('id', bloqueoId)
    .is('resuelto_en', null)
    .select()
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw new ErrorHttp(403, 'No tienes permiso para resolver bloqueos de este proyecto');

  res.json(data);
});
