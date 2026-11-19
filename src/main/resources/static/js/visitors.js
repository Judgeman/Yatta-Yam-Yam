/*
 * Seasonal visitors: while a seasonal look is on (see theme.js), a visitor crosses the
 * screen every 1 to 5 minutes, picked at random from that season's cast, never the
 * same one twice in a row. The casts are registered by christmas.js, easter.js,
 * halloween.js, muertos.js, garlic.js, pizza.js and pelmeni.js:
 *
 *   yyVisitors.add('easter', { call: 'hoppel', visitors: [ ... ] });
 *
 * Each visitor has a name, a weight (how often it is picked) and a motion:
 *   fly   across the upper half on a gentle wave (Santa's sleigh, the egg balloon, ...),
 *   walk  along the bottom edge (dancing, hopping),
 *   peek  in from the left, right or bottom edge, wave and leave again,
 *   drop  down from the top on a thread and climb back up (spider, garlic, pizza slice);
 *         thread: { color, width } styles the thread.
 * plus an svg() function that draws it and, for fly and walk, size(vw, vh) → [w, h].
 *
 * The next appearance is kept in sessionStorage, so the 1-5 minute rhythm carries
 * across page loads instead of starting over on every click. When it falls due while
 * the tab is in the background, it shows a moment after the tab is visible again.
 * Opening a ?theme=... preview shows the first visitor after a few seconds. Typing the
 * season's call word ("hohoho", "hoppel", "spuk", "calavera", "knoblauch", "pizza",
 * "pelmeni") outside a form field calls one at once.
 *
 * Nothing appears with "reduce motion" switched on in the OS. The figures are inline
 * SVG, ignore the mouse (pointer-events: none) and are removed when they are done.
 * Styles: css/visitors.css.
 */
