#!/usr/bin/env node
/**
 * Sincroniza la web con el Panel de Webcare (camadas y aviso).
 *
 * Vercel lo ejecuta al construir la web (buildCommand en vercel.json). El
 * criador edita sus camadas en el panel; al guardar, el panel avisa a Vercel
 * (Deploy Hook) y esta web se reconstruye sola en un minuto.
 *
 * Qué regenera (solo en la copia que publica Vercel; el repo no cambia):
 *   - el array `const camadas` de camada-detalle.html (lo usa el JS de la ficha)
 *   - las tarjetas de camadas.html y el aviso de su cabecera   <!-- panel:… -->
 *   - una página estática por camada en /camadas/<slug>.html   (para Google)
 *   - las URL de camadas del sitemap.xml                        <!-- panel:… -->
 *   - las fotos: se descargan del panel a /imagenes_panel/ y se publican
 *     desde este mismo dominio (sin conexión extra a Supabase al visitar la
 *     web, con la caché de Vercel, y siguen ahí aunque el panel falle)
 *
 * Si el panel no responde, NO toca nada: se publica la web tal como está en
 * el repo. Así un fallo del panel nunca tumba la web.
 *
 * Uso local:  node scripts/sync-panel.mjs            (escribe los archivos)
 *             node scripts/sync-panel.mjs --probar   (solo lee y resume)
 * Sustituye a scripts/generar-camadas.py, que ya no hace falta ejecutar.
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://deterrajaras.es';
// Datos públicos (la clave publishable está pensada para ir en webs; la protege el RLS).
const SUPABASE_URL = process.env.PANEL_SUPABASE_URL ?? 'https://tgffgspdeboedypiloqb.supabase.co';
const SUPABASE_KEY = process.env.PANEL_SUPABASE_KEY ?? 'sb_publishable_cPNLqIWoNndpHGF91qpRVQ_b87POFy9';
const SLUG_SITIO = process.env.PANEL_SLUG ?? 'deterrajaras';
const PROBAR = process.argv.includes('--probar');

// ── Lectura/escritura conservando BOM y saltos de línea de cada archivo ──
function leer(ruta) {
  let crudo = readFileSync(ruta);
  const bom = crudo[0] === 0xef && crudo[1] === 0xbb && crudo[2] === 0xbf;
  if (bom) crudo = crudo.subarray(3);
  const texto = crudo.toString('utf8');
  const crlf = texto.includes('\r\n');
  return { texto: crlf ? texto.replace(/\r\n/g, '\n') : texto, bom, crlf };
}
function escribir(ruta, texto, { bom, crlf }) {
  const datos = Buffer.from(crlf ? texto.replace(/\n/g, '\r\n') : texto, 'utf8');
  writeFileSync(ruta, bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), datos]) : datos);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const absUrl = (f) => (/^https?:/.test(f) ? f : `${BASE}/${f.replace(/^\//, '')}`);
const absRuta = (f) => (/^https?:/.test(f) || f.startsWith('/') ? f : `/${f}`);

/** Recorta sin partir palabras (igual que recortar() del generador original). */
function recortar(texto, limite = 155) {
  texto = texto.split(/\s+/).join(' ').trim();
  if (texto.length <= limite) return texto;
  const corte = texto.slice(0, limite + 1);
  const espacio = corte.lastIndexOf(' ');
  return espacio === -1 ? texto.slice(0, limite).trimEnd() : corte.slice(0, espacio).replace(/[ ,;:.—-]+$/, '');
}

// ── 1. Leer el panel ─────────────────────────────────────────────────────
async function pedir(ruta) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SUPABASE_KEY },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function leerPanel() {
  const [sitio] = await pedir(`sites?select=id,modulos&slug=eq.${SLUG_SITIO}`);
  if (!sitio) throw new Error(`no existe el sitio "${SLUG_SITIO}" en el panel`);
  const elementos = await pedir(
    `elementos?select=modulo,orden,datos,updated_at&site_id=eq.${sitio.id}&modulo=in.(camadas,aviso)&order=orden`,
  );
  return {
    camadas: sitio.modulos.includes('camadas') ? elementos.filter((e) => e.modulo === 'camadas') : null,
    aviso: sitio.modulos.includes('aviso') ? elementos.find((e) => e.modulo === 'aviso')?.datos ?? null : null,
  };
}

