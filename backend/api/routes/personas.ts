import { Router } from 'express';
import { z } from 'zod';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, ErrorHttp, errorSinFila, validar } from '../middleware/errores.js';
import { capacidad } from './capacidad.js';

// El trigger de vinculación con Auth compara emails en minúsculas; guardarlos
// así evita duplicados que solo difieren en mayúsculas.
const email = z.string().trim().toLowerCase().pipe(z.email());

const githubUsername = z
  .string()
  .trim()
  .regex(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i, 'No es un usuario de GitHub válido');

// auth_user_id no se acepta nunca: lo fija el trigger al registrarse.
const camposEditables = {
  nombre: z.string().trim().min(1).max(200),
  email,
  rol: z.enum(['admin', 'lider_proyecto', 'colaborador']),
  github_username: githubUsername.nullable(),
  activo: z.boolean(),
  fecha_ingreso: z.iso.date(),
};

const esquemaCrear = z
  .strictObject(camposEditables)
  .omit({ activo: true })
  .partial()
  .extend({ nombre: camposEditables.nombre, email: camposEditables.email });

const esquemaEditar = z
  .strictObject(camposEditables)
  .partial()
  .refine((cambios) => Object.keys(cambios).length > 0, 'No hay campos para actualizar');

const esquemaId = z.object({ id: z.uuid() });

export const personas = Router();

personas.post('/', async (req, res) => {
  const { supabase } = contexto(req);
  const datos = validar(esquemaCrear, req.body);

  const { data, error } = await supabase.from('personas').insert(datos).select().single();
  if (error) throw desdeSupabase(error);

  res.status(201).json(data);
});

personas.patch('/:id', async (req, res) => {
  const { supabase } = contexto(req);
  const { id } = validar(esquemaId, req.params);
  const cambios = validar(esquemaEditar, req.body);

  // Solo un admin escribe personas y catálogos. Si el último admin activo se
  // degrada o se desactiva, nadie puede volver a nombrar otro desde la app.
  const pierdeAdmin = (cambios.rol !== undefined && cambios.rol !== 'admin') || cambios.activo === false;
  if (pierdeAdmin) {
    const { data: objetivo, error: errorObjetivo } = await supabase
      .from('personas')
      .select('rol, activo')
      .eq('id', id)
      .maybeSingle();
    if (errorObjetivo) throw desdeSupabase(errorObjetivo);
    if (!objetivo) throw new ErrorHttp(404, 'No existe la persona');

    if (objetivo.rol === 'admin' && objetivo.activo) {
      const { count, error: errorConteo } = await supabase
        .from('personas')
        .select('id', { count: 'exact', head: true })
        .eq('rol', 'admin')
        .eq('activo', true)
        .neq('id', id);
      if (errorConteo) throw desdeSupabase(errorConteo);
      if (!count) throw new ErrorHttp(422, 'Tiene que quedar al menos un admin activo');
    }
  }

  const { data, error } = await supabase.from('personas').update(cambios).eq('id', id).select().maybeSingle();
  if (error) throw desdeSupabase(error);
  if (!data) throw await errorSinFila(supabase, 'personas', id, 'la persona');

  res.json(data);
});

personas.use('/:personaId/capacidad', capacidad);