(function () {
    'use strict';

    var root = document.documentElement;
    var NEXT_KEY = 'yy-visitor-next';       // sessionStorage: when the next visitor is due (ms)
    var PREVIEW_KEY = 'yy-theme-preview';   // set by theme.js while a preview is on
    var MIN_MS = 60 * 1000;
    var MAX_MS = 5 * 60 * 1000;
    var SOON_MS = 3000;                     // overdue, back in the tab, or a fresh preview

    var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var casts = {};
    var timer = null;
    var busy = false;
    var last = null;

    window.yyVisitors = {
        add: function (theme, cast) {
            casts[theme] = cast;
        },
        clamp: clamp
    };

    // ── Schedule ──

    function currentCast() {
        if (reduced && reduced.matches) {
            return null;
        }
        return casts[root.getAttribute('data-yy-theme')] || null;
    }

    function readStore(key) {
        try {
            return window.sessionStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function schedule(at) {
        window.clearTimeout(timer);
        try {
            window.sessionStorage.setItem(NEXT_KEY, String(at));
        } catch (e) {
            // Blocked storage: the rhythm then restarts on every page
        }
        timer = window.setTimeout(due, Math.max(0, at - Date.now()));
    }

    function scheduleRandom() {
        schedule(Date.now() + Math.round(MIN_MS + Math.random() * (MAX_MS - MIN_MS)));
    }

    function due() {
        if (document.hidden) {
            document.addEventListener('visibilitychange', onVisible);
            return;
        }
        show();
        scheduleRandom();
    }

    function onVisible() {
        if (!document.hidden) {
            document.removeEventListener('visibilitychange', onVisible);
            schedule(Date.now() + SOON_MS);
        }
    }

    function start() {
        var next = parseInt(readStore(NEXT_KEY), 10);
        if (isNaN(next)) {
            if (readStore(PREVIEW_KEY)) {
                schedule(Date.now() + SOON_MS); // first page of a preview: show one right away
            } else {
                scheduleRandom();
            }
        } else if (next > Date.now() + MAX_MS) {
            scheduleRandom(); // the clock was turned back
        } else {
            schedule(Math.max(next, Date.now() + SOON_MS));
        }
    }

    // Typing the season's call word anywhere except in form fields
    var typed = '';
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) {
            return;
        }
        var t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
            return;
        }
        var cast = currentCast();
        if (!cast || !cast.call) {
            typed = '';
            return;
        }
        typed = (typed + e.key.toLowerCase()).slice(-cast.call.length);
        if (typed === cast.call) {
            typed = '';
            show();
        }
    });

    // ── Show one visitor ──

    function pick(cast) {
        var pool = cast.visitors.filter(function (v) {
            return v.name !== last;
        });
        var total = pool.reduce(function (sum, v) {
            return sum + v.weight;
        }, 0);
        var r = Math.random() * total;
        for (var i = 0; i < pool.length; i++) {
            r -= pool[i].weight;
            if (r < 0) {
                return pool[i];
            }
        }
        return pool[pool.length - 1];
    }

    function show() {
        var cast = currentCast();
        if (busy || !cast || !document.body || !document.body.animate) {
            return;
        }
        var visitor = pick(cast);
        var stage = document.createElement('div');
        stage.className = 'yy-visitors';
        stage.setAttribute('aria-hidden', 'true');
        stage.setAttribute('data-visitor', visitor.name);
        document.body.appendChild(stage);
        busy = true;
        last = visitor.name;

        var animation = MOTIONS[visitor.motion](stage, visitor);
        var done = function () {
            if (stage.parentNode) {
                stage.parentNode.removeChild(stage);
            }
            busy = false;
        };
        animation.onfinish = done;
        animation.oncancel = done;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function actor(stage, width, height, html, extraClass) {
        var el = document.createElement('div');
        el.className = 'yy-visitor' + (extraClass ? ' ' + extraClass : '');
        el.style.width = width + 'px';
        el.style.height = height + 'px';
        el.innerHTML = html;
        stage.appendChild(el);
        return el;
    }

    function wrap(html, flip, extraClass) {
        var inner = extraClass ? '<div class="' + extraClass + '">' + html + '</div>' : html;
        return flip ? '<div class="yy-v-flip">' + inner + '</div>' : inner;
    }

    var MOTIONS = {
        // Across the upper half on a gentle wave, climbing a little
        fly: function (stage, v) {
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            var size = v.size(vw, vh);
            var w = size[0];
            var ltr = Math.random() < 0.5;
            // Figures drawn facing right are mirrored when they travel to the left
            var el = actor(stage, w, size[1], wrap(v.svg(), v.facesRight && !ltr, v.inner));
            var from = ltr ? -w : vw;
            var to = ltr ? vw : -w;
            var y0 = vh * (0.12 + Math.random() * 0.22);
            var climb = v.climb || 60;
            var wave = v.wave || 22;
            var frames = [];
            for (var i = 0; i <= 10; i++) {
                var t = i / 10;
                var x = from + (to - from) * t;
                var y = y0 - climb * t + Math.sin(t * Math.PI * 2) * wave;
                var dy = -climb + wave * Math.PI * 2 * Math.cos(t * Math.PI * 2);
                var angle = v.tilt === false ? 0 : Math.atan(dy / (to - from)) * 180 / Math.PI;
                frames.push({ transform: 'translate(' + x + 'px,' + y + 'px) rotate(' + angle.toFixed(2) + 'deg)' });
            }
            return el.animate(frames, {
                duration: clamp(Math.abs(to - from) / v.speed, v.minMs, v.maxMs),
                easing: 'linear'
            });
        },

        // Along the bottom edge; the inner class makes it dance or hop
        walk: function (stage, v) {
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            var size = v.size(vw, vh);
            var w = size[0];
            var h = size[1];
            var ltr = Math.random() < 0.5;
            var el = actor(stage, w, h, wrap(v.svg(), v.facesRight && !ltr, v.inner));
            var from = ltr ? -w : vw;
            var to = ltr ? vw : -w;
            var y = vh - h - 6;
            return el.animate([
                { transform: 'translate(' + from + 'px,' + y + 'px)' },
                { transform: 'translate(' + to + 'px,' + y + 'px)' }
            ], { duration: clamp(Math.abs(to - from) / v.speed, v.minMs, v.maxMs), easing: 'linear' });
        },

        // Leans in from an edge, waves and goes again. Peek figures are 120 x 110 with
        // their lower edge cut off; that edge sits on the screen edge.
        peek: function (stage, v) {
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            var w = clamp(Math.min(vw, vh) * 0.24, 110, 170);
            var h = w * 110 / 120;
            var edge = ['left', 'right', 'bottom'][Math.floor(Math.random() * 3)];
            var turn = edge === 'left' ? 90 : edge === 'right' ? -90 : 0;
            var x = edge === 'left' ? 0 : edge === 'right' ? vw : vw * (0.15 + Math.random() * 0.7);
            var y = edge === 'bottom' ? vh : vh * (0.3 + Math.random() * 0.45);
            var el = actor(stage, w, h, v.svg());
            el.style.left = (x - w / 2) + 'px';
            el.style.top = (y - h) + 'px';
            el.style.transformOrigin = '50% 100%';
            var at = function (tilt, shift) {
                return 'rotate(' + (turn + tilt) + 'deg) translateY(' + shift + '%)';
            };
            return el.animate([
                { transform: at(0, 100), offset: 0, easing: 'cubic-bezier(.2,.9,.3,1.2)' },
                { transform: at(0, 16), offset: 0.16 },
                { transform: at(7, 14), offset: 0.4 },
                { transform: at(-6, 16), offset: 0.66 },
                { transform: at(0, 16), offset: 0.84, easing: 'ease-in' },
                { transform: at(0, 100), offset: 1 }
            ], { duration: 5200 });
        },

        // Lets itself down from the top on a thread (drawn by .yy-visitor-drop::before),
        // dangles for a moment and climbs back up
        drop: function (stage, v) {
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            var size = v.size(vw, vh);
            var w = size[0];
            var h = size[1];
            var x = vw * (0.1 + Math.random() * 0.8) - w / 2;
            var depth = vh * (0.25 + Math.random() * 0.25);
            var el = actor(stage, w, h, wrap(v.svg(), false, v.inner), 'yy-visitor-drop');
            if (v.thread) {
                el.style.setProperty('--yy-thread-color', v.thread.color);
                el.style.setProperty('--yy-thread-width', v.thread.width);
            }
            var at = function (y, tilt) {
                return 'translate(' + x + 'px,' + y + 'px) rotate(' + tilt + 'deg)';
            };
            return el.animate([
                { transform: at(-h, 0), offset: 0, easing: 'cubic-bezier(.3,1.4,.5,1)' },
                { transform: at(depth, 0), offset: 0.22 },
                { transform: at(depth, 6), offset: 0.38 },
                { transform: at(depth, -5), offset: 0.54 },
                { transform: at(depth, 0), offset: 0.7, easing: 'ease-in' },
                { transform: at(-h, 0), offset: 1 }
            ], { duration: 6000 });
        }
    };

    // The casts register while the deferred scripts run; the first visit is seconds away
    start();
})();
