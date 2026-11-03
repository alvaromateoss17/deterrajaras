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
    /* Se carga al terminar la página, y también si el usuario ya está scrolleando.
       Antes esperaba al primer gesto y el móvil se quedaba con el script en caché. */
    var arrancado = false;
    var eventos = ['scroll', 'pointerdown', 'touchstart', 'keydown', 'wheel'];
    function unaVez() {
        if (arrancado) return;
        arrancado = true;
        eventos.forEach(function (ev) { w.removeEventListener(ev, unaVez); });
        arrancar();
    }
    eventos.forEach(function (ev) { w.addEventListener(ev, unaVez, { passive: true }); });
    function pronto() { setTimeout(unaVez, 280); }
    if (d.readyState === 'complete') pronto();
    else w.addEventListener('load', pronto);

    function animar() {
        var gsap = w.gsap;
        var ST = w.ScrollTrigger;
        gsap.registerPlugin(ST);

        var movil = w.matchMedia('(max-width: 699px), (pointer: coarse)').matches;
        var scrub = true;
        var vh = w.innerHeight;
        /* Lo que ya está en pantalla no se toca. Lo de abajo llega pegado al dedo,
           y está entero antes de poder leerlo: no se queda lavado en el centro. */
        var porDebajo = function (el) { return el.getBoundingClientRect().top > vh * 0.9; };
        var ligado = function (el, desde, hasta, start, end) {
            var vars = {
                ease: 'none',
                immediateRender: true,
                scrollTrigger: {
                    trigger: el,
                    start: start || 'top 100%',
                    end: end || (movil ? 'top 80%' : 'top 72%'),
                    scrub: scrub
                }
            };
            Object.keys(hasta).forEach(function (k) { vars[k] = hasta[k]; });
            gsap.fromTo(el, desde, vars);
        };

        /* Franja de garantías: ritmo fijo. No se invierte con el dedo. */
        var franja = d.querySelector('.marq');
        var pista = d.querySelector('.marq-track');
        var marquee = gsap.to(pista, { xPercent: -50, ease: 'none', duration: movil ? 46 : 40, repeat: -1 });
        if (!movil && franja) {
            franja.addEventListener('mouseenter', function () { gsap.to(marquee, { timeScale: 0, duration: 0.45, overwrite: true }); });
            franja.addEventListener('mouseleave', function () { gsap.to(marquee, { timeScale: 1, duration: 0.6, overwrite: true }); });
        }

        /* Títulos un poco más de recorrido que el párrafo, para que no sea el mismo gesto. */
        gsap.utils.toArray('[data-reveal]:not([data-reveal="img"])').filter(porDebajo).forEach(function (el) {
            var titulo = /^H[1-6]$/.test(el.tagName);
            ligado(el, { y: titulo ? 28 : 16, opacity: 0 }, { y: 0, opacity: 1 }, titulo ? 'top 100%' : 'top 97%', movil ? 'top 92%' : 'top 78%');
        });

        /* Fotos: se asientan dentro del marco. Siempre se ven; no se desvanecen. */
        gsap.utils.toArray('[data-reveal="img"]').filter(porDebajo).forEach(function (el) {
            var foto = el.querySelector('img, video') || el;
            ligado(foto, { scale: 1.06 }, { scale: 1 }, 'top 100%', movil ? 'top 68%' : 'top 58%');
            gsap.fromTo(el, { y: 18 }, {
                y: 0, ease: 'none', immediateRender: true,
                scrollTrigger: { trigger: el, start: 'top 100%', end: movil ? 'top 78%' : 'top 70%', scrub: scrub }
            });
        });

        gsap.utils.toArray('[data-pop]').filter(porDebajo).forEach(function (el) {
            ligado(el, { y: 10, opacity: 0 }, { y: 0, opacity: 1 }, 'top 98%', 'top 86%');
        });

        /* La foto de la familia se mueve un poco menos que el texto, en las dos versiones. */
        var familia = d.querySelector('.fam-img');
        if (familia) {
            gsap.fromTo(familia, { yPercent: movil ? -3 : -5 }, {
                yPercent: movil ? 3 : 5, ease: 'none', immediateRender: false,
                scrollTrigger: { trigger: familia.parentElement, start: 'top bottom', end: 'bottom top', scrub: scrub }
            });
        }

        d.querySelectorAll('.paso').forEach(function (paso) {
            if (!porDebajo(paso)) return;
            var linea = paso.querySelector('.paso-linea');
            if (linea) {
                gsap.fromTo(linea, { scaleX: 0 }, {
                    scaleX: 1, ease: 'none', immediateRender: true, transformOrigin: '0 50%',
                    scrollTrigger: { trigger: paso, start: 'top 96%', end: 'top 72%', scrub: scrub }
                });
            }
            paso.querySelectorAll('.paso-n, h3, p').forEach(function (parte, i) {
                ligado(parte, { y: 16, opacity: 0 }, { y: 0, opacity: 1 }, 'top ' + (98 - i * 2) + '%', 'top 80%');
            });
        });

        /* El nombre del pie entra entero. Letra a letra se quedaba en la D. */
        if (wordEl && porDebajo(wordBox)) {
            ligado(wordEl, { y: 22 }, { y: 0 }, 'top 100%', 'top 78%');
        }

        ST.refresh();
    }
})();
