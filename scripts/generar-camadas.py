#!/usr/bin/env python3
"""Genera una página estática por camada en /camadas/<slug>.html.

Por qué: /camadas/<slug> se reescribe en vercel.json a camada-detalle.html, que
se rellena entero con JavaScript. El HTML que reciben Google y WhatsApp antes de
ejecutar el JS es idéntico para todas las camadas (mismo title, misma
description, canonical a /camadas y sin H1). Vercel sirve un archivo estático
antes que un rewrite, así que basta con dejar un HTML por camada: la URL no
cambia y el JS existente sigue funcionando igual.

Uso: python3 scripts/generar-camadas.py   (desde la raíz del repo)

Al añadir una camada nueva al array `const camadas` de camada-detalle.html,
vuelve a ejecutarlo para crear su página.
"""

import html
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, "camada-detalle.html")
DESTINO = os.path.join(RAIZ, "camadas")
BASE = "https://deterrajaras.es"
BOM = "﻿"


# --------------------------------------------------------------------------
# Lectura conservando BOM y saltos de línea
# --------------------------------------------------------------------------
def leer(path):
    crudo = open(path, "rb").read()
    bom = crudo.startswith(b"\xef\xbb\xbf")
    if bom:
        crudo = crudo[3:]
    crlf = b"\r\n" in crudo
    texto = crudo.decode("utf-8")
    if crlf:
        texto = texto.replace("\r\n", "\n")
    return texto, bom, crlf


def escribir(path, texto, bom, crlf):
    if crlf:
        texto = texto.replace("\n", "\r\n")
    datos = texto.encode("utf-8")
    if bom:
        datos = b"\xef\xbb\xbf" + datos
    open(path, "wb").write(datos)


# --------------------------------------------------------------------------
# Extracción del array `const camadas = [...]`
# --------------------------------------------------------------------------
def extraer_array(texto):
    """Devuelve el literal del array, delimitado contando corchetes fuera de cadenas."""
    marca = "const camadas = ["
    i = texto.find(marca)
    if i == -1:
        raise SystemExit(
            "ERROR: no se encuentra 'const camadas = [' en camada-detalle.html.\n"
            "Si el array se ha renombrado o movido, actualiza este script."
        )
    inicio = i + len(marca) - 1  # sobre el '['
    nivel = 0
    dentro = False
    escape = False
    for j in range(inicio, len(texto)):
        c = texto[j]
        if dentro:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                dentro = False
            continue
        if c == '"':
            dentro = True
        elif c in "[{":
            nivel += 1
        elif c in "]}":
            nivel -= 1
            if nivel == 0:
                return texto[inicio : j + 1]
    raise SystemExit("ERROR: el array 'const camadas' no está bien cerrado.")


def js_a_json(literal):
    """Convierte el literal JS (claves sin comillas) en JSON, respetando las cadenas."""
    salida = []
    k = 0
    dentro = False
    escape = False
    while k < len(literal):
        c = literal[k]
        if dentro:
            salida.append(c)
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                dentro = False
            k += 1
            continue
        if c == '"':
            dentro = True
            salida.append(c)
            k += 1
            continue
        m = re.match(r"([A-Za-z_$][\w$]*)(\s*):", literal[k:])
        if m:
            salida.append('"%s"%s:' % (m.group(1), m.group(2)))
            k += m.end()
            continue
        salida.append(c)
        k += 1
    texto = "".join(salida)
    texto = re.sub(r",(\s*[}\]])", r"\1", texto)  # comas finales
    try:
        return json.loads(texto)
    except json.JSONDecodeError as e:
        raise SystemExit(
            "ERROR: el array 'const camadas' no se ha podido interpretar como JSON.\n"
            "Puede que use comillas simples, plantillas (`) o comentarios dentro.\n"
            "Detalle: %s" % e
        )


# --------------------------------------------------------------------------
# Utilidades de texto
# --------------------------------------------------------------------------
def recortar(texto, limite=155):
    """Recorta a `limite` caracteres sin partir palabras."""
    texto = " ".join(texto.split())
    if len(texto) <= limite:
        return texto
    corte = texto[: limite + 1]
    espacio = corte.rfind(" ")
    if espacio == -1:
        return texto[:limite].rstrip()
    return corte[:espacio].rstrip(" ,;:.—-")


