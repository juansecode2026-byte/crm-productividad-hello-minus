import { Router } from 'express';
import { z } from 'zod';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, errorSinFila, validar } from '../middleware/errores.js';

const esquemaCrear = z.strictObject({
  fecha: z.iso.date(),
  horas: z.number().positive().max(24),
  descripcion: z.string().trim().max(2000).nullable().optional(),
});

const esquemaProyecto = z.object({ proyectoId: z.uuid() });
const esquemaReunion = z.object({ proyectoId: z.uuid(), reunionId: z.uuid() });

export const reuniones = Router({ mergeParams: true });

reuniones.get('/', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId } = validar(esquemaProyecto, req.params);

  const { data, error } = await supabase
    .from('reuniones')
    .select('id, persona_id, proyecto_id, fecha, horas, descripcion, creado_en')
    .eq('proyecto_id', proyectoId)
    .order('fecha', { ascending: false });
  if (error) throw desdeSupabase(error);

  res.json(data);
});

// Quién registra la reunión es siempre quien hace la petición — mismo criterio
// que bloqueos.ts, no hay "registrar a nombre de otro". Es la única captura
// manual de tiempo del sistema (indicador 19, CLAUDE.md Fase 07);
// registro_tiempo sigue 100% inferido, sin tocar.
reuniones.post('/', async (req, res) => {
  const { supabase, persona } = contexto(req);
  const { proyectoId } = validar(esquemaProyecto, req.params);
  const datos = validar(esquemaCrear, req.body);

  const { data, error } = await supabase
    .from('reuniones')
    .insert({
      proyecto_id: proyectoId,
      persona_id: persona.id,
      fecha: datos.fecha,
      horas: datos.horas,
      descripcion: datos.descripcion ?? null,
    })
    .select()
    .single();
  if (error) throw desdeSupabase(error);

  res.status(201).json(data);
});

// Sin PATCH de texto, igual que bloqueos: si se registró mal, se borra y se
// vuelve a crear — no hay un campo que valga la pena editar en el lugar.
reuniones.delete('/:reunionId', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId, reunionId } = validar(esquemaReunion, req.params);

  const { data, error } = await supabase
    .from('reuniones')
    .delete()
    .eq('id', reunionId)
    .eq('proyecto_id', proyectoId)
    .select()
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw await errorSinFila(supabase, 'reuniones', reunionId, 'esa reunión');

  res.status(204).end();
});