// ── Fotos: del panel a /imagenes_panel/ de esta web ──────────────────────
const DIR_FOTOS = 'imagenes_panel';

/** Descarga las fotos del panel y devuelve un mapa URL remota → ruta local. */
async function traerFotos(urls) {
  mkdirSync(join(RAIZ, DIR_FOTOS), { recursive: true });
  const mapa = new Map();
  await Promise.all([...new Set(urls)].map(async (url) => {
    if (!url.startsWith(`${SUPABASE_URL}/storage/`)) return;
    const nombre = url.split('/').pop().split('?')[0].toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const local = `${DIR_FOTOS}/${nombre}`;
    try {
      if (!existsSync(join(RAIZ, local))) {
        const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!r.ok) throw new Error(String(r.status));
        writeFileSync(join(RAIZ, local), Buffer.from(await r.arrayBuffer()));
      }
      mapa.set(url, local);
    } catch (e) {
      // Si una foto no baja, se sigue usando su URL del panel: la web no se rompe.
      console.warn(`[sync-panel] Foto no descargada (${e.message}): ${url}`);
    }
  }));
  return mapa;
}

// ── 2. Del formato del panel al formato de la web ────────────────────────
const ESTADOS = {
  proxima: { estado: 'abierta', entregada: false, texto: 'Reservas abiertas', clase: 'st-reservas' },
  disponible: { estado: 'abierta', entregada: false, texto: 'Cachorros disponibles', clase: 'st-available' },
  completa: { estado: 'cerrada', entregada: false, texto: 'Plazas completas', clase: 'st-reserved' },
  entregada: { estado: 'cerrada', entregada: true, texto: 'Entregada', clase: 'st-reserved' },
};
// La URL de cada camada se deriva de raza + mes + año, igual que las que ya
// existen (caniche-toy-julio-2026, schnauzer-mini-mayo-2026): no se pierde SEO.
const RAZA_URL = { 'schnauzer miniatura': 'schnauzer-mini', 'schnauzer mini': 'schnauzer-mini', 'caniche toy': 'caniche-toy' };

