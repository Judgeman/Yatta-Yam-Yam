/*
 * Pelmeni visitors (see visitors.js for when and how they appear). The Pelmeni look is
 * link-only (?theme=pelmeni), see theme.js.
 *   - a pelmen surfs across the upper half on a wooden spoon, steam trailing behind,
 *   - a little parade of dumpling friends walks along the bottom edge: a pelmen, a
 *     ravioli and a gyoza,
 *   - a pelmen with a sprig of dill for hair dances along the bottom edge,
 *   - a pelmen with a dollop of smetana on its head peeks in from an edge and waves,
 *   - a fork comes down from the top with a rather surprised pelmen on it.
 * Typing "pelmeni" outside a form field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('pelmeni', {
        call: 'pelmeni',
        visitors: [
            {
                name: 'spoon-ride', weight: 2, motion: 'fly', facesRight: true, svg: spoonRideSvg,
                size: function (vw) {
                    var w = clamp(vw * 0.24, 170, 280);
                    return [w, w * 100 / 220];
                },
                speed: 0.22, minMs: 4500, maxMs: 11000, climb: 40, wave: 24
            },
            {
                name: 'parade', weight: 1, motion: 'walk', facesRight: true, svg: paradeSvg,
                size: function (vw, vh) {
                    var h = clamp(vh * 0.12, 65, 95);
                    return [h * 220 / 90, h];
                },
                speed: 0.13, minMs: 7000, maxMs: 13000
            },
            {
                name: 'dance-pelmen', weight: 1, motion: 'walk', svg: dancingPelmenSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.16, 85, 125);
                    return [h * 100 / 110, h];
                },
                speed: 0.15, minMs: 6000, maxMs: 11000
            },
            { name: 'peek-pelmen', weight: 1, motion: 'peek', svg: pelmenPeekSvg },
            {
                name: 'drop-fork', weight: 1, motion: 'drop', svg: forkSvg,
                thread: { color: '#c3c8d2', width: '5px' },
                size: function (vw, vh) {
                    var w = clamp(Math.min(vw, vh) * 0.11, 60, 95);
                    return [w, w * 110 / 80];
                }
            }
        ]
    });

    // ── Figures (inline SVG; animated parts carry yy-v-* classes, see visitors.css) ──

    var DOUGH = '#f6ead0';
    var DOUGH_DARK = '#efe0bd';
    var SEAM = '#d9c39a';
    var CRIMP = '#e2cfa6';
    var INK = '#3a2f24';
    var DILL = '#5f9a2e';

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>';
    }

    function eye(x, y, r) {
        return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + INK + '"/>'
            + '<circle cx="' + (x + r * 0.3) + '" cy="' + (y - r * 0.3) + '" r="' + (r * 0.35) + '" fill="#fff"/>';
    }

    function face(cx, cy, s, mouth) {
        return eye(cx - 6 * s, cy, 2.3 * s) + eye(cx + 6 * s, cy, 2.3 * s)
            + '<circle cx="' + (cx - 10 * s) + '" cy="' + (cy + 5 * s) + '" r="' + (2.6 * s) + '" fill="#f4a6a0" opacity=".55"/>'
            + '<circle cx="' + (cx + 10 * s) + '" cy="' + (cy + 5 * s) + '" r="' + (2.6 * s) + '" fill="#f4a6a0" opacity=".55"/>'
            + (mouth || '<path d="M' + (cx - 3.5 * s) + ' ' + (cy + 5 * s) + ' Q' + cx + ' ' + (cy + 8.5 * s) + ' ' + (cx + 3.5 * s) + ' ' + (cy + 5 * s)
                + '" stroke="' + INK + '" stroke-width="' + (1.5 * s) + '" fill="none" stroke-linecap="round"/>');
    }

    // A plump pelmen ("ear"): dome, crimped seam along the top, the two corners pinched
    // together below; centred on cx with its base at y, half-width w
    function pelmen(cx, y, w) {
        var h = w * 1.15;
        var top = y - h;
        var crimp = '';
        var steps = 8;
        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            var a = Math.PI * (1 - t);
            var px = cx + Math.cos(a) * w * 0.86;
            var py = y - h * 0.22 - Math.sin(a) * h * 0.72;
            crimp += (i === 0 ? 'M' : ' L') + px.toFixed(1) + ' ' + py.toFixed(1);
        }
        return '<circle cx="' + (cx - w * 0.82) + '" cy="' + (y - w * 0.05) + '" r="' + (w * 0.28) + '" fill="' + DOUGH_DARK + '" stroke="' + SEAM + '" stroke-width="1"/>'
            + '<circle cx="' + (cx + w * 0.82) + '" cy="' + (y - w * 0.05) + '" r="' + (w * 0.28) + '" fill="' + DOUGH_DARK + '" stroke="' + SEAM + '" stroke-width="1"/>'
            + '<path d="M' + (cx - w) + ' ' + (y - h * 0.15) + ' C' + (cx - w) + ' ' + (top - h * 0.1) + ' ' + (cx + w) + ' ' + (top - h * 0.1) + ' ' + (cx + w) + ' ' + (y - h * 0.15)
            + ' C' + (cx + w * 0.55) + ' ' + (y + h * 0.08) + ' ' + (cx - w * 0.55) + ' ' + (y + h * 0.08) + ' ' + (cx - w) + ' ' + (y - h * 0.15) + 'Z" fill="' + DOUGH
            + '" stroke="' + SEAM + '" stroke-width="1.4"/>'
            + '<path d="' + crimp + '" stroke="' + CRIMP + '" stroke-width="' + (w * 0.09) + '" stroke-dasharray="' + (w * 0.12) + ' ' + (w * 0.1) + '" fill="none" stroke-linecap="round"/>'
            + '<ellipse cx="' + (cx - w * 0.4) + '" cy="' + (top + h * 0.28) + '" rx="' + (w * 0.22) + '" ry="' + (w * 0.1) + '" fill="#fff" opacity=".6"/>';
    }

    function dillSprig(x, y, s, rot) {
        return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + s + ')" stroke="' + DILL
            + '" stroke-width="1.6" fill="none" stroke-linecap="round">'
            + '<path d="M0 10 L0 -10 M0 -3 L-5 -8 M0 -3 L5 -8 M0 3 L-5 -2 M0 3 L5 -2 M0 -8 L-3 -12 M0 -8 L3 -12"/></g>';
    }

    function legs(cx, y, spread, cls) {
        return '<g class="' + (cls ? 'yy-v-leg-l' : '') + '" style="transform-origin:' + (cx - spread) + 'px ' + (y - 4) + 'px">'
            + '<path d="M' + (cx - spread) + ' ' + (y - 4) + ' L' + (cx - spread - 2) + ' ' + (y + 8) + '" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>'
            + '<ellipse cx="' + (cx - spread - 4) + '" cy="' + (y + 9) + '" rx="4" ry="2.2" fill="' + INK + '"/></g>'
            + '<g class="' + (cls ? 'yy-v-leg-r' : '') + '" style="transform-origin:' + (cx + spread) + 'px ' + (y - 4) + 'px">'
            + '<path d="M' + (cx + spread) + ' ' + (y - 4) + ' L' + (cx + spread + 2) + ' ' + (y + 8) + '" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>'
            + '<ellipse cx="' + (cx + spread + 4) + '" cy="' + (y + 9) + '" rx="4" ry="2.2" fill="' + INK + '"/></g>';
    }

    // A pelmen surfing on a wooden spoon, waving, steam behind; 220 x 100 box, facing right
    function spoonRideSvg() {
        function puff(x, y, r, delay) {
            return '<circle class="yy-v-sparkle" style="transform-origin:' + x + 'px ' + y + 'px;animation-delay:' + delay
                + 's" cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff" opacity=".85"/>';
        }
        return svg('0 0 220 100', ''
            + puff(14, 58, 7, 0) + puff(30, 46, 5, -0.3) + puff(8, 40, 4, -0.6) + puff(36, 64, 4, -0.15)
            + '<path d="M44 74 L150 64" stroke="#a8763e" stroke-width="7" stroke-linecap="round"/>'
            + '<path d="M44 74 L150 64" stroke="#c99a5c" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>'
            + '<ellipse cx="176" cy="62" rx="30" ry="13" fill="#c08a4c" transform="rotate(-6 176 62)"/>'
            + '<ellipse cx="176" cy="60" rx="24" ry="8" fill="#a8763e" opacity=".55" transform="rotate(-6 176 60)"/>'
            + '<g class="yy-v-wave" style="transform-origin:190px 44px">'
            + '<path d="M190 44 L204 26" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>'
            + '<circle cx="205" cy="24" r="3.2" fill="#fff" stroke="' + SEAM + '"/></g>'
            + pelmen(176, 60, 20)
            + face(176, 47, 1));
    }

    // Ravioli: a square pillow with crimped edges; centred on cx, base at y, size w
    function ravioli(cx, y, w) {
        var x0 = cx - w / 2;
        var y0 = y - w;
        var teeth = '';
        for (var i = 0; i <= 8; i++) {
            var t = i * w / 8;
            teeth += '<circle cx="' + (x0 + t) + '" cy="' + y0 + '" r="' + (w * 0.05) + '" fill="#efd9a8"/>'
                + '<circle cx="' + (x0 + t) + '" cy="' + y + '" r="' + (w * 0.05) + '" fill="#efd9a8"/>'
                + '<circle cx="' + x0 + '" cy="' + (y0 + t) + '" r="' + (w * 0.05) + '" fill="#efd9a8"/>'
                + '<circle cx="' + (x0 + w) + '" cy="' + (y0 + t) + '" r="' + (w * 0.05) + '" fill="#efd9a8"/>';
        }
        return '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + w + '" rx="' + (w * 0.08) + '" fill="#f7e2b0" stroke="#dcbf86" stroke-width="1.2"/>'
            + teeth
            + '<rect x="' + (x0 + w * 0.2) + '" y="' + (y0 + w * 0.2) + '" width="' + (w * 0.6) + '" height="' + (w * 0.6) + '" rx="' + (w * 0.25) + '" fill="#fbecc8"/>';
    }

    // Gyoza: a crescent with pleats along the top; centred on cx, base at y, half-width w
    function gyoza(cx, y, w) {
        var pleats = '';
        for (var i = -2; i <= 2; i++) {
            pleats += '<path d="M' + (cx + i * w * 0.28) + ' ' + (y - w * 0.95) + ' q' + (w * 0.08) + ' ' + (w * 0.18) + ' ' + (w * 0.02) + ' ' + (w * 0.32)
                + '" stroke="#d6bf94" stroke-width="1.4" fill="none"/>';
        }
        return '<path d="M' + (cx - w) + ' ' + (y - w * 0.15) + ' Q' + cx + ' ' + (y - w * 1.6) + ' ' + (cx + w) + ' ' + (y - w * 0.15)
            + ' Q' + cx + ' ' + (y + w * 0.25) + ' ' + (cx - w) + ' ' + (y - w * 0.15) + 'Z" fill="#f4ead8" stroke="#d6bf94" stroke-width="1.2"/>'
            + '<path d="M' + (cx - w * 0.85) + ' ' + (y - w * 0.05) + ' Q' + cx + ' ' + (y + w * 0.3) + ' ' + (cx + w * 0.85) + ' ' + (y - w * 0.05)
            + '" stroke="#c9944f" stroke-width="' + (w * 0.18) + '" fill="none" stroke-linecap="round" opacity=".7"/>'
            + pleats;
    }

    // Three dumpling friends walking in a row: gyoza, ravioli, pelmen; 220 x 90 box, facing right
    function paradeSvg() {
        return svg('0 0 220 90', ''
            + '<g class="yy-v-bob" style="animation-delay:-.4s">' + legs(36, 76, 9, true) + gyoza(36, 74, 26) + face(36, 58, 0.85) + '</g>'
            + '<g class="yy-v-bob" style="animation-delay:-.2s">' + legs(106, 76, 10, true) + ravioli(106, 74, 44) + face(106, 50, 0.95) + '</g>'
            + '<g class="yy-v-bob">' + legs(178, 76, 11, true) + dillSprig(182, 44, 0.9, 20) + pelmen(178, 74, 26) + face(178, 58, 1)
            + '</g>');
    }

    // A pelmen with dill for hair, arms and legs, dancing; 100 x 110 box
    function dancingPelmenSvg() {
        function arm(cls, ox, oy, ex, ey) {
            return '<g class="' + cls + '" style="transform-origin:' + ox + 'px ' + oy + 'px">'
                + '<path d="M' + ox + ' ' + oy + ' L' + ex + ' ' + ey + '" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>'
                + '<circle cx="' + ex + '" cy="' + ey + '" r="3.6" fill="#fff" stroke="' + SEAM + '"/></g>';
        }
        return svg('0 0 100 110', ''
            + legs(50, 92, 14, true)
            + arm('yy-v-arm-l', 16, 66, 4, 84) + arm('yy-v-arm-r', 84, 66, 96, 84)
            + pelmen(50, 90, 40)
            + dillSprig(44, 42, 1.2, -18) + dillSprig(56, 40, 1.2, 14)
            + face(50, 66, 1.5));
    }

    // A pelmen with a dollop of smetana on its head, peeking in and waving; 120 x 110 box
    function pelmenPeekSvg() {
        return svg('0 0 120 110', ''
            + '<g class="yy-v-wave" style="transform-origin:96px 84px">'
            + '<path d="M96 84 L110 58" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'
            + '<circle cx="111" cy="55" r="5" fill="#fff" stroke="' + SEAM + '"/></g>'
            + pelmen(58, 102, 46)
            + '<path d="M43 60 C41 48 53 42 60 45 C70 42 77 50 73 60 C67 64 49 64 43 60Z" fill="#fffdf6" stroke="#e7e1d2" stroke-width="1.2"/>'
            + '<path d="M57 45 C59 39 65 37 67 40" stroke="#fffdf6" stroke-width="4" stroke-linecap="round" fill="none"/>'
            + dillSprig(72, 50, 0.75, 35)
            + face(58, 76, 1.5));
    }

    // A fork coming down with a pelmen on its tines; 80 x 110 box
    function forkSvg() {
        return svg('0 0 80 110', ''
            + '<path d="M40 0 L40 24" stroke="#c3c8d2" stroke-width="5" stroke-linecap="round"/>'
            + '<path d="M30 24 Q40 34 50 24 L50 22 L30 22 Z" fill="#c3c8d2"/>'
            // the tines go in behind the dough, so the pelmen looks speared
            + '<path d="M31 24 L31 64 M37 26 L37 64 M43 26 L43 64 M49 24 L49 64" stroke="#c3c8d2" stroke-width="3" stroke-linecap="round"/>'
            + pelmen(40, 92, 30)
            + face(40, 72, 1.2, '<ellipse cx="40" cy="80" rx="3" ry="3.6" fill="' + INK + '"/>'));
    }
})();
