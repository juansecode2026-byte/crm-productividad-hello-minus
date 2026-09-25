import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { DetalleSnapshot } from '../components/DetalleSnapshot';
import { fechaCorta } from '../lib/fechas';
import { FUENTE, grupoDe, type Aplicabilidad, type IndicadorCatalogo } from '../lib/indicadores';
import {
  listarSnapshots,
  obtenerIndicador,
  obtenerNombres,
  type ScopeIndicador,
  type Snapshot,
} from '../services/indicadoresService';
import estilos from './IndicadorDetalle.module.css';

interface Alcance {
  clave: string;
  tipo: ScopeIndicador;
  etiqueta: string;
  snapshots: Snapshot[];
}

type Forma = 'serie' | 'numero' | 'cualitativa';

const ORDEN_TIPO: Record<ScopeIndicador, number> = { portafolio: 0, proyecto: 1, persona: 2 };
const SEMANAS_EN_SERIE = 12;
const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

// La forma sale del dato de ESTE alcance, no del indicador en general: el mismo
// indicador puede tener 8 semanas en un proyecto y 1 en otro recién vinculado.
function formaDe(snapshots: Snapshot[]): Forma {
  const ultimo = snapshots[snapshots.length - 1];
  if (!ultimo || ultimo.valor === null) return 'cualitativa';
  return snapshots.filter((s) => s.valor !== null).length >= 2 ? 'serie' : 'numero';
}

export function IndicadorDetalle() {
  const { codigo = '' } = useParams<{ codigo: string }>();

  const [datos, setDatos] = useState<{ indicador: IndicadorCatalogo; aplicabilidad: Aplicabilidad[] } | null | undefined>(
    undefined,
  );
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [nombres, setNombres] = useState<{ proyectos: Map<string, string>; personas: Map<string, string> }>({
    proyectos: new Map(),
    personas: new Map(),
  });
  const [error, setError] = useState<string | null>(null);
  const [claveElegida, setClaveElegida] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([obtenerIndicador(codigo), listarSnapshots(codigo), obtenerNombres()])
      .then(([ind, snaps, noms]) => {
        setDatos(ind);
        setSnapshots(snaps);
        setNombres(noms);
      })
      .catch((excepcion) => setError(excepcion instanceof Error ? excepcion.message : 'No se pudo cargar el indicador'));
  }, [codigo]);

  const alcances = useMemo<Alcance[]>(() => {
    const mapa = new Map<string, Alcance>();
    for (const s of snapshots) {
      const clave = `${s.scope_type}:${s.scope_id ?? ''}`;
      if (!mapa.has(clave)) {
        const etiqueta =
          s.scope_type === 'portafolio'
            ? 'Toda la empresa'
            : s.scope_type === 'proyecto'
              ? (nombres.proyectos.get(s.scope_id ?? '') ?? 'Proyecto sin nombre')
              : (nombres.personas.get(s.scope_id ?? '') ?? 'Persona sin nombre');
        mapa.set(clave, { clave, tipo: s.scope_type, etiqueta, snapshots: [] });
      }
      mapa.get(clave)!.snapshots.push(s);
    }
    return [...mapa.values()].sort(
      (a, b) => ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] || a.etiqueta.localeCompare(b.etiqueta),
    );
  }, [snapshots, nombres]);

  const elegido = alcances.find((a) => a.clave === claveElegida) ?? alcances[0] ?? null;

  if (datos === undefined && !error) {
    return (
      <AppShell>
        <p className={estilos.cargando}>Cargando indicador…</p>
      </AppShell>
    );
  }

  if (datos === null || error) {
    return (
      <AppShell>
        <p className={estilos.error} role="alert">
          {error ?? 'No existe ese indicador en el catálogo.'}
        </p>
        <Link to="/indicadores" className={estilos.volver}>
          ← Volver al catálogo
        </Link>
      </AppShell>
    );
  }

  const { indicador, aplicabilidad } = datos!;
  const fuente = FUENTE[indicador.indicador_code];

  return (
    <AppShell>
      <header className={estilos.cabecera}>
        <div className={estilos.miga}>
          <Link to="/indicadores">Indicadores</Link> / {indicador.indicador_code}
        </div>
        <div className={estilos.filaTitulo}>
          <h1>
            {indicador.indicador_code.slice(0, 2)} · {indicador.nombre}
          </h1>
          <span className={estilos.grupo}>Grupo {grupoDe(aplicabilidad)}</span>
        </div>
        {indicador.descripcion && <p className={estilos.desc}>{indicador.descripcion}</p>}
        {fuente && <p className={estilos.fuente}>fuente: {fuente.tabla}</p>}
      </header>

      {alcances.length === 0 ? (
        <section className={estilos.seccion}>
          <div className={estilos.vacio}>
            <b>Todavía no hay resultados.</b> Sin datos no hay snapshot: el Motor de indicadores solo
            escribe cuando tiene de dónde calcular{fuente ? ` (${fuente.tabla})` : ''}. Cuando corra
            con datos reales, aparecen acá solos.
          </div>
        </section>
      ) : (
        <section className={estilos.seccion}>
          {alcances.length > 1 && (
            <div className={estilos.chips} role="group" aria-label="Alcance">
              {alcances.map((a) => (
                <button
                  key={a.clave}
                  type="button"
                  className={`${estilos.chip} ${a.clave === elegido?.clave ? estilos.chipActivo : ''}`}
                  aria-pressed={a.clave === elegido?.clave}
                  onClick={() => setClaveElegida(a.clave)}
                >
                  {a.etiqueta}
                </button>
              ))}
            </div>
          )}
          {elegido && <Resultado alcance={elegido} personas={nombres.personas} />}
        </section>
      )}
    </AppShell>
  );
}