function aWeb(filas) {
  const usados = new Set();
  return filas.map(({ datos: d, updated_at }, i) => {
    const est = ESTADOS[d.estado] ?? ESTADOS.proxima;
    const raza = (d.raza || '').trim() || (d.nombre || '').split('·')[0].trim();
    const [a, m, dia] = (d.nacimiento || '').split('-').map(Number);
    const mesTexto = a && m ? `${MESES[m - 1]} de ${a}` : '';
    let slug = mesTexto
      ? `${RAZA_URL[raza.toLowerCase()] ?? slugify(raza)}-${MESES[m - 1]}-${a}`
      : slugify(d.nombre || `camada-${i + 1}`);
    if (usados.has(slug) && dia) slug = `${slug}-${dia}`;
    while (usados.has(slug)) slug += '-b';
    usados.add(slug);

    const fotos = (d.fotos || []).length ? d.fotos : ['imagenes_caniches/schnauzer_mini_patio.jpg'];
    const cuando = mesTexto ? `nacida en ${mesTexto}` : 'próximamente';
    return {
      id: i + 1,
      slug,
      mesTexto,
      nombre: d.nombre,
      raza,
      fecha: a ? `Nacida el ${dia} de ${MESES[m - 1]} de ${a}` : 'Próximamente',
      estado: est.estado,
      entregada: est.entregada,
      estadoText: est.texto,
      cachorros: d.cachorros || '',
      entrega: d.entrega || '',
      colores: (d.colores || '').split(',').map((c) => c.trim()).filter(Boolean),
      icono: /caniche|poodle/i.test(raza) ? '🐩' : '🐕',
      fotoThumb: fotos[0],
      fotos,
      alts: fotos.map((_, n) =>
        n === 0
          ? `Camada de ${raza} ${cuando} en Cáceres`
          : `Cachorros de ${raza} criados en casa en Cáceres - ${mesTexto || 'próxima camada'} - foto ${n + 1}`,
      ),
      resumen: d.resumen || `${d.nombre}: camada de ${raza} criada en casa en Cáceres.`,
      desc: (d.descripcion || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      _clase: est.clase,
      _lastmod: (updated_at || new Date().toISOString()).slice(0, 10),
    };
  });
}

// ── 3. Escribir en la web ────────────────────────────────────────────────
function reemplazarMarcas(texto, nombre, contenido, archivo) {
  const re = new RegExp(`(<!-- panel:${nombre} -->\\n)[\\s\\S]*?(\\n?[ \\t]*<!-- /panel:${nombre} -->)`);
  if (!re.test(texto)) throw new Error(`faltan las marcas panel:${nombre} en ${archivo}`);
  return texto.replace(re, (_, abre, cierra) => abre + contenido + cierra);
}

function tarjetas(camadas) {
  const hayActivas = camadas.some((c) => c.estado === 'abierta');
  const cards = camadas.map((c) => `                <a href="/camadas/${c.slug}" class="camada-card">
                    <div class="camada-thumb">
                        <span class="camada-status ${c._clase}">${esc(c.estadoText)}</span>
                        <img src="${esc(absRuta(c.fotoThumb))}" alt="${esc(c.alts[0])}" loading="lazy">
                    </div>
                    <div class="camada-body">
                        <h3>${esc(c.nombre)}</h3>
                        <div class="camada-meta"><span><i class="fas fa-calendar" aria-hidden="true"></i> ${esc(c.fecha)}</span></div>
                        <p class="camada-resumen">${esc(c.resumen)}</p>
                        <span class="camada-btn camada-btn-reservas">Ver esta camada →</span>
                    </div>
                </a>`).join('\n');
  // Marca invisible con la hora de la sincronización: sirve para comprobar que
  // un guardado en el panel ha llegado a la web (ver el código de la página).
  return `            <!-- sincronizado con el Panel de Webcare: ${new Date().toISOString()} -->
            <h2>${hayActivas ? 'Nuestras camadas' : 'Camadas anteriores'}</h2>
            <p>Así son nuestras camadas reales: criadas en casa, con seguimiento veterinario desde el primer día.</p>
            <div class="camadas-grid">
${cards}
            </div>`;
}

function aviso(datos) {
  if (!datos || datos.activo !== true || !String(datos.texto || '').trim()) return '';
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(datos.hasta || '') ? ` data-hasta="${datos.hasta}"` : '';
  // Si tiene fecha de caducidad, se oculta solo en el navegador aunque la web no se haya reconstruido.
  return `        <div class="status-aviso"${hasta}><i class="fas fa-circle-info" aria-hidden="true"></i> ${esc(datos.texto.trim())}</div>${
    hasta ? `\n        <script>document.querySelectorAll('[data-hasta]').forEach(function(e){if(new Date().toISOString().slice(0,10)>e.dataset.hasta)e.remove()})</script>` : ''
  }`;
}

function sitemap(camadas) {
  return camadas.map((c) => `  <url>
    <loc>${BASE}/camadas/${c.slug}</loc>
    <lastmod>${c._lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n');
}

/** Página estática de una camada: misma lógica que generar-camadas.py. */
function paginaCamada(plantilla, c) {
  const url = `${BASE}/camadas/${c.slug}`;
  let titulo = `${c.nombre} | Deterrajaras`;
  if (titulo.length > 60) titulo = `${c.raza} · ${c.mesTexto} | Deterrajaras`;
  const descripcion = recortar(c.resumen, 155);
  const una = (t, re, nuevo, que) => {
    if (!re.test(t)) throw new Error(`[${c.slug}] no se encuentra ${que} en camada-detalle.html`);
    return t.replace(re, () => nuevo);
  };
  let t = plantilla.replace('<!DOCTYPE html>\n', '<!DOCTYPE html>\n<!-- ARCHIVO GENERADO por scripts/sync-panel.mjs con los datos del Panel de Webcare. No lo edites a mano. -->\n');
  t = una(t, /<title>[\s\S]*?<\/title>/, `<title>${esc(titulo)}</title>`, 'el <title>');
  t = una(t, /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${esc(descripcion)}">\n    <meta property="og:title" content="${esc(titulo)}">\n    <meta property="og:description" content="${esc(descripcion)}">\n    <meta property="og:url" content="${url}">`,
    'la meta description');
  t = una(t, /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(absUrl(c.fotoThumb))}">`, 'og:image');
  t = una(t, /<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(absUrl(c.fotoThumb))}">`, 'twitter:image');
  t = una(t, /<link rel="canonical" id="canonicalTag" href="[^"]*">/, `<link rel="canonical" id="canonicalTag" href="${url}">`, 'el canonical');
  t = una(t, /<div class="detalle-container" id="detalleContent"><\/div>/,
    `<div class="detalle-container" id="detalleContent">\n            <h1>${esc(c.nombre)}</h1>\n            <p>${esc(c.resumen)}</p>\n            <img src="${esc(absRuta(c.fotoThumb))}" alt="${esc(c.alts[0])}" loading="lazy">\n        </div>`,
    'el contenedor #detalleContent');
  return t;
}

/** Sustituye el array `const camadas = [...]` (cuenta corchetes fuera de cadenas). */
function reemplazarArray(texto, camadas) {
  const marca = 'const camadas = [';
  const i = texto.indexOf(marca);
  if (i === -1) throw new Error("no se encuentra 'const camadas = [' en camada-detalle.html");
  const inicio = i + marca.length - 1;
  let nivel = 0, dentro = false, escape = false, fin = -1;
  for (let j = inicio; j < texto.length; j++) {
    const ch = texto[j];
    if (dentro) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === '"') dentro = false; continue; }
    if (ch === '"') dentro = true;
    else if (ch === '[' || ch === '{') nivel++;
    else if ((ch === ']' || ch === '}') && --nivel === 0) { fin = j; break; }
  }
  const limpio = camadas.map(({ _clase, _lastmod, ...c }) => c);
  return texto.slice(0, inicio) + JSON.stringify(limpio, null, 4) + texto.slice(fin + 1);
}

