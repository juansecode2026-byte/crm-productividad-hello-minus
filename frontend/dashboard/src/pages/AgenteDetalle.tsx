import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { GrafoAgente } from '../components/GrafoAgente';
import { buscarAgente } from '../lib/agentes';
import estilos from './AgenteDetalle.module.css';

export function AgenteDetalle() {
  const { id } = useParams<{ id: string }>();
  const agente = id ? buscarAgente(id) : undefined;

  if (!agente) {
    return (
      <AppShell>
        <p className={estilos.vacio}>No se encontró ese agente.</p>
        <Link className={estilos.volver} to="/agentes">
          ← Ingeniería Agéntica
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className={estilos.env}>
        <Link className={estilos.volver} to="/agentes">
          ← Ingeniería Agéntica
        </Link>
        <h1>{agente.nombre}</h1>
        <p className={estilos.sub}>
          {agente.resumen} · <code>{agente.modelo}</code> · effort {agente.effort}
        </p>

        <div className={estilos.explicacionSimple}>
          <span className={estilos.rotuloSimple}>En palabras simples</span>
          Un <b>grafo</b> es solo el dibujo de "primero esto, después esto otro" — cada caja es un
          paso y cada flecha dice a qué paso sigue. Un <b>loop</b> es lo mismo, pero con una flecha
          que en vez de ir para adelante <b>vuelve</b> a un paso anterior: el agente repite parte del
          trabajo en vez de terminar.{' '}
          {agente.tieneLoop
            ? 'Este agente sí tiene una flecha así.'
            : 'Este agente no tiene ninguna flecha así — abajo se ve dibujado, en gris, dónde iría si la tuviera.'}
        </div>

        <div className={estilos.seccion}>
          <div className={estilos.scab}>
            <h2>Grafo{agente.tieneLoop ? ' y loop' : ''} — el camino real que sigue</h2>
            <span className={estilos.badgeReal}>✓ así corre hoy</span>
          </div>
          <div className={estilos.scuerpo}>
            <GrafoAgente pasos={agente.pasos} tieneLoop={agente.tieneLoop} tamano="detalle" />
            <div className={estilos.leyenda}>
              <span className={estilos.li}>
                <svg viewBox="0 0 60 30" aria-hidden="true">
                  <rect x="4" y="8" width="52" height="14" rx="3" fill="none" stroke="currentColor" />
                </svg>
                caja = un paso del agente
              </span>
              <span className={estilos.li}>
                <svg viewBox="0 0 60 30" aria-hidden="true">
                  <line x1="6" y1="15" x2="50" y2="15" stroke="currentColor" />
                  <polygon points="50 12,56 15,50 18" fill="currentColor" />
                </svg>
                flecha sólida = pasa de verdad
              </span>
              {!agente.tieneLoop && agente.pasos.length > 1 && (
                <span className={estilos.li}>
                  <svg viewBox="0 0 60 30" aria-hidden="true">
                    <path d="M50 22 C 50 4, 10 4, 10 22" stroke="currentColor" fill="none" strokeDasharray="3 3" />
                    <polygon points="10 22,16 19,16 25" fill="currentColor" />
                  </svg>
                  flecha punteada = no ocurre, solo explica el concepto
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={estilos.seccion}>
          <div className={estilos.scab}>
            <h2>Harness — quién lo hace correr</h2>
          </div>
          <div className={estilos.scuerpo}>
            <p className={estilos.harnessDesc}>{agente.harness.texto}</p>
            <dl className={estilos.campos}>
              <dt>Dispara</dt>
              <dd>{agente.harness.disparador === 'cron' ? 'Por horario (cron)' : 'Por botón, en caliente'}</dd>
              <dt>Definido en</dt>
              <dd>
                <code>{agente.harness.definidoEn}</code>
              </dd>
              <dt>Modelo</dt>
              <dd>
                {agente.modelo} · effort {agente.effort}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
