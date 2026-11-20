/*
 * Pasta visitors (see visitors.js for when and how they appear). The Pasta look is
 * link-only (?theme=pasta), see theme.js.
 *   - a little swarm of farfalle ("butterflies" in Italian) flutters across the upper half,
 *   - a meatball with spaghetti hair dances along the bottom edge,
 *   - a parade of pasta shapes walks along the bottom edge: penne, fusilli and a shell,
 *   - the meatball peeks in from an edge and waves,
 *   - a meatball comes down from the top, dangling from a strand of spaghetti.
 * Typing "pasta" outside a form field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('pasta', {
        call: 'pasta',
        visitors: [
            {
                name: 'farfalle', weight: 2, motion: 'fly', facesRight: true, svg: farfalleSvg, tilt: false,
                size: function (vw) {
                    var w = clamp(vw * 0.24, 170, 280);
                    return [w, w * 120 / 200];
                },
                speed: 0.15, minMs: 5500, maxMs: 13000, climb: 40, wave: 30
            },
            {
                name: 'dance-meatball', weight: 1, motion: 'walk', svg: meatballSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.16, 85, 125);
                    return [h * 100 / 110, h];
                },
                speed: 0.15, minMs: 6000, maxMs: 11000
            },
            {
                name: 'pasta-parade', weight: 1, motion: 'walk', facesRight: true, svg: paradeSvg,
                size: function (vw, vh) {
                    var h = clamp(vh * 0.12, 65, 95);
                    return [h * 220 / 90, h];
                },
                speed: 0.13, minMs: 7000, maxMs: 13000
            },
            { name: 'peek-meatball', weight: 1, motion: 'peek', svg: meatballPeekSvg },
            {
                name: 'drop-spaghetti', weight: 1, motion: 'drop', svg: dangleSvg,
                thread: { color: '#f2d17c', width: '3px' },
                size: function (vw, vh) {
                    var w = clamp(Math.min(vw, vh) * 0.11, 60, 95);
                    return [w, w * 100 / 80];
                }
            }
        ]
    });

    // ── Figures (inline SVG; animated parts carry yy-v-* classes, see visitors.css) ──

    var PASTA = '#f2d17c';
    var EDGE = '#d4ac52';
    var RIDGE = '#c99a3f';
    var MEAT = '#8a4a2b';
    var MEAT_DARK = '#6e3720';
    var SAUCE = '#c9302c';
    var INK = '#2e1d12';

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>';
    }

    function eye(x, y, r) {
        return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + INK + '"/>'
            + '<circle cx="' + (x + r * 0.3) + '" cy="' + (y - r * 0.3) + '" r="' + (r * 0.35) + '" fill="#fff"/>';
    }

    function face(cx, cy, s, mouth) {
        return eye(cx - 6 * s, cy, 2.3 * s) + eye(cx + 6 * s, cy, 2.3 * s)
            + '<circle cx="' + (cx - 10 * s) + '" cy="' + (cy + 5 * s) + '" r="' + (2.6 * s) + '" fill="#f4a6a0" opacity=".6"/>'
            + '<circle cx="' + (cx + 10 * s) + '" cy="' + (cy + 5 * s) + '" r="' + (2.6 * s) + '" fill="#f4a6a0" opacity=".6"/>'
            + (mouth || '<path d="M' + (cx - 3.5 * s) + ' ' + (cy + 5 * s) + ' Q' + cx + ' ' + (cy + 8.5 * s) + ' ' + (cx + 3.5 * s) + ' ' + (cy + 5 * s)
                + '" stroke="' + INK + '" stroke-width="' + (1.5 * s) + '" fill="none" stroke-linecap="round"/>');
    }

    function basil(x, y, s, r) {
        return '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ') scale(' + s + ')">'
            + '<path d="M0 -7 C5 -4 5 3 0 7 C-5 3 -5 -4 0 -7Z" fill="#3f9a3c"/>'
            + '<path d="M0 -6 L0 6" stroke="#2a7a2a" stroke-width=".8"/></g>';
    }

    // A meatball with sauce and a crown of spaghetti curls; centred on cx, cy, radius r
    function meatball(cx, cy, r) {
        var curls = '';
        for (var i = -3; i <= 3; i++) {
            var x = cx + i * r * 0.22;
            var y = cy - r * 0.86 + Math.abs(i) * r * 0.08;
            curls += '<path d="M' + x + ' ' + y + ' q' + (r * 0.12) + ' ' + (-r * 0.35) + ' ' + (r * -0.02) + ' ' + (-r * 0.55)
                + ' q' + (-r * 0.12) + ' ' + (-r * 0.12) + ' ' + (r * 0.06) + ' ' + (-r * 0.28) + '" stroke="' + EDGE
                + '" stroke-width="' + (r * 0.13) + '" fill="none" stroke-linecap="round"/>'
                + '<path d="M' + x + ' ' + y + ' q' + (r * 0.12) + ' ' + (-r * 0.35) + ' ' + (r * -0.02) + ' ' + (-r * 0.55)
                + ' q' + (-r * 0.12) + ' ' + (-r * 0.12) + ' ' + (r * 0.06) + ' ' + (-r * 0.28) + '" stroke="' + PASTA
                + '" stroke-width="' + (r * 0.08) + '" fill="none" stroke-linecap="round"/>';
        }
        var dots = '';
        [[-0.45, -0.2], [0.35, -0.35], [0.5, 0.25], [-0.3, 0.45], [0.05, 0.6], [-0.6, 0.15]].forEach(function (d) {
            dots += '<circle cx="' + (cx + d[0] * r) + '" cy="' + (cy + d[1] * r) + '" r="' + (r * 0.07) + '" fill="' + MEAT_DARK + '"/>';
        });
        return curls
            + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + MEAT + '"/>'
            + dots
            + '<path d="M' + (cx - r * 0.85) + ' ' + (cy - r * 0.3) + ' Q' + cx + ' ' + (cy - r * 1.05) + ' ' + (cx + r * 0.85) + ' ' + (cy - r * 0.3)
            + ' Q' + (cx + r * 0.6) + ' ' + (cy - r * 0.1) + ' ' + (cx + r * 0.4) + ' ' + (cy - r * 0.25)
            + ' Q' + cx + ' ' + (cy - r * 0.05) + ' ' + (cx - r * 0.4) + ' ' + (cy - r * 0.25)
            + ' Q' + (cx - r * 0.6) + ' ' + (cy - r * 0.1) + ' ' + (cx - r * 0.85) + ' ' + (cy - r * 0.3) + 'Z" fill="' + SAUCE + '" opacity=".9"/>'
            + '<ellipse cx="' + (cx - r * 0.35) + '" cy="' + (cy - r * 0.55) + '" rx="' + (r * 0.18) + '" ry="' + (r * 0.08) + '" fill="#fff" opacity=".45"/>';
    }

    // One farfalla seen from above, the two halves flapping; centred on 0, 0
    function farfalla(x, y, s, delay) {
        var half = '<path d="M0 0 L12 -8 Q15 0 12 8 Z" fill="' + PASTA + '" stroke="' + EDGE + '" stroke-width="1" stroke-linejoin="round"/>'
            + '<path d="M12 -8 l1.5 2 l-1.5 2 l1.5 2 l-1.5 2 l1.5 2 l-1.5 2 l1.5 2" stroke="' + EDGE + '" stroke-width=".8" fill="none"/>'
            + '<path d="M3 -1 L10 -4 M3 1 L10 4" stroke="' + EDGE + '" stroke-width=".6"/>';
        return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><g class="yy-v-bob" style="animation-delay:' + delay + 's">'
            + '<g class="yy-v-flutter" style="transform-origin:0px 0px;animation-delay:' + delay + 's">' + half + '</g>'
            + '<g class="yy-v-flutter" style="transform-origin:0px 0px;animation-delay:' + delay + 's"><g transform="scale(-1 1)">' + half + '</g></g>'
            + '<ellipse cx="0" cy="0" rx="3" ry="4.4" fill="#e9c063" stroke="' + EDGE + '" stroke-width=".8"/>'
            + '</g></g>';
    }

    // Five farfalle on their way; 200 x 120 box
    function farfalleSvg() {
        return svg('0 0 200 120', farfalla(152, 40, 1.5, 0) + farfalla(96, 72, 1.2, -0.06)
            + farfalla(44, 32, 1.05, -0.11) + farfalla(120, 102, 0.9, -0.03) + farfalla(30, 92, 0.8, -0.09));
    }

    function legs(cx, y, spread) {
        return '<g class="yy-v-leg-l" style="transform-origin:' + (cx - spread) + 'px ' + (y - 4) + 'px">'
            + '<path d="M' + (cx - spread) + ' ' + (y - 4) + ' L' + (cx - spread - 2) + ' ' + (y + 8) + '" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>'
            + '<ellipse cx="' + (cx - spread - 4) + '" cy="' + (y + 9) + '" rx="4" ry="2.2" fill="' + INK + '"/></g>'
            + '<g class="yy-v-leg-r" style="transform-origin:' + (cx + spread) + 'px ' + (y - 4) + 'px">'
            + '<path d="M' + (cx + spread) + ' ' + (y - 4) + ' L' + (cx + spread + 2) + ' ' + (y + 8) + '" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>'
            + '<ellipse cx="' + (cx + spread + 4) + '" cy="' + (y + 9) + '" rx="4" ry="2.2" fill="' + INK + '"/></g>';
    }

    // Meatball with spaghetti hair, arms and legs, dancing; 100 x 110 box
    function meatballSvg() {
        function arm(cls, ox, oy, ex, ey) {
            return '<g class="' + cls + '" style="transform-origin:' + ox + 'px ' + oy + 'px">'
                + '<path d="M' + ox + ' ' + oy + ' L' + ex + ' ' + ey + '" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>'
                + '<circle cx="' + ex + '" cy="' + ey + '" r="3.6" fill="#fff" stroke="#d9d2c4"/></g>';
        }
        return svg('0 0 100 110', ''
            + legs(50, 96, 12)
            + arm('yy-v-arm-l', 22, 66, 8, 82) + arm('yy-v-arm-r', 78, 66, 92, 82)
            + meatball(50, 64, 30)
            + basil(66, 38, 0.9, 30)
            + face(50, 70, 1.4));
    }

    // Penne, fusilli and a shell walking in a row; 220 x 90 box, facing right
    function paradeSvg() {
        var penne = '<path d="M14 72 L22 28 L44 28 L36 72 Z" fill="' + PASTA + '" stroke="' + EDGE + '" stroke-width="1.4" stroke-linejoin="round"/>'
            + '<path d="M22 72 L29 28 M29 72 L36 28" stroke="' + EDGE + '" stroke-width="1"/>'
            + '<ellipse cx="33" cy="28" rx="11" ry="3" fill="#e9c063" stroke="' + EDGE + '"/>';
        var fusilli = '<rect x="88" y="22" width="30" height="52" rx="14" fill="' + PASTA + '" stroke="' + EDGE + '" stroke-width="1.4"/>';
        for (var i = 0; i < 5; i++) {
            fusilli += '<path d="M90 ' + (30 + i * 9) + ' L116 ' + (24 + i * 9) + '" stroke="' + RIDGE + '" stroke-width="2.4" stroke-linecap="round"/>';
        }
        var shell = '<path d="M152 72 C148 36 196 36 192 72 C182 78 162 78 152 72 Z" fill="' + PASTA + '" stroke="' + EDGE + '" stroke-width="1.4"/>'
            + '<path d="M172 74 L172 46 M162 74 L158 50 M182 74 L186 50" stroke="' + EDGE + '" stroke-width="1.1"/>';
        return svg('0 0 220 90', ''
            + '<g class="yy-v-bob" style="animation-delay:-.4s">' + legs(29, 76, 7) + penne + face(29, 48, 0.8) + '</g>'
            + '<g class="yy-v-bob" style="animation-delay:-.2s">' + legs(103, 76, 8) + fusilli + face(103, 44, 0.9) + '</g>'
            + '<g class="yy-v-bob">' + legs(172, 76, 10) + shell + face(172, 58, 1) + '</g>');
    }

    // The meatball peeking in and waving; 120 x 110 box
    function meatballPeekSvg() {
        return svg('0 0 120 110', ''
            + '<g class="yy-v-wave" style="transform-origin:92px 86px">'
            + '<path d="M92 86 L108 60" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'
            + '<circle cx="109" cy="57" r="5" fill="#fff" stroke="#d9d2c4"/></g>'
            + meatball(58, 72, 36)
            + basil(78, 44, 1.1, 30)
            + face(58, 76, 1.5));
    }

    // A meatball dangling from a strand of spaghetti that loops around it; 80 x 100 box
    function dangleSvg() {
        return svg('0 0 80 100', ''
            + '<path d="M40 0 L40 30" stroke="' + PASTA + '" stroke-width="3" stroke-linecap="round"/>'
            + meatball(40, 62, 24)
            + '<path d="M40 30 C18 34 16 70 30 84 C46 96 66 80 62 60 C60 46 50 40 40 44" stroke="' + EDGE
            + '" stroke-width="4" fill="none" stroke-linecap="round"/>'
            + '<path d="M40 30 C18 34 16 70 30 84 C46 96 66 80 62 60 C60 46 50 40 40 44" stroke="' + PASTA
            + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
            + face(40, 66, 1.1, '<ellipse cx="40" cy="73" rx="3" ry="3.6" fill="' + INK + '"/>'));
    }
})();
