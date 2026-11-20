/*
 * Pizza visitors (see visitors.js for when and how they appear):
 *   - a whole pizza (one slice already gone) spins across the upper half like a frisbee,
 *   - a pizza slice with arms and legs dances along the bottom edge,
 *   - a pizzaiolo walks along the bottom edge tossing dough into the air,
 *   - a pizza slice peeks in from an edge and waves,
 *   - a pizza slice lets itself down from the top on a long string of cheese.
 * Typing "pizza" outside a form field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('pizza', {
        call: 'pizza',
        visitors: [
            {
                name: 'flying-pizza', weight: 2, motion: 'fly', svg: flyingPizzaSvg, inner: 'yy-v-spin', tilt: false,
                size: function (vw) {
                    var w = clamp(vw * 0.09, 70, 110);
                    return [w, w];
                },
                speed: 0.3, minMs: 3500, maxMs: 8000, climb: 40, wave: 40
            },
            {
                name: 'dance-slice', weight: 1, motion: 'walk', svg: sliceSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.18, 95, 140);
                    return [h * 100 / 130, h];
                },
                speed: 0.15, minMs: 6000, maxMs: 11000
            },
            {
                name: 'pizzaiolo', weight: 1, motion: 'walk', svg: pizzaioloSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.25, 130, 200);
                    return [h * 100 / 170, h];
                },
                speed: 0.12, minMs: 7000, maxMs: 13000
            },
            { name: 'peek-slice', weight: 1, motion: 'peek', svg: slicePeekSvg },
            {
                name: 'drop-slice', weight: 1, motion: 'drop', svg: hangingSliceSvg,
                thread: { color: '#ffd95a', width: '4px' },
                size: function (vw, vh) {
                    var w = clamp(Math.min(vw, vh) * 0.12, 65, 100);
                    return [w, w * 110 / 80];
                }
            }
        ]
    });

    // ── Figures (inline SVG; animated parts carry yy-v-* classes, see visitors.css) ──

    var CRUST = '#d9913f';
    var CRUST_LIGHT = '#e8b061';
    var SAUCE = '#d8432b';
    var CHEESE = '#ffd76a';
    var MOZZA = '#fff1c2';
    var INK = '#3a1f12';

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>';
    }

    function eye(x, y, r) {
        return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + INK + '"/>'
            + '<circle cx="' + (x + r * 0.3) + '" cy="' + (y - r * 0.3) + '" r="' + (r * 0.35) + '" fill="#fff"/>';
    }

    function pepperoni(x, y, r) {
        return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#b8322a"/>'
            + '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.8) + '" fill="#cf3e33"/>'
            + '<circle cx="' + (x - r * 0.35) + '" cy="' + (y - r * 0.2) + '" r="' + (r * 0.14) + '" fill="#8e2219"/>'
            + '<circle cx="' + (x + r * 0.3) + '" cy="' + (y + r * 0.3) + '" r="' + (r * 0.12) + '" fill="#8e2219"/>';
    }

    function basil(x, y, s, r) {
        return '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ') scale(' + s + ')">'
            + '<path d="M0 -7 C5 -4 5 3 0 7 C-5 3 -5 -4 0 -7Z" fill="#3f9a3c"/>'
            + '<path d="M0 -6 L0 6" stroke="#2a7a2a" stroke-width=".8"/></g>';
    }

    // Whole pizza with one slice missing, seen from above; 100 x 100 box (spins as a whole)
    function flyingPizzaSvg() {
        // the pie without the wedge between 300 and 360 degrees
        var r = 48;
        var a = 300 * Math.PI / 180;
        var pie = 'M50 50 L98 50 A' + r + ' ' + r + ' 0 1 1 ' + (50 + r * Math.cos(a)).toFixed(1) + ' ' + (50 + r * Math.sin(a)).toFixed(1) + ' Z';
        return svg('0 0 100 100', ''
            + '<defs><clipPath id="yy-v-pie"><path d="' + pie + '"/></clipPath></defs>'
            + '<g clip-path="url(#yy-v-pie)">'
            + '<circle cx="50" cy="50" r="48" fill="' + CRUST + '"/><circle cx="50" cy="50" r="42" fill="' + CRUST_LIGHT + '"/>'
            + '<circle cx="50" cy="50" r="37" fill="' + SAUCE + '"/>'
            + '<path d="M22 40 C26 22 46 16 60 20 C76 26 84 42 78 58 C74 74 56 82 40 78 C24 74 18 56 22 40Z" fill="' + MOZZA + '"/>'
            + pepperoni(32, 32, 6.5) + pepperoni(62, 70, 6.5) + pepperoni(34, 66, 5.5) + pepperoni(56, 40, 5)
            + basil(46, 54, 1, 30) + basil(26, 50, 0.9, -20) + basil(68, 30, 0.9, 60)
            + '<path d="M50 50 L50 2 M50 50 L8 26 M50 50 L8 74 M50 50 L50 98" stroke="#c97f30" stroke-width="1.2" opacity=".6"/>'
            + '</g>'
            + '<path d="' + pie + '" fill="none" stroke="#b9772c" stroke-width="1.5"/>');
    }

    // A slice, tip down, crust on top, centred on cx; returns the shapes only
    function slice(cx, top, w, h) {
        var left = cx - w / 2;
        var right = cx + w / 2;
        var tip = top + h;
        return '<path d="M' + left + ' ' + (top + 6) + ' L' + right + ' ' + (top + 6) + ' L' + cx + ' ' + tip + ' Z" fill="' + CHEESE + '" stroke="' + SAUCE + '" stroke-width="2.5" stroke-linejoin="round"/>'
            + '<path d="M' + (cx - w * 0.2) + ' ' + (top + h * 0.72) + ' Q' + (cx - w * 0.17) + ' ' + (top + h * 0.86) + ' ' + (cx - w * 0.12) + ' ' + (top + h * 0.82)
            + ' L' + (cx - w * 0.06) + ' ' + (top + h * 0.95) + '" fill="' + CHEESE + '"/>'
            + '<rect x="' + (left - 3) + '" y="' + top + '" width="' + (w + 6) + '" height="12" rx="6" fill="' + CRUST + '"/>'
            + '<rect x="' + (left) + '" y="' + (top + 2) + '" width="' + w + '" height="5" rx="2.5" fill="' + CRUST_LIGHT + '" opacity=".7"/>'
            + pepperoni(cx - w * 0.22, top + h * 0.28, w * 0.09) + pepperoni(cx + w * 0.2, top + h * 0.22, w * 0.08)
            + pepperoni(cx + w * 0.04, top + h * 0.58, w * 0.07) + basil(cx - w * 0.06, top + h * 0.75, 0.8, 20);
    }

    function limb(cls, ox, oy, ex, ey, end) {
        return '<g class="' + cls + '" style="transform-origin:' + ox + 'px ' + oy + 'px">'
            + '<path d="M' + ox + ' ' + oy + ' L' + ex + ' ' + ey + '" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' + end + '</g>';
    }

    // Dancing slice with arms and legs; 100 x 130 box
    function sliceSvg() {
        return svg('0 0 100 130', ''
            + limb('yy-v-leg-l', 44, 92, 38, 118, '<ellipse cx="34" cy="120" rx="7" ry="3.4" fill="' + INK + '"/>')
            + limb('yy-v-leg-r', 56, 92, 62, 118, '<ellipse cx="66" cy="120" rx="7" ry="3.4" fill="' + INK + '"/>')
            + limb('yy-v-arm-l', 26, 40, 10, 58, '<circle cx="9" cy="60" r="4" fill="#fff"/>')
            + limb('yy-v-arm-r', 74, 40, 90, 58, '<circle cx="91" cy="60" r="4" fill="#fff"/>')
            + slice(50, 8, 64, 104)
            + eye(43, 36, 3) + eye(57, 36, 3)
            + '<path d="M44 46 Q50 52 56 46" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/>'
            + '<circle cx="38" cy="45" r="3" fill="#ff9e7a" opacity=".6"/><circle cx="62" cy="45" r="3" fill="#ff9e7a" opacity=".6"/>');
    }

    // Pizzaiolo in a tall hat tossing a disc of dough; 100 x 170 box
    function pizzaioloSvg() {
        return svg('0 0 100 170', ''
            + '<g class="yy-v-toss" style="transform-origin:50px 18px">'
            + '<ellipse cx="50" cy="18" rx="22" ry="7" fill="#f3e3c3" stroke="#d9c39a" stroke-width="1.2"/>'
            + '<ellipse cx="50" cy="17" rx="15" ry="4" fill="#fbf0d9"/></g>'
            + '<g class="yy-v-leg-l" style="transform-origin:42px 128px"><rect x="36" y="126" width="11" height="30" rx="4" fill="#3b3b44"/>'
            + '<ellipse cx="40" cy="158" rx="9" ry="4.5" fill="#1d1d22"/></g>'
            + '<g class="yy-v-leg-r" style="transform-origin:58px 128px"><rect x="53" y="126" width="11" height="30" rx="4" fill="#3b3b44"/>'
            + '<ellipse cx="60" cy="158" rx="9" ry="4.5" fill="#1d1d22"/></g>'
            // arms up towards the dough
            + '<path d="M28 88 L20 64 L32 42" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
            + '<path d="M72 88 L80 64 L68 42" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
            + '<circle cx="33" cy="38" r="5" fill="#f3c9a7"/><circle cx="67" cy="38" r="5" fill="#f3c9a7"/>'
            + '<path d="M26 82 Q50 74 74 82 L76 130 L24 130 Z" fill="#fff" stroke="#e1e1e6" stroke-width="1.2"/>'
            + '<circle cx="44" cy="96" r="2" fill="#c9c9d2"/><circle cx="56" cy="96" r="2" fill="#c9c9d2"/>'
            + '<circle cx="44" cy="108" r="2" fill="#c9c9d2"/><circle cx="56" cy="108" r="2" fill="#c9c9d2"/>'
            + '<path d="M24 120 L76 120" stroke="#d6372b" stroke-width="5"/>'
            + '<path d="M40 76 L60 76 L50 88 Z" fill="#d6372b"/>'
            + '<circle cx="50" cy="62" r="15" fill="#f3c9a7"/>'
            + eye(45, 60, 2.2) + eye(55, 60, 2.2)
            + '<path d="M45 67 Q50 71 55 67" stroke="#7a3b2a" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
            + '<circle cx="41" cy="66" r="2.6" fill="#f09a8a" opacity=".6"/><circle cx="59" cy="66" r="2.6" fill="#f09a8a" opacity=".6"/>'
            + '<path d="M36 52 Q34 40 42 38 Q44 30 50 32 Q56 30 58 38 Q66 40 64 52 Z" fill="#fff" stroke="#e1e1e6" stroke-width="1.2"/>'
            + '<rect x="36" y="49" width="28" height="6" rx="3" fill="#fff" stroke="#e1e1e6" stroke-width="1.2"/>');
    }

    // Slice peeking in and waving; 120 x 110 box
    function slicePeekSvg() {
        return svg('0 0 120 110', ''
            + '<g class="yy-v-wave" style="transform-origin:88px 70px">'
            + '<path d="M88 70 L106 46" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round"/>'
            + '<circle cx="107" cy="43" r="5" fill="#fff" stroke="#e1e1e6"/></g>'
            + slice(56, 22, 76, 150)
            + eye(48, 52, 3.6) + eye(64, 52, 3.6)
            + '<path d="M49 64 Q56 71 63 64" stroke="' + INK + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
            + '<circle cx="41" cy="62" r="3.6" fill="#ff9e7a" opacity=".6"/><circle cx="71" cy="62" r="3.6" fill="#ff9e7a" opacity=".6"/>');
    }

    // Slice hanging from a long string of cheese; 80 x 110 box
    function hangingSliceSvg() {
        return svg('0 0 80 110', ''
            + '<path d="M40 0 L40 14" stroke="#ffd95a" stroke-width="4" stroke-linecap="round"/>'
            + '<path d="M36 12 Q40 18 44 12" stroke="#ffd95a" stroke-width="3" fill="none"/>'
            + slice(40, 12, 56, 94)
            + eye(33, 38, 2.8) + eye(47, 38, 2.8)
            + '<ellipse cx="40" cy="50" rx="3.4" ry="4.2" fill="' + INK + '"/>'
            + '<circle cx="28" cy="46" r="3" fill="#ff9e7a" opacity=".6"/><circle cx="52" cy="46" r="3" fill="#ff9e7a" opacity=".6"/>');
    }
})();
