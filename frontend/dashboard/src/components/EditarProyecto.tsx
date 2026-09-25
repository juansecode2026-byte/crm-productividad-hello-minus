import { useEffect, useState, type FormEvent } from 'react';
import type { Proyecto, TipoProyecto } from '../lib/tipos';
import { actualizarProyecto } from '../services/proyectosService';
import { listarTiposProyecto } from '../services/tiposProyectoService';
import estilos from './EditarProyecto.module.css';

interface Props {
  proyecto: Proyecto;
  onGuardado: (proyecto: Proyecto) => void;
  onCancelar: () => void;
}

// Formulario de edición general del proyecto. cliente_id, encargado_id y
// modalidad quedan afuera a propósito: no hay selector de clientes en este
// dashboard todavía, y encargado/modalidad tienen efectos sobre RLS e
// indicador_aplicabilidad que van más allá de "editar datos" — no son parte
// de esta tarea (Fase 07, migración 017: agregar tipo_id).
export function EditarProyecto({ proyecto, onGuardado, onCancelar }: Props) {
  const [tipos, setTipos] = useState<TipoProyecto[]>([]);
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [descripcion, setDescripcion] = useState(proyecto.descripcion ?? '');
  const [tipoId, setTipoId] = useState(proyecto.tipo_id ?? '');
  const [prioridad, setPrioridad] = useState(proyecto.prioridad !== null ? String(proyecto.prioridad) : '');
  const [estado, setEstado] = useState<Proyecto['estado']>(proyecto.estado);
  const [fechaObjetivo, setFechaObjetivo] = useState(proyecto.fecha_objetivo ?? '');
  const [fechaLimite, setFechaLimite] = useState(proyecto.fecha_limite ?? '');
  const [horasEstimadas, setHorasEstimadas] = useState(
    proyecto.horas_estimadas !== null ? String(proyecto.horas_estimadas) : '',
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarTiposProyecto()
      .then(setTipos)
      .catch(() => setTipos([]));
  }, []);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (!nombre.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      const actualizado = await actualizarProyecto(proyecto.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        tipo_id: tipoId || null,
        prioridad: prioridad ? Number(prioridad) : null,
        estado,
        fecha_objetivo: fechaObjetivo || null,
        fecha_limite: fechaLimite || null,
        horas_estimadas: horasEstimadas ? Number(horasEstimadas) : null,
      });
      onGuardado(actualizado);
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo guardar el proyecto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className={estilos.form} onSubmit={guardar}>
      {error && (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      )}

      <div className={estilos.fila}>
        <label className={estilos.campoAncho}>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={enviando} />
        </label>
        <label>
          Tipo
          <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} disabled={enviando}>
            <option value="">Sin tipo</option>
            {tipos.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={estilos.campoAncho}>
        Descripción
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          disabled={enviando}
          rows={2}
        />
      </label>

      <div className={estilos.fila}>
        <label>
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value as Proyecto['estado'])} disabled={enviando}>
            <option value="activo">Activo</option>
            <option value="pausado">Pausado</option>
            <option value="archivado">Archivado</option>
          </select>
        </label>
        <label>
          Prioridad (1-5)
          <input
            type="number"
            min="1"
            max="5"
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value)}
            disabled={enviando}
          />
        </label>
        <label>
          Horas estimadas
          <input
            type="number"
            min="0"
            step="0.5"
            value={horasEstimadas}
            onChange={(e) => setHorasEstimadas(e.target.value)}
            disabled={enviando}
          />
        </label>
      </div>

      <div className={estilos.fila}>
        <label>
          Fecha objetivo
          <input
            type="date"
            value={fechaObjetivo}
            onChange={(e) => setFechaObjetivo(e.target.value)}
            disabled={enviando}
          />
        </label>
        <label>
          Fecha límite
          <input
            type="date"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
            disabled={enviando}
          />
        </label>
      </div>

      <div className={estilos.acciones}>
        <button type="submit" disabled={enviando || !nombre.trim()}>
          Guardar
        </button>
        <button type="button" className={estilos.btnFantasma} onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
