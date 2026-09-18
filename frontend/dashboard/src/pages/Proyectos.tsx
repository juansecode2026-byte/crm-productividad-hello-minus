import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ETAPAS } from '../lib/etapas';
import { aFechaIso, tiempoRelativo } from '../lib/fechas';
import type { Persona, Proyecto, RepoCandidato } from '../lib/tipos';
import { listarPersonasActivas } from '../services/personasService';
import { listarProyectos } from '../services/proyectosService';
import { listarCandidatos, sugerirEtapa, vincularRepo, type SugerenciaEtapa } from '../services/reposService';
import estilos from './Proyectos.module.css';


interface FormularioVinculo {
  nombre: string;
  modalidad: 'individual' | 'equipo';
  etapa_inicial: string;
  fecha_inicio: string;
  encargado_id: string;
}

function formularioInicial(candidato: RepoCandidato): FormularioVinculo {
  return {
    nombre: candidato.repo,
    modalidad: candidato.colaboradores.length > 1 ? 'equipo' : 'individual',
    etapa_inicial: '',
    fecha_inicio: candidato.primerCommit ? aFechaIso(candidato.primerCommit) : '',
    encargado_id: '',
  };
}

export function Proyectos() {
  const [candidatos, setCandidatos] = useState<RepoCandidato[] | null>(null);
  const [errorCandidatos, setErrorCandidatos] = useState<string | null>(null);

  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [errorProyectos, setErrorProyectos] = useState<string | null>(null);

  const [personas, setPersonas] = useState<Pick<Persona, 'id' | 'nombre'>[]>([]);

  const [seleccionado, setSeleccionado] = useState<RepoCandidato | null>(null);
  const [form, setForm] = useState<FormularioVinculo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [sugerencia, setSugerencia] = useState<SugerenciaEtapa | null>(null);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [errorSugerencia, setErrorSugerencia] = useState<string | null>(null);

  async function cargarCandidatos() {
    setErrorCandidatos(null);
    try {
      setCandidatos(await listarCandidatos());
    } catch (excepcion) {
      setErrorCandidatos(excepcion instanceof Error ? excepcion.message : 'No se pudieron cargar los repos');
    }
  }

  async function cargarProyectos() {
    setErrorProyectos(null);
    try {
      setProyectos(await listarProyectos());
    } catch (excepcion) {
      setErrorProyectos(excepcion instanceof Error ? excepcion.message : 'No se pudieron cargar los proyectos');
    }
  }

  useEffect(() => {
    cargarCandidatos();
    cargarProyectos();
    listarPersonasActivas().then(setPersonas);
  }, []);

  function abrirVinculo(candidato: RepoCandidato) {
    setSeleccionado(candidato);
    setForm(formularioInicial(candidato));
    setErrorForm(null);
    setSugerencia(null);
    setErrorSugerencia(null);
  }

  function cerrarVinculo() {
    setSeleccionado(null);
    setForm(null);
    setErrorForm(null);
    setSugerencia(null);
    setErrorSugerencia(null);
  }

  // El agente propone; la persona confirma. Nunca se envía sola: pasar de la
  // etapa 2 congela el alcance del proyecto y eso no se revierte.
  async function pedirSugerencia() {
    if (!seleccionado || !form) return;
    setErrorSugerencia(null);
    setSugiriendo(true);
    try {
      const resultado = await sugerirEtapa(seleccionado.owner, seleccionado.repo);
      setSugerencia(resultado);
      setForm({ ...form, etapa_inicial: String(resultado.etapa) });
    } catch (excepcion) {
      setErrorSugerencia(excepcion instanceof Error ? excepcion.message : 'No se pudo consultar al agente');
    } finally {
      setSugiriendo(false);
    }
  }

  async function confirmarVinculo(evento: FormEvent) {
    evento.preventDefault();
    if (!seleccionado || !form) return;

    if (!form.etapa_inicial) {
      setErrorForm('Elegí la etapa actual');
      return;
    }
    if (form.modalidad === 'individual' && !form.encargado_id) {
      setErrorForm('Elegí un encargado');
      return;
    }

    setErrorForm(null);
    setEnviando(true);
    try {
      await vincularRepo({
        owner: seleccionado.owner,
        repo: seleccionado.repo,
        nombre: form.nombre,
        modalidad: form.modalidad,
        etapa_inicial: Number(form.etapa_inicial),
        fecha_inicio: form.fecha_inicio || null,
        encargado_id: form.modalidad === 'individual' ? form.encargado_id : undefined,
      });
      cerrarVinculo();
      await Promise.all([cargarCandidatos(), cargarProyectos()]);
    } catch (excepcion) {
      setErrorForm(excepcion instanceof Error ? excepcion.message : 'No se pudo vincular el repositorio');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AppShell>
      <div className={estilos.barra}>
        <h1>Proyectos</h1>
        {candidatos && candidatos.length > 0 && (
          <span className={estilos.chip}>{candidatos.length} sin vincular</span>
        )}
      </div>

      <section className={estilos.zona} aria-labelledby="tit-descubiertos">
        <div className={estilos.zonaCab}>
          <h2 id="tit-descubiertos">Descubiertos en GitHub</h2>
          <p>
            Repos que todavía no pertenecen a ningún proyecto. La etapa, la fecha de inicio real y el
            encargado no los sabe GitHub — los confirmás al vincular.
          </p>
        </div>

        {candidatos === null && !errorCandidatos && <p className={estilos.cargando}>Cargando repos...</p>}
        {errorCandidatos && (
          <p className={estilos.error} role="alert">
            {errorCandidatos}
          </p>
        )}
        {candidatos && candidatos.length === 0 && (
          <p className={estilos.vacio}>No hay repos pendientes de vincular.</p>
        )}

        {candidatos && candidatos.length > 0 && (
          <div className={estilos.split}>
            <div className={estilos.tablaEnvoltorio}>
              <table>
                <thead>
                  <tr>
                    <th>Repositorio</th>
                    <th className={estilos.num}>Último</th>
                    <th className={estilos.num}>7d</th>
                    <th className={estilos.num}>Total</th>
                    <th className={estilos.num}>PR</th>
                    <th>Equipo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {candidatos.map((candidato) => {
                    const clave = `${candidato.owner}/${candidato.repo}`;
                    const activo = candidato.commitsSemana > 0;
                    return (
                      <tr key={clave} data-seleccionada={seleccionado === candidato}>
                        <td>
                          <div className={estilos.repo}>
                            <span
                              className={`${estilos.luz} ${
                                !candidato.disponible ? estilos.luzSinAcceso : activo ? estilos.luzViva : ''
                              }`}
                              aria-hidden="true"
                              title={
                                !candidato.disponible
                                  ? 'Sin acceso — repo privado'
                                  : activo
                                    ? 'Commits esta semana'
                                    : 'Sin commits en 7 días'
                              }
                            />
                            <span className={estilos.srOnly}>
                              {!candidato.disponible
                                ? 'Sin acceso — repo privado'
                                : activo
                                  ? 'Commits esta semana'
                                  : 'Sin commits en 7 días'}
                            </span>
                            <div>
                              <div className={estilos.repoTexto}>{candidato.repo}</div>
                              <div className={estilos.duenio}>{candidato.owner}</div>
                            </div>
                          </div>
                        </td>
                        {candidato.disponible ? (
                          <>
                            <td className={estilos.num}>{tiempoRelativo(candidato.ultimoCommit)}</td>
                            <td className={estilos.num}>{candidato.commitsSemana}</td>
                            <td className={estilos.num}>
                              {candidato.commitsTotal}
                              {candidato.commitsTruncado ? '+' : ''}
                            </td>
                            <td className={estilos.num}>{candidato.prsAbiertos}</td>
                            <td>
                              <span className={estilos.etq}>
                                {candidato.colaboradores.length || '?'}{' '}
                                {candidato.colaboradores.length === 1 ? 'persona' : 'personas'}
                              </span>
                            </td>
                          </>
                        ) : (
                          <td colSpan={5} className={estilos.duenio}>
                            Sin acceso — repo privado, falta configurar un token
                          </td>
                        )}
                        <td>
                          <button
                            type="button"
                            className={estilos.accion}
                            disabled={seleccionado === candidato}
                            onClick={() => abrirVinculo(candidato)}
                          >
                            {seleccionado === candidato
                              ? 'vinculando…'
                              : !candidato.disponible
                                ? 'vincular sin datos'
                                : 'vincular'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {seleccionado && form && (
              <aside className={estilos.drawer}>
                <div className={estilos.drawerCab}>
                  <strong>{seleccionado.repo}</strong>
                  <button type="button" className={estilos.cerrar} onClick={cerrarVinculo} aria-label="Cerrar panel">
                    ✕
                  </button>
                </div>
                <form className={estilos.drawerCuerpo} onSubmit={confirmarVinculo}>
                  {seleccionado.disponible && (
                    <div className={estilos.auto}>
                      <span className={estilos.grupoTit}>Leído de GitHub</span>
                      <span>
                        colaboradores · <b>{seleccionado.colaboradores.join(', ') || '—'}</b>
                      </span>
                      <span>
                        primer commit ·{' '}
                        <b>{seleccionado.primerCommit ? aFechaIso(seleccionado.primerCommit) : 'no disponible'}</b>
                      </span>
                      <span>
                        último push · <b>{tiempoRelativo(seleccionado.ultimoCommit)}</b>
                      </span>
                    </div>
                  )}

                  <div className={estilos.grupoTit}>Lo que GitHub no sabe</div>

                  {errorForm && (
                    <p className={estilos.errorDrawer} role="alert">
                      {errorForm}
                    </p>
                  )}

                  <div className={estilos.campo}>
                    <label htmlFor="v-nombre">Nombre del proyecto</label>
                    <input
                      id="v-nombre"
                      required
                      disabled={enviando}
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                    {form.nombre === seleccionado.repo && (
                      <span className={estilos.pista}>Prellenado con el nombre del repositorio — editable</span>
                    )}
                  </div>

                  <div className={estilos.campo}>
                    <label htmlFor="v-etapa">Etapa actual (1–9)</label>
                    <div className={estilos.campoConAccion}>
                      <select
                        id="v-etapa"
                        disabled={enviando || sugiriendo}
                        value={form.etapa_inicial}
                        onChange={(e) => setForm({ ...form, etapa_inicial: e.target.value })}
                      >
                        <option value="">— Elegir —</option>
                        {ETAPAS.map((etapa) => (
                          <option key={etapa.numero} value={etapa.numero}>
                            {etapa.numero} · {etapa.nombre}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={estilos.btnSugerir}
                        onClick={pedirSugerencia}
                        disabled={enviando || sugiriendo}
                      >
                        {sugiriendo ? 'leyendo…' : 'Sugerir'}
                      </button>
                    </div>
                    <span className={estilos.pista}>Pasar la etapa 2 congela el alcance</span>

                    {sugiriendo && (
                      <span className={estilos.pista} role="status">
                        El agente está leyendo la estructura del repo...
                      </span>
                    )}

                    {errorSugerencia && (
                      <span className={estilos.pistaError} role="alert">
                        {errorSugerencia}
                      </span>
                    )}

                    {sugerencia && !sugiriendo && (
                      <div className={estilos.sugerencia}>
                        <span className={estilos.sugerenciaTit}>
                          El agente sugiere la etapa {sugerencia.etapa} — confirmala o cambiala
                        </span>
                        <p>{sugerencia.evidencia}</p>
                        {sugerencia.dudas && (
                          <p className={estilos.sugerenciaDudas}>
                            <b>Dudas:</b> {sugerencia.dudas}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={estilos.campo}>
                    <label htmlFor="v-inicio">Fecha de inicio real</label>
                    <input
                      id="v-inicio"
                      type="date"
                      disabled={enviando}
                      value={form.fecha_inicio}
                      onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                    />
                    {seleccionado.primerCommit && (
                      <span className={estilos.pista}>Sugerida por el primer commit</span>
                    )}
                  </div>

                  <div className={estilos.campo}>
                    <label htmlFor="v-modalidad">Modalidad</label>
                    <select
                      id="v-modalidad"
                      disabled={enviando}
                      value={form.modalidad}
                      onChange={(e) => setForm({ ...form, modalidad: e.target.value as 'individual' | 'equipo' })}
                    >
                      <option value="individual">Individual</option>
                      <option value="equipo">Equipo</option>
                    </select>
                  </div>

                  {form.modalidad === 'individual' ? (
                    <div className={estilos.campo}>
                      <label htmlFor="v-encargado">Encargado</label>
                      <select
                        id="v-encargado"
                        disabled={enviando}
                        value={form.encargado_id}
                        onChange={(e) => setForm({ ...form, encargado_id: e.target.value })}
                      >
                        <option value="">— Elegir —</option>
                        {personas.map((persona) => (
                          <option key={persona.id} value={persona.id}>
                            {persona.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className={estilos.campo}>
                      <span className={estilos.grupoTit}>Encargados</span>
                      <span className={estilos.pista}>
                        {personas.map((p) => p.nombre).join(' y ') || 'todas las personas activas'} — los dos quedan
                        como líderes del proyecto
                      </span>
                    </div>
                  )}

                  <button type="submit" className={estilos.btn} disabled={enviando}>
                    {enviando ? 'Confirmando...' : 'Confirmar vínculo'}
                  </button>
                  <button type="button" className={`${estilos.btn} ${estilos.btnFantasma}`} onClick={cerrarVinculo}>
                    Cancelar
                  </button>
                </form>
              </aside>
            )}
          </div>
        )}
      </section>

      <section className={estilos.zona} aria-labelledby="tit-vinculados">
        <div className={estilos.zonaCab}>
          <h2 id="tit-vinculados">Tus proyectos</h2>
        </div>

        {proyectos === null && !errorProyectos && <p className={estilos.cargando}>Cargando proyectos...</p>}
        {errorProyectos && (
          <p className={estilos.error} role="alert">
            {errorProyectos}
          </p>
        )}
        {proyectos && proyectos.length === 0 && (
          <p className={estilos.vacio}>Todavía no hay proyectos vinculados.</p>
        )}
        {proyectos && proyectos.length > 0 && (
          <ul className={estilos.lista}>
            {proyectos.map((proyecto) => (
              <li key={proyecto.id}>
                <Link to={`/proyectos/${proyecto.id}`} className={estilos.tarjetaProyecto}>
                  <h3 className={estilos.nombreProyecto}>{proyecto.nombre}</h3>
                  <p className={estilos.metaProyecto}>
                    {proyecto.estado === 'activo' && <span className={estilos.pillActivo}>Activo</span>}
                    <span>
                      Etapa {proyecto.etapa_actual} de 9 · {proyecto.modalidad}
                    </span>
                    {proyecto.alcance_congelado_en && <span>· alcance congelado</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
