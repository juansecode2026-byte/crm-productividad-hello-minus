import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ClavesIngesta } from '../components/ClavesIngesta';
import { EditarProyecto } from '../components/EditarProyecto';
import { EstimacionTarea } from '../components/EstimacionTarea';
import { PieEvidencia } from '../components/PieEvidencia';
import { Reuniones } from '../components/Reuniones';
import { diasEntre, fechaCorta } from '../lib/fechas';
import { ETAPAS } from '../lib/etapas';
import type { Bloqueo, ChecklistItem, Hito, HistorialEtapa, Proyecto as TipoProyecto } from '../lib/tipos';
import {
  abrirBloqueo,
  listarBloqueos,
  resolverBloqueo,
} from '../services/bloqueosService';
import {
  borrarItemChecklist,
  crearItemChecklist,
  escanearChecklist as escanearChecklistService,
  listarChecklist,
  listarExplicaciones,
  marcarItemChecklist,
} from '../services/checklistService';
import { borrarHito, cambiarEstadoHito, crearHito, listarHitos } from '../services/hitosService';
import { listarPersonasActivas } from '../services/personasService';
import { listarHistorialEtapas, obtenerProyecto } from '../services/proyectosService';
import { obtenerAporteIntegrantes, type SnapshotAporte } from '../services/indicadoresService';
import { crearTarea, listarTareas, marcarTarea, type TareaConEvidencia } from '../services/tareasService';
import estilos from './Proyecto.module.css';

// Los cuatro estados de un ítem, de menos a más certeza. El símbolo no es
// decoración: es lo que distingue un estado de otro para quien no ve el color
// —el rojo contra el verde es justo el par que no distingue un daltónico— y lo
// único que sobrevive si la pantalla se imprime en blanco y negro.
type EstadoItem = 'sin_verificar' | 'sin_empezar' | 'en_proceso' | 'hecho' | 'confirmado';

const GLIFO: Record<EstadoItem, string> = {
  sin_verificar: '',
  sin_empezar: '○',
  en_proceso: '◐',
  hecho: '✓',
  confirmado: '✓',
};

const ROTULO: Record<EstadoItem, string> = {
  sin_verificar: 'Sin verificar',
  sin_empezar: 'Falta por construir',
  en_proceso: 'En proceso',
  hecho: 'Confirmar',
  confirmado: 'Confirmado',
};

type EstadoEtapa = 'hecha' | 'actual' | 'saltada' | 'futura';

function estadoDeEtapa(numero: number, etapaActual: number, visitadas: Set<number>): EstadoEtapa {
  if (numero === etapaActual) return 'actual';
  if (visitadas.has(numero)) return 'hecha';
  if (numero < etapaActual) return 'saltada';
  return 'futura';
}

