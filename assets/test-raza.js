/* Test "¿Qué raza es para ti?" — solo lo usa /test-raza.
 *
 * Las respuestas van en atributos data-* del HTML (data-pregunta, data-opcion,
 * data-caniche, data-schnauzer), así que la página no necesita nada de
 * JavaScript escrito dentro del propio HTML.
 */
(function () {
    'use strict';

    var d = document;
    var puntos = { C: 0, S: 0 };
    var respuestas = {};

    function verPantalla(id) {
        d.querySelectorAll('.slide').forEach(function (s) { s.classList.remove('active'); });
        var destino = d.getElementById(id);
        if (destino) destino.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function progreso(pregunta) {
        var pct = ((pregunta - 1) / 5) * 100;
        d.querySelectorAll('.progress-bar-fill').forEach(function (el) { el.style.width = pct + '%'; });
        d.querySelectorAll('.progress-label').forEach(function (el) {
            el.textContent = 'Pregunta ' + pregunta + ' de 5';
        });
    }

    function reiniciar() {
        puntos = { C: 0, S: 0 };
        respuestas = {};
        d.querySelectorAll('.option-card').forEach(function (c) { c.classList.remove('selected'); });
    }

    function empezar() {
        reiniciar();
        progreso(1);
        verPantalla('slide-1');
    }

    function repetir() {
        reiniciar();
        verPantalla('slide-0');
    }

    function responder(tarjeta) {
        var pregunta = +tarjeta.dataset.pregunta;
        var opcion = +tarjeta.dataset.opcion;
        respuestas[pregunta] = opcion;
        puntos.C += +tarjeta.dataset.caniche;
        puntos.S += +tarjeta.dataset.schnauzer;

        tarjeta.classList.add('selected');
        setTimeout(function () {
            if (pregunta < 5) {
                progreso(pregunta + 1);
                verPantalla('slide-' + (pregunta + 1));
            } else {
                resultado();
            }
        }, 280);
    }

    function resultado() {
        var textos = redactar();
        if (puntos.C > puntos.S) {
            d.getElementById('result-text-caniche').textContent = textos.caniche;
            verPantalla('slide-result-caniche');
        } else if (puntos.S > puntos.C) {
            d.getElementById('result-text-schnauzer').textContent = textos.schnauzer;
            verPantalla('slide-result-schnauzer');
        } else {
            verPantalla('slide-result-empate');
        }
    }

    function redactar() {
        var hogar = respuestas[1];   /* 0=piso, 1=casa, 2=jardín */
        var ninos = respuestas[2];   /* 0=pequeños, 1=mayores, 2=ninguno */
        var horas = respuestas[3];   /* 0=<4, 1=4-8, 2=>8 */
        var exp = respuestas[4];     /* 0=ninguna, 1=algo, 2=experiencia */
        var prio = respuestas[5];    /* 0=cariño, 1=energía, 2=mantenimiento */

        var c = 'El Caniche Toy encaja perfectamente contigo. ';
        if (hogar === 0) c += 'Su tamaño compacto lo hace ideal para vivir en piso. ';
        else if (hogar === 1) c += 'Se adapta estupendamente a casas amplias. ';
        else c += 'Disfrutará muchísimo de tus espacios exteriores. ';
        if (ninos === 0) c += 'Su carácter dulce y paciente es perfecto para los más pequeños de la casa. ';
        else if (ninos === 1) c += 'Conectará enseguida con los niños de casa gracias a su carácter juguetón. ';
        else c += 'Como compañero de adultos, el Caniche Toy es afectuoso e increíblemente atento. ';
        if (prio === 2 || horas === 2) c += 'Además, al no soltar pelo, el mantenimiento del hogar es mucho más fácil.';
        else c += 'Inteligente y fácil de educar, aprenderá rápidamente todo lo que le enseñes.';

        var s = 'El Schnauzer Mini es la combinación perfecta para tu estilo de vida. ';
        if (hogar === 2) s += 'Con acceso a jardín, tendrá el espacio que necesita para desfogar su energía. ';
        else if (hogar === 1) s += 'Se adapta bien a casas amplias y disfruta de los paseos diarios. ';
        else s += 'Su tamaño compacto le permite adaptarse bien aunque vivas en piso. ';
        if (exp === 2) s += 'Con tu experiencia, sabrás aprovechar toda su inteligencia y ganas de aprender. ';
        else if (exp === 1) s += 'Tu experiencia previa con perros te ayudará a conectar rápido con él. ';
        else s += 'Aunque es tu primer perro, su lealtad y claridad de carácter lo hacen fácil de entender. ';
        if (prio === 1) s += 'Activo y lleno de vida, será el compañero de juegos que estabas buscando.';
        else s += 'Leal a su familia por encima de todo, te dará una fidelidad difícil de encontrar en otra raza.';

        return { caniche: c, schnauzer: s };
    }

    d.addEventListener('click', function (e) {
        var tarjeta = e.target.closest('.option-card[data-pregunta]');
        if (tarjeta) { responder(tarjeta); return; }
        var boton = e.target.closest('[data-test]');
        if (!boton) return;
        if (boton.dataset.test === 'empezar') empezar();
        else if (boton.dataset.test === 'repetir') repetir();
    });

    /* Si alguna foto de resultado no carga, se quita en vez de dejar el hueco */
    d.querySelectorAll('.quiz-wrap img').forEach(function (img) {
        var ocultar = function () { img.style.display = 'none'; };
        img.addEventListener('error', ocultar);
        if (img.complete && img.naturalWidth === 0) ocultar();
    });
})();
