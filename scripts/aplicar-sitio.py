#!/usr/bin/env python3
"""Pone la misma cabecera y el mismo pie en todas las páginas de la web.

Las piezas vivas están en assets/sitio/ (cabecera.part, pie.part, sitio.css) y
en assets/sitio.js. Este script las incrusta en cada .html entre marcas HTML,
de modo que volver a ejecutarlo actualiza el marcado sin duplicar nada.

    python3 scripts/aplicar-sitio.py           # aplica los cambios
    python3 scripts/aplicar-sitio.py --dry     # solo dice qué cambiaría

De paso quita lo que sustituye: el menú antiguo (#navbar y .mobile-menu), el
pie antiguo, el botón flotante antiguo, su CSS y su JavaScript.
"""
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SECO = '--dry' in sys.argv

# ── Selectores del menú y el pie antiguos: su CSS sobra una vez sustituidos ──
VIEJOS = re.compile(
    r'^(footer\b|#navbar\b|\.nav-inner\b|\.nav-logo\b|\.nav-links\b|\.nav-camadas\b'
    r'|\.nav-tienda\b|\.nav-dropdown\b|\.nav-has-dropdown\b|\.nav-active\b|\.mobile-menu\b'
    r'|\.mobile-close\b|\.mobile-tienda\b|\.mobile-wa\b|\.hamburger\b|\.float-wa\b'
    r'|\.footer-[\w-]*\b|\.f-logo\b|\.f-socials\b|\.f-soc\b|\.f-legal\b)'
)


def paginas():
    salida = subprocess.run(['git', 'ls-files', '-z', '*.html'],
                            cwd=RAIZ, capture_output=True, check=True).stdout
    for nombre in salida.split(b'\0'):
        if nombre and b'googlee' not in nombre:
            yield RAIZ / nombre.decode()


def leer(ruta):
    crudo = ruta.read_bytes()
    bom = crudo.startswith(b'\xef\xbb\xbf')
    texto = crudo.decode('utf-8-sig')
    crlf = '\r\n' in texto
    return texto.replace('\r\n', '\n'), bom, crlf


def escribir(ruta, texto, bom, crlf):
    if crlf:
        texto = texto.replace('\n', '\r\n')
    datos = texto.encode('utf-8')
    if bom:
        datos = b'\xef\xbb\xbf' + datos
    ruta.write_bytes(datos)


def entre_marcas(texto, marca, contenido):
    """Mete (o actualiza) un bloque entre <!-- marca --> y <!-- /marca -->."""
    bloque = f'<!-- {marca} -->\n{contenido.strip()}\n<!-- /{marca} -->'
    patron = re.compile(rf'<!-- {marca} -->.*?<!-- /{marca} -->', re.S)
    if patron.search(texto):
        return patron.sub(lambda _: bloque, texto, count=1), bloque
    return texto, bloque


def cierre(texto, inicio, etiqueta):
    """Devuelve el final de la etiqueta que abre en `inicio`, contando anidadas."""
    abre = re.compile(rf'<{etiqueta}\b', re.I)
    cierra = re.compile(rf'</{etiqueta}>', re.I)
    nivel = 0
    i = inicio
    while i < len(texto):
        a = abre.search(texto, i)
        c = cierra.search(texto, i)
        if not c:
            raise ValueError(f'no se cierra <{etiqueta}>')
        if a and a.start() < c.start():
            nivel += 1
            i = a.end()
        else:
            nivel -= 1
            i = c.end()
            if nivel == 0:
                return i
    raise ValueError(f'no se cierra <{etiqueta}>')


def bloques_css(css):
    """Parte una hoja de estilo en trozos (prefacio, cuerpo, texto completo)."""
    trozos = []
    i = 0
    n = len(css)
    while i < n:
        llave = css.find('{', i)
        if llave < 0:
            trozos.append((None, None, css[i:]))
            break
        prefacio = css[i:llave]
        nivel = 1
        j = llave + 1
        while j < n and nivel:
            if css[j] == '{':
                nivel += 1
            elif css[j] == '}':
                nivel -= 1
            j += 1
        trozos.append((prefacio, css[llave + 1:j - 1], css[i:j]))
        i = j
    return trozos


