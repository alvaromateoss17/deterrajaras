# -*- coding: utf-8 -*-
"""Genera las paginas de categoria del blog en /blog/categoria/<slug>.html
Reutiliza el CSS y el chrome (nav, footer, script) de blog.html para no duplicar diseno.
Ejecutar desde la raiz del repo:  python tools_gen_categorias.py
"""
import io, os, re

SITE = "https://deterrajaras.es"

# ---------------------------------------------------------------- datos
# Los 8 articulos del blog, del mas reciente al mas antiguo.
POSTS = [
    dict(slug="ensenar-cachorro-hacer-sus-necesidades", cat="Consejos para nuevos dueños",
         nuevo=True, fecha="21 de julio de 2026",
         titulo="Cómo enseñar a un cachorro a hacer sus necesidades",
         extracto="Cuánto aguanta un cachorro según su edad, la rutina que funciona y por qué un Caniche Toy o un Schnauzer Mini tardan más en aprender."),
    dict(slug="golpe-de-calor-perros-pequenos", cat="Cuidados y salud",
         nuevo=True, fecha="6 de julio de 2026",
         titulo="Golpe de calor en perros pequeños: síntomas y primeros auxilios",
         extracto="El golpe de calor mata en minutos y es la urgencia veterinaria más frecuente del verano. Aprende a reconocer los síntomas, aplicar los primeros auxilios correctos y prevenirlo en tu Caniche Toy o Schnauzer Miniatura."),
    dict(slug="perros-hipoalergenicos-peque%C3%B1os", cat="Razas",
         nuevo=True, fecha="28 de junio de 2026",
         titulo="Perros hipoalergénicos pequeños: las mejores razas para alérgicos",
         extracto="¿Tienes alergia pero quieres un perro? Te explicamos qué razas pequeñas sueltan menos pelo y producen menos alérgenos, y por qué el Caniche Toy y el Schnauzer Mini destacan. Con la verdad sobre los perros hipoalergénicos."),
    dict(slug="seguro-obligatorio-perros-2026", cat="Ley y documentación",
         nuevo=True, fecha="15 de junio de 2026",
         titulo="Seguro obligatorio para perros 2026: ¿ya es obligatorio?",
         extracto="¿Es obligatorio el seguro para perros en 2026? Te explicamos qué dice la Ley de Bienestar Animal, el reglamento pendiente, multas y la documentación que debe darte un criadero legal."),
    dict(slug="cuanto-cuesta-caniche-toy", cat="Compra de Cachorros",
         nuevo=True, fecha="9 de junio de 2026",
         titulo="¿Cuánto cuesta un Caniche Toy en España? Guía 2026",
         extracto="Rango de precios, factores que influyen en el coste, diferencias entre criadores responsables y opciones más económicas. Todo lo que debes saber antes de comprar."),
    dict(slug="schnauzer-miniatura-pierde-pelo", cat="Cuidados y salud",
         nuevo=True, fecha="9 de junio de 2026",
         titulo="¿Pierde pelo el Schnauzer Miniatura? Todo lo que debes saber",
         extracto="Descubre cómo es el manto del Schnauzer Miniatura, la diferencia entre mudanza y pérdida de pelo, cuidados de peluquería profesional y si es apto para personas con alergias."),
    dict(slug="alimentacion-cachorro-pienso", cat="Cuidados y salud",
         nuevo=False, fecha="29 de mayo de 2026",
         titulo="Alimentación del cachorro: qué pienso elegir y por qué",
         extracto="Todo lo que necesitas saber para elegir la alimentación más adecuada para tu nuevo compañero: cómo leer una etiqueta, cuántas veces al día comer, qué alimentos son tóxicos y cuándo cambiar al pienso de adulto."),
    dict(slug="como-comprar-un-cachorro", cat="Consejos para nuevos dueños",
         nuevo=False, fecha="26 de mayo de 2026",
         titulo="¿Estás pensando en un nuevo miembro para la familia?",
         extracto="Guía completa para comprar un cachorro en España: cómo elegir criadero, documentación obligatoria, primeros cuidados y señales de alarma que nunca debes ignorar."),
]

