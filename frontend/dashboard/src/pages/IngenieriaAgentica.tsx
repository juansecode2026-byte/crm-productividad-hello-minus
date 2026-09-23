import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { GrafoAgente } from '../components/GrafoAgente';
import { AGENTES } from '../lib/agentes';
import { contarProyectosConAgentesReportando } from '../services/trazasAgenteService';
import estilos from './IngenieriaAgentica.module.css';

export function IngenieriaAgentica() {
  const [proyectosReportando, setProyectosReportando] = useState<number | null>(null);
  const [errorConteo, setErrorConteo] = useState<string | null>(null);

  useEffect(() => {
    contarProyectosConAgentesReportando()
      .then(setProyectosReportando)
      .catch((excepcion) => setErrorConteo(excepcion instanceof Error ? excepcion.message : 'No se pudo consultar'));
  }, []);

  return (
    <AppShell>
      <header className={estilos.cabecera}>
        <div className={estilos.miga}>Ingeniería Agéntica</div>
        <h1>Ingeniería Agéntica</h1>
        <p className={estilos.desc}>
          Cada tarjeta muestra la <b>forma</b> del agente de un vistazo — no hace falta saber
          qué es un grafo para notar la diferencia entre una tarjeta con una sola caja y una
          con tres conectadas.
        </p>
      </header>

      <section className={estilos.seccion}>
        <div className={estilos.leyenda}>
          <span className={estilos.leyendaRotulo}>Cómo leer las formas</span>
          <span className={estilos.li}>
            <svg viewBox="0 0 60 30" aria-hidden="true">
              <rect x="4" y="8" width="18" height="14" rx="3" />
              <line x1="22" y1="15" x2="36" y2="15" stroke="currentColor" />
              <rect x="38" y="8" width="18" height="14" rx="3" />
            </svg>
            una caja = un paso
          </span>
          <span className={estilos.li}>
            <svg viewBox="0 0 60 30" aria-hidden="true">
              <defs>
                <marker id="leyenda-flecha" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto">
                  <polygon points="0 0,5 2.5,0 5" fill="currentColor" />
                </marker>
              </defs>
              <line x1="6" y1="15" x2="50" y2="15" stroke="currentColor" markerEnd="url(#leyenda-flecha)" />
            </svg>
            flecha = pasa al siguiente paso
          </span>
          <span className={estilos.li}>
            <svg viewBox="0 0 60 30" aria-hidden="true">
              <defs>
                <marker id="leyenda-flecha-2" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto">
                  <polygon points="0 0,5 2.5,0 5" fill="currentColor" />
                </marker>
              </defs>
              <path
                d="M50 22 C 50 4, 10 4, 10 22"
                stroke="currentColor"
                fill="none"
                strokeDasharray="3 3"
                markerEnd="url(#leyenda-flecha-2)"
              />
            </svg>
            flecha punteada que vuelve = un <b>loop</b>
          </span>
        </div>

        <div className={estilos.tarjetas}>
          {AGENTES.map((agente) => (
            <Link key={agente.id} to={`/agentes/${agente.id}`} className={estilos.tarjeta}>
              <div className={estilos.forma}>
                <GrafoAgente pasos={agente.pasos} tieneLoop={agente.tieneLoop} tamano="mini" />
              </div>
              <div className={estilos.tnombre}>{agente.nombre}</div>
              <div className={estilos.tque}>{agente.resumen}</div>
              <div className={estilos.pills}>
                <span className={`${estilos.pill} ${estilos.harness} ${agente.harness.disparador === 'cron' ? estilos.cron : ''}`}>
                  {agente.harness.disparador === 'cron' ? '⏱ cron' : '🖱 botón'}
                </span>
                <span className={`${estilos.pill} ${estilos.sinloop}`}>{agente.tieneLoop ? 'con loop' : 'sin loop'}</span>
                <span className={estilos.pill}>
                  {agente.pasos.length} {agente.pasos.length === 1 ? 'paso' : 'pasos'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={estilos.seccion}>
        <div className={estilos.encabezadoSeccion}>
          <h2>Agentes de otros proyectos</h2>
        </div>
        {proyectosReportando === null && !errorConteo && <p className={estilos.cargando}>Consultando…</p>}
        {errorConteo && (
          <p className={estilos.error} role="alert">
            {errorConteo}
          </p>
        )}
        {proyectosReportando === 0 && (
          <div className={estilos.vacio}>
            <p>
              Ningún proyecto reportó todavía. El canal existe (<code>trazas_agente</code>, endpoint{' '}
              <code>ingesta-telemetria</code>) pero el paquete <code>hello-minus-telemetry</code> no está
              instalado en ningún repo — se verificó buscando la referencia en los 6 repos candidatos.
            </p>
          </div>
        )}
        {proyectosReportando !== null && proyectosReportando > 0 && (
          <p className={estilos.desc}>
            {proyectosReportando} {proyectosReportando === 1 ? 'proyecto está reportando' : 'proyectos están reportando'}{' '}
            actividad de agentes propios.
          </p>
        )}
      </section>
    </AppShell>
  );
}
