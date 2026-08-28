-- =============================================================================
-- 001_vincular_auth_y_catalogos.sql
-- =============================================================================
-- Aplicado en Supabase el 2026-08-28 como `vincular_auth_y_catalogos_base`.
--
-- Resuelve un problema de orden: `personas.auth_user_id` no se puede llenar
-- antes de que esa persona exista en Supabase Auth, y hasta que no esté lleno,
-- `private.persona_actual()` devuelve NULL y RLS deja a esa persona afuera.
--
-- En vez de depender de que alguien recuerde vincularlo a mano, un trigger lo
-- hace solo: al registrarse un usuario en Auth, si su email ya figura en
-- `personas`, se enlaza. Sembrar la fila y registrarse quedan desacoplados y
-- pueden ocurrir en cualquier orden.
-- =============================================================================

create or replace function private.vincular_persona_con_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.personas
     set auth_user_id = new.id
   where lower(email) = lower(new.email)
     and auth_user_id is null;
  return new;
end;
$$;

comment on function private.vincular_persona_con_auth() is
  'Al registrarse alguien en Auth, enlaza su fila de personas si el email coincide y aún no tiene auth_user_id. Evita tener que vincular a mano.';

drop trigger if exists al_crear_usuario_vincular_persona on auth.users;

create trigger al_crear_usuario_vincular_persona
  after insert on auth.users
  for each row execute function private.vincular_persona_con_auth();


-- -----------------------------------------------------------------------------
-- Catálogos base
-- -----------------------------------------------------------------------------

-- La lista de canales viene textual de la Fase 01.
insert into canales_venta (nombre) values
  ('Chatbot'), ('Referido'), ('Outbound'), ('Web'), ('Alianza')
on conflict (nombre) do nothing;

-- Solo los dos roles que se derivan del rol global. La documentación no
-- especifica otros; se agregan cuando aparezca un caso real que los pida.
insert into roles_proyecto (nombre, descripcion) values
  ('lider',       'Responsable del proyecto. Gobierna alcance, miembros y etapas.'),
  ('colaborador', 'Participa en el proyecto sin gobernarlo.')
on conflict (nombre) do nothing;
