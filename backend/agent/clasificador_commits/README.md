# Clasificador de commits

Fase 06, parte 3 de 3. El único agente de este CRM que llama a Claude hasta
ahora — de los 16 analizados en `docs/agentes-crm-productividad-hello-minus.md`,
este es uno de los 5-6 que de verdad necesitan juicio de un LLM.

## Qué hace y qué no

- **`tipo_inferido`** (funcionalidad / arreglo / refactor / documentacion /
  configuracion / otro) — sale del LLM, leyendo el mensaje del commit. Esto sí
  necesita entender intención, no hay regla determinística razonable.
- **`area_inferida`** — sale de `scripts/inferir_area.py`, puramente
  determinístico (regla de STACK.md: el cálculo vive en scripts, el agente
  solo emite juicio con evidencia). `ejecutar.py` llama a los dos por separado
  y guarda ambos en la misma fila de `commits`.

## Archivos

| Archivo | Qué es |
|---|---|
| `modelos.py` | El esquema de salida, como modelo de Pydantic — no como `output_schema.json` suelto (ver el comentario del archivo para el porqué). |
| `system_prompt.md` | Las 6 categorías y cómo decidir entre ellas. |
| `cliente.py` | `clasificar_commits()` — un lote por llamada (hasta 50), valida que la respuesta tenga exactamente los shas que se le pidieron. |
| `ejecutar.py` | El orquestador: lee `commits` sin `tipo_inferido`, clasifica en lotes, calcula el área, actualiza. Un lote que falla no aborta la corrida — sigue con el próximo. |

## Probado

Contra la API real de Claude, con mensajes y archivos **reales de este mismo
repo** (no inventados): clasificó correctamente 6 commits — funcionalidad,
documentación (un revert), configuración (creación de la base) — y devolvió
exactamente los shas pedidos, ni de más ni de menos. La validación de
cobertura se probó también con una respuesta manipulada a mano.

El orquestador (`ejecutar.py`) se probó con una conexión Postgres falsa (no
hay Docker en esta máquina para un Postgres descartable, y Supabase estaba
desconectado esta sesión): confirma que arma los `UPDATE` con los parámetros
correctos, llamando al clasificador y al inferidor de área de verdad. **Falta
probarlo contra la base real** — pendiente de reconectar Supabase.

## Correr

```bash
pip install -r backend/agent/requirements.txt
DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=... \
  python -m clasificador_commits.ejecutar
```

(desde `backend/agent/`, para que el paquete se resuelva).

## Falta

- **No hay cron todavía.** `ejecutar.py` es el script que correría cada
  noche, pero no hay ningún disparador configurado — es infraestructura de
  despliegue, no se decidió dónde vive (¿Edge Function con `pg_cron`? ¿un
  cron real corriendo Python en algún servidor?).
- No se sembró `indicador_catalogo` con nada que dependa de `tipo_inferido` o
  `area_inferida` todavía — eso es el Motor de indicadores (Fase 07).
