/*
 * Yatta-Yam-Yam Wrapped (/wrapped): turns the stacked slides into a story.
 *
 * Tap the right part of a slide (or press →, Space, swipe left) to go on, the left
 * third (←, swipe right) to go back. The bars at the top show where you are; the
 * slide number is kept in the URL hash, so reloading stays on the same slide.
 * Big numbers with data-wr-count count up when their slide appears.
 * Without JavaScript the slides are simply shown one below the other.
 */
(function () {
    'use strict';

    var stage = document.getElementById('wrapped');
    if (!stage) return;
    var slides = Array.prototype.slice.call(stage.querySelectorAll('.wr-slide'));
    if (slides.length === 0) return;

    var progress = stage.querySelector('.wr-progress');
    var nav = stage.querySelector('.wr-nav');
    var counter = stage.querySelector('.wr-counter');
    var prevBtn = stage.querySelector('[data-wr-prev]');
    var nextBtn = stage.querySelector('[data-wr-next]');
    var restartBtn = stage.querySelector('[data-wr-restart]');
    var hint = stage.querySelector('[data-wr-hint]');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var current = -1;

    var bars = slides.map(function () {
        var bar = document.createElement('span');
        bar.className = 'wr-bar';
        bar.appendChild(document.createElement('i'));
        progress.appendChild(bar);
        return bar;
    });

    stage.classList.add('wr-story');
    document.body.classList.add('wr-story-mode');
    progress.hidden = false;
    nav.hidden = false;
    if (restartBtn) restartBtn.hidden = false;
    if (hint && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
        hint.textContent = 'Click or press → to continue';
    }

    function show(index, moveFocus) {
        if (index < 0 || index >= slides.length || index === current) return;
        current = index;
        slides.forEach(function (slide, n) {
            slide.classList.toggle('is-active', n === index);
        });
        bars.forEach(function (bar, n) {
            bar.classList.toggle('is-done', n < index);
            bar.classList.toggle('is-active', n === index);
        });
        var slide = slides[index];
        slide.scrollTop = 0;
        counter.textContent = (index + 1) + ' / ' + slides.length;
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === slides.length - 1;
        if (moveFocus) slide.focus({preventScroll: true});
        countUp(slide);
        try {
            window.history.replaceState(window.history.state, '', '#' + (index + 1));
        } catch (e) { /* ignore */ }
    }

    function next() { show(current + 1, true); }
    function prev() { show(current - 1, true); }

    // ── Count-up of the big numbers ───────────────────────────────────────────

    function format(value, decimals) {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function countUp(slide) {
        if (reduceMotion) return;
        slide.querySelectorAll('[data-wr-count]').forEach(function (el) {
            var target = parseFloat(el.getAttribute('data-wr-count'));
            if (!isFinite(target) || target <= 0) return;
            if (!el.hasAttribute('data-wr-final')) el.setAttribute('data-wr-final', el.textContent);
            var finalText = el.getAttribute('data-wr-final');
            var decimals = parseInt(el.getAttribute('data-wr-decimals') || '0', 10);
            var prefix = el.getAttribute('data-wr-prefix') || '';
            var token = {};
            el.wrToken = token;
            var start = null;
            var duration = 900;

            function frame(time) {
                if (el.wrToken !== token) return;
                if (start === null) start = time;
                var p = Math.min(1, (time - start) / duration);
                var eased = 1 - Math.pow(1 - p, 3);
                if (p < 1) {
                    var value = decimals > 0 ? target * eased : Math.round(target * eased);
                    el.textContent = prefix + format(value, decimals);
                    window.requestAnimationFrame(frame);
                } else {
                    el.textContent = finalText;
                }
            }
            el.textContent = prefix + format(0, decimals);
            window.requestAnimationFrame(frame);
        });
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);
    if (restartBtn) {
        restartBtn.addEventListener('click', function () { show(0, true); });
    }

    stage.addEventListener('click', function (e) {
        if (e.target.closest('a, button, input, select, textarea, label, .wr-nav')) return;
        var selection = window.getSelection ? String(window.getSelection()) : '';
        if (selection.length > 0) return;
        var rect = stage.getBoundingClientRect();
        if (e.clientX - rect.left < rect.width / 3) prev(); else next();
    });

    document.addEventListener('keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.target.closest && e.target.closest('input, select, textarea')) return;
        switch (e.key) {
            case 'ArrowRight':
            case 'PageDown':
                next(); e.preventDefault(); break;
            case ' ':
                if (e.target.closest && e.target.closest('a, button')) return;
                next(); e.preventDefault(); break;
            case 'ArrowLeft':
            case 'PageUp':
                prev(); e.preventDefault(); break;
            case 'Home':
                show(0, true); e.preventDefault(); break;
            case 'End':
                show(slides.length - 1, true); e.preventDefault(); break;
        }
    });

    var touchX = null;
    var touchY = null;
    stage.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) { touchX = null; return; }
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
    }, {passive: true});
    stage.addEventListener('touchend', function (e) {
        if (touchX === null) return;
        var dx = e.changedTouches[0].clientX - touchX;
        var dy = e.changedTouches[0].clientY - touchY;
        touchX = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
        // A swipe: handle it here and swallow the click that may follow
        e.preventDefault();
        if (dx < 0) next(); else prev();
    });

    var fromHash = parseInt((window.location.hash || '').replace('#', ''), 10);
    show(fromHash >= 1 && fromHash <= slides.length ? fromHash - 1 : 0, false);
})();
