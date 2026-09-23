import type { PasoAgente } from '../lib/agentes';
import estilos from './GrafoAgente.module.css';

// Un solo componente dibuja el grafo, en dos tamaños. Nunca se escribe un SVG
// a mano por agente: agregar un cuarto agente es agregar un `pasos[]` en
// agentes.ts, no dibujar cajas. `tieneLoop` es lo único que cambia la lectura
// de la última flecha — sólida y de vuelta si es real, punteada y rotulada
// "no ocurre" si el agente no la tiene (para enseñar el concepto sin mentir
// sobre datos que no existen).
interface Props {
  pasos: PasoAgente[];
  tieneLoop: boolean;
  tamano?: 'mini' | 'detalle';
}

const BOX_W = { mini: 70, detalle: 190 } as const;
const BOX_H = { mini: 26, detalle: 92 } as const;
const GAP = { mini: 20, detalle: 58 } as const;
const PAD = { mini: 8, detalle: 20 } as const;

export function GrafoAgente({ pasos, tieneLoop, tamano = 'detalle' }: Props) {
  const boxW = BOX_W[tamano];
  const boxH = BOX_H[tamano];
  const gap = GAP[tamano];
  const pad = PAD[tamano];
  const topeLoop = tamano === 'detalle' ? 44 : 0; // espacio arriba para la flecha de loop
  const ancho = pad * 2 + pasos.length * boxW + (pasos.length - 1) * gap;
  const alto = pad * 2 + boxH + topeLoop;
  const y = pad + topeLoop;

  const xDe = (i: number) => pad + i * (boxW + gap);

  const etiqueta =
    pasos.length === 1
      ? '1 paso: sin loop'
      : `${pasos.length} pasos en fila: sin loop`;

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className={tamano === 'mini' ? estilos.svgMini : estilos.svgDetalle}
      role="img"
      aria-label={
        tieneLoop
          ? `Grafo de ${pasos.length} pasos, con un loop que vuelve sobre un paso anterior.`
          : `Grafo de ${pasos.length} pasos en fila, ${etiqueta}.`
      }
    >
      <defs>
        <marker id={`ga-arrow-${tamano}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill="currentColor" />
        </marker>
      </defs>

      {pasos.map((paso, i) => (
        <g key={i} className={estilos[paso.tipo]}>
          <rect x={xDe(i)} y={y} width={boxW} height={boxH} rx={tamano === 'mini' ? 3 : 8} />
          {tamano === 'detalle' && (
            <>
              <text x={xDe(i) + boxW / 2} y={y + 24} textAnchor="middle" className={estilos.titulo} fontSize="12">
                {paso.titulo}
              </text>
              <text x={xDe(i) + boxW / 2} y={y + 42} textAnchor="middle" fontSize="10" opacity={0.85}>
                {paso.detalle.length > 46 ? `${paso.detalle.slice(0, 44)}…` : paso.detalle}
              </text>
              {paso.repite && (
                <text x={xDe(i) + boxW / 2} y={y + boxH - 10} textAnchor="middle" fontSize="9.5" opacity={0.6}>
                  {paso.repite}
                </text>
              )}
            </>
          )}
        </g>
      ))}

      {pasos.slice(0, -1).map((_, i) => (
        <line
          key={i}
          x1={xDe(i) + boxW}
          y1={y + boxH / 2}
          x2={xDe(i + 1)}
          y2={y + boxH / 2}
          stroke="currentColor"
          markerEnd={`url(#ga-arrow-${tamano})`}
        />
      ))}

      {tamano === 'detalle' &&
        (tieneLoop ? (
          <path
            d={`M ${xDe(pasos.length - 1) + boxW / 2} ${y} C ${xDe(pasos.length - 1) + boxW / 2} ${y - 30}, ${xDe(0) + boxW / 2} ${y - 30}, ${xDe(0) + boxW / 2} ${y}`}
            stroke="currentColor"
            fill="none"
            markerEnd={`url(#ga-arrow-${tamano})`}
          />
        ) : (
          pasos.length > 1 && (
            <>
              <path
                className={estilos.fantasma}
                d={`M ${xDe(pasos.length - 1) + boxW / 2} ${y} C ${xDe(pasos.length - 1) + boxW / 2} ${y - 30}, ${xDe(0) + boxW / 2} ${y - 30}, ${xDe(0) + boxW / 2} ${y}`}
                stroke="currentColor"
                fill="none"
                markerEnd={`url(#ga-arrow-${tamano})`}
              />
              <text x={ancho / 2} y={14} textAnchor="middle" fontSize="10" className={estilos.fantasma}>
                así se vería un loop si volviera a un paso anterior — no ocurre
              </text>
            </>
          )
        ))}
    </svg>
  );
}
