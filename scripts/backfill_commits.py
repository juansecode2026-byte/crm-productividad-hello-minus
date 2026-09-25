"""Canal 1 (GitHub) — backfill del historial de commits, anotado como
pendiente en CLAUDE.md desde que se construyó el receptor: el webhook solo
captura push a partir del momento en que un repo se vincula, así que todo lo
anterior a esa fecha nunca llega. Esto llena ese hueco, una vez por repo.

No es parte de la cadena nocturna — es una herramienta manual, se corre
cuando hace falta (recién vinculado un repo con historia previa). Por eso no
calcula `tipo_inferido` ni `area_inferida`: los deja NULL, igual que hace el
webhook (`eventos.ts`), y el Clasificador de commits los llena en su próxima
corrida — la misma cola, sin caso especial para "commit viejo" vs. "commit
nuevo".

Determinístico, sin Claude: por eso vive en scripts/ y no en backend/agent/.

Solo habla con GitHub — no escribe en Supabase. DATABASE_URL no vive en
ningún .env local (es secreto de GitHub Actions) y pedir la service_role acá
hubiera significado ponerla en un archivo nuevo solo para esto. En vez de
eso, el script deja las filas listas en un JSON; quien lo corrió las inserta
con el cliente que ya tenga a mano (el MCP de Supabase, psql, lo que sea).

Uso:
    python scripts/backfill_commits.py --env-file backend/api/.env \\
        --repo dueno/nombre --repo-id <uuid> --personas personas.json \\
        --salida commits_backfill.json

    # personas.json: [{"id": "...", "github_username": "...", "email": "..."}, ...]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

LIMITE_POR_DEFECTO = 300
POR_PAGINA = 100


# --------------------------------------------------------------------------
# .env mínimo: el propio proceso lo lee, nunca pasa por el asistente. Mismo
# principio que --env-file-if-exists de tsx, en Python no hay equivalente
# nativo.
# --------------------------------------------------------------------------
def cargar_env_file(ruta: Path) -> None:
    if not ruta.exists():
        return
    import os

    # Dos pasadas: primero se arma el mapa del archivo completo (si una clave
    # se repite, la última línea gana — mismo criterio que cualquier .env real
    # o un `source` de shell); recién después se vuelca a os.environ, y ahí sí
    # una variable que ya viniera puesta en el proceso no se pisa.
    del_archivo: dict[str, str] = {}
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, _, valor = linea.partition("=")
        clave = clave.strip()
        if clave:
            del_archivo[clave] = valor.strip()

    for clave, valor in del_archivo.items():
        if clave not in os.environ:
            os.environ[clave] = valor


def _peticion_github(url: str, token: str):
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "hello-minus-backfill",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def verificar_rate_limit(token: str) -> int:
    datos = _peticion_github("https://api.github.com/rate_limit", token)
    return datos["resources"]["core"]["remaining"]


def listar_commits_github(owner: str, repo: str, token: str, limite: int) -> list[dict]:
    """Historial del branch por defecto, más nuevo primero (orden de la API).
    Pagina hasta juntar `limite` o hasta que la API deje de dar resultados —
    un repo real puede tener miles; el tope evita una corrida descontrolada.
    """
    commits: list[dict] = []
    pagina = 1
    while len(commits) < limite:
        url = f"https://api.github.com/repos/{owner}/{repo}/commits?per_page={POR_PAGINA}&page={pagina}"
        try:
            lote = _peticion_github(url, token)
        except urllib.error.HTTPError as error:
            if error.code == 409:  # repo vacío, sin commits todavía
                break
            raise
        if not lote:
            break
        commits.extend(lote)
        if len(lote) < POR_PAGINA:
            break
        pagina += 1
    return commits[:limite]


def archivos_de_commit(owner: str, repo: str, sha: str, token: str) -> list[str] | None:
    """Un solo commit trae `files` (la lista de commits no). Ruta cara —
    un llamado por commit— pero es lo único que le da a `inferir_area` con
    qué trabajar; sin esto, cada commit del backfill quedaría sin área para
    siempre, igual que un push sin payload de archivos.
    """
    url = f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}"
    try:
        datos = _peticion_github(url, token)
    except urllib.error.HTTPError:
        return None
    return [f["filename"] for f in datos.get("files", [])]


# --------------------------------------------------------------------------
# Atribución — mismo criterio que backend/functions/github-webhook/eventos.ts
# (atribuidor): usuario de GitHub primero, email como respaldo, sin distinguir
# mayúsculas en ninguno de los dos.
# --------------------------------------------------------------------------
def construir_atribuidor(personas: list[dict]):
    por_usuario = {p["github_username"].lower(): p["id"] for p in personas if p.get("github_username")}
    por_email = {p["email"].lower(): p["id"] for p in personas if p.get("email")}

    def atribuir(usuario: str | None, email: str | None) -> str | None:
        if usuario and usuario.lower() in por_usuario:
            return por_usuario[usuario.lower()]
        if email and email.lower() in por_email:
            return por_email[email.lower()]
        return None

    return atribuir


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", default="backend/api/.env", help="Dónde leer GITHUB_TOKEN")
    parser.add_argument("--repo", required=True, help="dueno/nombre")
    parser.add_argument("--repo-id", required=True, help="uuid de repositorios.id")
    parser.add_argument("--personas", required=True, help="JSON con [{id, github_username, email}, ...]")
    parser.add_argument("--salida", required=True, help="Dónde escribir las filas listas para insertar")
    parser.add_argument("--limite", type=int, default=LIMITE_POR_DEFECTO, help="Tope de commits a traer")
    args = parser.parse_args()

    cargar_env_file(Path(args.env_file))

    import os

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print(f"Falta GITHUB_TOKEN en {args.env_file}.", file=sys.stderr)
        sys.exit(1)

    restantes = verificar_rate_limit(token)
    print(f"Límite de GitHub: {restantes} peticiones restantes esta hora.")
    if restantes < 200:
        print("Muy poco margen para un backfill — probá de nuevo más tarde.", file=sys.stderr)
        sys.exit(1)

    personas = json.loads(Path(args.personas).read_text(encoding="utf-8"))
    atribuir = construir_atribuidor(personas)

    owner, nombre = args.repo.split("/", 1)
    encontrados = listar_commits_github(owner, nombre, token, args.limite)

    filas: list[dict] = []
    sin_atribuir = 0
    sin_archivos = 0
    for commit in encontrados:
        sha = commit["sha"]
        autor_commit = commit.get("commit", {}).get("author", {}) or {}
        autor_cuenta = commit.get("author") or {}  # puede venir null: cuenta borrada, o email sin cuenta de GitHub
        persona_id = atribuir(autor_cuenta.get("login"), autor_commit.get("email"))
        if persona_id is None:
            sin_atribuir += 1

        archivos = archivos_de_commit(owner, nombre, sha, token)
        if archivos is None:
            sin_archivos += 1
            archivos = []

        filas.append(
            {
                "repo_id": args.repo_id,
                "sha": sha,
                "mensaje": commit.get("commit", {}).get("message"),
                "archivos_tocados": archivos,
                "fecha": autor_commit.get("date"),
                "persona_id": persona_id,
            }
        )
        # GitHub deja margen de sobra con token (5000/h), pero un repo grande
        # puede sumar cientos de llamados de archivos_de_commit seguidos —
        # una pausa chica evita ráfagas que algún proxy intermedio recorte.
        if len(filas) % 50 == 0:
            time.sleep(0.5)

    Path(args.salida).write_text(json.dumps(filas, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"{args.repo}: {len(encontrados)} en GitHub · {len(filas)} listos en {args.salida} · "
        f"{sin_atribuir} sin persona · {sin_archivos} sin lista de archivos"
    )


if __name__ == "__main__":
    main()
