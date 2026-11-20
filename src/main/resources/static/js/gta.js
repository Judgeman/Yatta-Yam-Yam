/*
 * GTA VI homage visitors (see visitors.js for when and how they appear). The look is
 * link-only (?theme=gta), see theme.js. All figures are our own drawings in a Miami
 * neon style; nothing is taken from the game.
 *   - a car chase races along the bottom edge: a sports car, a police car with flashing
 *     lights behind it,
 *   - a helicopter sweeps across the upper half with its searchlight on,
 *   - a speedboat cuts along the bottom edge, spray behind it,
 *   - a flamingo in sunglasses peeks in from an edge and waves,
 *   - a bag of cash comes down from the top on a rope.
 * Typing "vicecity" outside a form field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('gta', {
        call: 'vicecity',
        visitors: [
            {
                name: 'car-chase', weight: 2, motion: 'walk', facesRight: true, svg: chaseSvg,
                size: function (vw, vh) {
                    var h = clamp(vh * 0.1, 55, 80);
                    return [h * 260 / 70, h];
                },
                speed: 0.32, minMs: 3500, maxMs: 7000
            },
            {
                name: 'helicopter', weight: 1, motion: 'fly', facesRight: true, svg: helicopterSvg,
                size: function (vw) {
                    var w = clamp(vw * 0.2, 150, 230);
                    return [w, w * 100 / 160];
                },
                speed: 0.2, minMs: 5000, maxMs: 11000, climb: 30, wave: 16
            },
            {
                name: 'speedboat', weight: 1, motion: 'walk', facesRight: true, svg: speedboatSvg, inner: 'yy-v-bob',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.09, 50, 70);
                    return [h * 180 / 60, h];
                },
                speed: 0.26, minMs: 4000, maxMs: 8000
            },
            { name: 'peek-flamingo', weight: 1, motion: 'peek', svg: flamingoPeekSvg },
            {
                name: 'drop-cash', weight: 1, motion: 'drop', svg: cashBagSvg,
                thread: { color: '#c9a46a', width: '3px' },
                size: function (vw, vh) {
                    var w = clamp(Math.min(vw, vh) * 0.11, 60, 95);
                    return [w, w * 100 / 80];
                }
            }
        ]
    });

    // ── Figures (inline SVG; animated parts carry yy-v-* classes, see visitors.css) ──

    var PINK = '#ff3ea5';
    var TEAL = '#19d3c5';
    var NIGHT = '#2a0f3d';
    var INK = '#1d1124';

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>';
    }

    function wheel(x, y, r) {
        return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + INK + '"/>'
            + '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.45) + '" fill="#c9c9d6"/>';
    }

    // A low sports car facing right; x is its rear, y the road
    function sportsCar(x, y) {
        return '<path d="M' + x + ' ' + (y - 10) + ' L' + (x + 4) + ' ' + (y - 20) + ' L' + (x + 34) + ' ' + (y - 22)
            + ' L' + (x + 50) + ' ' + (y - 32) + ' L' + (x + 74) + ' ' + (y - 32) + ' L' + (x + 92) + ' ' + (y - 22)
            + ' L' + (x + 112) + ' ' + (y - 19) + ' L' + (x + 116) + ' ' + (y - 10) + ' Z" fill="' + PINK + '"/>'
            + '<path d="M' + (x + 52) + ' ' + (y - 30) + ' L' + (x + 72) + ' ' + (y - 30) + ' L' + (x + 86) + ' ' + (y - 22)
            + ' L' + (x + 44) + ' ' + (y - 22) + ' Z" fill="' + TEAL + '" opacity=".85"/>'
            + '<path d="M' + (x + 6) + ' ' + (y - 16) + ' L' + (x + 110) + ' ' + (y - 16) + '" stroke="#fff" stroke-width="1.2" opacity=".6"/>'
            + '<rect x="' + (x + 108) + '" y="' + (y - 19) + '" width="6" height="3" rx="1" fill="#ffe066"/>'
            + '<rect x="' + x + '" y="' + (y - 18) + '" width="4" height="3" fill="#ff3b3b"/>'
            + wheel(x + 24, y - 8, 8) + wheel(x + 94, y - 8, 8);
    }

    // A police car facing right, its light bar flashing red and blue; x is its rear
    function policeCar(x, y) {
        return '<path d="M' + x + ' ' + (y - 10) + ' L' + (x + 2) + ' ' + (y - 22) + ' L' + (x + 26) + ' ' + (y - 24)
            + ' L' + (x + 38) + ' ' + (y - 36) + ' L' + (x + 70) + ' ' + (y - 36) + ' L' + (x + 82) + ' ' + (y - 24)
            + ' L' + (x + 100) + ' ' + (y - 22) + ' L' + (x + 102) + ' ' + (y - 10) + ' Z" fill="#f5f5fa"/>'
            + '<path d="M' + x + ' ' + (y - 18) + ' L' + (x + 102) + ' ' + (y - 18) + ' L' + (x + 102) + ' ' + (y - 12) + ' L' + x + ' ' + (y - 12) + ' Z" fill="#1d2b5c"/>'
            + '<path d="M' + (x + 40) + ' ' + (y - 34) + ' L' + (x + 68) + ' ' + (y - 34) + ' L' + (x + 78) + ' ' + (y - 24)
            + ' L' + (x + 32) + ' ' + (y - 24) + ' Z" fill="#8fb4e8"/>'
            + '<rect x="' + (x + 44) + '" y="' + (y - 41) + '" width="10" height="5" rx="1.5" fill="#ff2d3d" class="yy-v-siren"/>'
            + '<rect x="' + (x + 55) + '" y="' + (y - 41) + '" width="10" height="5" rx="1.5" fill="#2d6bff" class="yy-v-siren yy-v-siren-alt"/>'
            + '<rect x="' + (x + 96) + '" y="' + (y - 21) + '" width="5" height="3" rx="1" fill="#ffe066"/>'
            + wheel(x + 20, y - 8, 8) + wheel(x + 82, y - 8, 8);
    }

    // Sports car chased by a police car, facing right; 260 x 70 box
    function chaseSvg() {
        return svg('0 0 260 70', ''
            + '<path d="M0 30 L18 30 M4 40 L26 40 M10 50 L30 50" stroke="' + TEAL + '" stroke-width="2" stroke-linecap="round" opacity=".7"/>'
            + '<g class="yy-v-bob" style="animation-delay:-.3s">' + policeCar(14, 66) + '</g>'
            + '<path d="M126 36 L136 36 M130 46 L142 46" stroke="' + PINK + '" stroke-width="2" stroke-linecap="round" opacity=".7"/>'
            + '<g class="yy-v-bob">' + sportsCar(142, 66) + '</g>');
    }

    // Helicopter with a spinning rotor and a searchlight; 160 x 100 box, facing right
    function helicopterSvg() {
        return svg('0 0 160 100', ''
            + '<path d="M96 44 L60 100 L130 100 Z" fill="#ffe066" opacity=".22"/>'
            + '<path d="M18 30 L60 34 L60 40 L20 36 Z" fill="' + NIGHT + '"/>'
            + '<path d="M14 22 L22 22 L24 38 L16 38 Z" fill="' + NIGHT + '"/>'
            + '<path d="M56 26 C60 14 108 12 116 30 C120 40 112 48 96 48 L66 48 C58 48 54 38 56 26 Z" fill="#3a1c5c"/>'
            + '<path d="M94 22 C104 22 112 26 114 32 L94 32 Z" fill="' + TEAL + '" opacity=".9"/>'
            + '<path d="M62 32 L92 32" stroke="' + PINK + '" stroke-width="2.4"/>'
            + '<path d="M64 52 L112 52 M72 48 L70 52 M104 48 L106 52" stroke="' + NIGHT + '" stroke-width="2.6" stroke-linecap="round"/>'
            + '<circle cx="96" cy="46" r="3" fill="#ffe066"/>'
            + '<path d="M86 14 L86 8" stroke="' + NIGHT + '" stroke-width="3"/>'
            + '<g class="yy-v-flutter" style="transform-origin:86px 7px"><rect x="40" y="5" width="92" height="3.4" rx="1.7" fill="' + NIGHT + '"/></g>'
            + '<g class="yy-v-flutter" style="transform-origin:18px 22px;animation-delay:-.08s"><rect x="8" y="20.5" width="20" height="3" rx="1.5" fill="' + NIGHT + '"/></g>');
    }

    // Speedboat with spray behind it, facing right; 180 x 60 box
    function speedboatSvg() {
        return svg('0 0 180 60', ''
            + '<path d="M0 46 Q20 40 40 46 Q60 52 80 46" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>'
            + '<circle class="yy-v-sparkle" style="transform-origin:20px 38px" cx="20" cy="38" r="4" fill="#fff" opacity=".8"/>'
            + '<circle class="yy-v-sparkle" style="transform-origin:34px 32px;animation-delay:-.3s" cx="34" cy="32" r="3" fill="#fff" opacity=".8"/>'
            + '<path d="M50 34 L150 34 Q172 34 178 26 L170 46 Q160 52 130 52 L60 52 Z" fill="#f5f5fa"/>'
            + '<path d="M54 42 L170 40" stroke="' + PINK + '" stroke-width="3"/>'
            + '<path d="M58 47 L164 45" stroke="' + TEAL + '" stroke-width="2"/>'
            + '<path d="M96 34 L106 20 L130 20 L140 34 Z" fill="' + TEAL + '" opacity=".8"/>'
            + '<path d="M104 20 L104 14" stroke="' + NIGHT + '" stroke-width="2"/>'
            + '<path d="M60 34 L60 26 L70 26 L70 34" fill="' + NIGHT + '"/>');
    }

    // Flamingo in sunglasses peeking in and waving a wing; 120 x 110 box
    function flamingoPeekSvg() {
        return svg('0 0 120 110', ''
            // a feathered wing, waving
            + '<g class="yy-v-wave" style="transform-origin:80px 94px">'
            + '<path d="M80 94 C84 76 96 62 110 56 L106 62 L114 62 L106 70 L113 72 L102 78 L106 82 L94 86 Z" fill="#ff7bbf"/>'
            + '<path d="M86 86 C92 76 100 68 108 62" stroke="#e0247a" stroke-width="1.4" fill="none"/></g>'
            + '<ellipse cx="60" cy="112" rx="34" ry="22" fill="#ff8cc6"/>'
            + '<path d="M50 96 C40 76 46 58 58 50 C70 42 68 28 58 24" stroke="#ff8cc6" stroke-width="11" fill="none" stroke-linecap="round"/>'
            + '<circle cx="54" cy="22" r="13" fill="#ff8cc6"/>'
            + '<path d="M42 20 C32 22 28 30 30 38 C33 34 36 30 42 28 Z" fill="#fff4ec"/>'
            + '<path d="M30 38 C29 42 30 46 33 47 C33 43 34 40 36 36 Z" fill="' + INK + '"/>'
            + '<rect x="44" y="15" width="22" height="7" rx="3.5" fill="' + INK + '"/>'
            + '<rect x="46" y="16.5" width="8" height="4" rx="2" fill="' + TEAL + '"/>'
            + '<rect x="56" y="16.5" width="8" height="4" rx="2" fill="' + TEAL + '"/>'
            + '<path d="M66 18 L70 16" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>');
    }

    // A bag of cash on a rope, grinning; 80 x 100 box
    function cashBagSvg() {
        return svg('0 0 80 100', ''
            + '<path d="M40 0 L40 26" stroke="#c9a46a" stroke-width="3"/>'
            + '<path d="M30 30 Q40 24 50 30 L48 36 L32 36 Z" fill="#a8763e"/>'
            + '<path d="M32 34 C12 44 10 80 22 92 C32 100 48 100 58 92 C70 80 68 44 48 34 Z" fill="#c99a5c" stroke="#8a6034" stroke-width="1.5"/>'
            + '<path d="M30 34 Q40 40 50 34" stroke="#8a6034" stroke-width="3" fill="none"/>'
            + '<text x="40" y="78" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="22" fill="#2f6b35">$</text>'
            + '<circle cx="33" cy="56" r="2.6" fill="' + INK + '"/><circle cx="47" cy="56" r="2.6" fill="' + INK + '"/>'
            + '<path d="M34 62 Q40 66 46 62" stroke="' + INK + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
            + '<rect x="16" y="88" width="16" height="8" rx="1" fill="#8fd18a" stroke="#3f8a46" stroke-width=".8" transform="rotate(-20 24 92)"/>');
    }
})();
