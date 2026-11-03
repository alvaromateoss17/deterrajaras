/* Home de deterrajaras.es — interacción y animaciones (solo la usa index.html).
 * La cabecera, el menú móvil y el pie los maneja assets/sitio.js, común a toda la web.
 *
 * Regla de oro: todo el contenido se ve sin JavaScript. Las animaciones de
 * entrada solo ocultan un elemento en el instante en que entra en pantalla,
 * nunca antes, y con prefers-reduced-motion no se anima nada.
 * La entrada de la portada va en CSS (index.html) para no retrasar el LCP.
 */
(function () {
    'use strict';

    var d = document;
    var w = window;
    var reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Preguntas frecuentes: 5 visibles, las otras 4 en el HTML pero ocultas ── */
    var masBtn = d.querySelector('.faq-more');
    var masBox = d.getElementById('faq-mas');
    masBtn.addEventListener('click', function () {
        var abrir = masBox.hidden;
        masBox.hidden = !abrir;
        masBtn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
        masBtn.querySelector('span').textContent = abrir ? 'Ver menos preguntas' : 'Ver las 9 preguntas';
        if (abrir && w.gsap && !reduce) {
            w.gsap.fromTo(masBox.children, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'expo.out', stagger: 0.06, clearProps: 'opacity,visibility,transform' });
        }
        refrescar();
    });
    d.querySelectorAll('.faq details').forEach(function (det) {
        det.addEventListener('toggle', refrescar);
    });

    /* ── Vídeo: siempre en silencio, se reproduce al verse, botón propio ── */
    var video = d.querySelector('.vid video');
    var vidBtn = d.querySelector('.vid-btn');
    if (video) {
        var pausadoAMano = false;
        video.muted = true;
        video.defaultMuted = true;
        video.addEventListener('volumechange', function () { if (!video.muted) video.muted = true; });
        var sync = function () {
            var p = video.paused;
            vidBtn.setAttribute('aria-label', p ? 'Reproducir vídeo' : 'Pausar vídeo');
            vidBtn.classList.toggle('is-paused', p);
        };
        video.addEventListener('play', sync);
        video.addEventListener('pause', sync);
        var reproducir = function () {
            if (video.dataset.poster) { video.poster = video.dataset.poster; delete video.dataset.poster; }
            var p = video.play();
            if (p && p.catch) p.catch(function () { sync(); });
        };
        vidBtn.addEventListener('click', function () {
            video.muted = true;
            if (video.paused) { pausadoAMano = false; reproducir(); }
            else { pausadoAMano = true; video.pause(); }
        });
        if ('IntersectionObserver' in w) {
            /* El póster se pone al acercarse, para no competir con la carga inicial */
            var cerca = new IntersectionObserver(function (entradas) {
                if (entradas[0].isIntersecting && video.dataset.poster) {
                    video.poster = video.dataset.poster;
                    delete video.dataset.poster;
                    cerca.disconnect();
                }
            }, { rootMargin: '0px 0px 600px 0px' });
            cerca.observe(video);
            /* Se reproduce solo mientras se ve, salvo que lo hayan pausado a mano */
            new IntersectionObserver(function (entradas) {
                var e = entradas[0];
                if (e.isIntersecting) {
                    if (!reduce && !pausadoAMano) reproducir();
                } else if (!video.paused) {
                    video.pause();
                }
            }, { threshold: 0.35 }).observe(video);
        } else if (video.dataset.poster) {
            video.poster = video.dataset.poster;
        }
        sync();
    }

    /* ── Formulario: mismo envío que antes (Web3Forms) ── */
    var form = d.getElementById('contactForm');
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = form.querySelector('.form-btn');
        btn.disabled = true;
        btn.textContent = 'Enviando…';
        var data = {
            access_key: '304f42cd-dcac-46b0-87f5-2fe8b77c3582',
            /* Casilla trampa: los robots la rellenan y Web3Forms descarta el envío */
            botcheck: form.querySelector('[name="botcheck"]').checked,
            name: d.getElementById('cf-nombre').value,
            email: d.getElementById('cf-email').value,
            phone: d.getElementById('cf-tel').value,
            message: d.getElementById('cf-msg').value,
            subject: 'Nuevo mensaje desde deterrajaras.es'
        };
        try {
            var res = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(data)
            });
            var json = await res.json();
            if (json.success) {
                form.hidden = true;
                d.getElementById('contactOk').hidden = false;
            } else {
                btn.disabled = false;
                btn.textContent = 'Enviar mensaje';
                alert('Error al enviar. Inténtalo de nuevo o escríbenos directamente.');
            }
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Enviar mensaje';
            alert('Error de conexión. Inténtalo de nuevo.');
        }
    });

    /* El wordmark del pie lo dimensiona assets/sitio.js; aquí solo se anima */
    var wordBox = d.querySelector('.ft-word');
    var wordEl = wordBox && wordBox.querySelector('.ft-word-in');
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { refrescar(); });

    /* ── Animaciones con GSAP + ScrollTrigger ── */
    var refrescoPendiente;
    function refrescar() {
        if (!w.ScrollTrigger) return;
        clearTimeout(refrescoPendiente);
        refrescoPendiente = setTimeout(function () { w.ScrollTrigger.refresh(); }, 60);
    }

    if (reduce) return;

    /* GSAP se pide cuando la página ya ha cargado: no compite con la portada */
    function cargar(src) {
        return new Promise(function (ok, ko) {
            var s = d.createElement('script');
            s.src = src;
            s.onload = ok;
            s.onerror = ko;
            d.head.appendChild(s);
        });
    }
    function arrancar() {
        cargar('/assets/home/gsap.min.js')
            .then(function () { return cargar('/assets/home/ScrollTrigger.min.js'); })
            .then(animar)
            .catch(function () { /* sin GSAP la página se ve igual, solo sin animaciones */ });
    }
    /* Se pide con la primera interacción (o a los 4 s): las animaciones son
       para lo que está por debajo, y así no compiten con la portada */
    var arrancado = false;
    var eventos = ['scroll', 'pointerdown', 'touchstart', 'keydown', 'wheel'];
    function unaVez() {
        if (arrancado) return;
        arrancado = true;
        eventos.forEach(function (ev) { w.removeEventListener(ev, unaVez); });
        arrancar();
    }
    eventos.forEach(function (ev) { w.addEventListener(ev, unaVez, { passive: true }); });
    setTimeout(unaVez, 4000);

    function animar() {
        var gsap = w.gsap;
        var ST = w.ScrollTrigger;
        gsap.registerPlugin(ST);

        var movil = w.matchMedia('(max-width: 699px), (pointer: coarse)').matches;
        var ease = 'expo.out';
        var dist = movil ? 12 : 22;
        var dur = movil ? 0.55 : 0.9;
        var limpiar = 'opacity,visibility,transform';
        var vh = w.innerHeight;
        var retraso = function (el) { return Math.min((+el.dataset.delay || 0) / 1000, movil ? 0.06 : 0.16); };
        /* Solo se anima lo que todavía no está en pantalla: nada visible se oculta */
        var porDebajo = function (el) { return el.getBoundingClientRect().top > vh * 0.92; };
        var alEntrar = function (trigger, fn) {
            ST.create({ trigger: trigger, start: movil ? 'top bottom' : 'top 88%', once: true, onEnter: function () { if (!d.hidden) fn(); } });
        };
        /* En el móvil no se baja la opacidad: si no, el bloque se ve lavado a mitad del scroll. */
        var entrar = function (el, extra) {
            var desde = movil ? { y: dist } : { autoAlpha: 0, y: dist };
            var hasta = movil
                ? { y: 0, duration: dur, ease: ease, delay: retraso(el), clearProps: 'transform' }
                : { autoAlpha: 1, y: 0, duration: dur, ease: ease, delay: retraso(el), clearProps: limpiar };
            if (extra) Object.assign(hasta, extra);
            gsap.fromTo(el, desde, hasta);
        };

        /* Franja de garantías: un paseo constante. En el móvil no se engancha al dedo. */
        var franja = d.querySelector('.marq');
        var pista = d.querySelector('.marq-track');
        var marquee = gsap.to(pista, { xPercent: -50, ease: 'none', duration: movil ? 48 : 42, repeat: -1 });
        if (!movil) {
            franja.addEventListener('mouseenter', function () { gsap.to(marquee, { timeScale: 0, duration: 0.6, overwrite: true }); });
            franja.addEventListener('mouseleave', function () { gsap.to(marquee, { timeScale: 1, duration: 0.8, overwrite: true }); });
        }

        /* Textos y bloques: una subida corta, la misma en toda la página */
        gsap.utils.toArray('[data-reveal]:not([data-reveal="img"])').filter(porDebajo).forEach(function (el) {
            alEntrar(el, function () { entrar(el); });
        });

        /* Fotos: entran enteras. El recorte animado se veía a tirones en el móvil. */
        gsap.utils.toArray('[data-reveal="img"]').filter(porDebajo).forEach(function (el) {
            alEntrar(el, function () { entrar(el, movil ? null : { duration: 1.05 }); });
        });

        /* Iconos */
        gsap.utils.toArray('[data-pop]').filter(porDebajo).forEach(function (el) {
            alEntrar(el, function () { entrar(el, { duration: 0.45, delay: 0.04 }); });
        });

        /* En escritorio la foto de la familia acompaña un poco el scroll. En el móvil, quieta. */
        if (!movil) {
            var familia = d.querySelector('.fam-img');
            if (familia) {
                gsap.fromTo(familia, { yPercent: -4 }, { yPercent: 4, ease: 'none', immediateRender: false, scrollTrigger: { trigger: familia.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.4 } });
            }
        }

        /* Proceso: la línea acompaña al texto, sin arrastrarse con el dedo */
        d.querySelectorAll('.paso').forEach(function (paso) {
            if (!porDebajo(paso)) return;
            var linea = paso.querySelector('.paso-linea');
            var partes = paso.querySelectorAll('.paso-n, h3, p');
            alEntrar(paso, function () {
                if (linea) gsap.fromTo(linea, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: ease, clearProps: 'transform' });
                if (movil) gsap.fromTo(partes, { y: dist }, { y: 0, duration: dur, ease: ease, stagger: 0.06, clearProps: 'transform' });
                else gsap.fromTo(partes, { autoAlpha: 0, y: dist }, { autoAlpha: 1, y: 0, duration: dur, ease: ease, stagger: 0.08, clearProps: limpiar });
            });
        });

        /* Wordmark: entra entero. Letra a letra se cortaba en pantallas estrechas. */
        if (wordEl) {
            alEntrar(wordBox, function () {
                if (movil) gsap.fromTo(wordEl, { y: 14 }, { y: 0, duration: 0.6, ease: ease, clearProps: 'transform' });
                else gsap.fromTo(wordEl, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1, ease: ease, clearProps: limpiar });
            });
        }

        ST.refresh();
    }
})();
