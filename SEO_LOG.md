# SEO_LOG · Deterrajaras.es

Registro de cambios SEO para comparar posiciones a 4 y 8 semanas.
Posiciones de partida: SE Ranking, 20-11-2026 (datos del brief de Álvaro).

| Fecha | Página | Cambio | Keyword objetivo | Posición de partida |
|-------|--------|--------|------------------|---------------------|
| 2026-11-20 | `/schnauzer-mini` | Title y H1 ahora incluyen "Schnauzer Mini" además de "Miniatura"; meta reescrita (+20 años, colores confirmados). | schnauzer mini (10.800), schnauzer miniatura (2.400) | long tail / no top 100 |
| 2026-11-20 | `/schnauzer-mini` | Nueva sección "Colores del Schnauzer Miniatura" (negro + sal y pimienta) con foto propia. | schnauzer sal y pimienta (480), schnauzer mini negro (590) | sin posicionar |
| 2026-11-20 | `/schnauzer-mini` | Añadido JSON-LD BreadcrumbList e ImageObject de foto propia. | (soporte técnico/rich results) | — |
| 2026-11-20 | `/caniche-toy` | Añadido JSON-LD BreadcrumbList (coherencia con el resto del sitio). | caniche toy (90.500), caniche enano (4.400) | fuera de top / largo plazo |
| 2026-11-20 | `/blog/cuanto-cuesta-schnauzer-miniatura` | Title/og ahora incluyen "Schnauzer Mini" (head term de precio). | schnauzer mini precio (590), schnauzer miniatura precio (320) | — |
| 2026-11-20 | `/cachorros-madrid` | Title/meta/og alinean slug + keyword "Madrid" con el enfoque honesto de entrega nacional (criadero en Cáceres). | caniche toy madrid (390), schnauzer mini madrid (30) | no top 100 |
| 2026-11-20 | `sitemap.xml` | `lastmod` 2026-11-20 en las páginas modificadas. | (frescura) | — |
| 2026-11-20 | `/schnauzer-mini` + `llms.txt` | **Blanco confirmado como variedad OCASIONAL.** Álvaro confirma que crían sobre todo negro y sal y pimienta, y blanco en camadas puntuales. Reflejado con ese marco honesto en hero, FAQ (schema+visible), sección de colores (tarjeta sin foto, no hay foto propia de blanco) y bloque CTA. Captura "schnauzer miniatura blanco" (140/mes). | schnauzer miniatura blanco (140) | sin posicionar |
| 2026-11-20 | `/blog/cuanto-cuesta-schnauzer-miniatura` | Rango general de mercado bajado de 900→**800 €** (coherente con el precio real del criadero, 800-900 €). No se publica el precio propio. Menciones informativas al "blanco" (por qué es más caro) se mantienen como contenido de raza, sin afirmar que lo criamos. | schnauzer blanco (140, informacional) | — |

## Decisión de canibalización registrada
- Intención "precio del schnauzer" → URL canónica **`/blog/cuanto-cuesta-schnauzer-miniatura`** (ya existente).
  NO se creó `/blog/cuanto-cuesta-schnauzer-mini` para evitar duplicado (regla 6: una intención = una URL).
- Enlazado interno pilar↔blogs: **ya existía** (commit `672bc61`). No se duplicó para no sobreoptimizar.

## Decisiones de Álvaro (2026-11-20, confirmadas)
- **Schnauzer blanco: SÍ**, como variedad ocasional (sobre todo negros; blanco en camadas puntuales). Reflejado con ese marco. **Fotos propias añadidas** (2026-11-20): bloque dedicado en `/schnauzer-mini` con dos fotos reales en WebP (patio 800/1200 + exposición 760), alt descriptivo e `ImageObject`.
- **Precio propio (800-900 €): NO mostrar** en la web. Los precios se dan por WhatsApp en privado. El artículo mantiene solo el rango general de mercado.
- **"caniche toy" seco (KD 87):** no se invierte esfuerzo (SERP dominada por enciclopedias/marketplaces).

## Próxima medición
- [ ] Semana +4 (hacia 2026-12-18): revisar schnauzer mini, schnauzer miniatura, schnauzer sal y pimienta, schnauzer mini negro, schnauzer mini precio.
- [ ] Semana +8 (hacia 2027-01-15): revisar lo anterior + caniche toy madrid / schnauzer mini madrid.
