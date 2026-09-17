-- Fase 04 — Registro de tiempo: se decide 100% inferido desde
-- sesiones_claude_code, sin captura manual (DECISIONES.md, pregunta abierta
-- 1: "si es inferido, aparece un candidato nuevo — derivar horas desde
-- sesiones_claude_code"). Ver scripts/derivar_registro_tiempo.py.
--
-- Dos cambios:
--   1. registro_tiempo pasa a ser una tabla de solo-sistema, igual que
--      commits o sesiones_claude_code: nadie la escribe a mano, la llena el
--      derivador con service_role. Las políticas de escritura de personas
--      (crear/editar/borrar "mi tiempo", con la ventana de 7 días) ya no
--      tienen sentido y se retiran. La lectura no cambia: transparencia total.
--   2. Constraint único para que el derivador pueda hacer upsert de forma
--      idempotente — cada corrida recalcula el total del día y lo reemplaza,
--      nunca lo duplica ni lo suma encima de una corrida anterior.

drop policy if exists crear_mi_tiempo  on registro_tiempo;
drop policy if exists editar_mi_tiempo on registro_tiempo;
drop policy if exists borrar_mi_tiempo on registro_tiempo;

alter table registro_tiempo
  add constraint registro_tiempo_unico
  unique (persona_id, proyecto_id, fecha, area);

comment on table registro_tiempo is
  'Solo-sistema: la llena scripts/derivar_registro_tiempo.py desde '
  'sesiones_claude_code, con service_role. Ningún usuario la escribe.';
