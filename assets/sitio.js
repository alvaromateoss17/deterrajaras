/* Cabecera y pie comunes de deterrajaras.es.
 *
 * Lo cargan todas las páginas. Todo funciona sin JavaScript: esto solo añade
 * la sombra de la cabecera al bajar, el menú de móvil, el botón flotante de
 * WhatsApp y el ajuste del wordmark del pie al ancho disponible.
 */
(function () {
    'use strict';

    var d = document;
    var w = window;

    var header = d.querySelector('.hd');
    var waFloat = d.querySelector('.wa-float');
    var menu = d.getElementById('menu-movil');
    var menuBtn = d.querySelector('.hd-burger');

    /* ── Cabecera con sombra y WhatsApp flotante ── */
    function onScroll() {
        var y = w.scrollY;
        if (header) header.classList.toggle('is-scrolled', y > 12);
        if (waFloat) waFloat.classList.toggle('is-on', y > w.innerHeight * 0.6 && (!menu || menu.hidden));
    }
    w.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ── Menú móvil ── */
    if (menu && menuBtn) {
        var cerrar = menu.querySelector('.menu-close');

        function setMenu(open) {
            menu.hidden = !open;
            menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            d.body.style.overflow = open ? 'hidden' : '';
            if (open) cerrar.focus();
            else menuBtn.focus();
            onScroll();
        }
        menuBtn.addEventListener('click', function () { setMenu(true); });
        cerrar.addEventListener('click', function () { setMenu(false); });
        menu.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                menu.hidden = true;
                menuBtn.setAttribute('aria-expanded', 'false');
                d.body.style.overflow = '';
            });
        });
        d.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !menu.hidden) setMenu(false);
        });
        w.addEventListener('resize', function () {
            if (!menu.hidden && w.innerWidth >= 900) setMenu(false);
        });
    }

    /* En la portada, las anclas internas no dejan el #fragmento en la URL */
    if (w.location.pathname === '/' || w.location.pathname === '/index.html') {
        d.querySelectorAll('.hd a[href^="#"], #menu-movil a[href^="#"]').forEach(function (a) {
            a.addEventListener('click', function () {
                setTimeout(function () { w.history.replaceState(null, d.title, '/'); }, 10);
            });
        });
    }

    /* ── Preguntas frecuentes: un solo acordeón para toda la web ──
       Delegado en el documento: vale para los dos marcados que hay
       (.faq-q + #aria-controls y .faq-btn + .faq-body) y para las
       preguntas que se añadan después. */
    d.addEventListener('click', function (e) {
        var boton = e.target.closest && e.target.closest('.faq-q, .faq-btn');
        if (!boton) return;
        var abierto = boton.getAttribute('aria-expanded') === 'true';
        d.querySelectorAll('.faq-q, .faq-btn').forEach(function (b) {
            b.setAttribute('aria-expanded', 'false');
        });
        d.querySelectorAll('.faq-a, .faq-body').forEach(function (a) {
            a.classList.remove('open');
        });
        if (abierto) return;
        boton.setAttribute('aria-expanded', 'true');
        var destino = boton.getAttribute('aria-controls')
            ? d.getElementById(boton.getAttribute('aria-controls'))
            : (boton.closest('.faq-item') || d).querySelector('.faq-body');
        if (destino) destino.classList.add('open');
    });

    /* ── Wordmark del pie: ocupa exactamente el ancho disponible ── */
    var wordBox = d.querySelector('.ft-word');
    var wordEl = wordBox && wordBox.querySelector('.ft-word-in');
    function ajustarWord() {
        if (!wordEl) return;
        var ancho = wordBox.clientWidth;
        if (!ancho) return;
        wordEl.style.fontSize = '100px';
        var natural = wordEl.getBoundingClientRect().width;
        if (natural > 0) wordEl.style.fontSize = (100 * ancho / natural * 0.995).toFixed(2) + 'px';
    }
    ajustarWord();
    w.addEventListener('resize', ajustarWord);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(ajustarWord);
})();
