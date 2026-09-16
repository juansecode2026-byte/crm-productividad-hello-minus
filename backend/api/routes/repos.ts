import { Router } from 'express';
import { z } from 'zod';
import { contexto } from '../middleware/autenticacion.js';
import { desdeSupabase, ErrorHttp, validar } from '../middleware/errores.js';
import { estadisticasRepo } from '../services/github.js';

const esquemaVincular = z
  .strictObject({
    owner: z.string().trim().min(1),
    repo: z.string().trim().min(1),
    nombre: z.string().trim().min(1).max(200),
    modalidad: z.enum(['individual', 'equipo']),
    etapa_inicial: z.number().int().min(1).max(9),
    fecha_inicio: z.iso.date().nullable(),
    // En equipo no se pregunta: quedan todas las personas activas como
    // líderes (ver más abajo). Solo hace falta elegir una en individual.
    encargado_id: z.uuid().optional(),
  })
  .refine(
    (datos) => datos.modalidad === 'equipo' || datos.encargado_id !== undefined,
    { message: 'Elegí un encargado', path: ['encargado_id'] },
  );

export const repos = Router();

// No es "todo GitHub": es repos_candidatos menos lo que ya tiene fila en
// repositorios. Agregar más candidatos es tarea de admin hasta que exista el
// lector automático (DECISIONES.md).
repos.get('/candidatos', async (req, res) => {
  const { supabase } = contexto(req);

  const [candidatosRes, vinculadosRes] = await Promise.all([
    supabase.from('repos_candidatos').select('owner, repo, agregado_en').order('agregado_en'),
    supabase.from('repositorios').select('github_repo'),
  ]);
  if (candidatosRes.error) throw desdeSupabase(candidatosRes.error);
  if (vinculadosRes.error) throw desdeSupabase(vinculadosRes.error);

  const yaVinculados = new Set(vinculadosRes.data.map((fila) => fila.github_repo.toLowerCase()));
  const pendientes = candidatosRes.data.filter(
    (candidato) => !yaVinculados.has(`${candidato.owner}/${candidato.repo}`.toLowerCase()),
  );

  const conEstadisticas = await Promise.all(
    pendientes.map((candidato) => estadisticasRepo(candidato.owner, candidato.repo)),
  );

  res.json(conEstadisticas);
});

repos.post('/vincular', async (req, res) => {
  const { supabase, persona } = contexto(req);
  const datos = validar(esquemaVincular, req.body);

  const { data: activas, error: errorActivas } = await supabase.from('personas').select('id, activo').eq('activo', true);
  if (errorActivas) throw desdeSupabase(errorActivas);

  // Individual: la elegida a mano. Equipo: quien vincula (así RLS lo deja
  // pasar sin ser admin) — el resto de las personas activas se agregan abajo.
  const encargadoId = datos.modalidad === 'equipo' ? persona.id : datos.encargado_id!;
  if (datos.modalidad === 'individual' && !activas.some((p) => p.id === encargadoId)) {
    throw new ErrorHttp(422, 'El encargado no existe o está inactivo');
  }

  const { data: proyecto, error: errorProyecto } = await supabase.rpc('crear_proyecto', {
    p_nombre: datos.nombre,
    p_modalidad: datos.modalidad,
    p_etapa_inicial: datos.etapa_inicial,
    p_fecha_inicio: datos.fecha_inicio ?? undefined,
    p_encargado_id: encargadoId,
  });
  if (errorProyecto) throw desdeSupabase(errorProyecto);

  const githubRepo = `${datos.owner}/${datos.repo}`;
  const { data: repositorio, error: errorRepositorio } = await supabase
    .from('repositorios')
    .insert({ proyecto_id: proyecto.id, github_repo: githubRepo })
    .select()
    .single();

  if (errorRepositorio) {
    // El proyecto ya quedó creado: no lo revertimos (queda como proyecto normal
    // sin repo, se puede reintentar el vínculo a mano). Se avisa distinto para
    // que quien lo usa sepa que no partió de cero.
    const errorMapeado = desdeSupabase(errorRepositorio);
    throw new ErrorHttp(
      errorMapeado.estado,
      `El proyecto "${datos.nombre}" se creó, pero no se pudo vincular el repositorio: ${errorMapeado.message}`,
    );
  }

  // crear_proyecto ya sumó al encargado como miembro líder. En equipo faltan
  // las demás personas activas — mismo rol, para que las dos gobiernen el
  // proyecto por igual.
  if (datos.modalidad === 'equipo') {
    const { data: rolLider, error: errorRol } = await supabase
      .from('roles_proyecto')
      .select('id')
      .eq('nombre', 'lider')
      .single();
    if (errorRol) throw desdeSupabase(errorRol);

    const resto = activas.filter((p) => p.id !== encargadoId);
    if (resto.length > 0) {
      const { error: errorMiembros } = await supabase.from('miembros_proyecto').insert(
        resto.map((p) => ({
          proyecto_id: proyecto.id,
          persona_id: p.id,
          rol_proyecto_id: rolLider.id,
          fecha_entrada: datos.fecha_inicio ?? undefined,
        })),
      );
      if (errorMiembros) {
        const errorMapeado = desdeSupabase(errorMiembros);
        throw new ErrorHttp(
          errorMapeado.estado,
          `El proyecto "${datos.nombre}" se vinculó, pero no se pudo agregar al resto del equipo como líder: ${errorMapeado.message}`,
        );
      }
    }
  }

  res.status(201).json({ proyecto, repositorio });
});