def atributo(valor):
    return html.escape(valor, quote=True)


def sustituir_una(texto, patron, reemplazo, que, slug):
    nuevo, n = re.subn(patron, lambda _: reemplazo, texto, count=1)
    if n != 1:
        raise SystemExit(
            "ERROR [%s]: no se ha encontrado %s en camada-detalle.html.\n"
            "La plantilla ha cambiado; revisa este script." % (slug, que)
        )
    return nuevo


# --------------------------------------------------------------------------
def construir(plantilla, c):
    slug = c["slug"]
    url = "%s/camadas/%s" % (BASE, slug)
    titulo = "%s | Deterrajaras" % c["nombre"]
    if len(titulo) > 60:
        titulo = "%s · %s | Deterrajaras" % (c["raza"], c.get("mesTexto", ""))
    descripcion = recortar(c["resumen"], 155)
    foto = c["fotoThumb"].lstrip("/")
    alt = (c.get("alts") or [c["nombre"]])[0]

    t = plantilla

    # Aviso de archivo generado
    t = t.replace(
        "<!DOCTYPE html>\n",
        "<!DOCTYPE html>\n<!-- ARCHIVO GENERADO por scripts/generar-camadas.py — "
        "no lo edites a mano: los cambios se pierden. Edita camada-detalle.html. -->\n",
        1,
    )

    # <title>
    t = sustituir_una(t, r"<title>.*?</title>",
                      "<title>%s</title>" % atributo(titulo), "el <title>", slug)

    # meta description
    t = sustituir_una(t, r'<meta name="description" content="[^"]*">',
                      '<meta name="description" content="%s">' % atributo(descripcion),
                      "la meta description", slug)

    # og:title / og:description / og:url: no existen en la plantilla, se añaden
    bloque = (
        '<meta name="description" content="%s">\n'
        '    <meta property="og:title" content="%s">\n'
        '    <meta property="og:description" content="%s">\n'
        '    <meta property="og:url" content="%s">'
        % (atributo(descripcion), atributo(titulo), atributo(descripcion), url)
    )
    t = sustituir_una(t, r'<meta name="description" content="[^"]*">', bloque,
                      "el hueco para las etiquetas og", slug)

    # og:image y twitter:image
    t = sustituir_una(t, r'<meta property="og:image" content="[^"]*">',
                      '<meta property="og:image" content="%s/%s">' % (BASE, foto),
                      "og:image", slug)
    t = sustituir_una(t, r'<meta name="twitter:image" content="[^"]*">',
                      '<meta name="twitter:image" content="%s/%s">' % (BASE, foto),
                      "twitter:image", slug)

    # canonical
    t = sustituir_una(t, r'<link rel="canonical" id="canonicalTag" href="[^"]*">',
                      '<link rel="canonical" id="canonicalTag" href="%s">' % url,
                      "el canonical", slug)

    # Contenido inicial: el JS lo sustituye entero al cargar, así que no hay doble H1.
    inicial = (
        '<div class="detalle-container" id="detalleContent">\n'
        '            <h1>%s</h1>\n'
        '            <p>%s</p>\n'
        '            <img src="/%s" alt="%s" loading="lazy">\n'
        '        </div>'
        % (html.escape(c["nombre"]), html.escape(c["resumen"]), foto, atributo(alt))
    )
    t = sustituir_una(t, r'<div class="detalle-container" id="detalleContent"></div>',
                      inicial, "el contenedor #detalleContent", slug)
    return t


def main():
    plantilla, bom, crlf = leer(ORIGEN)
    camadas = js_a_json(extraer_array(plantilla))
    os.makedirs(DESTINO, exist_ok=True)

    generadas = []
    for c in camadas:
        if not c.get("slug"):
            print("  · sin slug, se omite: %s" % c.get("nombre", "?"))
            continue
        for campo in ("nombre", "resumen", "fotoThumb", "raza"):
            if not c.get(campo):
                raise SystemExit("ERROR [%s]: falta el campo '%s'." % (c["slug"], campo))
        destino = os.path.join(DESTINO, c["slug"] + ".html")
        escribir(destino, construir(plantilla, c), bom, crlf)
        generadas.append(c["slug"])
        print("  · camadas/%s.html" % c["slug"])

    print("\n%d páginas generadas en camadas/." % len(generadas))
    return generadas


if __name__ == "__main__":
    main()
