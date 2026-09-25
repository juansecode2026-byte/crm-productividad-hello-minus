import { Router } from 'express';
import { z } from 'zod';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, validar } from '../middleware/errores.js';

const esquemaCrear = z.strictObject({
  horas_semanales: z.number().positive().max(168),
  vigente_desde: z.iso.date().optional(),
});

const esquemaPersona = z.object({ personaId: z.uuid() });

export const capacidad = Router({ mergeParams: true });

capacidad.get('/', async (req, res) => {
  const { supabase } = contexto(req);
  const { personaId } = validar(esquemaPersona, req.params);

  const { data, error } = await supabase
    .from('capacidad_persona')
    .select('id, persona_id, horas_semanales, vigente_desde, creado_en')
    .eq('persona_id', personaId)
    .order('vigente_desde', { ascending: false });
  if (error) throw desdeSupabase(error);

  res.json(data);
});

// Declarar la propia capacidad es como declarar la propia tarea: cada quien
// la suya. Admin puede declarar la de cualquiera (escribir_capacidad lo
// exige en RLS; acá solo se arma el insert, sin duplicar ese chequeo).
// Sin PATCH ni DELETE, a propósito: es historial (CLAUDE.md, Fase 07) — una
// capacidad nueva no borra la vieja, agrega una fila con otro vigente_desde.
capacidad.post('/', async (req, res) => {
  const { supabase } = contexto(req);
  const { personaId } = validar(esquemaPersona, req.params);
  const datos = validar(esquemaCrear, req.body);

  const { data, error } = await supabase
    .from('capacidad_persona')
    .insert({
      persona_id: personaId,
      horas_semanales: datos.horas_semanales,
      vigente_desde: datos.vigente_desde,
    })
    .select()
    .single();
  if (error) throw desdeSupabase(error);

  res.status(201).json(data);
});