# Categorias: slug de URL, H1, intro propia (texto unico, no duplicado) y meta description.
CATS = [
    dict(nombre="Cuidados y salud", slug="cuidados-y-salud",
         h1="Cuidados y salud del cachorro",
         desc="Guías de cuidados y salud para Caniche Toy y Schnauzer Mini: alimentación, golpe de calor, pelaje y prevención. Criadero Deterrajaras, Cáceres.",
         intro="Todo lo que necesitas para mantener sano a un perro de raza pequeña: qué darle de comer en cada etapa, cómo actuar ante una urgencia de verano y qué cuidados de pelaje necesita cada raza. Son los artículos que más nos preguntan las familias durante el primer año."),
    dict(nombre="Consejos para nuevos dueños", slug="consejos-para-nuevos-duenos",
         h1="Consejos para nuevos dueños",
         desc="Primeros días con un cachorro en casa: rutinas, higiene, qué documentación exigir y cómo elegir criadero. Guías del criadero Deterrajaras en Cáceres.",
         intro="Si acabas de llegar a casa con un cachorro, o estás a punto de hacerlo, esta es tu sección. Rutinas de los primeros días, aprendizaje de higiene y todo lo que conviene tener resuelto antes de que el cachorro cruce la puerta."),
    dict(nombre="Compra de Cachorros", slug="compra-de-cachorros",
         h1="Compra de cachorros",
         desc="Precios, criaderos responsables y qué mirar antes de comprar un cachorro de Caniche Toy o Schnauzer Mini en España.",
         intro="Cuánto cuesta realmente un cachorro de raza pequeña, qué diferencia a un criadero responsable de una fábrica de cachorros y en qué fijarte antes de dejar una señal."),
    dict(nombre="Razas", slug="razas",
         h1="Razas de perro pequeñas",
         desc="Comparativas y características de razas pequeñas: Caniche Toy, Schnauzer Mini y perros hipoalergénicos. Criadero Deterrajaras, Cáceres.",
         intro="Carácter, tamaño, necesidades y convivencia de las razas pequeñas con las que trabajamos, además de comparativas para ayudarte a elegir la que encaja con tu familia."),
    dict(nombre="Ley y documentación", slug="ley-y-documentacion",
         h1="Ley y documentación",
         desc="Ley de Bienestar Animal, seguro obligatorio y documentación que debe entregarte un criadero legal en España.",
         intro="Qué obliga la normativa española a un propietario y a un criadero: seguros, registros, microchip y los papeles que siempre debes recibir con tu cachorro."),
]

# ------------------------------------------------------- extraer de blog.html
src = io.open("blog.html", encoding="utf-8").read()

head_css = src[src.index('    <link rel="preconnect"'): src.index("    </style>")]
body_top = src[src.index("<body>"): src.index('<main id="contenido">')]
footer = src[src.index("<footer>"): src.index("</html>") + len("</html>")]

# El chrome de blog.html usa rutas relativas ("blog", "camadas"). Desde
# /blog/categoria/x esas rutas se romperian, asi que las pasamos a absolutas.
REL2ABS = [
    ('href="caniche-toy"', 'href="/caniche-toy"'),
    ('href="schnauzer-mini"', 'href="/schnauzer-mini"'),
    ('href="blog"', 'href="/blog"'),
    ('href="camadas"', 'href="/camadas"'),
    ('href="aviso-legal"', 'href="/aviso-legal"'),
    ('href="politica-privacidad"', 'href="/politica-privacidad"'),
]
for a, b in REL2ABS:
    body_top = body_top.replace(a, b)
    footer = footer.replace(a, b)

# CSS propio de la pagina de categoria (breadcrumb + cabecera).
EXTRA_CSS = """
/* BREADCRUMB DE CATEGORIA */
.cat-breadcrumb { background: #fff; border-bottom: 1px solid var(--color-borde); padding: 14px 0; margin-top: 74px; }
.cat-breadcrumb-inner { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--color-texto-suave); flex-wrap: wrap; }
.cat-breadcrumb-inner a { color: var(--color-texto-suave); transition: var(--tr); }
.cat-breadcrumb-inner a:hover { color: var(--color-cta-principal); }
.cat-breadcrumb-inner .sep { opacity: 0.4; }
.cat-breadcrumb-inner .current { color: var(--color-texto); font-weight: 600; }
.blog-hero.is-cat { padding-top: 46px; }
.blog-hero.is-cat h1 { margin-bottom: 14px; }
.cat-empty { background: #fff; border: 1px solid var(--color-borde); border-radius: var(--radius); padding: 32px; text-align: center; color: var(--color-texto-suave); }
"""


def card(p):
    """Tarjeta de articulo, con el mismo markup que el grid de blog.html."""
    badge = '\n                                <span class="card-new">Nuevo</span>' if p["nuevo"] else ""
    return """                    <article class="article-card">
                        <div class="card-body">
                            <div class="card-meta">
                                <span class="card-cat">%s</span>%s
                            </div>
                            <div class="card-date"><i class="far fa-calendar-alt" style="margin-right:5px;"></i>%s</div>
                            <h2 class="card-title">%s</h2>
                            <p class="card-excerpt">%s</p>
                            <a href="/blog/%s" class="card-link">Leer artículo <i class="fas fa-arrow-right"></i></a>
                        </div>
                    </article>""" % (p["cat"], badge, p["fecha"], p["titulo"], p["extracto"], p["slug"])


def sidebar(activa):
    """Lista de categorias; la activa se marca y no se autoenlaza."""
    out = ['                        <a href="/blog">\n'
           '                            Todos los artículos <span class="cat-count">%d</span>\n'
           '                        </a>' % len(POSTS)]
    for c in CATS:
        n = sum(1 for p in POSTS if p["cat"] == c["nombre"])
        cls = ' class="active"' if c["nombre"] == activa else ""
        out.append('                        <a href="/blog/categoria/%s"%s>\n'
                   '                            %s <span class="cat-count">%d</span>\n'
                   '                        </a>' % (c["slug"], cls, c["nombre"], n))
    return "\n".join(out)