export function Proyecto() {
  const { id } = useParams<{ id: string }>();
  const proyectoId = id ?? '';

  const [proyecto, setProyecto] = useState<TipoProyecto | null | undefined>(undefined);
  const [historial, setHistorial] = useState<HistorialEtapa[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [explicaciones, setExplicaciones] = useState<Map<string, string>>(new Map());
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [tareas, setTareas] = useState<TareaConEvidencia[]>([]);
  const [aporte, setAporte] = useState<SnapshotAporte | null>(null);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [personas, setPersonas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  async function cargarTodo() {
    setError(null);
    try {
      const [proy, hist, check, expl, hit, tar, bloq, pers, apo] = await Promise.all([
        obtenerProyecto(proyectoId),
        listarHistorialEtapas(proyectoId),
        listarChecklist(proyectoId),
        listarExplicaciones(),
        listarHitos(proyectoId),
        listarTareas(proyectoId),
        listarBloqueos(proyectoId),
        listarPersonasActivas(),
        obtenerAporteIntegrantes(proyectoId),
      ]);
      setProyecto(proy);
      setHistorial(hist);
      setChecklist(check);
      setExplicaciones(expl);
      setHitos(hit);
      setTareas(tar);
      setBloqueos(bloq);
      setPersonas(Object.fromEntries(pers.map((p) => [p.id, p.nombre])));
      setAporte(apo);
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo cargar el proyecto');
    }
  }

  useEffect(() => {
    if (proyectoId) cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId]);

  const visitadas = useMemo(() => new Set(historial.map((h) => h.etapa)), [historial]);
  const historialPorEtapa = useMemo(() => {
    const mapa = new Map<number, HistorialEtapa>();
    for (const h of historial) mapa.set(h.etapa, h);
    return mapa;
  }, [historial]);

  function nombrePersona(idPersona: string | null): string {
    if (!idPersona) return '—';
    return personas[idPersona] ?? 'alguien';
  }

  // ---------------- checklist ----------------
  const [nuevoItemTexto, setNuevoItemTexto] = useState('');
  const [nuevoItemEtapa, setNuevoItemEtapa] = useState(String(proyecto?.etapa_actual ?? 1));
  const [enviandoItem, setEnviandoItem] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [errorEscaneo, setErrorEscaneo] = useState<string | null>(null);
  const [resumenEscaneo, setResumenEscaneo] = useState<string | null>(null);

  // El agente propone; `completado` lo sigue moviendo solo una persona. Por eso
  // después de escanear se recarga todo: lo que cambió son `estado_agente`,
  // `verificado_en` y `evidencia`, no lo que alguien ya había confirmado.
  async function escanear() {
    setErrorEscaneo(null);
    setResumenEscaneo(null);
    setEscaneando(true);
    try {
      const resultado = await escanearChecklistService(proyectoId);
      await cargarTodo();
      const partes = [
        `${resultado.hechos} de ${resultado.revisados} ítems dados por hechos`,
        resultado.enProceso > 0 ? `${resultado.enProceso} en proceso` : null,
        resultado.sembrados > 0 ? `${resultado.sembrados} sembrados de la plantilla` : null,
        resultado.leyoClaudeMd ? 'leyó el CLAUDE.md del repo' : 'el repo no tiene CLAUDE.md',
      ].filter(Boolean);
      setResumenEscaneo(`${partes.join(' · ')}. Confirmá los que correspondan.`);
    } catch (excepcion) {
      setErrorEscaneo(excepcion instanceof Error ? excepcion.message : 'No se pudo escanear el repositorio');
    } finally {
      setEscaneando(false);
    }
  }

  async function alternarItem(item: ChecklistItem) {
    const anterior = checklist;
    setChecklist((actual) => actual.map((i) => (i.id === item.id ? { ...i, completado: !i.completado } : i)));
    try {
      await marcarItemChecklist(proyectoId, item.id, !item.completado);
      await cargarTodo();
    } catch (excepcion) {
      setChecklist(anterior);
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo actualizar el ítem');
    }
  }

  async function eliminarItem(item: ChecklistItem) {
    try {
      await borrarItemChecklist(proyectoId, item.id);
      setChecklist((actual) => actual.filter((i) => i.id !== item.id));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo borrar el ítem');
    }
  }

  async function agregarItem(evento: FormEvent) {
    evento.preventDefault();
    if (!nuevoItemTexto.trim()) return;
    setEnviandoItem(true);
    try {
      const item = await crearItemChecklist(proyectoId, Number(nuevoItemEtapa), nuevoItemTexto.trim());
      setChecklist((actual) => [...actual, item]);
      setNuevoItemTexto('');
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo agregar el ítem');
    } finally {
      setEnviandoItem(false);
    }
  }

  // ---------------- hitos ----------------
  const [nuevoHitoNombre, setNuevoHitoNombre] = useState('');
  const [nuevoHitoEtapa, setNuevoHitoEtapa] = useState('');
  const [nuevoHitoFecha, setNuevoHitoFecha] = useState('');
  const [enviandoHito, setEnviandoHito] = useState(false);

  async function marcarCumplido(hito: Hito) {
    try {
      const actualizado = await cambiarEstadoHito(proyectoId, hito.id, 'cumplido');
      setHitos((actual) => actual.map((h) => (h.id === hito.id ? actualizado : h)));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo marcar el hito como cumplido');
    }
  }

  async function eliminarHito(hito: Hito) {
    try {
      await borrarHito(proyectoId, hito.id);
      setHitos((actual) => actual.filter((h) => h.id !== hito.id));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo borrar el hito');
    }
  }

  async function agregarHito(evento: FormEvent) {
    evento.preventDefault();
    if (!nuevoHitoNombre.trim()) return;
    setEnviandoHito(true);
    try {
      const hito = await crearHito(proyectoId, {
        nombre: nuevoHitoNombre.trim(),
        etapa: nuevoHitoEtapa ? Number(nuevoHitoEtapa) : null,
        fecha_planeada: nuevoHitoFecha || null,
      });
      setHitos((actual) => [...actual, hito]);
      setNuevoHitoNombre('');
      setNuevoHitoEtapa('');
      setNuevoHitoFecha('');
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo agregar el hito');
    } finally {
      setEnviandoHito(false);
    }
  }

  // ---------------- tareas semanales ----------------
  // Marcar una tarea no mueve "Aporte por integrante" en el acto: ese número es
  // un snapshot que escribe el motor de indicadores, no un cálculo en vivo.
  async function alternarTarea(tarea: TareaConEvidencia) {
    setErrorTarea(null);
    try {
      await marcarTarea(proyectoId, tarea.id, !tarea.completado);
      await cargarTodo();
    } catch (excepcion) {
      setErrorTarea(excepcion instanceof Error ? excepcion.message : 'No se pudo actualizar la tarea');
    }
  }

  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [nuevaTareaTitulo, setNuevaTareaTitulo] = useState('');
  const [nuevaTareaInicio, setNuevaTareaInicio] = useState('');
  const [nuevaTareaFin, setNuevaTareaFin] = useState('');
  const [nuevaTareaAreas, setNuevaTareaAreas] = useState('');
  const [enviandoTarea, setEnviandoTarea] = useState(false);
  const [errorTarea, setErrorTarea] = useState<string | null>(null);

  async function agregarTarea(evento: FormEvent) {
    evento.preventDefault();
    const areas = nuevaTareaAreas
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    if (!nuevaTareaTitulo.trim() || !nuevaTareaInicio || !nuevaTareaFin || areas.length === 0) {
      setErrorTarea('Completá título, semana y al menos un área');
      return;
    }
    setErrorTarea(null);
    setEnviandoTarea(true);
    try {
      await crearTarea(proyectoId, {
        titulo: nuevaTareaTitulo.trim(),
        semana_inicio: nuevaTareaInicio,
        semana_fin: nuevaTareaFin,
        areas,
      });
      await cargarTodo();
      setMostrarFormTarea(false);
      setNuevaTareaTitulo('');
      setNuevaTareaInicio('');
      setNuevaTareaFin('');
      setNuevaTareaAreas('');
    } catch (excepcion) {
      setErrorTarea(excepcion instanceof Error ? excepcion.message : 'No se pudo declarar la tarea');
    } finally {
      setEnviandoTarea(false);
    }
  }

  // ---------------- bloqueos ----------------
  const [mostrarFormBloqueo, setMostrarFormBloqueo] = useState(false);
  const [nuevoBloqueoDesc, setNuevoBloqueoDesc] = useState('');
  const [nuevoBloqueoTipo, setNuevoBloqueoTipo] = useState<Bloqueo['tipo']>('interno');
  const [enviandoBloqueo, setEnviandoBloqueo] = useState(false);

  async function agregarBloqueo(evento: FormEvent) {
    evento.preventDefault();
    if (!nuevoBloqueoDesc.trim()) return;
    setEnviandoBloqueo(true);
    try {
      const bloqueo = await abrirBloqueo(proyectoId, nuevoBloqueoDesc.trim(), nuevoBloqueoTipo);
      setBloqueos((actual) => [bloqueo, ...actual]);
      setMostrarFormBloqueo(false);
      setNuevoBloqueoDesc('');
      setNuevoBloqueoTipo('interno');
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo abrir el bloqueo');
    } finally {
      setEnviandoBloqueo(false);
    }
  }

  async function marcarResuelto(bloqueo: Bloqueo) {
    try {
      const actualizado = await resolverBloqueo(proyectoId, bloqueo.id);
      setBloqueos((actual) => actual.map((b) => (b.id === bloqueo.id ? actualizado : b)));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo resolver el bloqueo');
    }
  }

  if (proyecto === undefined) {
    return (
      <AppShell>
        <p className={estilos.cargando}>Cargando proyecto...</p>
      </AppShell>
    );
  }

  if (proyecto === null) {
    return (
      <AppShell>
        <p className={estilos.error} role="alert">
          No existe ese proyecto, o no tenés permiso para verlo.
        </p>
        <Link to="/" className={estilos.volver}>
          ← Volver a proyectos
        </Link>
      </AppShell>
    );
  }

  const hitosVencidos = hitos.filter((h) => h.estado === 'vencido').length;
  const bloqueosAbiertos = bloqueos.filter((b) => !b.resuelto_en).length;

  const totalConfirmados = checklist.filter((i) => i.completado).length;
  const totalDetectados = checklist.filter((i) => !i.completado && i.estado_agente === 'hecho').length;
  const porcentajeChecklist =
    checklist.length === 0 ? 0 : Math.round((totalConfirmados / checklist.length) * 100);

  // Solo las etapas que tienen ítems: un proyecto sin agentes de IA no muestra
  // la etapa 5 vacía, igual que el rail de arriba no la marca como pendiente.
  const porEtapa = ETAPAS.map((etapa) => {
    const items = checklist.filter((item) => item.etapa === etapa.numero);
    return {
      etapa,
      items,
      confirmados: items.filter((i) => i.completado).length,
      detectados: items.filter((i) => !i.completado && i.estado_agente === 'hecho').length,
    };
  }).filter((grupo) => grupo.items.length > 0);

  return (
    <AppShell>
      <header className={estilos.cabecera}>
        <div className={estilos.miga}>
          <Link to="/">Proyectos</Link> / {proyecto.nombre}
        </div>
        <div className={estilos.tituloFila}>
          <h1>{proyecto.nombre}</h1>
          {!editando && (
            <button type="button" className={estilos.btnEditar} onClick={() => setEditando(true)}>
              Editar
            </button>
          )}
        </div>
        <div className={estilos.meta}>
          <span>
            <b>{proyecto.modalidad === 'equipo' ? 'Equipo' : 'Individual'}</b>
          </span>
          <span>
            Encargado <b>{nombrePersona(proyecto.encargado_id)}</b>
          </span>
          {proyecto.fecha_inicio && (
            <span>
              Inicio <b>{fechaCorta(proyecto.fecha_inicio)}</b>
            </span>
          )}
          {proyecto.alcance_congelado_en && (
            <span>
              Alcance congelado <b>{fechaCorta(proyecto.alcance_congelado_en)}</b>
            </span>
          )}
        </div>
      </header>

      {editando && (
        <EditarProyecto
          proyecto={proyecto}
          onGuardado={(actualizado) => {
            setProyecto(actualizado);
            setEditando(false);
          }}
          onCancelar={() => setEditando(false)}
        />
      )}

      {error && (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      )}

      <section className={estilos.seccion}>
        <div className={estilos.encabezadoSeccion}>
          <h2>Etapas</h2>
          <span className={estilos.permiso}>avanza el encargado o el admin</span>
        </div>
        <div className={estilos.railEnvoltura}>
          <div className={estilos.rail}>
            {ETAPAS.map((etapa) => {
              const est = estadoDeEtapa(etapa.numero, proyecto.etapa_actual, visitadas);
              const registro = historialPorEtapa.get(etapa.numero);
              const dias = registro ? diasEntre(registro.entra_en, registro.sale_en) : null;
              return (
                <div
                  key={etapa.numero}
                  className={`${estilos.etapa} ${estilos[est]}`}
                  title={`${etapa.nombre} — ${etapa.construye}`}
                >
                  <div className={estilos.barraEtapa} />
                  <div className={estilos.numEtapa}>{String(etapa.numero).padStart(2, '0')}</div>
                  <div className={estilos.nombreEtapa}>{etapa.nombre}</div>
                  <div className={estilos.selloEtapa}>
                    {est === 'saltada'
                      ? 'no aplica'
                      : est === 'actual'
                        ? dias !== null
                          ? `en curso · ${dias} días`
                          : 'en curso'
                        : est === 'hecha'
                          ? dias !== null
                            ? `${dias} días`
                            : 'cerrada'
                          : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className={estilos.rejilla}>
        <div className={estilos.columna}>
          {/* ---------------- checklist por etapa ---------------- */}
          <section className={estilos.seccion}>
            <div className={estilos.encabezadoSeccion}>
              <h2>Checklist por etapa</h2>
              <button
                type="button"
                className={estilos.btnAgente}
                onClick={escanear}
                disabled={escaneando}
              >
                {escaneando ? 'Leyendo el repo…' : checklist.length === 0 ? 'Generar con agente IA' : 'Volver a escanear'}
              </button>
            </div>

            {errorEscaneo && (
              <p className={estilos.error} role="alert">
                {errorEscaneo}
              </p>
            )}

            {resumenEscaneo && !escaneando && (
              <p className={estilos.avisoEscaneo} role="status">
                {resumenEscaneo}
              </p>
            )}

            {checklist.length > 0 && (
              <div className={estilos.resumen}>
                <span className={estilos.resumenCifra}>{porcentajeChecklist}%</span>
                <span className={estilos.resumenBarra}>
                  <span className={estilos.resumenHecho} style={{ width: `${porcentajeChecklist}%` }} />
                  <span
                    className={estilos.resumenEsperando}
                    style={{ width: `${Math.round((totalDetectados / checklist.length) * 100)}%` }}
                  />
                </span>
                <span className={estilos.resumenTexto}>
                  <b>
                    {totalConfirmados} de {checklist.length}
                  </b>{' '}
                  confirmados
                  {totalDetectados > 0 && (
                    <>
                      {' · '}
                      <span className={estilos.esperandoTit}>{totalDetectados} esperando tu confirmación</span>
                    </>
                  )}
                </span>
              </div>
            )}

            <div className={estilos.bloque}>
              {checklist.length === 0 && !escaneando && (
                <p className={estilos.vacio}>
                  Este proyecto todavía no tiene checklist. Generalo con el agente: lee el
                  repositorio y propone qué está hecho y qué falta.
                </p>
              )}

              {porEtapa.map(({ etapa, items, confirmados }) => (
                <details
                  key={etapa.numero}
                  // Siempre arrancan cerradas: las 9 a la vez desplegadas se leían
                  // desorganizadas. Lo que necesita atención ya lo dice el resumen
                  // de arriba ("N esperando tu confirmación"); acá cada quien abre
                  // la etapa que le interesa.
                  className={estilos.grupoEtapa}
                >
                  <summary className={estilos.grupoCab}>
                    <span className={estilos.chevron} aria-hidden="true">
                      ▸
                    </span>
                    <span className={estilos.grupoNum}>{String(etapa.numero).padStart(2, '0')}</span>
                    <span className={estilos.grupoNombre}>{etapa.nombre}</span>
                    <span
                      className={`${estilos.medidor} ${
                        confirmados === items.length ? '' : confirmados === 0 ? estilos.vacioMedidor : estilos.parcial
                      }`}
                    >
                      <span style={{ width: `${Math.round((confirmados / items.length) * 100)}%` }} />
                    </span>
                    <span className={estilos.grupoCuenta}>
                      {confirmados} de {items.length}
                    </span>
                  </summary>

                  <ul className={estilos.lista}>
                    {items.map((item) => {
                      const explicacion = explicaciones.get(`${item.etapa}|${item.texto}`);
                      // Una escala de certeza, no una bandera: lo único que cuenta
                      // como terminado es `completado`, que solo mueve una persona.
                      // Los otros tres los propone el agente y ninguno aprueba solo.
                      const estado = item.completado ? 'confirmado' : (item.estado_agente ?? 'sin_verificar');
                      return (
                        <li key={item.id} className={`${estilos.item} ${estilos[estado]}`}>
                          <button
                            type="button"
                            className={estilos.caja}
                            onClick={() => alternarItem(item)}
                            aria-pressed={item.completado}
                            aria-label={item.completado ? 'Marcar como pendiente' : 'Marcar como completado'}
                          >
                            {GLIFO[estado]}
                          </button>
                          <div className={estilos.cuerpoItem}>
                            <div className={estilos.textoItem}>{item.texto}</div>
                            {/* Va antes de la evidencia a propósito: quien no programa
                                necesita entender el ítem para poder confirmarlo, y la
                                evidencia del agente está escrita para quien sí. */}
                            {explicacion && (
                              <div className={estilos.explicacionSimple}>
                                <span className={estilos.rotuloSimple}>En palabras simples</span>
                                {explicacion}
                              </div>
                            )}
                            {item.evidencia && <div className={estilos.evidencia}>{item.evidencia}</div>}
                            {/* Firma solo lo confirmado y lo que el agente da por hecho:
                                son los dos estados donde "¿cuándo se hizo?" tiene sentido.
                                En "en proceso" y "falta" la etiqueta de la derecha ya
                                dice el estado y una fecha sería ruido. */}
                            {(estado === 'confirmado' || estado === 'hecho') && (
                              <PieEvidencia
                                tono={estado === 'confirmado' ? 'confirmado' : 'detectado'}
                                prefijo={
                                  estado === 'confirmado'
                                    ? `confirmado por ${nombrePersona(item.completado_por)} · ${fechaCorta(item.completado_en)}`
                                    : `detectado el ${fechaCorta(item.verificado_en)}`
                                }
                                fecha={item.evidencia_fecha}
                                origen={item.evidencia_fecha_origen}
                                archivo={item.evidencia_archivo}
                              />
                            )}
                          </div>
                          {/* De los cuatro estados, "hecho" es el único que pide algo —
                              por eso es el único con forma de botón. Los demás llevan
                              una etiqueta que informa y no se toca. */}
                          {estado === 'hecho' ? (
                            <button
                              type="button"
                              className={estilos.accionConfirmar}
                              onClick={() => alternarItem(item)}
                            >
                              Confirmar
                            </button>
                          ) : (
                            estado !== 'confirmado' && (
                              <span className={`${estilos.marca} ${estilos[estado]}`}>
                                <span aria-hidden="true">{GLIFO[estado]}</span>
                                {ROTULO[estado]}
                              </span>
                            )
                          )}
                          <button
                            type="button"
                            className={estilos.borrar}
                            onClick={() => eliminarItem(item)}
                            aria-label="Borrar ítem"
                          >
                            ✕
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}

              <form className={estilos.formInline} onSubmit={agregarItem}>
                <select
                  value={nuevoItemEtapa}
                  onChange={(e) => setNuevoItemEtapa(e.target.value)}
                  disabled={enviandoItem}
                  aria-label="Etapa del ítem"
                >
                  {ETAPAS.map((e) => (
                    <option key={e.numero} value={e.numero}>
                      Etapa {e.numero}
                    </option>
                  ))}
                </select>
                <input
                  value={nuevoItemTexto}
                  onChange={(e) => setNuevoItemTexto(e.target.value)}
                  placeholder="Agregar ítem propio de este proyecto..."
                  disabled={enviandoItem}
                />
                <button type="submit" disabled={enviandoItem || !nuevoItemTexto.trim()}>
                  +
                </button>
              </form>
            </div>
          </section>

          {/* ---------------- hitos ---------------- */}
          <section className={estilos.seccion}>
            <div className={estilos.encabezadoSeccion}>
              <h2>Hitos{hitosVencidos > 0 && <span className={`${estilos.conteo} ${estilos.mal}`}>{hitosVencidos}</span>}</h2>
              <span className={`${estilos.permiso} ${estilos.restringido}`}>solo el encargado o el admin</span>
            </div>
            <div className={estilos.bloque}>
              {hitos.length === 0 && <p className={estilos.vacio}>Todavía no hay hitos.</p>}
              {hitos.length > 0 && (
                <div className={estilos.tablaEnvoltura}>
                  <table>
                    <thead>
                      <tr>
                        <th>Hito</th>
                        <th>Etapa</th>
                        <th>Planeada</th>
                        <th>Real</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {hitos.map((hito) => (
                        <tr key={hito.id}>
                          <td className={estilos.principal}>{hito.nombre}</td>
                          <td>{hito.etapa ? <span className={estilos.chip}>{hito.etapa}</span> : '—'}</td>
                          <td className={estilos.fecha}>{fechaCorta(hito.fecha_planeada)}</td>
                          <td className={estilos.fecha}>{fechaCorta(hito.fecha_real)}</td>
                          <td>
                            <span
                              className={`${estilos.chip} ${
                                hito.estado === 'cumplido'
                                  ? estilos.ok
                                  : hito.estado === 'en_curso'
                                    ? estilos.curso
                                    : hito.estado === 'vencido'
                                      ? estilos.vencido
                                      : ''
                              }`}
                            >
                              {hito.estado}
                            </span>
                          </td>
                          <td>
                            <div className={estilos.accionesFila}>
                              {hito.estado !== 'cumplido' && (
                                <button type="button" className={estilos.accion} onClick={() => marcarCumplido(hito)}>
                                  cumplir
                                </button>
                              )}
                              <button type="button" className={estilos.borrar} onClick={() => eliminarHito(hito)}>
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <form className={estilos.formHito} onSubmit={agregarHito}>
                <input
                  value={nuevoHitoNombre}
                  onChange={(e) => setNuevoHitoNombre(e.target.value)}
                  placeholder="Nombre del hito..."
                  disabled={enviandoHito}
                />
                <select
                  value={nuevoHitoEtapa}
                  onChange={(e) => setNuevoHitoEtapa(e.target.value)}
                  disabled={enviandoHito}
                  aria-label="Etapa del hito (opcional)"
                >
                  <option value="">Sin etapa</option>
                  {ETAPAS.map((e) => (
                    <option key={e.numero} value={e.numero}>
                      Etapa {e.numero}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={nuevoHitoFecha}
                  onChange={(e) => setNuevoHitoFecha(e.target.value)}
                  disabled={enviandoHito}
                  aria-label="Fecha planeada"
                />
                <button type="submit" disabled={enviandoHito || !nuevoHitoNombre.trim()}>
                  agregar
                </button>
              </form>
            </div>
          </section>
        </div>

        <div className={estilos.columna}>
          {/* ---------------- aporte por integrante (indicador #29) ---------------- */}
          <section className={estilos.seccion}>
            <div className={estilos.encabezadoSeccion}>
              <h2>Aporte por integrante</h2>
              <span className={estilos.permiso}>
                {aporte ? `semana del ${fechaCorta(aporte.periodo)}` : 'sin calcular'}
              </span>
            </div>
            <div className={estilos.bloque}>
              {!aporte || aporte.por_persona.length === 0 ? (
                <p className={estilos.vacio}>
                  Todavía no hay cálculo. Sale de las tareas semanales: cuando alguien tenga tareas
                  asignadas acá y el motor de indicadores corra, aparece lo que cada quien completó
                  de lo suyo.
                </p>
              ) : (
                <>
                  <p className={estilos.aporteNota}>
                    Cada barra mide contra el 100% de esa persona — lo que le tocaba a ella — no
                    contra el proyecto. Dos barras no se suman.
                  </p>
                  {aporte.por_persona.map((p) => (
                    <div key={p.persona_id} className={estilos.aporteFila}>
                      <div className={estilos.aporteAvatar} aria-hidden="true">
                        {nombrePersona(p.persona_id)
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((parte) => parte[0])
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className={estilos.aporteCuerpo}>
                        <div className={estilos.aporteNombreFila}>
                          <span className={estilos.aporteNombre}>{nombrePersona(p.persona_id)}</span>
                          <span className={estilos.aportePct}>{p.porcentaje}%</span>
                        </div>
                        <div
                          className={estilos.aporteBarra}
                          role="progressbar"
                          aria-valuenow={p.porcentaje}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${nombrePersona(p.persona_id)}: ${p.porcentaje}% de sus tareas`}
                        >
                          <span style={{ width: `${p.porcentaje}%` }} />
                        </div>
                        <div className={estilos.aporteDetalle}>
                          <b>
                            {p.completadas} de {p.asignadas}
                          </b>{' '}
                          {p.asignadas === 1 ? 'tarea asignada' : 'tareas asignadas'}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className={estilos.aporteCalculado}>
                    Calculado {fechaCorta(aporte.calculado_en)}. Marcar una tarea no lo mueve al
                    instante: se actualiza cuando corre el motor.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* ---------------- tareas semanales ---------------- */}
          <section className={estilos.seccion}>
            <div className={estilos.encabezadoSeccion}>
              <h2>Tarea semanal y su rastro</h2>
              <span className={estilos.permiso}>el Detector corre sábados 12:00</span>
            </div>
            <div className={estilos.bloque}>
              {tareas.length === 0 && <p className={estilos.vacio}>Todavía no hay tareas declaradas.</p>}
              {tareas.map((tarea) => (
                <article key={tarea.id} className={estilos.tarea}>
                  <div className={estilos.semana}>
                    {fechaCorta(tarea.semana_inicio)} — {fechaCorta(tarea.semana_fin)} ·{' '}
                    {nombrePersona(tarea.persona_id).toUpperCase()}
                  </div>
                  <div className={estilos.tareaCab}>
                    <button
                      type="button"
                      className={`${estilos.caja} ${tarea.completado ? estilos.cajaHecha : ''}`}
                      onClick={() => alternarTarea(tarea)}
                      aria-pressed={tarea.completado}
                      aria-label={tarea.completado ? 'Marcar como abierta' : 'Marcar como terminada'}
                    >
                      {tarea.completado ? '✓' : ''}
                    </button>
                    <div className={`${estilos.tituloTarea} ${tarea.completado ? estilos.tituloHecho : ''}`}>
                      {tarea.titulo}
                    </div>
                  </div>
                  {tarea.completado && tarea.completado_en && (
                    <div className={estilos.tareaCerrada}>terminada {fechaCorta(tarea.completado_en)}</div>
                  )}
                  <EstimacionTarea
                    proyectoId={proyectoId}
                    tareaId={tarea.id}
                    semanaInicio={tarea.semana_inicio}
                    semanaFin={tarea.semana_fin}
                  />
                  {tarea.areas.map((area) => {
                    const evidenciaArea = tarea.tarea_evidencia.filter((e) => e.area === area);
                    const conRastro = evidenciaArea.length > 0;
                    return (
                      <div key={area} className={`${estilos.area} ${conRastro ? estilos.conRastro : estilos.sinRastro}`}>
                        <div className={estilos.nombreArea}>{area}</div>
                        {conRastro ? (
                          <ul className={estilos.evidencias}>
                            {evidenciaArea.map((ev) => (
                              <li key={ev.id}>
                                <span className={estilos.fuente}>{ev.fuente.replace('_', ' ')}</span>
                                <span className={estilos.ref}>{ev.referencia}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className={estilos.notaSinRastro}>
                            Sin rastro esta semana.{' '}
                            <span>Se declaró el área pero no hubo commits ni sesiones en ella.</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </article>
              ))}

              {mostrarFormTarea ? (
                <form className={estilos.formTarea} onSubmit={agregarTarea}>
                  {errorTarea && <p className={estilos.errorForm}>{errorTarea}</p>}
                  <input
                    value={nuevaTareaTitulo}
                    onChange={(e) => setNuevaTareaTitulo(e.target.value)}
                    placeholder="¿Qué vas a trabajar esta semana?"
                    disabled={enviandoTarea}
                  />
                  <div className={estilos.filaFechas}>
                    <input
                      type="date"
                      value={nuevaTareaInicio}
                      onChange={(e) => setNuevaTareaInicio(e.target.value)}
                      disabled={enviandoTarea}
                      aria-label="Semana - inicio"
                    />
                    <input
                      type="date"
                      value={nuevaTareaFin}
                      onChange={(e) => setNuevaTareaFin(e.target.value)}
                      disabled={enviandoTarea}
                      aria-label="Semana - fin"
                    />
                  </div>
                  <input
                    value={nuevaTareaAreas}
                    onChange={(e) => setNuevaTareaAreas(e.target.value)}
                    placeholder="Áreas, separadas por coma (ej: Backend — API, Frontend)"
                    disabled={enviandoTarea}
                  />
                  <div className={estilos.accionesFila}>
                    <button type="submit" disabled={enviandoTarea}>
                      Declarar tarea
                    </button>
                    <button type="button" className={estilos.btnFantasma} onClick={() => setMostrarFormTarea(false)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className={estilos.btnAbrirForm} onClick={() => setMostrarFormTarea(true)}>
                  + declarar tarea de la semana
                </button>
              )}
            </div>
          </section>

          {/* ---------------- bloqueos ---------------- */}
          <section className={estilos.seccion}>
            <div className={estilos.encabezadoSeccion}>
              <h2>
                Bloqueos{bloqueosAbiertos > 0 && <span className={`${estilos.conteo} ${estilos.ojo}`}>{bloqueosAbiertos}</span>}
              </h2>
              <span className={estilos.permiso}>los abre cualquier miembro</span>
            </div>
            <div className={estilos.bloque}>
              {bloqueos.length === 0 && <p className={estilos.vacio}>No hay bloqueos registrados.</p>}
              {bloqueos.map((bloqueo) => (
                <div key={bloqueo.id} className={`${estilos.bloqueoFila} ${bloqueo.resuelto_en ? estilos.resuelto : ''}`}>
                  <div className={estilos.filaBloqueo}>
                    <span className={estilos.descBloqueo}>{bloqueo.descripcion}</span>
                    <span className={`${estilos.chip} ${bloqueo.tipo === 'cliente' ? estilos.alerta : ''}`}>
                      {bloqueo.tipo}
                    </span>
                  </div>
                  <div className={`${estilos.duracion} ${!bloqueo.resuelto_en ? estilos.abierto : ''}`}>
                    {bloqueo.resuelto_en
                      ? `resuelto en ${diasEntre(bloqueo.abierto_en, bloqueo.resuelto_en)} días · cerró ${nombrePersona(bloqueo.resuelto_por)}`
                      : `abierto hace ${diasEntre(bloqueo.abierto_en, null)} días · ${nombrePersona(bloqueo.persona_id)}`}
                  </div>
                  {!bloqueo.resuelto_en && (
                    <button type="button" className={estilos.accion} onClick={() => marcarResuelto(bloqueo)}>
                      resolver
                    </button>
                  )}
                </div>
              ))}

              {mostrarFormBloqueo ? (
                <form className={estilos.formTarea} onSubmit={agregarBloqueo}>
                  <input
                    value={nuevoBloqueoDesc}
                    onChange={(e) => setNuevoBloqueoDesc(e.target.value)}
                    placeholder="¿Qué te está bloqueando?"
                    disabled={enviandoBloqueo}
                  />
                  <select
                    value={nuevoBloqueoTipo}
                    onChange={(e) => setNuevoBloqueoTipo(e.target.value as Bloqueo['tipo'])}
                    disabled={enviandoBloqueo}
                  >
                    <option value="interno">Interno</option>
                    <option value="externo">Externo</option>
                    <option value="cliente">Cliente</option>
                  </select>
                  <div className={estilos.accionesFila}>
                    <button type="submit" disabled={enviandoBloqueo}>
                      Abrir bloqueo
                    </button>
                    <button type="button" className={estilos.btnFantasma} onClick={() => setMostrarFormBloqueo(false)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className={estilos.btnAbrirForm} onClick={() => setMostrarFormBloqueo(true)}>
                  + abrir bloqueo
                </button>
              )}
            </div>
          </section>

          <Reuniones proyectoId={proyectoId} nombrePersona={nombrePersona} />

          <ClavesIngesta proyectoId={proyectoId} />
        </div>
      </div>
    </AppShell>
  );
}
