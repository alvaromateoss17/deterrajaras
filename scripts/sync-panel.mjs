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
 * Uso local:  node scripts/sync-panel.mjs                (escribe los archivos)
 *             node scripts/sync-panel.mjs --probar       (solo lee y resume)
 *             node scripts/sync-panel.mjs --desde-repo   (regenera /camadas/*.html
 *               con el array del repo, sin panel: refresca el respaldo)
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
const DESDE_REPO = process.argv.includes('--desde-repo');

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
    const clave = ESTADOS[d.estado] ? d.estado : 'proxima';
    const est = ESTADOS[clave];
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
      estadoClave: clave,
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

/** Última frase de la description de la home, según lo que haya en el panel.
 *  El texto del repo ("Lista de espera abierta") vale siempre, así que si el
 *  panel falla la home no promete camadas que no existen. */
const BASE_HOME = 'Criadero familiar con Núcleo Zoológico en Cáceres. Caniche Toy y Schnauzer Mini criados en casa, con chip, vacunas y contrato.';

function descripcionHome(camadas) {
  const hay = (clave) => camadas.some((c) => c.estadoClave === clave);
  const frase = hay('disponible')
    ? 'Camadas disponibles ahora.'
    : hay('proxima')
      ? 'Próxima camada con reservas abiertas.'
      : 'Lista de espera abierta.';
  return `${BASE_HOME} ${frase}`;
}

function sitemap(camadas) {
  // Solo las camadas que se indexan (ver paginaCamada): una camada cerrada en
  // el sitemap es pedirle a Google que rastree una página marcada noindex.
  return camadas.filter((c) => c.estado === 'abierta').map((c) => `  <url>
    <loc>${BASE}/camadas/${c.slug}</loc>
    <lastmod>${c._lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n');
}

/** Mide una imagen local (PNG/WebP/JPEG) para poder poner width/height.
 *  Si no se puede medir, devuelve null: no se inventan dimensiones. */
function medir(foto) {
  if (/^https?:/.test(foto)) return null;
  try {
    const b = readFileSync(join(RAIZ, foto.replace(/^\//, '')));
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b.length > 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
      const tipo = b.toString('latin1', 12, 16);
      if (tipo === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (tipo === 'VP8L') {
        const n = b.readUInt32LE(21);
        return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
      }
      if (tipo === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      for (let i = 2; i < b.length - 9; ) {
        if (b[i] !== 0xff) { i++; continue; }
        const marca = b[i + 1];
        if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
          return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch {
    // Foto no legible (p. ej. no se descargó del panel): se publica sin medidas.
  }
  return null;
}

/** Alt de la foto n. Si el array no trae alts (respaldo antiguo), se calcula
 *  con la misma fórmula que aWeb(): mismo texto, no uno nuevo. */
const alt = (c, n) => (c.alts && c.alts[n]) || (n === 0
  ? `Camada de ${c.raza} ${c.mesTexto ? `nacida en ${c.mesTexto}` : 'próximamente'} en Cáceres`
  : `Cachorros de ${c.raza} criados en casa en Cáceres - ${c.mesTexto || 'próxima camada'} - foto ${n + 1}`);

const dim = (foto) => {
  const m = medir(foto);
  return m ? ` width="${m.w}" height="${m.h}"` : '';
};

/** La fecha sin el "Nacida el", para encajarla en una frase. */
const fechaCorta = (c) => c.fecha.replace('Nacida el ', '');

/** Meta description a partir del ESTADO REAL, no del resumen del panel: el
 *  resumen lo escribe el criador a mano y se queda desfasado cuando la camada
 *  cambia de estado (la de julio seguía diciendo "plazas reservadas" estando
 *  ya entregada). Si cambias esto, cambia descripcionCamada() de
 *  camada-detalle.html: el estático lo ve Google y el del JS, el usuario. */
function metaCamada(c) {
  const donde = 'en Cáceres';
  const cachorros = c.cachorros ? `${c.cachorros}` : '';
  const entrega = c.entrega ? ` Entrega prevista: ${c.entrega}.` : '';
  let texto;
  if (c.estadoClave === 'proxima') {
    texto = `Próxima camada de ${c.raza} ${donde}: reservas abiertas.${entrega}`;
  } else if (c.estadoClave === 'disponible') {
    texto = `Cachorros de ${c.raza} disponibles ${donde}, nacidos el ${fechaCorta(c)}.${cachorros ? ` ${cachorros}.` : ''}${entrega}`;
  } else if (c.estadoClave === 'completa') {
    texto = `Camada de ${c.raza} nacida el ${fechaCorta(c)} ${donde}${cachorros ? `: ${cachorros}` : ''}, con todas las plazas reservadas.${entrega}`;
  } else {
    texto = `Camada de ${c.raza} nacida el ${fechaCorta(c)} ${donde}${cachorros ? `: ${cachorros}` : ''}, ya entregados. Fotos reales de cómo criamos en casa.`;
  }
  return recortar(texto, 155);
}

/** Párrafo que explica el estado. Mismo texto que pinta el JS de la ficha. */
function introCamada(c) {
  if (c.estadoClave === 'entregada') {
    return `Esta camada nació el ${fechaCorta(c)} y todos sus cachorros ya han sido entregados a sus familias. La mantenemos publicada como muestra real de cómo criamos: en casa, con seguimiento veterinario desde el primer día.`;
  }
  if (c.estadoClave === 'completa') {
    return `Esta camada nació el ${fechaCorta(c)} y todas sus plazas están reservadas${c.entrega ? `; la entrega está prevista para ${c.entrega}` : ''}. La mantenemos publicada como muestra real de cómo criamos: en casa, con seguimiento veterinario desde el primer día.`;
  }
  if (c.estadoClave === 'proxima') return 'Esta camada aún no ha nacido: puedes reservar tu lugar ahora.';
  return '';
}

/** Todo lo que hoy pinta el JS, escrito ya en el HTML: estado, raza, fecha,
 *  nº de cachorros, colores, entrega, las fotos con alt y medidas, y la
 *  descripción del panel. Solo datos del panel; nada inventado. */
function cuerpoCamada(c) {
  const bloque = (etiqueta, valor) => (valor
    ? `                <div class="info-block">
                    <div class="info-label">${etiqueta}</div>
                    <div class="info-value">${esc(valor)}</div>
                </div>`
    : '');
  const info = [
    bloque('Raza', c.raza),
    bloque(c.estadoClave === 'proxima' ? 'Época prevista' : 'Fecha nacimiento', c.fecha),
    bloque('Cachorros', c.cachorros),
    bloque('Colores', (c.colores || []).join(', ')),
    bloque('Entrega estimada', c.entrega),
  ].filter(Boolean).join('\n');

  const galeria = c.fotos.map((f, n) => `                    <img src="${esc(absRuta(f))}" alt="${esc(alt(c, n))}"${dim(f)}${n === 0 ? '' : ' loading="lazy"'}
                         class="gallery-thumb${n === 0 ? ' active' : ''}" onclick="changeMain('${esc(absRuta(f))}', this)">`).join('\n');

  const intro = introCamada(c);
  const parrafos = [...(intro ? [intro] : []), ...(c.desc || [])].map((pa) => `                <p>${esc(pa)}</p>`).join('\n');

  const cta = c.estado === 'abierta'
    ? `            <a href="https://wa.me/34670225384?text=${encodeURIComponent(`Hola! Me interesa la ${c.nombre}. ¿Podéis darme más información?`)}" target="_blank" class="cta-wa">
                <i class="fab fa-whatsapp" aria-hidden="true"></i> Contactar por WhatsApp
            </a>`
    : `            <div class="reservas-cta" style="margin-top:32px;">
                <p class="reservas-cta-pre">¿Buscas un cachorro de Caniche Toy o Schnauzer Mini?</p>
                <a href="/camadas#lista-espera" class="reservas-btn">
                    <i class="fas fa-envelope" aria-hidden="true"></i>
                    Apuntarme a la lista de espera
                </a>
            </div>`;

  return `            <h1 style="font-family:'Playfair Display',serif;font-size:clamp(1.5rem,4vw,2rem);color:var(--color-texto);margin-bottom:16px;">${esc(c.nombre)}</h1>
            <img id="mainImg" src="${esc(absRuta(c.fotoThumb))}" alt="${esc(alt(c, 0))}"${dim(c.fotoThumb)} class="main-img">
            <div class="gallery-row">
${galeria}
            </div>
            <span class="reservas-badge" style="margin-top:16px;display:inline-block;">${esc(c.estadoText)}</span>
            <div class="info-grid">
${info}
            </div>
            <div class="detalle-desc">
${parrafos}
            </div>
${cta}`;
}

/** Página estática de una camada: misma lógica que generar-camadas.py. */
function paginaCamada(plantilla, c) {
  const url = `${BASE}/camadas/${c.slug}`;
  let titulo = `${c.nombre} | Deterrajaras`;
  if (titulo.length > 60) titulo = `${c.raza} · ${c.mesTexto} | Deterrajaras`;
  const descripcion = metaCamada(c);
  const una = (t, re, nuevo, que) => {
    if (!re.test(t)) throw new Error(`[${c.slug}] no se encuentra ${que} en camada-detalle.html`);
    return t.replace(re, () => nuevo);
  };
  let t = plantilla.replace('<!DOCTYPE html>\n', '<!DOCTYPE html>\n<!-- ARCHIVO GENERADO por scripts/sync-panel.mjs con los datos del Panel de Webcare. No lo edites a mano. -->\n');
  t = una(t, /<title>[\s\S]*?<\/title>/, `<title>${esc(titulo)}</title>`, 'el <title>');
  // Indexación según el estado real de la camada: se indexa lo que aporta algo
  // a quien busca (se puede reservar o comprar) y no lo que ya pasó. Las camadas
  // cerradas siguen publicadas y enlazadas desde /camadas, pero en noindex y
  // fuera del sitemap. La plantilla /camada-detalle va siempre noindex.
  const robots = c.estado === 'abierta' ? 'index, follow' : 'noindex, follow';
  t = una(t, /[ \t]*<!-- Plantilla: noindex[\s\S]*?-->\n[ \t]*<meta name="robots" content="noindex, follow">/,
    `    <meta name="robots" content="${robots}">`, 'la meta robots');
  t = una(t, /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${esc(descripcion)}">\n    <meta property="og:title" content="${esc(titulo)}">\n    <meta property="og:description" content="${esc(descripcion)}">\n    <meta property="og:url" content="${url}">`,
    'la meta description');
  t = una(t, /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(absUrl(c.fotoThumb))}">`, 'og:image');
  t = una(t, /<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(absUrl(c.fotoThumb))}">`, 'twitter:image');
  t = una(t, /<link rel="canonical" id="canonicalTag" href="[^"]*">/, `<link rel="canonical" id="canonicalTag" href="${url}">`, 'el canonical');
  t = una(t, /<div class="detalle-container" id="detalleContent"><\/div>/,
    `<div class="detalle-container" id="detalleContent" data-slug="${c.slug}">\n${cuerpoCamada(c)}\n        </div>`,
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
  // Modo local: regenera solo /camadas/<slug>.html con el array que ya está en
  // camada-detalle.html (fotos del repo), sin tocar el panel. Sirve para
  // refrescar el respaldo que se publica si el panel falla, después de cambiar
  // la plantilla. Vercel nunca lo usa.
  if (DESDE_REPO) {
    const rutaDetalle = join(RAIZ, 'camada-detalle.html');
    const detalle = leer(rutaDetalle);
    const ini = detalle.texto.indexOf('const camadas = [');
    const fin = detalle.texto.indexOf('\n];', ini);
    if (ini === -1 || fin === -1) throw new Error("no se encuentra el array 'const camadas' en camada-detalle.html");
    const camadas = new Function(`return ${detalle.texto.slice(ini + 'const camadas = '.length, fin + 2)}`)();
    for (const c of camadas) {
      escribir(join(RAIZ, 'camadas', `${c.slug}.html`), paginaCamada(detalle.texto, c), detalle);
      console.log(`[sync-panel] respaldo regenerado: camadas/${c.slug}.html (${c.estadoText})`);
    }
    return;
  }

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

    // index.html: la description de la home no puede prometer camadas que no hay
    const desc = descripcionHome(camadas);
    const rutaHome = join(RAIZ, 'index.html');
    const home = leer(rutaHome);
    let textoHome = reemplazarMarcas(home.texto, 'meta-desc',
      `    <meta name="description" content="${esc(desc)}">`, 'index.html');
    textoHome = reemplazarMarcas(textoHome, 'meta-og',
      `    <meta property="og:description" content="${esc(desc)}">`, 'index.html');
    escribir(rutaHome, textoHome, home);
    console.log(`[sync-panel] Home: "${desc.slice(desc.lastIndexOf('. ') + 2)}"`);

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
