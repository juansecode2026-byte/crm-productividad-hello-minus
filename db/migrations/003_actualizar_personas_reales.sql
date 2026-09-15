-- =============================================================================
-- 003_actualizar_personas_reales.sql — reemplaza los datos provisionales
-- =============================================================================
-- Aplicado en Supabase el 2026-09-15 como `seed_personas_reales`.
--
-- Cierra el pendiente que dejó `002_seed_personas.sql`: mientras el email sea
-- `.invalid`, el trigger `al_crear_usuario_vincular_persona` (de
-- `001_vincular_auth_y_catalogos.sql`) no puede enlazar a nadie y RLS mantiene
-- la base cerrada para todos.
--
-- Orden obligatorio después de correr esto:
--   1. Este bloque primero.
--   2. Recién entonces cada quien se registra en Supabase Auth con SU email
--      real — tiene que coincidir exactamente con el que queda acá.
-- =============================================================================

delete from personas where email in ('integrante-1@pendiente.invalid', 'integrante-2@pendiente.invalid');

insert into personas (nombre, email, rol, github_username, activo) values
  ('Juan Sebastian Correa Ramírez', 'juansecode2026@gmail.com', 'admin',       'juansecode2026-byte', true),
  ('Gabriel Carvajal',              'monkeyotbz@gmail.com',     'colaborador', 'Monkeyotbz',           true)
on conflict (email) do nothing;