def podar_css(css):
    """Quita las reglas del menú y el pie antiguos, también dentro de @media."""
    fuera = []
    for prefacio, cuerpo, entero in bloques_css(css):
        if prefacio is None:
            fuera.append(entero)
            continue
        limpio = sin_comentarios(prefacio)
        if limpio.startswith('@media') or limpio.startswith('@supports'):
            dentro = podar_css(cuerpo)
            if dentro.strip():
                fuera.append(prefacio + '{' + dentro + '}')
            continue
        if limpio.startswith('@'):
            fuera.append(entero)
            continue
        selectores = [s.strip() for s in re.split(r',(?![^(]*\))', limpio) if s.strip()]
        quedan = [s for s in selectores if not VIEJOS.match(s)]
        if not quedan:
            continue
        if len(quedan) != len(selectores):
            fuera.append(', '.join(quedan) + '{' + cuerpo + '}')
            continue
        fuera.append(entero)
    return ''.join(fuera)


def sin_comentarios(prefacio):
    return ' '.join(re.sub(r'/\*.*?\*/', ' ', prefacio, flags=re.S).split())


def reglas_de(css, contexto=''):
    """Devuelve {(contexto, selectores normalizados): declaraciones} de una hoja."""
    fuera = {}
    for prefacio, cuerpo, _ in bloques_css(css):
        if prefacio is None:
            continue
        limpio = sin_comentarios(prefacio)
        if limpio.startswith('@media') or limpio.startswith('@supports'):
            fuera.update(reglas_de(cuerpo, limpio))
        elif not limpio.startswith('@'):
            fuera[(contexto, limpio)] = ' '.join(cuerpo.split())
    return fuera


def podar_duplicados(css, comunes, contexto=''):
    """Quita de la portada las reglas que ya trae la hoja común, tal cual."""
    fuera = []
    for prefacio, cuerpo, entero in bloques_css(css):
        if prefacio is None:
            fuera.append(entero)
            continue
        limpio = sin_comentarios(prefacio)
        if limpio.startswith('@media') or limpio.startswith('@supports'):
            dentro = podar_duplicados(cuerpo, comunes, limpio)
            if dentro.strip():
                fuera.append(prefacio + '{' + dentro + '}')
            continue
        if comunes.get((contexto, limpio)) == ' '.join(cuerpo.split()):
            continue
        fuera.append(entero)
    return ''.join(fuera)


def fin_de_llamada(js, par):
    """Desde el paréntesis que abre la llamada, devuelve dónde acaba la sentencia."""
    if par < 0 or js[par] != '(':
        return -1
    nivel = 0
    j = par
    while j < len(js):
        c = js[j]
        if c in '([{':
            nivel += 1
        elif c in ')]}':
            nivel -= 1
            if nivel == 0:
                j += 1
                while j < len(js) and js[j] in ' \t':
                    j += 1
                if j < len(js) and js[j] == ';':
                    j += 1
                return j
        elif c in '"\'`':
            j += 1
            while j < len(js) and js[j] != c:
                j += 2 if js[j] == '\\' else 1
        j += 1
    return -1


def fin_de_bloque(js, i):
    """Igual, pero para una declaración de función: hasta su llave de cierre."""
    llave = js.find('{', i)
    if llave < 0:
        return -1
    nivel = 0
    for j in range(llave, len(js)):
        if js[j] == '{':
            nivel += 1
        elif js[j] == '}':
            nivel -= 1
            if nivel == 0:
                return j + 1
    return -1


ANCLAS = [
    (r"(?:const|var|let)\s+(?:navbar|hamburger|mobileMenu|mobileClose)\s*=\s*document\.getElementById\('(?:navbar|hamburger|mobileMenu|mobileClose)'\);", None),
    (r"(?:document\.getElementById\('(?:hamburger|mobileClose|mobileMenu)'\)|hamburger|mobileClose|mobileMenu)\.addEventListener\(", 'llamada'),
    (r"function\s+closeMobile\s*\(\)\s*\{", 'bloque'),
]


PROPIOS = {
    'test-raza.html': ('/assets/test-raza.js',),
    'camadas.html': ('/assets/camadas-lista.js',),
}

# Bloques <script> que ya no tienen que ir dentro del HTML: el acordeón de
# preguntas lo lleva assets/sitio.js, el test y los vídeos de camadas tienen
# su propio archivo, y /index.html lo redirige vercel.json.
MUDADOS = (
    re.compile(r"document\.querySelectorAll\('\.faq-(?:q|btn)'\)"),
    re.compile(r'URL CLEANER'),
    re.compile(r'const cards = document\.querySelectorAll\(\x27\.video-card\x27\)'),
    re.compile(r'SCORING TABLE'),
)


