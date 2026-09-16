import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, ErrorHttp, validar } from '../middleware/errores.js';

const PREFIJO = 'hmt_';

const esquemaProyecto = z.object({ proyectoId: z.uuid() });
const esquemaClave = z.object({ proyectoId: z.uuid(), claveId: z.uuid() });
const esquemaCrear = z.strictObject({ nombre: z.string().trim().min(1).max(100) });

export const claves = Router({ mergeParams: true });

claves.get('/', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId } = validar(esquemaProyecto, req.params);

  const { data, error } = await supabase
    .from('claves_ingesta')
    .select('id, nombre, prefijo, activa, creada_en, ultimo_uso_en')
    .eq('proyecto_id', proyectoId)
    .order('creada_en', { ascending: false });
  if (error) throw desdeSupabase(error);

  res.json(data);
});

// La clave en claro se devuelve UNA sola vez, acá. En la base solo queda el
// hash: si se pierde, se revoca y se emite otra.
claves.post('/', async (req, res) => {
  const { supabase, persona } = contexto(req);
  const { proyectoId } = validar(esquemaProyecto, req.params);
  const { nombre } = validar(esquemaCrear, req.body);

  const clave = PREFIJO + randomBytes(24).toString('hex');
  const hash = createHash('sha256').update(clave).digest('hex');

  const { data, error } = await supabase
    .from('claves_ingesta')
    .insert({
      proyecto_id: proyectoId,
      nombre,
      hash_clave: hash,
      prefijo: clave.slice(0, 12),
      creada_por: persona.id,
    })
    .select('id, nombre, prefijo, creada_en')
    .single();
  if (error) throw desdeSupabase(error);

  res.status(201).json({ ...data, clave });
});

claves.post('/:claveId/revocar', async (req, res) => {
  const { supabase } = contexto(req);
  const { proyectoId, claveId } = validar(esquemaClave, req.params);

  const { data, error } = await supabase
    .from('claves_ingesta')
    .update({ activa: false })
    .eq('id', claveId)
    .eq('proyecto_id', proyectoId)
    .select('id, nombre, prefijo, activa')
    .maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw new ErrorHttp(404, 'No existe esa clave en el proyecto, o no tenés permiso para revocarla');

  res.json(data);
});
