#!/usr/bin/env python3
"""
Genera el recorte propio de Font Awesome que usa toda la web.

Font Awesome desde cdnjs pesaba ~315 KB (CSS + tres fuentes) y en móvil con
red lenta retrasaba el primer pintado más de dos segundos. Este script:

  1. Busca en todos los archivos versionados los iconos que se usan (fa-*).
  2. Recorta el CSS de Font Awesome 6.5.0 a esas clases.
  3. Recorta las fuentes solid/regular/brands a esos glifos.
  4. Lo escribe en /fonts con un hash en el nombre (la carpeta se sirve con
     caché immutable de un año, así que cada versión necesita nombre nuevo).
  5. Sustituye en todas las páginas la referencia anterior por la nueva.

Si añades un icono nuevo a cualquier página y sale en blanco, vuelve a
ejecutarlo. Necesita fonttools y brotli:

    python3 -m venv /tmp/venv-iconos
    /tmp/venv-iconos/bin/pip install fonttools brotli
    /tmp/venv-iconos/bin/python scripts/generar-iconos.py
"""
import hashlib
import io
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

RAIZ = Path(__file__).resolve().parent.parent
FONTS = RAIZ / "fonts"
CDN = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0"
FUENTES = {  # sufijo propio -> (archivo original, familia, peso)
    "solid": ("fa-solid-900.woff2", "Font Awesome 6 Free", 900),
    "regular": ("fa-regular-400.woff2", "Font Awesome 6 Free", 400),
    "brands": ("fa-brands-400.woff2", "Font Awesome 6 Brands", 400),
}
# Clases de estilo que no son iconos y siempre hay que conservar.
BASE = {"fa", "fas", "far", "fab", "fa-solid", "fa-regular", "fa-brands", "fa-classic"}
REF_ICONOS = re.compile(rb"(?:https://cdnjs\.cloudflare\.com/ajax/libs/font-awesome/6\.5\.0/css/all\.min\.css|/fonts/iconos-[0-9a-f]{8}\.css)")
PRECONNECT = re.compile(rb'[ \t]*<link rel="preconnect" href="https://cdnjs\.cloudflare\.com" crossorigin>\r?\n')


def descargar(ruta):
    with urllib.request.urlopen(f"{CDN}/{ruta}") as r:
        return r.read()


def archivos_versionados():
    salida = subprocess.run(["git", "ls-files", "-z"], cwd=RAIZ, capture_output=True, check=True).stdout
    return [RAIZ / p.decode() for p in salida.split(b"\0") if p]


def iconos_usados(archivos):
    usados = set()
    for f in archivos:
        if f.suffix in {".html", ".js", ".mjs", ".py", ".json"} and f.name != "generar-iconos.py":
            usados |= set(re.findall(r"\bfa-[a-z0-9-]+", f.read_text(encoding="utf-8", errors="ignore")))
    return usados


def bloques(css):
    """Parte CSS minificado en (prelude, cuerpo) de primer nivel."""
    out, i = [], 0
    while i < len(css):
        a = css.find("{", i)
        if a < 0:
            break
        nivel, j = 1, a + 1
        while nivel:
            nivel += {"{": 1, "}": -1}.get(css[j], 0)
            j += 1
        out.append((css[i:a].strip(), css[a + 1:j - 1]))
        i = j
    return out


def selector_vale(sel, usados):
    clases = set(re.findall(r"\.(fa[a-z0-9-]*)", sel))
    return all(c in usados or c in BASE for c in clases)


def recortar_css(css, usados, codigos):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    salida = []
    for prelude, cuerpo in bloques(css):
        if prelude.startswith("@font-face"):
            continue
        if prelude.startswith("@keyframes"):
            if prelude.split()[1] in usados:
                salida.append(f"{prelude}{{{cuerpo}}}")
            continue
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            dentro = recortar_css(cuerpo, usados, codigos)
            if dentro:
                salida.append(f"{prelude}{{{dentro}}}")
            continue
        sels = [s for s in prelude.split(",") if selector_vale(s, usados)]
        if not sels:
            continue
        m = re.search(r'--fa:"\\([0-9a-f]+)"', cuerpo) or re.search(r'content:"\\([0-9a-f]+)"', cuerpo)
        if m and any(re.search(r"\.fa-[a-z0-9-]+", s) for s in sels):
            codigos.add(int(m.group(1), 16))
        salida.append(f"{','.join(sels)}{{{cuerpo}}}")
    return "".join(salida)


def recortar_fuente(datos, codigos):
    fuente = TTFont(io.BytesIO(datos))
    presentes = set(fuente.getBestCmap()) & codigos
    if not presentes:
        return None
    opciones = subset.Options()
    opciones.flavor = "woff2"
    opciones.layout_features = []
    opciones.name_IDs = ["*"]
    opciones.notdef_outline = True
    s = subset.Subsetter(opciones)
    s.populate(unicodes=sorted(presentes))
    s.subset(fuente)
    buf = io.BytesIO()
    fuente.flavor = "woff2"
    fuente.save(buf)
    return buf.getvalue()


def main():
    archivos = archivos_versionados()
    usados = iconos_usados(archivos)
    codigos = set()
    css = recortar_css(descargar("css/all.min.css").decode(), usados, codigos)

    fuentes = {}
    for sufijo, (original, familia, peso) in FUENTES.items():
        datos = recortar_fuente(descargar(f"webfonts/{original}"), codigos)
        if datos:
            fuentes[sufijo] = (datos, familia, peso)

    huella = hashlib.sha1(css.encode() + b"".join(d for d, _, _ in fuentes.values())).hexdigest()[:8]
    caras = "".join(
        f'@font-face{{font-family:"{familia}";font-style:normal;font-weight:{peso};font-display:swap;'
        f'src:url(iconos-{sufijo}-{huella}.woff2) format("woff2")}}'
        for sufijo, (_, familia, peso) in fuentes.items()
    )
    cabecera = "/* Font Awesome Free 6.5.0 recortado (scripts/generar-iconos.py) - fontawesome.com/license/free */\n"

    for viejo in FONTS.glob("iconos-*"):
        viejo.unlink()
    (FONTS / f"iconos-{huella}.css").write_text(cabecera + caras + css, encoding="utf-8")
    for sufijo, (datos, _, _) in fuentes.items():
        (FONTS / f"iconos-{sufijo}-{huella}.woff2").write_bytes(datos)

    nueva = f"/fonts/iconos-{huella}.css".encode()
    tocadas = 0
    for f in archivos:
        if f.suffix not in {".html", ".mjs", ".py"} or f.name == "generar-iconos.py":
            continue
        original = f.read_bytes()
        cambiado = PRECONNECT.sub(b"", REF_ICONOS.sub(nueva, original))
        if cambiado != original:
            f.write_bytes(cambiado)
            tocadas += 1

    total = len(cabecera + caras + css) + sum(len(d) for d, _, _ in fuentes.values())
    print(f"{len(usados)} clases fa-*, {len(codigos)} glifos, {total / 1024:.1f} KB en total")
    print(f"iconos-{huella}.css + {', '.join(fuentes)}; {tocadas} archivos actualizados")


if __name__ == "__main__":
    sys.exit(main())
