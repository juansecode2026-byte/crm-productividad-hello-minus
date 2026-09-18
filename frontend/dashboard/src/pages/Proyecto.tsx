import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
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
  listarChecklist,
  marcarItemChecklist,
} from '../services/checklistService';
import { borrarHito, cambiarEstadoHito, crearHito, listarHitos } from '../services/hitosService';
import { listarPersonasActivas } from '../services/personasService';
import { listarHistorialEtapas, obtenerProyecto } from '../services/proyectosService';
import { crearTarea, listarTareas, type TareaConEvidencia } from '../services/tareasService';
import estilos from './Proyecto.module.css';

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
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [tareas, setTareas] = useState<TareaConEvidencia[]>([]);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [personas, setPersonas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function cargarTodo() {
    setError(null);
    try {
      const [proy, hist, check, hit, tar, bloq, pers] = await Promise.all([
        obtenerProyecto(proyectoId),
        listarHistorialEtapas(proyectoId),
        listarChecklist(proyectoId),
        listarHitos(proyectoId),
        listarTareas(proyectoId),
        listarBloqueos(proyectoId),
        listarPersonasActivas(),
      ]);
      setProyecto(proy);
      setHistorial(hist);
      setChecklist(check);
      setHitos(hit);
      setTareas(tar);
      setBloqueos(bloq);
      setPersonas(Object.fromEntries(pers.map((p) => [p.id, p.nombre])));
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

  const checklistPendientes = checklist.filter((i) => !i.completado).length;
  const hitosVencidos = hitos.filter((h) => h.estado === 'vencido').length;
  const bloqueosAbiertos = bloqueos.filter((b) => !b.resuelto_en).length;

  return (
    <AppShell>
      <header className={estilos.cabecera}>
        <div className={estilos.miga}>
          <Link to="/">Proyectos</Link> / {proyecto.nombre}
        </div>
        <h1>{proyecto.nombre}</h1>
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
          {/* ---------------- checklist ---------------- */}
          <section className={estilos.seccion}>
            <div className={estilos.encabezadoSeccion}>
              <h2>
                Checklist{checklistPendientes > 0 && <span className={estilos.conteo}>{checklistPendientes}</span>}
              </h2>
              <span className={estilos.permiso}>lo marca cualquier miembro</span>
            </div>
            <div className={estilos.bloque}>
              {checklist.length === 0 && <p className={estilos.vacio}>Todavía no hay ítems de checklist.</p>}
              <ul className={estilos.lista}>
                {checklist.map((item) => (
                  <li key={item.id} className={`${estilos.item} ${item.completado ? estilos.hecho : ''}`}>
                    <button
                      type="button"
                      className={estilos.caja}
                      onClick={() => alternarItem(item)}
                      aria-pressed={item.completado}
                      aria-label={item.completado ? 'Marcar como pendiente' : 'Marcar como completado'}
                    >
                      {item.completado ? '✓' : ''}
                    </button>
                    <div className={estilos.cuerpoItem}>
                      <div className={estilos.textoItem}>{item.texto}</div>
                      <div className={item.completado ? estilos.firma : estilos.sinFirma}>
                        {item.completado
                          ? `${nombrePersona(item.completado_por)} · ${fechaCorta(item.completado_en)}`
                          : `etapa ${item.etapa} · sin marcar`}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={estilos.borrar}
                      onClick={() => eliminarItem(item)}
                      aria-label="Borrar ítem"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
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
                  placeholder="Agregar ítem de checklist..."
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
                  <div className={estilos.tituloTarea}>{tarea.titulo}</div>
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
        </div>
      </div>
    </AppShell>
  );
}
