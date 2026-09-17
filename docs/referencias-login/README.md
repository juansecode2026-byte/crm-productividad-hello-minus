# Referencias visuales — login/registro

Capturas de Reels de Instagram, guardadas el 2026-09-16 para analizar más
adelante si el login del dashboard (`frontend/dashboard/src/pages/Login.tsx`)
se rediseña en esta dirección. Todavía no se decidió nada — es material de
referencia, no un mockup propio ni una decisión tomada.

Se relaciona con el pendiente de "Branding y diseño del dashboard" en
`CLAUDE.md`: la dirección visual "Consola" ya se eligió para el resto del
dashboard (ver `docs/` — no hay nota propia de esa decisión, vive en el
historial de commits y en la memoria de sesión), pero el login sigue con una
adaptación mínima de esos mismos tokens, no con un diseño propio.

## Contenido

| Archivo | Qué muestra |
|---|---|
| `01-login-registro-v7.jpeg` | Formulario "Create Account" — nombre completo, email, contraseña, confirmar contraseña, checkbox de términos, botón principal, login social (Google/Apple), link a "Sign In". |
| `02-otp-verificacion.jpeg` | Verificación de OTP de 4 dígitos, con reenvío cronometrado ("Resend in 00:36") y estado de carga ("Verifying Code..."). |
| `03-login-registro-v7-hover.jpeg` | Mismo formulario que 01, con el cursor sobre el link "Sign In" — variante casi idéntica, probablemente el mismo diseño en otro frame del Reel. |

## Rasgos visuales comunes

- Fondo negro con líneas doradas/bronce curvas de fondo (decorativo, no funcional).
- Tarjeta con efecto glassmorphism (vidrio esmerilado, blur) sobre ese fondo.
- Acento dorado/ámbar en botones y elementos activos — distinto del acento
  cian que ya usa la dirección "Consola" del resto del dashboard.
- Tipografía sans bold para títulos, alto contraste.

## Para cuando se retome

Preguntas a resolver antes de adoptar algo de esto:
- ¿Este tono (dorado, glassmorphism, fondo decorativo) encaja con "Consola"
  (Linear/Vercel, densa, funcional) o es una dirección distinta que reemplazaría
  esa elección?
- El login de este CRM es para 2 personas conocidas, no un flujo de
  adquisición de usuarios — ¿vale la pena esta cantidad de ornamento para un
  formulario que se usa una vez por sesión?
- La verificación OTP no es un paso que exista hoy en el flujo de Auth de
  Supabase de este proyecto (es email + contraseña) — adoptarlo implica
  agregar un paso nuevo, no solo restilizar uno existente.
