import estilos from './DetalleSnapshot.module.css';

interface Props {
  detalle: unknown;
  personas: Map<string, string>;
}

type Objeto = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

function formatear(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'number') return numero.format(valor);
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  if (typeof valor === 'string') return valor;
  return JSON.stringify(valor);
}

function humanizar(clave: string): string {
  return clave.replace(/_/g, ' ');
}

// El Motor escribe `detalle` en tres formas (scripts/calcular_indicadores.py):
// listas de filas (`por_persona`, `por_area`), un mapa de objetos (el #26,
// una entrada por modalidad) y campos sueltos. Las dos primeras se dibujan
// igual — como tabla —, así un calculador nuevo con otra lista no necesita
// tocar este componente.
function aFilas(valor: unknown): Objeto[] | null {
  if (Array.isArray(valor) && valor.every(esObjeto)) return valor;
  if (esObjeto(valor)) {
    const entradas = Object.entries(valor);
    if (entradas.length > 0 && entradas.every(([, v]) => esObjeto(v))) {
      return entradas.map(([clave, v]) => ({ etiqueta: clave, ...(v as Objeto) }));
    }
  }
  return null;
}

function Tabla({ filas, personas }: { filas: Objeto[]; personas: Map<string, string> }) {
  const etiquetaDe = (fila: Objeto): string => {
    if (typeof fila.persona_id === 'string') return personas.get(fila.persona_id) ?? 'persona sin nombre';
    if (typeof fila.etiqueta === 'string') return fila.etiqueta;
    if (typeof fila.area === 'string') return fila.area;
    return '—';
  };
  const columnas = [
    ...new Set(filas.flatMap((f) => Object.keys(f)).filter((c) => !['persona_id', 'etiqueta', 'area'].includes(c))),
  ];
  const conPorcentaje = columnas.includes('porcentaje');

  return (
    <table className={estilos.tabla}>
      <thead>
        <tr>
          <th></th>
          {columnas.map((c) => (
            <th key={c}>{humanizar(c)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={i}>
            <td className={estilos.etiqueta}>{etiquetaDe(fila)}</td>
            {columnas.map((c) => (
              <td key={c} className={estilos.num}>
                {c === 'porcentaje' && conPorcentaje && typeof fila[c] === 'number' ? (
                  // Un solo color para todas las barras, a propósito: pintarlas
                  // distinto según el valor sugiere un ranking entre personas.
                  <span className={estilos.barraCelda}>
                    <span className={estilos.barraFondo}>
                      <span style={{ width: `${Math.min(100, Math.max(0, fila[c] as number))}%` }} />
                    </span>
                    {formatear(fila[c])}%
                  </span>
                ) : (
                  formatear(fila[c])
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DetalleSnapshot({ detalle, personas }: Props) {
  if (!esObjeto(detalle) || Object.keys(detalle).length === 0) return null;

  const listas: [string, Objeto[]][] = [];
  const sueltos: [string, unknown][] = [];

  // Un mapa por modalidad (#26) es el detalle entero, no una clave adentro.
  const detalleComoFilas = aFilas(detalle);
  if (detalleComoFilas) {
    listas.push(['por modalidad', detalleComoFilas]);
  } else {
    for (const [clave, valor] of Object.entries(detalle)) {
      const filas = aFilas(valor);
      if (filas) listas.push([clave, filas]);
      else sueltos.push([clave, valor]);
    }
  }

  return (
    <div className={estilos.detalle}>
      {sueltos.length > 0 && (
        <dl className={estilos.sueltos}>
          {sueltos.map(([clave, valor]) => (
            <div key={clave}>
              <dt>{humanizar(clave)}</dt>
              <dd>{formatear(valor)}</dd>
            </div>
          ))}
        </dl>
      )}
      {listas.map(([clave, filas]) => (
        <div key={clave}>
          <div className={estilos.subtitulo}>{humanizar(clave)}</div>
          {filas.length === 0 ? <p className={estilos.vacio}>sin filas</p> : <Tabla filas={filas} personas={personas} />}
        </div>
      ))}
    </div>
  );
}
