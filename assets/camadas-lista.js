/* Vídeos de la página de camadas: se reproducen en silencio al entrar en
 * pantalla y se paran al salir. Solo lo usa /camadas.
 */
(function () {
    'use strict';

    var tarjetas = document.querySelectorAll('.video-card');
    if (!tarjetas.length) return;

    var videos = [].map.call(tarjetas, function (c) { return c.querySelector('video'); })
        .filter(Boolean);

    /* Póster diferido: no compite con el primer pintado, se pone al acercarse */
    var ponerPoster = function (v) {
        if (v.dataset.poster) { v.poster = v.dataset.poster; delete v.dataset.poster; }
    };

    if (!('IntersectionObserver' in window)) {
        videos.forEach(function (v) {
            ponerPoster(v);
            v.setAttribute('controls', '');
            v.preload = 'metadata';
        });
        return;
    }

    var cerca = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
            if (e.isIntersecting) { ponerPoster(e.target); cerca.unobserve(e.target); }
        });
    }, { rootMargin: '600px 0px' });
    videos.forEach(function (v) { cerca.observe(v); });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        /* Quien pide menos movimiento: controles normales, sin reproducción sola */
        videos.forEach(function (v) { v.setAttribute('controls', ''); v.preload = 'metadata'; });
        return;
    }

    var mirador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
            var v = e.target;
            if (e.isIntersecting) {
                var p = v.play();
                if (p) p.catch(function () { v.setAttribute('controls', ''); });
            } else if (!v.paused) {
                v.pause();
            }
        });
    }, { threshold: 0.35 });
    videos.forEach(function (v) { mirador.observe(v); });
})();