def build(c):
    posts = [p for p in POSTS if p["cat"] == c["nombre"]]
    url = "%s/blog/categoria/%s" % (SITE, c["slug"])

    # Una categoria con un solo articulo no aporta valor de indexacion (thin
    # content) y competiria con el propio articulo. Se sirve para navegacion,
    # pero se marca noindex,follow para que Google no la indexe.
    robots = "index, follow" if len(posts) >= 2 else "noindex, follow"

    items = ",\n".join(
        '            { "@type": "ListItem", "position": %d, "url": "%s/blog/%s" }'
        % (i + 1, SITE, p["slug"]) for i, p in enumerate(posts))

    jsonld = """    <script type="application/ld+json">
    [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "%s",
        "description": "%s",
        "url": "%s",
        "inLanguage": "es-ES",
        "isPartOf": { "@type": "Blog", "name": "Blog de Deterrajaras", "url": "%s/blog" },
        "mainEntity": {
          "@type": "ItemList",
          "numberOfItems": %d,
          "itemListElement": [
%s
          ]
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "%s" },
          { "@type": "ListItem", "position": 2, "name": "Blog", "item": "%s/blog" },
          { "@type": "ListItem", "position": 3, "name": "%s", "item": "%s" }
        ]
      }
    ]
    </script>
""" % (c["h1"], c["desc"], url, SITE, len(posts), items, SITE, SITE, c["nombre"], url)

    cards = "\n\n".join(card(p) for p in posts) if posts else \
        '                    <div class="cat-empty">Todavía no hay artículos en esta categoría.</div>'

    return """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="apple-touch-icon" href="/favicon.svg">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s · Blog de Deterrajaras</title>
    <meta name="description" content="%s">
    <meta name="robots" content="%s">
    <meta name="author" content="Deterrajaras">
    <link rel="canonical" href="%s">
    <meta property="og:type" content="website">
    <meta property="og:title" content="%s · Blog de Deterrajaras">
    <meta property="og:description" content="%s">
    <meta property="og:url" content="%s">
    <meta property="og:locale" content="es_ES">
%s%s%s
    </style>
</head>
%s<main id="contenido">

<!-- BREADCRUMB -->
<div class="cat-breadcrumb">
    <div class="container">
        <nav class="cat-breadcrumb-inner" aria-label="Ruta de navegación">
            <a href="/">Inicio</a>
            <span class="sep">&rsaquo;</span>
            <a href="/blog">Blog</a>
            <span class="sep">&rsaquo;</span>
            <span class="current">%s</span>
        </nav>
    </div>
</div>

<!-- HERO -->
<section class="blog-hero is-cat">
    <div class="container">
        <span class="badge">%s</span>
        <h1>%s</h1>
        <p>%s</p>
    </div>
</section>

<!-- MAIN -->
<section class="blog-main">
    <div class="container">
        <div class="blog-layout">

            <!-- ARTÍCULOS -->
            <div>
                <div class="articles-grid">

%s

                </div>
            </div>

            <!-- SIDEBAR -->
            <aside class="blog-sidebar">

                <!-- CATEGORÍAS -->
                <div class="sidebar-box">
                    <h3>Categorías</h3>
                    <nav class="cat-list" aria-label="Categorías del blog">
%s
                    </nav>
                </div>

                <!-- CTA SIDEBAR -->
                <div class="blog-cta">
                    <h3>¿Te ha surgido alguna duda?</h3>
                    <p>Escríbenos por WhatsApp y te respondemos sin compromiso.</p>
                    <a href="https://wa.me/34670225384" target="_blank"><i class="fab fa-whatsapp"></i> Hablar por WhatsApp</a>
                    <a href="/camadas">Ver camadas disponibles →</a>
                </div>

            </aside>
        </div>
    </div>
</section>

<!-- CTA INFERIOR -->
<section class="blog-bottom-cta">
    <div class="container">
        <h2>¿Listo para conocer a tu futuro compañero?</h2>
        <p>Criamos Caniches Toy y Schnauzer Mini con amor desde casa, con Núcleo Zoológico registrado y toda la documentación en regla.</p>
        <div class="cta-btns">
            <a href="https://wa.me/34670225384" target="_blank" class="btn-primary">
                <i class="fab fa-whatsapp"></i> Escribir por WhatsApp
            </a>
            <a href="/camadas" class="btn-outline">
                Ver camadas disponibles →
            </a>
        </div>
    </div>
</section>

</main>

%s
""" % (c["h1"], c["desc"], robots, url, c["h1"], c["desc"], url,
       jsonld, head_css, EXTRA_CSS, body_top,
       c["nombre"], c["nombre"], c["h1"], c["intro"], cards, sidebar(c["nombre"]), footer)


if __name__ == "__main__":
    os.makedirs(os.path.join("blog", "categoria"), exist_ok=True)
    for c in CATS:
        n = sum(1 for p in POSTS if p["cat"] == c["nombre"])
        path = os.path.join("blog", "categoria", c["slug"] + ".html")
        io.open(path, "w", encoding="utf-8", newline="").write(build(c))
        idx = "index" if n >= 2 else "NOINDEX"
        print("%-34s %d articulos  %s" % (c["slug"], n, idx))
