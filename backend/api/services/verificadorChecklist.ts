// Verificador de checklist: siembra los ítems de la plantilla que le falten al
// proyecto, lee el repositorio, y marca cuáles el agente cree ya hechos.
//
// La regla que gobierna todo este archivo: **el agente nunca escribe
// `completado`.** Solo llena `detectado_en` y `evidencia`. `completado` lo
// mueve una persona apretando "Confirmar" (PATCH .../checklist/:itemId), que
// ya existía desde antes. Por eso los ítems ya confirmados ni siquiera se le
// mandan al agente: no hay nada que pueda decir que cambie algo.
import type { ClienteSupabase } from '../middleware/autenticacion.js';
import { desdeSupabase, ErrorHttp } from '../middleware/errores.js';
import { correrAgente } from './agentePython.js';
import { estadisticasRepo, estructuraRepo, leerClaudeMd } from './github.js';

export interface ResultadoEscaneo {
  sembrados: number;
  detectados: number;
  revisados: number;
  leyoClaudeMd: boolean;
}

interface VeredictoAgente {
  id: string;
  detectado: boolean;
  evidencia: string;
}

export async function escanearChecklist(
  supabase: ClienteSupabase,
  proyectoId: string,
): Promise<ResultadoEscaneo> {
  // 1. El repo del proyecto. Sin repo vinculado no hay nada que leer.
  const { data: repositorio, error: errorRepo } = await supabase
    .from('repositorios')
    .select('github_repo')
    .eq('proyecto_id', proyectoId)
    .limit(1)
    .maybeSingle();
  if (errorRepo) throw desdeSupabase(errorRepo);
  if (!repositorio) {
    throw new ErrorHttp(422, 'Este proyecto no tiene un repositorio vinculado: no hay qué escanear.');
  }

  const [owner, repo] = repositorio.github_repo.split('/');
  if (!owner || !repo) {
    throw new ErrorHttp(422, `El repositorio "${repositorio.github_repo}" no tiene forma dueño/nombre.`);
  }

  // 2. Sembrar lo que falte de la plantilla. Idempotente por el constraint
  //    único (proyecto_id, etapa, texto): volver a escanear no duplica, y si
  //    la plantilla creció desde el último escaneo, los nuevos entran ahora.
  const { data: plantilla, error: errorPlantilla } = await supabase
    .from('checklist_plantilla')
    .select('etapa, texto')
    .eq('activo', true)
    .order('etapa')
    .order('orden');
  if (errorPlantilla) throw desdeSupabase(errorPlantilla);

  let sembrados = 0;
  if (plantilla.length > 0) {
    const { data: insertados, error: errorSembrar } = await supabase
      .from('checklist_items')
      .upsert(
        plantilla.map((fila) => ({ proyecto_id: proyectoId, etapa: fila.etapa, texto: fila.texto })),
        { onConflict: 'proyecto_id,etapa,texto', ignoreDuplicates: true },
      )
      .select('id');
    if (errorSembrar) throw desdeSupabase(errorSembrar);
    sembrados = insertados?.length ?? 0;
  }

  // 3. Los ítems a juzgar: todos los del proyecto que una persona no haya
  //    confirmado todavía. Los confirmados no se tocan ni se consultan.
  const { data: items, error: errorItems } = await supabase
    .from('checklist_items')
    .select('id, etapa, texto')
    .eq('proyecto_id', proyectoId)
    .eq('completado', false)
    .order('etapa');
  if (errorItems) throw desdeSupabase(errorItems);

  if (items.length === 0) {
    return { sembrados, detectados: 0, revisados: 0, leyoClaudeMd: false };
  }

  // 4. Lo que se ve del repositorio. El CLAUDE.md es opcional: la mayoría de
  //    los repos no tiene, y el agente funciona igual sin él.
  const [estadisticas, estructura, claudeMd] = await Promise.all([
    estadisticasRepo(owner, repo),
    estructuraRepo(owner, repo),
    leerClaudeMd(owner, repo),
  ]);

  const json = await correrAgente<{ veredictos?: VeredictoAgente[] }>({
    modulo: 'verificador_checklist.ejecutar',
    contexto: `${owner}/${repo} · ${items.length} ítems`,
    // Más tiempo que el Sugeridor de etapa: son ~30 juicios en una sola
    // llamada, no uno.
    limiteMs: 180_000,
    entrada: {
      owner,
      repo,
      carpetas: estructura.carpetas,
      archivos_raiz: estructura.archivosRaiz,
      archivos_clave: estructura.archivosClave,
      total_archivos: estructura.totalArchivos,
      estructura_disponible: estructura.disponible,
      commits_total: estadisticas.commitsTotal,
      commits_truncado: estadisticas.commitsTruncado,
      commits_semana: estadisticas.commitsSemana,
      primer_commit: estadisticas.primerCommit,
      ultimo_commit: estadisticas.ultimoCommit,
      prs_abiertos: estadisticas.prsAbiertos,
      colaboradores: estadisticas.colaboradores,
      claude_md: claudeMd,
      items,
    },
  });

  const veredictos = json.veredictos ?? [];

  // 5. Escribir solo lo detectado. Un veredicto negativo limpia una detección
  //    anterior: si el agente antes creyó ver algo y ahora no, el ámbar se
  //    va — lo contrario dejaría propuestas viejas colgadas para siempre.
  const idsValidos = new Set(items.map((item) => item.id));
  const ahora = new Date().toISOString();
  let detectados = 0;

  for (const veredicto of veredictos) {
    if (!idsValidos.has(veredicto.id)) continue;

    const { error } = await supabase
      .from('checklist_items')
      .update(
        veredicto.detectado
          ? { detectado_en: ahora, evidencia: veredicto.evidencia }
          : { detectado_en: null, evidencia: veredicto.evidencia },
      )
      .eq('id', veredicto.id)
      .eq('proyecto_id', proyectoId)
      .eq('completado', false); // Cinturón: nunca pisar algo ya confirmado.
    if (error) throw desdeSupabase(error);

    if (veredicto.detectado) detectados++;
  }

  return { sembrados, detectados, revisados: veredictos.length, leyoClaudeMd: claudeMd !== null };
}
