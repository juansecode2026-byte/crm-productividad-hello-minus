-- =============================================================================
-- 005_repos_candidatos.sql — registro de repos por vincular
-- =============================================================================
-- La pantalla "Descubiertos en GitHub" del dashboard no lista TODO GitHub: lista
-- las filas de acá que todavía no tienen fila en `repositorios`. Es la lista de
-- vigilancia del admin, no un rastreo automático de cuentas enteras — eso queda
-- para cuando exista el lector de la API pública (candidato de DECISIONES.md).
--
-- Sembrado con los 4 repos elegidos el 2026-09-16: los 3 más activos de Gabriel
-- más crm-ventas, que además es compartido con Juan.
-- =============================================================================

create table repos_candidatos (
  id          uuid primary key default gen_random_uuid(),
  owner       text not null,
  repo        text not null,
  notas       text,
  agregado_en timestamptz not null default now(),
  constraint repo_candidato_unico unique (owner, repo)
);

alter table repos_candidatos enable row level security;

create policy leer_repos_candidatos on repos_candidatos
  for select to authenticated using (private.persona_actual() is not null);

create policy admin_repos_candidatos on repos_candidatos
  for all to authenticated using (private.es_admin()) with check (private.es_admin());

insert into repos_candidatos (owner, repo) values
  ('Monkeyotbz', 'hellominus.com'),
  ('Monkeyotbz', 'crm-ventas'),
  ('Monkeyotbz', 'turismocolombia-website'),
  ('Monkeyotbz', 'kairosplanner');
