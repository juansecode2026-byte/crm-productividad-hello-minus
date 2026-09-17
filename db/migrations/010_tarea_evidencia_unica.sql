-- Fase 03 — Detector de rastro semanal (scripts/detectar_rastro_semanal.py).
-- Constraint único para que el detector pueda correr todos los sábados sin
-- duplicar evidencia ya encontrada: la misma referencia (sha de commit,
-- número de PR, session_id) para la misma tarea y área es la misma prueba,
-- sin importar cuántas veces se vuelva a detectar.
alter table tarea_evidencia
  add constraint tarea_evidencia_unica
  unique (tarea_id, area, fuente, referencia);
