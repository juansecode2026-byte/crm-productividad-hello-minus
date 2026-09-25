import type { CapacidadPersona } from '../lib/tipos';
import { peticionApi } from './api';

export function listarCapacidad(personaId: string): Promise<CapacidadPersona[]> {
  return peticionApi<CapacidadPersona[]>('GET', `/personas/${personaId}/capacidad`);
}

// Sin vigente_hasta que pasar: el backend la fija en hoy si no se manda nada.
export function declararCapacidad(personaId: string, horasSemanales: number): Promise<CapacidadPersona> {
  return peticionApi<CapacidadPersona>('POST', `/personas/${personaId}/capacidad`, {
    horas_semanales: horasSemanales,
  });
}
