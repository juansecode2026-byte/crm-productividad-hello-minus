// Verificador de checklist: siembra los ítems de la plantilla que le falten al
// proyecto, lee el repositorio, y marca cuáles el agente cree ya hechos.
//
// La regla que gobierna todo este archivo: **el agente nunca escribe
// `completado`.** Solo llena `estado_agente`, `verificado_en` y `evidencia`.
// `completado` lo mueve una persona apretando "Confirmar" (PATCH
// .../checklist/:itemId), que ya existía desde antes. Por eso los ítems ya confirmados ni siquiera se le
// mandan al agente: no hay nada que pueda decir que cambie algo.
import { randomUUID } from 'node:crypto';
import type { ClienteSupabase } from '../middleware/autenticacion.js';
import { desdeSupabase, ErrorHttp } from '../middleware/errores.js';
import { correrAgente } from './agentePython.js';
import { resolverFechaEvidencia, type FechaEvidencia } from './fechaEvidencia.js';
import { estadisticasRepo, estructuraRepo, leerClaudeMd, ultimoCommitDeArchivo } from './github.js';
import { registrarUsoVerificadorChecklist } from './telemetria.js';

export interface ResultadoEscaneo {
  sembrados: number;
  hechos: number;
  enProceso: number;
  revisados: number;
  leyoClaudeMd: boolean;
}

type EstadoAgente = 'sin_empezar' | 'en_proceso' | 'hecho';

interface VeredictoAgente {
  id: string;
  estado: EstadoAgente;
  evidencia: string;
  archivo_evidencia?: string | null;
}

// Piloto del experimento de costo (2026-09-25): lo que devuelve ejecutar.py
// además de los veredictos, tal como vino en la respuesta del SDK.
interface UsoAgente {
  tokens_entrada: number;
  tokens_salida: number;
}

const ESTADOS_VALIDOS: readonly EstadoAgente[] = ['sin_empezar', 'en_proceso', 'hecho'];

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
    return { sembrados, hechos: 0, enProceso: 0, revisados: 0, leyoClaudeMd: false };
  }

  // 4. Lo que se ve del repositorio. El CLAUDE.md es opcional: la mayoría de
  //    los repos no tiene, y el agente funciona igual sin él.
  const [estadisticas, estructura, claudeMd] = await Promise.all([
    estadisticasRepo(owner, repo),
    estructuraRepo(owner, repo),
    leerClaudeMd(owner, repo),
  ]);

  const json = await correrAgente<{ veredictos?: VeredictoAgente[]; uso?: UsoAgente }>({
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

  // Piloto del experimento de costo: se reporta lo que haya, sin bloquear el
  // escaneo si la telemetría fallara — misma regla de "nunca tumba al
  // proyecto que la usa" que ya sigue el paquete.
  if (json.uso) {
    registrarUsoVerificadorChecklist(randomUUID(), {
      tokensEntrada: json.uso.tokens_entrada,
      tokensSalida: json.uso.tokens_salida,
    });
  }

  // 5. Escribir el veredicto. Se escribe siempre, en los tres estados: un
  //    escaneo nuevo pisa al anterior, así una detección vieja que ya no se
  //    sostiene no queda colgada para siempre.
  const idsValidos = new Set(items.map((item) => item.id));
  const ahora = new Date().toISOString();
  const hoy = ahora.slice(0, 10);
  let hechos = 0;
  let enProceso = 0;

  // La ruta que cita el agente solo se acepta si está entre los archivos que
  // efectivamente se le mostraron. Una ruta inventada no llega a la base, y
  // tampoco dispara una consulta a GitHub.
  const rutasMostradas = new Set([...estructura.archivosRaiz, ...estructura.archivosClave]);
  if (claudeMd !== null) rutasMostradas.add('CLAUDE.md');
  const archivoValido = (v: VeredictoAgente): string | null =>
    v.estado !== 'sin_empezar' && v.archivo_evidencia && rutasMostradas.has(v.archivo_evidencia)
      ? v.archivo_evidencia
      : null;

  // 5a. La fecha de la evidencia, solo para lo que el agente da por hecho —
  //     es lo único donde "¿cuándo se terminó?" tiene sentido. Las consultas a
  //     GitHub van en paralelo y sin repetir: si tres ítems citan el mismo
  //     archivo, se pregunta una sola vez. Cero tokens de Claude: es la API de
  //     GitHub y aritmética (services/fechaEvidencia.ts).
  const rutasAConsultar = new Set<string>();
  for (const v of veredictos) {
    const archivo = archivoValido(v);
    if (v.estado === 'hecho' && archivo) rutasAConsultar.add(archivo);
  }
  const fechaPorRuta = new Map(
    await Promise.all(
      [...rutasAConsultar].map(async (ruta) => [ruta, await ultimoCommitDeArchivo(owner, repo, ruta)] as const),
    ),
  );

  for (const veredicto of veredictos) {
    if (!idsValidos.has(veredicto.id)) continue;
    // Un estado que no existe se descarta en vez de escribirse: mejor un ítem
    // sin veredicto que una fila con un valor que el enum no acepta.
    if (!ESTADOS_VALIDOS.includes(veredicto.estado)) continue;

    const archivo = archivoValido(veredicto);
    const fecha: FechaEvidencia | null =
      veredicto.estado === 'hecho'
        ? resolverFechaEvidencia({
            archivo,
            evidencia: veredicto.evidencia,
            fechaDelArchivo: archivo && archivo !== 'CLAUDE.md' ? (fechaPorRuta.get(archivo) ?? null) : null,
            fechaClaudeMd: archivo === 'CLAUDE.md' ? (fechaPorRuta.get('CLAUDE.md') ?? null) : null,
            hoy,
          })
        : null;

    const { error } = await supabase
      .from('checklist_items')
      .update({
        estado_agente: veredicto.estado,
        verificado_en: ahora,
        evidencia: veredicto.evidencia,
        evidencia_archivo: archivo,
        evidencia_fecha: fecha?.fecha ?? null,
        evidencia_fecha_origen: fecha?.origen ?? null,
      })
      .eq('id', veredicto.id)
      .eq('proyecto_id', proyectoId)
      .eq('completado', false); // Cinturón: nunca pisar algo ya confirmado.
    if (error) throw desdeSupabase(error);

    if (veredicto.estado === 'hecho') hechos++;
    else if (veredicto.estado === 'en_proceso') enProceso++;
  }

  return { sembrados, hechos, enProceso, revisados: veredictos.length, leyoClaudeMd: claudeMd !== null };
}
