import type { PostgrestError } from '@supabase/supabase-js';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { z } from 'zod';
import type { ClienteSupabase } from './autenticacion.js';

export class ErrorHttp extends Error {
  readonly estado: number;
  readonly detalles?: unknown;

  constructor(estado: number, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

export function validar<T extends z.ZodType>(esquema: T, datos: unknown): z.output<T> {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((problema) => ({
      campo: problema.path.join('.'),
      mensaje: problema.message,
    }));
    throw new ErrorHttp(400, 'Datos inválidos', detalles);
  }
  return resultado.data;
}

const mensajesPorRestriccion: Record<string, string> = {
  miembro_activo_unico: 'Esa persona ya es miembro activo del proyecto',
  miembro_unico_por_periodo: 'Esa persona ya tiene una entrada al proyecto en esa fecha',
  personas_email_key: 'Ya existe una persona con ese email',
  personas_github_username_key: 'Ese usuario de GitHub ya está asignado a otra persona',
  repositorios_github_repo_key: 'Ese repositorio ya está vinculado a otro proyecto',
};

// Los mensajes de RLS y de privilegios vienen de Postgres en inglés; los de
// las funciones de 004_funciones_proyectos.sql ya están escritos para mostrarse.
function esMensajeDePostgres(mensaje: string): boolean {
  return mensaje.startsWith('new row violates') || mensaje.startsWith('permission denied');
}

export function desdeSupabase(error: PostgrestError): ErrorHttp {
  switch (error.code) {
    case '42501':
      return new ErrorHttp(
        403,
        esMensajeDePostgres(error.message) ? 'No tienes permiso para esta operación' : error.message,
      );
    case 'P0001':
      return new ErrorHttp(422, error.message);
    case 'P0002':
      return new ErrorHttp(404, error.message);
    case '23505': {
      const restriccion = Object.keys(mensajesPorRestriccion).find((nombre) => error.message.includes(nombre));
      return new ErrorHttp(409, restriccion ? mensajesPorRestriccion[restriccion]! : 'Ya existe un registro con esos datos');
    }
    case '23503':
      return new ErrorHttp(422, 'Alguna referencia no existe (proyecto, persona, cliente o rol)');
    case '23514':
      return new ErrorHttp(422, 'Algún valor está fuera del rango permitido');
    case '22P02':
      return new ErrorHttp(400, 'Algún valor tiene un formato inválido');
    default:
      // Solo código y mensaje: `details` puede traer valores de la fila.
      console.error(`Error de Supabase sin mapear [${error.code}]: ${error.message}`);
      return new ErrorHttp(500, 'Error inesperado de la base de datos');
  }
}

// Un UPDATE que RLS no deja pasar no falla: afecta cero filas. Como todos los
// integrantes leen todo, si la fila se ve es que falta permiso de escritura.
export async function errorSinFila(
  supabase: ClienteSupabase,
  tabla: 'proyectos' | 'personas',
  id: string,
  recurso: string,
): Promise<ErrorHttp> {
  const { data, error } = await supabase.from(tabla).select('id').eq('id', id).maybeSingle();
  if (error) return desdeSupabase(error);
  return data
    ? new ErrorHttp(403, `No tienes permiso para modificar ${recurso}`)
    : new ErrorHttp(404, `No existe ${recurso}`);
}

export const rutaNoEncontrada: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { mensaje: 'Ruta no encontrada' } });
};

function tipoDeErrorDeCuerpo(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'type' in error && typeof error.type === 'string') {
    return error.type;
  }
  return undefined;
}

export const manejarErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ErrorHttp) {
    res.status(error.estado).json({ error: { mensaje: error.message, detalles: error.detalles } });
    return;
  }

  const tipo = tipoDeErrorDeCuerpo(error);
  if (tipo === 'entity.parse.failed') {
    res.status(400).json({ error: { mensaje: 'El cuerpo de la petición no es JSON válido' } });
    return;
  }
  if (tipo === 'entity.too.large') {
    res.status(413).json({ error: { mensaje: 'El cuerpo de la petición es demasiado grande' } });
    return;
  }

  console.error('Error no controlado:', error instanceof Error ? error.message : error);
  res.status(500).json({ error: { mensaje: 'Error interno del servidor' } });
};
