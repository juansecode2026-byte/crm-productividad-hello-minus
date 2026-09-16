-- =============================================================================
-- 006_mas_repos_candidatos.sql — suma los 2 repos privados de Juan
-- =============================================================================
-- A diferencia de los 4 de 005_repos_candidatos.sql, estos dos son privados:
-- el lector público (backend/api/services/github.ts) no los va a poder leer
-- hasta que se configure GITHUB_TOKEN en el backend. Hasta entonces aparecen
-- en la lista con disponible=false.
-- =============================================================================

insert into repos_candidatos (owner, repo, notas) values
  ('juansecode2026-byte', 'calificacion-llamadas-calidad-callcenter', 'Privado — requiere GITHUB_TOKEN'),
  ('juansecode2026-byte', 'software-constructoras-inmobiliarias', 'Privado — requiere GITHUB_TOKEN')
on conflict (owner, repo) do nothing;
