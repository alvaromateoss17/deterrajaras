# Deterrajaras.es — Contexto del proyecto

Soy Álvaro (Dumor.es). **Deterrajaras** es mi criadero familiar de **Caniche Toy** y
**Schnauzer Miniatura** en **Cáceres (Extremadura)**, con Núcleo Zoológico registrado.
Escribo y publico todo en **español**.

## Objetivo
Posicionamiento y visibilidad, **NO** captar clientes: la lista de espera está completa.
El objetivo es dominar la SERP cuando alguien busca un criadero como el nuestro o nuestras
razas. Dominio de SERP, no conversión.

**Prioridad explícita:** equilibrar las dos razas **dando protagonismo al Schnauzer Mini**.
Hoy casi todo el tráfico es del Caniche Toy; del Schnauzer apenas aparecemos. El Schnauzer
debe ser el **pilar principal**: su página de raza, su artículo de precio, sus colores y su
contenido de apoyo.

## Reglas de contenido (innegociables)
1. **No inventar datos** (premios, nº de camadas, testimonios, fechas, métricas). Donde falte
   un dato real que no esté en el repo, usar el marcador literal `[PENDIENTE: dato real de Álvaro]`.
2. **Schnauzer blanco: DATO DESCONOCIDO.** No sabemos con certeza si criamos blanco. No añadir
   afirmaciones nuevas de que lo criamos. (Aviso: a fecha 2026-11-20 el repo ya afirma el color
   blanco en varias páginas; está pendiente de confirmación por Álvaro — ver `INFORME_SEO_2026-11-20.md`.)
3. **Ley de Bienestar Animal 7/2023:** respetar los textos legales existentes (entrega a 8 semanas,
   etc.). No cambiar afirmaciones legales.
4. **Sin formularios nuevos ni CTAs de venta agresivos.** Mantener los enlaces a WhatsApp existentes.
5. **No romper nada:** antes de desplegar, ejecutar el build (`node scripts/sync-panel.mjs`).
   Solo subir a `main` si el build pasa.
6. **Una intención de búsqueda = una URL.** Evitar canibalización. Inspeccionar el repo antes de crear.
7. Preservar la estética actual (rosa palo / burdeos / marrón, tipografías Playfair + Lato).
   Mejoras quirúrgicas, sin rediseñar.
8. Commits pequeños y revisables, en español, uno por página/concepto.

## Stack y despliegue
- Sitio **HTML estático** (sin framework). Cada página es un `.html` en la raíz o en `/blog/`.
- Cabecera/menú/pie comunes se incrustan entre marcas `<!-- sitio:cabecera -->` … con
  `scripts/aplicar-sitio.py`. Fuente única del CSS común: `assets/sitio/sitio.css`.
- **Build / deploy:** Vercel. `vercel.json` → `buildCommand: node scripts/sync-panel.mjs`,
  `outputDirectory: "."`, `cleanUrls: true`, `trailingSlash: false`.
- `sitemap.xml` y `robots.txt` en la raíz; `llms.txt` en formato llmstxt.org.

## URLs canónicas por intención (anti-canibalización)
- **Raza Caniche Toy:** `/caniche-toy` · **Raza Schnauzer:** `/schnauzer-mini`
- **Precio Caniche Toy:** `/blog/cuanto-cuesta-caniche-toy`
- **Precio Schnauzer:** `/blog/cuanto-cuesta-schnauzer-miniatura` (NO crear `/cuanto-cuesta-schnauzer-mini`: sería duplicado)
- **Colores Caniche:** `/blog/colores-caniche-toy` · **Colores/variedades Schnauzer:** sección dentro de `/schnauzer-mini`
- **Local Extremadura:** home + `/caniche-toy-extremadura` + `/schnauzer-mini-extremadura` + `/criadero-caceres`
- **Entrega nacional / Madrid:** `/cachorros-madrid`
- **Carácter/cuidados Schnauzer:** `/blog/schnauzer-miniatura-caracter`, `/blog/schnauzer-miniatura-suelta-pelo`

## Paleta
`--burdeos #AD3E64` · `--melocoton #F5C4B3` · `--crema #F9EDE8` · `--salvia #4E6B47` ·
`--texto #5A3E36`. Serif: Playfair Display. Sans: Lato.