def quitar_js_mudado(texto):
    """Quita el JavaScript que ahora vive en assets/ (y los <script> vacíos)."""
    def limpia(m):
        js = m.group(1)
        if any(p.search(js) for p in MUDADOS) or not js.strip():
            return ''
        return m.group(0)
    texto = re.sub(r'<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>(.*?)</script>\s*',
                   limpia, texto, flags=re.S)
    # <noscript> que se quedó sin contenido al quitar la hoja de iconos
    return re.sub(r'[ \t]*<noscript>\s*</noscript>\n?', '', texto)


def quitar_js_viejo(texto):
    """Borra el JavaScript que manejaba el menú antiguo."""
    def limpia(m):
        js = original = m.group(1)
        cambios = True
        while cambios:
            cambios = False
            # el scroll que solo servía para la sombra del menú antiguo
            for s in re.finditer(r"window\.addEventListener\(\s*'scroll'", js):
                fin = fin_de_llamada(js, js.index('(', s.start()))
                if fin > 0 and 'navbar' in js[s.start():fin]:
                    js = js[:s.start()] + js[fin:]
                    cambios = True
                    break
            if cambios:
                continue
            for patron, modo in ANCLAS:
                s = re.search(patron, js)
                if not s:
                    continue
                fin = s.end() if modo is None else (
                    fin_de_llamada(js, s.end() - 1) if modo == 'llamada' else fin_de_bloque(js, s.start()))
                if fin > 0:
                    js = js[:s.start()] + js[fin:]
                    cambios = True
                    break
        if js == original:
            return m.group(0)
        js = re.sub(r'//\s*(?:──\s*)?(?:NAVBAR(?:\s+SCROLL)?|MOBILE MENU)\s*(?:──)?[ \t]*\n', '', js)
        js = re.sub(r'\n[ \t]*\n[ \t]*\n+', '\n\n', js)
        if not js.strip():
            return ''
        return m.group(0).replace(original, js)
    return re.sub(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>\s*', limpia, texto, flags=re.S)


ALTO_CABECERA = 72      # lo que mide la cabecera, que ya ocupa su sitio
MINIMO_ARRIBA = 24      # aire mínimo entre la cabecera y el contenido


def menos_cabecera(valor):
    return f'{max(valor - ALTO_CABECERA, MINIMO_ARRIBA)}px'


def ajusta_declaraciones(cuerpo):
    """Baja el hueco que el contenido reservaba para la cabecera fija."""
    def padding(m):
        arriba = int(m.group(2))
        if arriba < 70:
            return m.group(0)
        return m.group(1) + menos_cabecera(arriba) + m.group(3)

    def margen(m):
        arriba = int(m.group(2))
        if not 60 <= arriba <= 110:
            return m.group(0)
        return m.group(1) + '0' + m.group(3)

    cuerpo = re.sub(r'(padding-top:\s*)(\d+)px(\s*(?:;|$|}))', padding, cuerpo)
    cuerpo = re.sub(r'(padding:\s*)(\d+)px( [^;}]*(?:;|$|}))', padding, cuerpo)
    cuerpo = re.sub(r'(margin-top:\s*)(\d+)px(\s*(?:;|$|}))', margen, cuerpo)
    return cuerpo


def ajustar_arranque(texto):
    """El contenido ya no esquiva una cabecera fija: le sobra el hueco de arriba."""
    main = re.search(r'<main\b([^>]*)>', texto)
    if not main:
        return texto
    selectores = set()
    clase = re.search(r'class="([^"]+)"', main.group(1))
    if clase:
        selectores.add('.' + clase.group(1).split()[0])

    # primer elemento dentro de <main>, saltando comentarios
    resto = texto[main.end():]
    hijo = re.search(r'\s*(?:<!--.*?-->\s*)*<(\w+)([^>]*)>', resto, re.S)
    if hijo:
        cl = re.search(r'class="([^"]+)"', hijo.group(2))
        if cl:
            selectores.add('.' + cl.group(1).split()[0])
        estilo = re.search(r'style="([^"]*)"', hijo.group(2))
        if estilo and not cl:
            nuevo_estilo = ajusta_declaraciones(estilo.group(1))
            if nuevo_estilo != estilo.group(1):
                inicio = main.end() + hijo.start()
                etiqueta = hijo.group(0).replace(
                    f'style="{estilo.group(1)}"', f'style="{nuevo_estilo}"')
                texto = texto[:inicio] + etiqueta + texto[main.end() + hijo.end():]

    if not selectores:
        return texto

    def en_hoja(css):
        fuera = []
        for prefacio, cuerpo, entero in bloques_css(css):
            if prefacio is None:
                fuera.append(entero)
                continue
            limpio = sin_comentarios(prefacio)
            if limpio.startswith('@media') or limpio.startswith('@supports'):
                fuera.append(prefacio + '{' + en_hoja(cuerpo) + '}')
                continue
            partes = {s.strip() for s in limpio.split(',')}
            if partes & selectores and not limpio.startswith('@'):
                fuera.append(prefacio + '{' + ajusta_declaraciones(cuerpo) + '}')
                continue
            fuera.append(entero)
        return ''.join(fuera)

    return re.sub(r'(<style[^>]*>)(.*?)(</style>)',
                  lambda m: m.group(1) + en_hoja(m.group(2)) + m.group(3),
                  texto, flags=re.S)


def main():
    cabecera = (RAIZ / 'assets/sitio/cabecera.part').read_text(encoding='utf-8')
    pie = (RAIZ / 'assets/sitio/pie.part').read_text(encoding='utf-8')
    hoja = (RAIZ / 'assets/sitio/sitio.css').read_text(encoding='utf-8')

    for ruta in paginas():
        rel = ruta.relative_to(RAIZ).as_posix()
        texto, bom, crlf = leer(ruta)
        original = texto
        portada = rel == 'index.html'
        raiz = '' if portada else '/'

        # ── 1. Cabecera ──
        nuevo_hd = cabecera.replace('{{R}}', raiz)
        texto, bloque = entre_marcas(texto, 'sitio:cabecera', nuevo_hd)
        if bloque not in texto:
            ini = texto.index('>', texto.index('<body')) + 1
            if portada:
                fin = texto.index('<main id="contenido">')
            else:
                fin = cierre(texto, texto.index('<nav id="navbar"'), 'nav')
            texto = texto[:ini] + '\n' + bloque + '\n\n' + texto[fin:].lstrip('\n')

        # ── 2. Pie ──
        nuevo_ft = pie.replace('{{R}}', raiz)
        texto, bloque = entre_marcas(texto, 'sitio:pie', nuevo_ft)
        if bloque not in texto:
            ini = texto.index('<footer')
            fin = cierre(texto, ini, 'footer')
            texto = texto[:ini] + bloque + texto[fin:]

        # ── 3. Lo que sustituye el pie: botón flotante antiguo ──
        texto = re.sub(r'\s*<!--\s*(?:FLOATING\s+)?WHATSAPP\s+FLOTANTE\s*-->', '', texto, flags=re.I)
        texto = re.sub(r'\s*<a [^>]*class="float-wa"[^>]*>.*?</a>', '', texto, flags=re.S)

        # ── 4. JavaScript: el del menú antiguo y el que ya vive en assets/ ──
        texto = quitar_js_viejo(texto)
        texto = quitar_js_mudado(texto)

        # ── 5. El contenido ya no esquiva una cabecera fija ──
        if not portada:
            texto = ajustar_arranque(texto)

        # ── 6. CSS del menú y el pie antiguos ──
        def poda(m):
            return m.group(1) + podar_css(m.group(2)) + m.group(3)
        texto = re.sub(r'(<style[^>]*>)(.*?)(</style>)', poda, texto, flags=re.S)

        # ── 7. Playfair es variable: un archivo cubre de 400 a 900 ──
        texto = re.sub(
            r"(@font-face \{font-family: 'Playfair Display';font-style: normal;font-weight: )700(;)",
            r"\g<1>400 900\g<2>", texto)

        # ── 8. La portada no repite las reglas que ya están en la hoja común ──
        if portada:
            comunes = reglas_de(hoja)
            texto = re.sub(r'(<style[^>]*>)(.*?)(</style>)',
                           lambda m: m.group(1) + podar_duplicados(m.group(2), comunes) + m.group(3),
                           texto, flags=re.S)

        # ── 9. Hoja común al final del <head> y guion común al final del <body> ──
        texto, bloque = entre_marcas(texto, 'sitio:css', f'<style>\n{hoja.strip()}\n</style>')
        if bloque not in texto:
            texto = texto.replace('</head>', bloque + '\n</head>', 1)
        for guion in ('/assets/sitio.js', '/assets/cookies.js') + PROPIOS.get(rel, ()):
            if guion not in texto:
                texto = texto.replace(
                    '</body>', f'<script src="{guion}" defer></script>\n</body>', 1)

        if texto != original:
            print(f'  {rel}: {len(original):>7} → {len(texto):>7} bytes')
            if not SECO:
                escribir(ruta, texto, bom, crlf)


if __name__ == '__main__':
    main()
