// La clave viaja en claro por HTTPS y acá se compara contra el SHA-256 que
// guarda `claves_ingesta`. Nunca se guarda ni se loguea la clave en claro.
export async function hashDeClave(clave: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clave));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const PREFIJO_CLAVE = 'hmt_';
