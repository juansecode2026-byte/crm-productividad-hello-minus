import { z } from 'zod';

z.config(z.locales.es());

const esquema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((valor) => valor.split(',').map((origen) => origen.trim()).filter(Boolean))
    .refine((origenes) => !origenes.includes('*'), 'CORS_ORIGINS no puede contener "*"')
    .pipe(z.array(z.url()).min(1)),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  console.error(`Variables de entorno inválidas:\n${z.prettifyError(resultado.error)}`);
  process.exit(1);
}

export const config = resultado.data;
