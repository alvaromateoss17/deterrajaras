# Informe SEO · Deterrajaras.es · 2026-11-20

Trabajo ejecutado en modo autónomo (Álvaro ausente, con autorización explícita para
completar y desplegar). Objetivo del encargo: **visibilidad y posición en la SERP**,
no captar clientes. Prioridad: reforzar el **Schnauzer Mini** y defender el Caniche.

---

## 1. Resumen honesto

El sitio **ya estaba bastante trabajado** antes de esta sesión. Buena parte de lo que
pedía el brief estaba hecho en commits previos (artículos de blog, consolidación de
entidad/autoría, `llms.txt`, **enlazado interno pilar↔blogs**, schema en las páginas
clave). Por eso **no he reescrito páginas enteras ni he forzado cambios**: hacerlo
habría sido sobreoptimizar y arriesgar romper algo (tu regla "no rompas nada").

El hallazgo de peso fue un **error de contenido inventado** por el primer agente, que
he corregido. Lo demás ha sido verificación técnica y ajustes de coherencia.

---

## 2. Lo que he cambiado en esta sesión

### 2.1. Corrección crítica: "Schnauzer blanco" (contenido inventado)
El trabajo parcial del primer agente afirmaba que **criáis Schnauzer blanco** en el hero
de `/schnauzer-mini`, en su FAQ (schema + visible), en una tarjeta de color y en `llms.txt`.
**Tú no lo has confirmado y no hay ni una foto de blanco en el repo** → es justo la regla
que no se toca (no inventar hechos del criadero). **Lo he eliminado de todas partes.**
`/schnauzer-mini` queda coherente con dos variedades: **negro** y **sal y pimienta**.

### 2.2. Precio del Schnauzer
Me diste tu precio real: **800–900 €**. Decisiones tomadas:
- **No he publicado tu precio concreto** en ninguna página (me lo diste "para que lo sepas",
  no para publicarlo; y poner un precio propio bajo choca con el ángulo "barato = riesgo"
  del artículo).
- Sí he bajado el **rango general de mercado** del artículo de precio de **900→800 €**
  (las 6 apariciones: meta, schema y cuerpo), porque es más exacto y evita que el propio
  artículo deje entrever que tu precio es "sospechosamente barato".

### 2.3. Registros
- `SEO_LOG.md` actualizado y veraz (incluye las correcciones de arriba).
- Este informe.

---

## 3. Verificación técnica (estado real del sitio — está sano)
- **Un solo H1 por página.** Las únicas excepciones son el verificador de Google (stub, normal)
  y `camada-detalle.html` (plantilla generada por el build, además redirigida).
- **Ninguna imagen de contenido sin `alt`.** El hero de la home que el brief daba por
  "sin alt" ya estaba bien: la capa de fondo es decorativa (`alt=""` correcto) y la imagen
  real tiene alt descriptivo.
- **Enlazado interno pilar↔blogs ya existe** (commit `672bc61`): los blogs que posicionan
  (`cuanto-cuesta-caniche-toy`, `perros-hipoalergenicos-pequenos`, `seguro-obligatorio-perros-2026`)
  ya enlazan a `/caniche-toy`, `/schnauzer-mini`, `/colores-caniche-toy` y `/camadas` con anclas
  descriptivas. No lo he duplicado.
- **Señal geográfica de `/cachorros-madrid`: ya resuelta.** Title/H1 combinan "Madrid" con
  "entrega en toda España" y criadero en Cáceres, y la página ya incluye el Schnauzer.
- **Schema:** `/schnauzer-mini` tiene WebPage + FAQPage + BreadcrumbList + ImageObject;
  `/caniche-toy` tiene BreadcrumbList. Coherente con el resto del sitio.
- **Build de Vercel** (`node scripts/sync-panel.mjs`): pasa en verde (exit 0).

---

## 4. Pendiente de un dato o decisión TUYA
1. **¿Criáis Schnauzer blanco?** Hoy el sitio NO lo afirma. Si SÍ lo criáis, se puede
   reañadir (color + foto propia) y capturar "schnauzer miniatura blanco" (~140/mes). Si no,
   déjalo como está. **Avísame.**
2. **Tu precio (800–900 €):** ¿quieres mostrarlo en alguna página o prefieres mantener solo
   el rango general? Hoy no aparece tu precio propio.
3. **"caniche toy" seco (KD 87, 90.500/mes):** la SERP la dominan enciclopedias y marketplaces.
   Recomendación: **no invertir esfuerzo** en el término seco; seguir capturando variantes
   ("caniche toy precio", "caniche enano", colores, local), que es donde ya ganáis.

---

## 5. Propuesta (solo propuesta, la ejecutas tú)
- Crear un **proyecto de deterrajaras.es en SE Ranking** con las keywords del brief para
  rastrear posiciones semana a semana (hoy no existe). Es la forma de medir si estos cambios
  mueven, especialmente las del Schnauzer.
- Medición sugerida: **+4 semanas (≈18-12-2026)** y **+8 semanas (≈15-01-2027)**, usando como
  base las posiciones del `SEO_LOG.md`.

---

## 6. Nota sobre la ejecución "en la nube"
El primer intento se lanzó como agente remoto pensando que trabajaría en servidores de
Anthropic con el ordenador apagado. **Esa ejecución remota no estaba disponible** en la
cuenta y cayó a modo local; al dormirse el equipo, el agente murió a media faena. De ahí
que este trabajo se haya tenido que completar en local, con el ordenador encendido.