// ── Principal ────────────────────────────────────────────────────────────
async function main() {
  let panel;
  try {
    panel = await leerPanel();
  } catch (e) {
    console.warn(`[sync-panel] No se ha podido leer el panel (${e.message}). Se publica la web tal como está.`);
    return;
  }

  if (panel.camadas) {
    if (!PROBAR) {
      const fotos = await traerFotos(panel.camadas.flatMap((c) => c.datos.fotos || []));
      for (const c of panel.camadas) c.datos.fotos = (c.datos.fotos || []).map((u) => fotos.get(u) ?? u);
      console.log(`[sync-panel] ${fotos.size} fotos publicadas desde /${DIR_FOTOS}/`);
    }
    const camadas = aWeb(panel.camadas);
    console.log(`[sync-panel] ${camadas.length} camadas: ${camadas.map((c) => `${c.slug} (${c.estadoText})`).join(', ')}`);
    if (PROBAR) return;

    // camada-detalle.html: nuevo array (y plantilla de las páginas por camada)
    const rutaDetalle = join(RAIZ, 'camada-detalle.html');
    const detalle = leer(rutaDetalle);
    const nuevoDetalle = reemplazarArray(detalle.texto, camadas);
    escribir(rutaDetalle, nuevoDetalle, detalle);

    // /camadas/<slug>.html: una por camada; se borran las de camadas que ya no están
    const dirCamadas = join(RAIZ, 'camadas');
    mkdirSync(dirCamadas, { recursive: true });
    const vigentes = new Set(camadas.map((c) => `${c.slug}.html`));
    for (const f of readdirSync(dirCamadas)) if (f.endsWith('.html') && !vigentes.has(f)) unlinkSync(join(dirCamadas, f));
    for (const c of camadas) escribir(join(dirCamadas, `${c.slug}.html`), paginaCamada(nuevoDetalle, c), detalle);

    // camadas.html y sitemap.xml
    const rutaListado = join(RAIZ, 'camadas.html');
    const listado = leer(rutaListado);
    escribir(rutaListado, reemplazarMarcas(listado.texto, 'camadas', tarjetas(camadas), 'camadas.html'), listado);
    const rutaSitemap = join(RAIZ, 'sitemap.xml');
    const mapa = leer(rutaSitemap);
    escribir(rutaSitemap, reemplazarMarcas(mapa.texto, 'camadas', sitemap(camadas), 'sitemap.xml'), mapa);
  }

  if (panel.aviso !== null && !PROBAR) {
    const rutaListado = join(RAIZ, 'camadas.html');
    const listado = leer(rutaListado);
    escribir(rutaListado, reemplazarMarcas(listado.texto, 'aviso', aviso(panel.aviso), 'camadas.html'), listado);
    console.log(`[sync-panel] Aviso: ${aviso(panel.aviso) ? `"${panel.aviso.texto}"` : 'oculto'}`);
  }
}

main().catch((e) => {
  // Un error de plantilla sí debe parar el build: es un fallo del código, no del panel.
  console.error(`[sync-panel] ERROR: ${e.message}`);
  process.exit(1);
});
