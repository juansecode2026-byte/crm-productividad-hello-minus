const PREFIJO = 'sha256=';

function hexABytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Se firma sobre los bytes crudos, no sobre el JSON re-serializado: cualquier
// diferencia de espacios u orden de claves cambia la firma.
// crypto.subtle.verify compara en tiempo constante.
export async function firmaValida(cuerpo: Uint8Array, cabecera: string | null, secreto: string): Promise<boolean> {
  if (!cabecera?.startsWith(PREFIJO)) return false;
  const firma = hexABytes(cabecera.slice(PREFIJO.length));
  if (!firma) return false;

  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('HMAC', llave, firma, cuerpo);
}
