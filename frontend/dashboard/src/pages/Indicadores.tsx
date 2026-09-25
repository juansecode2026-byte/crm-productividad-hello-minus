import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import {
  CATEGORIAS,
  estadoEn,
  FUENTE,
  grupoDe,
  type Aplicabilidad,
  type EstadoModalidad,
  type Fuente,
  type Grupo,
  type IndicadorCatalogo,
} from '../lib/indicadores';
import { listarCatalogo, listarIndicadoresConResultados } from '../services/indicadoresService';
import estilos from './Indicadores.module.css';

const GLIFO_FUENTE: Record<Fuente, string> = { respaldo: '✓', telemetria: '◐', sin_campo: '○' };
const CLASE_GRUPO: Record<Grupo, string> = { A: '', B: 'b', C: 'c', Nuevo: 'n' };

function Modalidad({ estado }: { estado: EstadoModalidad }) {
  if (estado === 'aplica') return <td className={`${estilos.mod} ${estilos.si}`}>✓</td>;
  if (estado === 'no_aplica') return <td className={`${estilos.mod} ${estilos.no}`}>N/A</td>;
  return <td className={`${estilos.mod} ${estilos.rev}`}>a decidir</td>;
}

export function Indicadores() {
  const [indicadores, setIndicadores] = useState<IndicadorCatalogo[] | null>(null);
  const [aplicabilidad, setAplicabilidad] = useState<Aplicabilidad[]>([]);
  const [conResultados, setConResultados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarCatalogo(), listarIndicadoresConResultados()])
      .then(([{ indicadores: ind, aplicabilidad: apl }, resultados]) => {
        setIndicadores(ind);
        setAplicabilidad(apl);
        setConResultados(resultados);
      })
      .catch((excepcion) => setError(excepcion instanceof Error ? excepcion.message : 'No se pudo cargar el catálogo'));
  }, []);

  const porCodigo = useMemo(() => {
    const mapa = new Map<string, Aplicabilidad[]>();
    for (const fila of aplicabilidad) {
      mapa.set(fila.indicador_code, [...(mapa.get(fila.indicador_code) ?? []), fila]);
    }
    return mapa;
  }, [aplicabilidad]);

  // Los totales salen del catálogo real, no de un número escrito a mano: si
  // mañana se agrega un indicador, el resumen cambia solo.
  const conteo = useMemo(() => {
    const c: Record<Fuente, number> = { respaldo: 0, telemetria: 0, sin_campo: 0 };
    for (const ind of indicadores ?? []) {
      const fuente = FUENTE[ind.indicador_code]?.fuente;
      if (fuente) c[fuente]++;
    }
    return c;
  }, [indicadores]);

  return (
    <AppShell>
      <header className={estilos.cabecera}>
        <div className={estilos.miga}>Indicadores</div>
        <h1>Catálogo de indicadores</h1>
        <p className={estilos.desc}>
          Qué se mide y cómo se lee cada indicador. El número calculado de cada uno está en
          "Ver resultados", al final de su fila.
        </p>
      </header>

      <section className={estilos.seccion}>
        <div className={estilos.nota}>
          <b>Los 9 que dependen 100% del cliente no están acá.</b> El doc los marca "no se van a
          utilizar por el momento": medirlos evaluaría al cliente, no al equipo. Si se activan, se
          agregan.
        </div>

        {error && (
          <p className={estilos.error} role="alert">
            {error}
          </p>
        )}
        {!indicadores && !error && <p className={estilos.cargando}>Cargando catálogo…</p>}

        {indicadores && (
          <>
            <div className={estilos.resumen}>
              <div className={estilos.stat}>
                <div className={estilos.cifra}>{indicadores.length}</div>
                <div className={estilos.etiquetaStat}>indicadores en el catálogo</div>
              </div>
              <div className={`${estilos.stat} ${estilos.respaldo}`}>
                <div className={estilos.cifra}>{conteo.respaldo}</div>
                <div className={estilos.etiquetaStat}>el esquema los respalda</div>
              </div>
              <div className={`${estilos.stat} ${estilos.telemetria}`}>
                <div className={estilos.cifra}>{conteo.telemetria}</div>
                <div className={estilos.etiquetaStat}>esperan telemetría de Claude Code</div>
              </div>
              <div className={`${estilos.stat} ${estilos.sin_campo}`}>
                <div className={estilos.cifra}>{conteo.sin_campo}</div>
                <div className={estilos.etiquetaStat}>ningún campo los respalda</div>
              </div>
            </div>

            <div className={estilos.leyendas}>
              <div className={estilos.leyenda}>
                <b>Fuente:</b>
                <span><span className={`${estilos.glifo} ${estilos.respaldo}`}>✓</span> el esquema lo respalda</span>
                <span><span className={`${estilos.glifo} ${estilos.telemetria}`}>◐</span> la tabla existe, espera telemetría</span>
                <span><span className={`${estilos.glifo} ${estilos.sin_campo}`}>○</span> falta capturar un dato</span>
              </div>
              <div className={estilos.leyenda}>
                <b>Grupo:</b>
                <span><span className={estilos.gr}>A</span> igual en individual y equipo</span>
                <span><span className={`${estilos.gr} ${estilos.b}`}>B</span> cambia la comparación</span>
                <span><span className={`${estilos.gr} ${estilos.c}`}>C</span> solo aplica en equipo</span>
                <span><span className={`${estilos.gr} ${estilos.n}`}>Nuevo</span> propuesto para individual</span>
              </div>
            </div>

            {CATEGORIAS.map((categoria) => {
              const deEsta = indicadores.filter((i) => i.categoria === categoria);
              if (deEsta.length === 0) return null;
              return (
                <section key={categoria} className={estilos.seccionTipo}>
                  <div className={estilos.tipoCab}>
                    <h2>{categoria}</h2>
                    <span className={estilos.tipoCuenta}>
                      {deEsta.length} {deEsta.length === 1 ? 'indicador' : 'indicadores'}
                    </span>
                  </div>
                  <div className={estilos.tablaEnvoltura}>
                    <table>
                      <thead>
                        <tr>
                          <th>Indicador</th>
                          <th>Grupo</th>
                          <th>Individual</th>
                          <th>Equipo</th>
                          <th>Fuente</th>
                          <th>Resultados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deEsta.map((ind) => {
                          const filas = porCodigo.get(ind.indicador_code) ?? [];
                          const grupo = grupoDe(filas);
                          const sustituye = filas.find((f) => f.modalidad === 'individual')?.sustituye_comparacion;
                          const fuente = FUENTE[ind.indicador_code];
                          return (
                            <tr key={ind.indicador_code}>
                              <td>
                                <span className={estilos.codigo}>{ind.indicador_code.slice(0, 2)}</span>
                                <div className={estilos.nombre}>{ind.nombre}</div>
                                {ind.descripcion && <div className={estilos.subnota}>{ind.descripcion}</div>}
                                {sustituye && <div className={estilos.comparacion}>En individual compara contra: {sustituye}</div>}
                              </td>
                              <td>
                                <span className={`${estilos.gr} ${CLASE_GRUPO[grupo] ? estilos[CLASE_GRUPO[grupo]] : ''}`}>
                                  {grupo}
                                </span>
                              </td>
                              <Modalidad estado={estadoEn(filas, 'individual')} />
                              <Modalidad estado={estadoEn(filas, 'equipo')} />
                              <td className={estilos.fuenteCelda}>
                                {fuente ? (
                                  <>
                                    <span className={`${estilos.glifo} ${estilos[fuente.fuente]}`}>
                                      {GLIFO_FUENTE[fuente.fuente]}
                                    </span>
                                    <div className={estilos.tabla}>{fuente.tabla}</div>
                                  </>
                                ) : (
                                  <span className={estilos.tabla}>sin clasificar</span>
                                )}
                              </td>
                              <td>
                                <Link
                                  to={`/indicadores/${ind.indicador_code}`}
                                  className={`${estilos.verResultados} ${
                                    conResultados.has(ind.indicador_code) ? estilos.conDatos : ''
                                  }`}
                                >
                                  {conResultados.has(ind.indicador_code) && (
                                    <span className={estilos.puntoDatos} aria-hidden="true" />
                                  )}
                                  Ver resultados →
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </>
        )}
      </section>
    </AppShell>
  );
}
