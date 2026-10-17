/* Aviso de cookies y medición con Google Analytics.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * PARA PONER ANALYTICS: pega aquí tu identificador de medición (G-XXXXXXXXXX)
 * entre las comillas. Mientras esté vacío, la web no carga Analytics ni pide
 * cookies a nadie.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Cómo funciona, para cumplir con la AEPD:
 *   - Hasta que el visitante dice que sí, no se carga nada de Google ni se
 *     escribe ninguna cookie de medición (Consent Mode v2 en "denied").
 *   - "Aceptar" y "Rechazar" se ven igual de claros y con el mismo tamaño.
 *   - La decisión se guarda un año en este navegador y se puede cambiar
 *     cuando se quiera desde el enlace "Cookies" del pie.
 */
(function () {
    'use strict';

    var MEDICION = '';

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
        var s = d.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEDICION;
        d.head.appendChild(s);
        gtag('js', new Date());
        gtag('config', MEDICION, { anonymize_ip: true });
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
