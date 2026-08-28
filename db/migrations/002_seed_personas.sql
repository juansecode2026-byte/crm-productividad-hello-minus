-- =============================================================================
-- 002_seed_personas.sql — los dos integrantes del equipo
-- =============================================================================
-- Aplicado en Supabase el 2026-08-28 como `seed_personas_placeholder`.
--
-- ⚠️  DATOS PROVISIONALES. Ver "Cómo poner los datos reales" al final.
--
-- Decisiones de este seed, por si no son obvias:
--
--   · Emails con TLD `.invalid` — reservado por la RFC 2606 justo para esto.
--     No existe ni puede existir, así que ninguno puede enganchar por accidente
--     con una cuenta real de Auth.
--
--   · `github_username` en NULL, no con un placeholder. Si se pusiera un nombre
--     inventado y ese usuario existiera en GitHub, el Sincronizador le
--     atribuiría a esta persona los commits de un tercero — y quedarían
--     indicadores con apariencia de correctos sobre trabajo ajeno. NULL es el
--     estado honesto de "todavía no se sabe".
--
--   · Uno es `admin` y el otro `colaborador`. Ambos leen todo por RLS; la
--     diferencia es que solo el admin modifica catálogos y datos comerciales.
-- =============================================================================

insert into personas (nombre, email, rol, activo) values
  ('Integrante 1 — pendiente de datos reales', 'integrante-1@pendiente.invalid', 'admin',       true),
  ('Integrante 2 — pendiente de datos reales', 'integrante-2@pendiente.invalid', 'colaborador', true)
on conflict (email) do nothing;


-- =============================================================================
-- Cómo poner los datos reales
-- =============================================================================
-- Mientras el email sea `.invalid`, el trigger de 001 no puede enlazar a nadie
-- y RLS mantiene la base cerrada para todos. El orden importa:
--
--   1. Correr el UPDATE de abajo con los datos reales.
--   2. Recién entonces registrarse en Supabase Auth con ESE MISMO email.
--
-- Si alguien se registra antes de corregir su email, el trigger no engancha y
-- hay que vincular a mano:
--     update personas set auth_user_id = (select id from auth.users where email = '<su email>')
--      where email = '<su email>';
--
-- El email tiene que coincidir exactamente con el de Auth — es la única llave
-- del enlace. El github_username tiene que ser el usuario real con el que hace
-- commits en los repos de Hello Minus, o su actividad queda huérfana.
--
-- update personas set
--   nombre          = 'Nombre real',
--   email           = 'correo.real@dominio.com',
--   github_username = 'usuario-real-de-github'
-- where email = 'integrante-1@pendiente.invalid';
--
-- update personas set
--   nombre          = 'Nombre real',
--   email           = 'correo.real@dominio.com',
--   github_username = 'usuario-real-de-github'
-- where email = 'integrante-2@pendiente.invalid';
