import { Router } from 'express';
import { z } from 'zod';
import { contexto, type ClienteSupabase } from '../middleware/autenticacion.js';
import { desdeSupabase, ErrorHttp, errorSinFila, validar } from '../middleware/errores.js';
import { miembros } from './miembros.js';

const fecha = z.iso.date();

// etapa_actual, alcance_congelado_en y creado_por quedan afuera a propósito:
// los fija el servidor, nunca el formulario.
const camposEditables = {
  nombre: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().max(5000).nullable(),
  cliente_id: z.uuid().nullable(),
  encargado_id: z.uuid().nullable(),
  tipo: z.string().trim().max(100).nullable(),
  prioridad: z.number().int().min(1).max(5).nullable(),
  estado: z.enum(['activo', 'pausado', 'archivado']),
  modalidad: z.enum(['individual', 'equipo']),
  fecha_inicio: fecha.nullable(),
  fecha_objetivo: fecha.nullable(),
  fecha_limite: fecha.nullable(),
  horas_estimadas: z.number().positive().max(999999.99).nullable(),
};

const esquemaCrear = z
  .strictObject(camposEditables)
  .omit({ estado: true })
  .partial()
  .extend({
    nombre: camposEditables.nombre,
    etapa_inicial: z.number().int().min(1).max(9).optional(),
  });

const esquemaEditar = z
  .strictObject(camposEditables)
  .partial()
  .refine((cambios) => Object.keys(cambios).length > 0, 'No hay campos para actualizar');

const esquemaEtapa = z.strictObject({ etapa: z.number().int().min(1).max(9) });

const esquemaId = z.object({ id: z.uuid() });

interface Fechas {
  fecha_inicio?: string | null;
  fecha_objetivo?: string | null;
  fecha_limite?: string | null;
}

// Fechas ISO (AAAA-MM-DD): la comparación de texto respeta el orden cronológico.
function incoherenciaDeFechas({ fecha_inicio, fecha_objetivo, fecha_limite }: Fechas): string | null {
  if (fecha_inicio && fecha_objetivo && fecha_objetivo < fecha_inicio) {
    return 'La fecha objetivo no puede ser anterior a la fecha de inicio';
  }
  if (fecha_inicio && fecha_limite && fecha_limite < fecha_inicio) {
    return 'La fecha límite no puede ser anterior a la fecha de inicio';
  }
  if (fecha_objetivo && fecha_limite && fecha_limite < fecha_objetivo) {
    return 'La fecha límite no puede ser anterior a la fecha objetivo';
  }
  return null;
}

async function exigirEncargadoActivo(supabase: ClienteSupabase, encargadoId: string): Promise<void> {
  const { data, error } = await supabase.from('personas').select('activo').eq('id', encargadoId).maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data?.activo) throw new ErrorHttp(422, 'El encargado no existe o está inactivo');
}

export const proyectos = Router();

proyectos.post('/', async (req, res) => {
  const { supabase } = contexto(req);
  const datos = validar(esquemaCrear, req.body);

  const incoherencia = incoherenciaDeFechas(datos);
  if (incoherencia) throw new ErrorHttp(422, incoherencia);

  // Los opcionales ausentes viajan como undefined y se omiten del JSON, así
  // la función usa sus valores por defecto (modalidad, etapa inicial).
  const { data, error } = await supabase.rpc('crear_proyecto', {
    p_nombre: datos.nombre,
    p_descripcion: datos.descripcion ?? undefined,
    p_cliente_id: datos.cliente_id ?? undefined,
    p_encargado_id: datos.encargado_id ?? undefined,
    p_tipo: datos.tipo ?? undefined,
    p_prioridad: datos.prioridad ?? undefined,
    p_modalidad: datos.modalidad,
    p_etapa_inicial: datos.etapa_inicial,
    p_fecha_inicio: datos.fecha_inicio ?? undefined,
    p_fecha_objetivo: datos.fecha_objetivo ?? undefined,
    p_fecha_limite: datos.fecha_limite ?? undefined,
    p_horas_estimadas: datos.horas_estimadas ?? undefined,
  });

  if (error) throw desdeSupabase(error);
  res.status(201).json(data);
});

proyectos.patch('/:id', async (req, res) => {
  const { supabase } = contexto(req);
  const { id } = validar(esquemaId, req.params);
  const cambios = validar(esquemaEditar, req.body);

  if ('fecha_inicio' in cambios || 'fecha_objetivo' in cambios || 'fecha_limite' in cambios) {
    const { data: actual, error } = await supabase
      .from('proyectos')
      .select('fecha_inicio, fecha_objetivo, fecha_limite')
      .eq('id', id)
      .maybeSingle();
    if (error) throw desdeSupabase(error);
    if (!actual) throw new ErrorHttp(404, 'No existe el proyecto');

    const incoherencia = incoherenciaDeFechas({ ...actual, ...cambios });
    if (incoherencia) throw new ErrorHttp(422, incoherencia);
  }

  if (cambios.encargado_id) {
    await exigirEncargadoActivo(supabase, cambios.encargado_id);
  }

  const { data, error } = await supabase.from('proyectos').update(cambios).eq('id', id).select().maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw await errorSinFila(supabase, 'proyectos', id, 'el proyecto');

  res.json(data);
});

proyectos.post('/:id/etapa', async (req, res) => {
  const { supabase } = contexto(req);
  const { id } = validar(esquemaId, req.params);
  const { etapa } = validar(esquemaEtapa, req.body);

  const { data, error } = await supabase.rpc('cambiar_etapa_proyecto', { p_proyecto_id: id, p_etapa: etapa });
  if (error) throw desdeSupabase(error);

  res.json(data);
});

proyectos.use('/:proyectoId/miembros', miembros);
