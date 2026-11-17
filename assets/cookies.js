/* Aviso de cookies y medición con Google Analytics.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * EL IDENTIFICADOR VA EN LA CONSTANTE MEDICION, unas líneas más abajo. Vale
 * tanto el de medición de Analytics (G-XXXXXXXXXX, lo da Analytics en
 * Administrar › Flujos de datos) como el de un contenedor de Tag Manager
 * (GTM-XXXXXXX). Si se deja vacío, la web no carga nada ni pide cookies.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Cómo funciona, para cumplir con la AEPD:
 *   - Hasta que el visitante dice que sí, no se carga nada de Google ni se
 *     escribe ninguna cookie de medición (Consent Mode v2 en "denied").
 *   - "Aceptar" y "Rechazar" se ven igual de claros y con el mismo tamaño.
 *   - La decisión se guarda un año en este navegador y se puede cambiar
 *     cuando se quiera desde el enlace "Cookies" del pie.
 *   - Al rechazar (o si ya había una negativa guardada al cargar) se retira el
 *     consentimiento de Google (Consent Mode v2 de vuelta a "denied") y se
 *     borran las cookies de medición que hubieran quedado (_ga, _ga_<ID>, _gid,
 *     _gat*, y las de Clarity _clck/_clsk), probando el dominio del host y el
 *     dominio raíz con punto, para que retirar el permiso revoque de verdad.
 */
(function () {
    'use strict';

    var MEDICION = 'GTM-KB2NCDN9';

    /* Un contenedor de Tag Manager se carga distinto que Analytics a secas */
    var ES_CONTENEDOR = /^GTM-/i.test(MEDICION);

    var d = document;
    var CLAVE = 'deterrajaras:cookies';
    var UN_ANO = 365 * 24 * 60 * 60 * 1000;

    function leerDecision() {
        try {
            var guardado = JSON.parse(localStorage.getItem(CLAVE));
            if (!guardado || Date.now() - guardado.fecha > UN_ANO) return null;
            return guardado.valor;
        } catch (e) {
            return null;
        }
    }

    function guardarDecision(valor) {
        try {
            localStorage.setItem(CLAVE, JSON.stringify({ valor: valor, fecha: Date.now() }));
        } catch (e) { /* navegación privada: vale la decisión de esta visita */ }
    }

    /* ── Google Analytics, solo si hay identificador y permiso ── */
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }

    if (MEDICION) {
        gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
        });
    }

    var cargado = false;
    function arrancarMedicion() {
        if (!MEDICION) return;
        gtag('consent', 'update', { analytics_storage: 'granted' });
        if (cargado) return;
        cargado = true;
        if (ES_CONTENEDOR) {
            window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
        }
        var s = d.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/' +
            (ES_CONTENEDOR ? 'gtm.js' : 'gtag/js') + '?id=' + MEDICION;
        d.head.appendChild(s);
        if (!ES_CONTENEDOR) {
            gtag('js', new Date());
            gtag('config', MEDICION, { anonymize_ip: true });
        }
    }

    /* ── Retirar el consentimiento ──
     * GTM ya cargado no se puede "descargar" sin recargar, pero sí dejamos de
     * medir: ponemos el consentimiento de vuelta en "denied" y borramos las
     * cookies que Google (o Clarity) hubiera escrito. */
    var PATRONES = [/^_ga($|_)/, /^_gid$/, /^_gat/, /^_clck$/, /^_clsk$/];

    /* Dominios donde pueden vivir las cookies: el host actual (sin atributo
     * domain), el host, el host sin "www" y el dominio raíz con punto, porque
     * Google Analytics las escribe en el dominio raíz (p. ej. .deterrajaras.es). */
    function dominiosCookie() {
        var host = (window.location && window.location.hostname) || '';
        var lista = [''];   /* '' = sin domain, borra las cookies del host exacto */
        if (host) {
            lista.push(host);
            lista.push('.' + host);
            var sinWww = host.replace(/^www\./, '');
            if (sinWww !== host) {
                lista.push(sinWww);
                lista.push('.' + sinWww);
            }
            var partes = sinWww.split('.');
            if (partes.length >= 2) {
                var raiz = partes.slice(-2).join('.');
                lista.push(raiz);
                lista.push('.' + raiz);
            }
        }
        return lista;
    }

    function borrarCookies() {
        var dominios = dominiosCookie();
        var trozos = (d.cookie || '').split(';');
        for (var i = 0; i < trozos.length; i++) {
            var nombre = trozos[i].split('=')[0].replace(/^\s+|\s+$/g, '');
            if (!nombre) continue;
            var coincide = false;
            for (var p = 0; p < PATRONES.length; p++) {
                if (PATRONES[p].test(nombre)) { coincide = true; break; }
            }
            if (!coincide) continue;
            var base = nombre + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            for (var j = 0; j < dominios.length; j++) {
                try {
                    d.cookie = dominios[j] ? base + '; domain=' + dominios[j] : base;
                } catch (e) { /* dominio no válido en este contexto: seguimos */ }
            }
        }
    }

    function revocarMedicion() {
        if (MEDICION) {
            gtag('consent', 'update', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
            });
        }
        borrarCookies();
    }

    /* ── El cartel ── */
    var caja = null;

    function cerrar() {
        if (!caja) return;
        caja.remove();
        caja = null;
    }

    function decidir(valor) {
        guardarDecision(valor);
        cerrar();
        if (valor === 'si') arrancarMedicion();
        else revocarMedicion();
    }

    function mostrar() {
        if (caja) return;
        caja = d.createElement('div');
        caja.className = 'ck';
        caja.setAttribute('role', 'dialog');
        caja.setAttribute('aria-label', 'Aviso de cookies');
        caja.tabIndex = -1;
        caja.innerHTML =
            '<p class="ck-txt">Usamos cookies propias para que la web funcione y, solo si nos dejas, ' +
            'cookies de Google Analytics para saber qué páginas se leen más. ' +
            'Puedes cambiar de idea cuando quieras. ' +
            '<a href="https://deterrajaras.es/politica-privacidad#cookies">Más detalles</a>.</p>' +
            '<div class="ck-btns">' +
            '<button type="button" class="ck-btn ck-no">Rechazar</button>' +
            '<button type="button" class="ck-btn ck-si">Aceptar</button>' +
            '</div>';
        d.body.appendChild(caja);
        caja.querySelector('.ck-si').addEventListener('click', function () { decidir('si'); });
        caja.querySelector('.ck-no').addEventListener('click', function () { decidir('no'); });
        caja.focus();   /* al aviso entero, no a un botón: ninguno se destaca */
    }

    var decision = leerDecision();
    if (decision === 'si') arrancarMedicion();
    else if (decision === 'no') borrarCookies();   /* limpia restos de antes de este arreglo */
    else if (decision === null && MEDICION) mostrar();

    /* El enlace "Cookies" del pie siempre vuelve a abrir el aviso */
    d.addEventListener('click', function (e) {
        var enlace = e.target.closest && e.target.closest('[data-cookies]');
        if (!enlace) return;
        e.preventDefault();
        try { localStorage.removeItem(CLAVE); } catch (err) { /* da igual */ }
        mostrar();
    });
})();