function Resultado({ alcance, personas }: { alcance: Alcance; personas: Map<string, string> }) {
  const forma = formaDe(alcance.snapshots);
  const ultimo = alcance.snapshots[alcance.snapshots.length - 1]!;

  return (
    <>
      <div className={estilos.panel}>
        <div className={estilos.panelCab}>
          <span className={estilos.panelTit}>
            {alcance.etiqueta}
            {alcance.tipo === 'persona' && <span className={estilos.tipoScope}> · persona</span>}
          </span>
          <span className={estilos.panelMeta}>
            semana del {fechaCorta(ultimo.periodo)} · calculado {fechaCorta(ultimo.calculado_en)}
          </span>
        </div>

        {forma === 'serie' && <Serie snapshots={alcance.snapshots} />}
        {forma === 'numero' && (
          <>
            <div className={estilos.numGrande}>{numero.format(ultimo.valor!)}</div>
            <p className={estilos.nota}>
              Una sola semana calculada todavía — la serie semanal aparece sola desde la segunda.
            </p>
          </>
        )}
        {forma === 'cualitativa' && (
          <p className={estilos.nota}>
            Este indicador no se resume en un número a propósito: la respuesta es la comparación de
            abajo, no un promedio.
          </p>
        )}
      </div>

      <div className={estilos.panel}>
        <div className={estilos.panelCab}>
          <span className={estilos.panelTit}>{forma === 'cualitativa' ? 'Detalle' : 'Desglose'}</span>
          <span className={estilos.panelMeta}>semana del {fechaCorta(ultimo.periodo)}</span>
        </div>
        <DetalleSnapshot detalle={ultimo.detalle} personas={personas} />
        {!ultimo.detalle && <p className={estilos.nota}>Este snapshot no trae desglose.</p>}
      </div>
    </>
  );
}

function Serie({ snapshots }: { snapshots: Snapshot[] }) {
  const puntos = snapshots.filter((s) => s.valor !== null).slice(-SEMANAS_EN_SERIE);
  const valores = puntos.map((p) => p.valor!);
  const maximo = Math.max(...valores.map(Math.abs), 0);
  const actual = valores[valores.length - 1]!;
  const previos = valores.slice(0, -1);
  const promedio = previos.reduce((a, b) => a + b, 0) / previos.length;
  const cambio = promedio === 0 ? null : ((actual - promedio) / Math.abs(promedio)) * 100;

  return (
    <>
      <div className={estilos.numGrande}>{numero.format(actual)}</div>
      <div className={estilos.barras} aria-label="Serie semanal">
        {puntos.map((p, i) => {
          const esActual = i === puntos.length - 1;
          const alto = maximo === 0 ? 2 : Math.max(2, Math.round((Math.abs(p.valor!) / maximo) * 100));
          return (
            <div key={p.periodo} className={estilos.barraCol}>
              <span className={estilos.barraValor}>{numero.format(p.valor!)}</span>
              <div className={estilos.barraCaja}>
                <div className={`${estilos.barra} ${esActual ? estilos.barraActual : ''}`} style={{ height: `${alto}px` }} />
              </div>
              <span className={estilos.barraFecha}>{esActual ? 'esta' : fechaCorta(p.periodo)}</span>
            </div>
          );
        })}
      </div>
      {/* Color neutro a propósito: que suba no siempre es bueno (carga vs.
          capacidad, bloqueos). El juicio lo hace quien lee, no el color. */}
      {cambio !== null && (
        <span className={estilos.cambio}>
          {cambio >= 0 ? '↑' : '↓'} {cambio >= 0 ? '+' : ''}
          {numero.format(cambio)}% vs. promedio de las {previos.length}{' '}
          {previos.length === 1 ? 'semana anterior' : 'semanas anteriores'}
        </span>
      )}
    </>
  );
}
