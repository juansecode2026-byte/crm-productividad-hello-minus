import type { ClaveIngesta } from '../lib/tipos';
import { peticionApi } from './api';

export function listarClaves(proyectoId: string): Promise<ClaveIngesta[]> {
  return peticionApi<ClaveIngesta[]>('GET', `/proyectos/${proyectoId}/claves`);
}

// La clave en claro solo viene en esta respuesta — en la base queda el hash,
// así que si se pierde no hay forma de recuperarla: toca revocar y crear otra.
export function crearClave(proyectoId: string, nombre: string): Promise<ClaveIngesta & { clave: string }> {
  return peticionApi('POST', `/proyectos/${proyectoId}/claves`, { nombre });
}

export function revocarClave(proyectoId: string, claveId: string): Promise<ClaveIngesta> {
  return peticionApi('POST', `/proyectos/${proyectoId}/claves/${claveId}/revocar`);
}
