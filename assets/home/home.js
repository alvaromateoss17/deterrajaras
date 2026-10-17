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
            w.gsap.fromTo(masBox.children, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.06, clearProps: 'opacity,visibility,transform' });
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

        var ease = 'expo.out';
        var dist = 28;
        var limpiar = 'opacity,visibility,transform,clipPath';
        var vh = w.innerHeight;
        var retraso = function (el) { return (+el.dataset.delay || 0) / 1000; };
        /* Solo se anima lo que todavía no está en pantalla: nada visible se oculta */
        var porDebajo = function (el) { return el.getBoundingClientRect().top > vh * 0.95; };
        var alEntrar = function (trigger, fn) {
            ST.create({ trigger: trigger, start: 'top bottom', once: true, onEnter: function () { if (!d.hidden) fn(); } });
        };

        /* Franja de garantías: movimiento continuo, acelera con el scroll, se para con el ratón */
        var franja = d.querySelector('.marq');
        var pista = d.querySelector('.marq-track');
        var marquee = gsap.to(pista, { xPercent: -50, ease: 'none', duration: 36, repeat: -1 });
        var calma;
        ST.create({
            start: 0,
            end: 'max',
            onUpdate: function (self) {
                if (franja.matches(':hover')) return;
                var impulso = 1 + Math.min(Math.abs(self.getVelocity()) / 500, 3);
                gsap.to(marquee, { timeScale: impulso * (self.direction < 0 ? -1 : 1), duration: 0.25, overwrite: true });
                clearTimeout(calma);
                calma = setTimeout(function () { gsap.to(marquee, { timeScale: 1, duration: 1, overwrite: true }); }, 140);
            }
        });
        franja.addEventListener('mouseenter', function () { gsap.to(marquee, { timeScale: 0, duration: 0.6, overwrite: true }); });
        franja.addEventListener('mouseleave', function () { gsap.to(marquee, { timeScale: 1, duration: 0.8, overwrite: true }); });

        /* Textos y bloques que suben al aparecer */
        gsap.utils.toArray('[data-reveal]:not([data-reveal="img"])').filter(porDebajo).forEach(function (el) {
            alEntrar(el, function () {
                gsap.fromTo(el, { autoAlpha: 0, y: dist }, { autoAlpha: 1, y: 0, duration: 1, ease: ease, delay: retraso(el), clearProps: limpiar });
            });
        });

        /* Fotos que se descubren */
        gsap.utils.toArray('[data-reveal="img"]').filter(porDebajo).forEach(function (el) {
            alEntrar(el, function () {
                gsap.fromTo(el,
                    { clipPath: 'inset(16% 5% 0% 5% round 18px)', autoAlpha: 0.3 },
                    { clipPath: 'inset(0% 0% 0% 0% round 18px)', autoAlpha: 1, duration: 1.3, ease: ease, delay: retraso(el), clearProps: limpiar });
            });
        });

        /* Iconos con un pequeño giro */
        gsap.utils.toArray('[data-pop]').filter(porDebajo).forEach(function (el) {
            alEntrar(el, function () {
                gsap.fromTo(el, { scale: 0.6, autoAlpha: 0, rotate: -12 }, { scale: 1, autoAlpha: 1, rotate: 0, duration: 0.9, ease: ease, delay: 0.25, clearProps: limpiar });
            });
        });

        /* Profundidad suave en la portada y en la foto de la familia */
        gsap.to('.hero-par', { yPercent: 4, ease: 'none', scrollTrigger: { trigger: '#inicio', start: 'top top', end: 'bottom top', scrub: true } });
        var familia = d.querySelector('.fam-img');
        if (familia) {
            gsap.fromTo(familia, { yPercent: -5 }, { yPercent: 5, ease: 'none', immediateRender: false, scrollTrigger: { trigger: familia.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
        }

        /* Proceso: la línea de cada paso se dibuja con el scroll */
        d.querySelectorAll('.paso').forEach(function (paso) {
            if (!porDebajo(paso)) return;
            var linea = paso.querySelector('.paso-linea');
            gsap.fromTo(linea, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: paso, start: 'top bottom', end: 'top 55%', scrub: 0.5 } });
            var partes = paso.querySelectorAll('.paso-n, h3, p');
            alEntrar(paso, function () {
                gsap.fromTo(partes, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: ease, stagger: 0.07, clearProps: limpiar });
            });
        });

        /* Wordmark: las letras suben una a una */
        if (wordEl) {
            var letras = wordEl.querySelectorAll('span');
            alEntrar(wordBox, function () {
                gsap.fromTo(letras, { yPercent: 105 }, { yPercent: 0, duration: 1.2, ease: ease, stagger: 0.04, clearProps: 'transform' });
            });
        }

        ST.refresh();
    }
})();
