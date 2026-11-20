/*
 * Garlic visitors (see visitors.js for when and how they appear):
 *   - a garlic bulb with little arms and legs dances along the bottom edge,
 *   - a bat flaps across the upper half in a hurry (it does not like the smell),
 *   - a vampire peeks in from an edge, holding his nose ("Ugh, garlic!"),
 *   - a garlic bulb peeks in from an edge and waves,
 *   - a garlic charm lets itself down from the top on a string.
 * Typing "knoblauch" outside a form field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('garlic', {
        call: 'knoblauch',
        visitors: [
            {
                name: 'dance-garlic', weight: 2, motion: 'walk', svg: garlicSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.17, 90, 135);
                    return [h * 100 / 120, h];
                },
                speed: 0.15, minMs: 6000, maxMs: 11000
            },
            {
                name: 'bat', weight: 1, motion: 'fly', facesRight: true, svg: batSvg, tilt: false,
                size: function (vw) {
                    var w = clamp(vw * 0.13, 100, 160);
                    return [w, w * 70 / 120];
                },
                speed: 0.38, minMs: 3000, maxMs: 6000, climb: 70, wave: 30
            },
            { name: 'peek-vampire', weight: 1, motion: 'peek', svg: vampirePeekSvg },
            { name: 'peek-garlic', weight: 1, motion: 'peek', svg: garlicPeekSvg },
            {
                name: 'drop-garlic', weight: 1, motion: 'drop', svg: garlicCharmSvg,
                thread: { color: '#b08a5a', width: '2px' },
                size: function (vw, vh) {
                    var w = clamp(Math.min(vw, vh) * 0.11, 60, 95);
                    return [w, w * 100 / 80];
                }
            }
        ]
    });

    // ── Figures (inline SVG; animated parts carry yy-v-* classes, see visitors.css) ──

    var SKIN = '#fbf7ee';
    var LINE = '#d9ccb2';
    var STREAK = '#b58ac9';
    var INK = '#3b2f24';

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>';
    }

    function eye(x, y, r) {
        return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + INK + '"/>'
            + '<circle cx="' + (x + r * 0.3) + '" cy="' + (y - r * 0.3) + '" r="' + (r * 0.35) + '" fill="#fff"/>';
    }

    // A garlic bulb body centred on cx with its tip at top and its base at bottom
    function bulb(cx, top, bottom, half) {
        var mid = top + (bottom - top) * 0.55;
        return '<path d="M' + cx + ' ' + top + ' C' + (cx + half * 0.4) + ' ' + (top + 10) + ' ' + (cx + half) + ' ' + (mid - 14) + ' ' + (cx + half) + ' ' + mid
            + ' C' + (cx + half) + ' ' + (bottom - 6) + ' ' + (cx + half * 0.5) + ' ' + bottom + ' ' + cx + ' ' + bottom
            + ' C' + (cx - half * 0.5) + ' ' + bottom + ' ' + (cx - half) + ' ' + (bottom - 6) + ' ' + (cx - half) + ' ' + mid
            + ' C' + (cx - half) + ' ' + (mid - 14) + ' ' + (cx - half * 0.4) + ' ' + (top + 10) + ' ' + cx + ' ' + top + 'Z" fill="' + SKIN
            + '" stroke="' + LINE + '" stroke-width="1.4"/>'
            + '<path d="M' + cx + ' ' + (top + 4) + ' C' + (cx - half * 0.35) + ' ' + mid + ' ' + (cx - half * 0.3) + ' ' + (bottom - 8) + ' ' + (cx - half * 0.15) + ' ' + (bottom - 1)
            + ' M' + cx + ' ' + (top + 4) + ' C' + (cx + half * 0.35) + ' ' + mid + ' ' + (cx + half * 0.3) + ' ' + (bottom - 8) + ' ' + (cx + half * 0.15) + ' ' + (bottom - 1)
            + '" stroke="#e8decb" stroke-width="1.3" fill="none"/>'
            + '<path d="M' + (cx - half * 0.7) + ' ' + (mid - 8) + ' C' + (cx - half * 0.85) + ' ' + mid + ' ' + (cx - half * 0.8) + ' ' + (mid + 10) + ' ' + (cx - half * 0.6) + ' ' + (bottom - 6)
            + ' M' + (cx + half * 0.72) + ' ' + (mid - 6) + ' C' + (cx + half * 0.86) + ' ' + (mid + 2) + ' ' + (cx + half * 0.8) + ' ' + (mid + 10) + ' ' + (cx + half * 0.62) + ' ' + (bottom - 7)
            + '" stroke="' + STREAK + '" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>'
            + '<path d="M' + (cx - 1.8) + ' ' + (top + 1) + ' Q' + cx + ' ' + (top - 9) + ' ' + (cx + 3) + ' ' + (top - 12) + '" stroke="#8fa53a" stroke-width="3" fill="none" stroke-linecap="round"/>';
    }

    function face(cx, cy, s, mouth) {
        return eye(cx - 7 * s, cy, 2.6 * s) + eye(cx + 7 * s, cy, 2.6 * s)
            + '<circle cx="' + (cx - 11 * s) + '" cy="' + (cy + 6 * s) + '" r="' + (3 * s) + '" fill="#f4a6bd" opacity=".6"/>'
            + '<circle cx="' + (cx + 11 * s) + '" cy="' + (cy + 6 * s) + '" r="' + (3 * s) + '" fill="#f4a6bd" opacity=".6"/>'
            + (mouth || '<path d="M' + (cx - 4 * s) + ' ' + (cy + 6 * s) + ' Q' + cx + ' ' + (cy + 10 * s) + ' ' + (cx + 4 * s) + ' ' + (cy + 6 * s)
                + '" stroke="' + INK + '" stroke-width="' + (1.6 * s) + '" fill="none" stroke-linecap="round"/>');
    }

    function limb(cls, ox, oy, ex, ey, end) {
        return '<g class="' + cls + '" style="transform-origin:' + ox + 'px ' + oy + 'px">'
            + '<path d="M' + ox + ' ' + oy + ' L' + ex + ' ' + ey + '" stroke="#8fa53a" stroke-width="3" stroke-linecap="round"/>' + end + '</g>';
    }

    // Garlic bulb with arms and legs, dancing; 100 x 120 box
    function garlicSvg() {
        return svg('0 0 100 120', ''
            + limb('yy-v-leg-l', 42, 96, 38, 112, '<ellipse cx="35" cy="113" rx="6" ry="3" fill="#6b7f2a"/>')
            + limb('yy-v-leg-r', 58, 96, 62, 112, '<ellipse cx="65" cy="113" rx="6" ry="3" fill="#6b7f2a"/>')
            + limb('yy-v-arm-l', 22, 66, 8, 82, '<circle cx="7" cy="84" r="3.4" fill="#8fa53a"/>')
            + limb('yy-v-arm-r', 78, 66, 92, 82, '<circle cx="93" cy="84" r="3.4" fill="#8fa53a"/>')
            + bulb(50, 16, 100, 32)
            + '<path d="M40 100 l-2 6 M50 100 l0 7 M60 100 l2 6" stroke="#c9b48d" stroke-width="1.4"/>'
            + face(50, 62, 1));
    }

    // Bat in a hurry, wings flapping, a drop of sweat; 120 x 70 box, facing right
    function batSvg() {
        var wing = 'M0 0 C-10 -14 -30 -20 -46 -10 C-40 -6 -38 0 -40 6 C-34 2 -28 4 -26 10 C-20 4 -12 6 -8 12 C-6 6 -3 3 0 2Z';
        return svg('0 0 120 70', ''
            + '<g transform="translate(58 34)">'
            + '<g class="yy-v-wing-l" style="transform-origin:0px 0px"><path d="' + wing + '" fill="#3b2a4a"/></g>'
            + '<g class="yy-v-wing-r" style="transform-origin:0px 0px"><g transform="scale(-1 1)"><path d="' + wing + '" fill="#3b2a4a"/></g></g>'
            + '<ellipse cx="0" cy="4" rx="10" ry="12" fill="#4a3660"/>'
            + '<path d="M-7 -6 L-9 -16 L-2 -9 Z M7 -6 L9 -16 L2 -9 Z" fill="#4a3660"/>'
            + '<circle cx="-4" cy="0" r="3.4" fill="#fff"/><circle cx="4.5" cy="0" r="3.4" fill="#fff"/>'
            + '<circle cx="-3" cy="0.5" r="1.6" fill="#1d1622"/><circle cx="5.5" cy="0.5" r="1.6" fill="#1d1622"/>'
            + '<ellipse cx="0.5" cy="8" rx="3" ry="2.2" fill="#1d1622"/>'
            + '<path d="M-1.5 6.5 L-1 9 M2.5 6.5 L2 9" stroke="#fff" stroke-width="1"/>'
            + '<path d="M13 -10 C11 -6 11 -4 13 -3 C15 -4 15 -6 13 -10Z" fill="#8ccaf6"/>'
            + '</g>'
            + '<path d="M8 30 L22 30 M4 38 L20 38 M10 46 L24 44" stroke="#9a8aa8" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>');
    }

    // Vampire holding his nose, with a speech bubble; 120 x 110 box
    function vampirePeekSvg() {
        return svg('0 0 120 110', ''
            + '<path d="M8 110 L18 74 L40 82 L60 92 L80 82 L102 74 L112 110 Z" fill="#1d1622"/>'
            + '<path d="M18 74 L10 54 L40 80 Z M102 74 L110 54 L80 80 Z" fill="#b3122e"/>'
            + '<path d="M44 84 L60 106 L76 84 Z" fill="#fff"/>'
            + '<path d="M56 88 L60 96 L64 88 Z" fill="#b3122e"/>'
            + '<path d="M60 86 L60 70" stroke="#d6e0d2" stroke-width="10"/>'
            + '<ellipse cx="60" cy="56" rx="20" ry="23" fill="#d6e0d2"/>'
            + '<path d="M40 50 Q38 30 60 30 Q82 30 80 50 Q74 40 66 42 L60 50 L54 42 Q46 40 40 50 Z" fill="#1d1622"/>'
            + '<path d="M46 52 L54 55 M74 52 L66 55" stroke="#1d1622" stroke-width="2" stroke-linecap="round"/>'
            + '<path d="M47 58 Q50 55 53 58 M67 58 Q70 55 73 58" stroke="#1d1622" stroke-width="2" fill="none" stroke-linecap="round"/>'
            + '<path d="M51 72 Q60 66 69 72" stroke="#7a1020" stroke-width="2" fill="none" stroke-linecap="round"/>'
            + '<path d="M54 71 L55 75 L56 70.5 M64 70.5 L65 75 L66 71" fill="#fff" stroke="#fff" stroke-width="1"/>'
            // the hand pinching his nose (instead of a wave: he wiggles it)
            + '<g class="yy-v-wave" style="transform-origin:96px 100px">'
            + '<path d="M96 100 Q90 84 68 66" stroke="#1d1622" stroke-width="10" fill="none" stroke-linecap="round"/>'
            + '<circle cx="64" cy="63" r="5.5" fill="#d6e0d2"/>'
            + '<path d="M60 60 L58 56 M63 59 L62 55" stroke="#d6e0d2" stroke-width="2.4" stroke-linecap="round"/></g>'
            + '<path d="M84 6 Q84 0 90 0 L114 0 Q120 0 120 6 L120 26 Q120 32 114 32 L96 32 L90 40 L90 32 Q84 32 84 26 Z" fill="#fff" stroke="#c9c1d6"/>'
            + '<text x="102" y="14" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="9" fill="#5e2d74">Ugh,</text>'
            + '<text x="102" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="9" fill="#5e2d74">garlic!</text>');
    }

    // Garlic bulb peeking in and waving; 120 x 110 box
    function garlicPeekSvg() {
        return svg('0 0 120 110', ''
            + '<g class="yy-v-wave" style="transform-origin:88px 88px">'
            + '<path d="M88 88 L104 62" stroke="#8fa53a" stroke-width="4" stroke-linecap="round"/>'
            + '<circle cx="105" cy="59" r="5" fill="#8fa53a"/></g>'
            + bulb(56, 22, 140, 40)
            + face(56, 70, 1.2));
    }

    // Garlic charm hanging on a string; 80 x 100 box
    function garlicCharmSvg() {
        return svg('0 0 80 100', ''
            + '<path d="M40 0 L40 16" stroke="#b08a5a" stroke-width="2"/>'
            + '<path d="M33 18 Q40 12 47 18" stroke="#b3122e" stroke-width="3" fill="none" stroke-linecap="round"/>'
            + bulb(40, 20, 92, 28)
            + face(40, 60, 0.9, '<ellipse cx="40" cy="67" rx="3.4" ry="4" fill="' + INK + '"/>')
            + '<path d="M30 92 l-2 6 M40 92 l0 7 M50 92 l2 6" stroke="#c9b48d" stroke-width="1.4"/>');
    }
})();
