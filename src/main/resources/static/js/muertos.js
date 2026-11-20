/*
 * Día de los Muertos visitors (see visitors.js for when and how they appear):
 *   - a small swarm of monarch butterflies flutters across the upper half (they reach
 *     Mexico around 1 November and are said to carry the souls of the departed),
 *   - a Catrina in her flower hat dances along the bottom edge,
 *   - a skeleton with a marigold crown strolls along the bottom edge playing the guitar,
 *   - a skeleton or the Catrina peeks in from the left, right or bottom edge and waves.
 * Every skull is a decorated sugar skull (calavera). Typing "calavera" outside a form
 * field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('muertos', {
        call: 'calavera',
        visitors: [
            {
                name: 'butterflies', weight: 2, motion: 'fly', facesRight: true, svg: butterfliesSvg, tilt: false,
                size: function (vw) {
                    var w = clamp(vw * 0.26, 180, 300);
                    return [w, w * 120 / 200];
                },
                speed: 0.13, minMs: 6000, maxMs: 14000, climb: 40, wave: 34
            },
            {
                name: 'dance-catrina', weight: 1, motion: 'walk', svg: catrinaSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.24, 125, 190);
                    return [h * 100 / 160, h];
                },
                speed: 0.15, minMs: 6000, maxMs: 11000
            },
            {
                name: 'guitar-skeleton', weight: 1, motion: 'walk', svg: guitarSkeletonSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.22, 120, 180);
                    return [h * 110 / 150, h];
                },
                speed: 0.13, minMs: 7000, maxMs: 12000
            },
            { name: 'peek-skeleton', weight: 1, motion: 'peek', svg: skeletonPeekSvg },
            { name: 'peek-catrina', weight: 1, motion: 'peek', svg: catrinaPeekSvg }
        ]
    });

    // ── Figures (inline SVG; animated parts carry yy-v-* classes, see visitors.css) ──

    var BONE = '#fbf8f2';
    var BONE_LINE = '#d8ccb4';
    var INK = '#2a2030';
    var PINK = '#e4007c';
    var ORANGE = '#f7a400';
    var TURQ = '#00a6a6';
    var PURPLE = '#7b2cbf';
    var DEEP = '#4a148c';

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>';
    }

    function n(v) {
        return Math.round(v * 10) / 10;
    }

    // Pompom marigold (cempasúchil) centred on x, y
    function marigold(x, y, r) {
        var out = '';
        [[r * 0.62, r * 0.42, '#f28c00'], [r * 0.32, r * 0.38, '#ffb300']].forEach(function (ring) {
            for (var i = 0; i < 9; i++) {
                var a = 2 * Math.PI * i / 9 + ring[0];
                out += '<circle cx="' + n(x + ring[0] * Math.cos(a)) + '" cy="' + n(y + ring[0] * Math.sin(a))
                    + '" r="' + n(ring[1]) + '" fill="' + ring[2] + '"/>';
            }
        });
        return out + '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(r * 0.28) + '" fill="#e06c00"/>';
    }

    function rose(x, y, r, color) {
        return '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(r) + '" fill="' + color + '"/>'
            + '<path d="M' + n(x - r * 0.5) + ' ' + n(y) + ' A' + n(r * 0.5) + ' ' + n(r * 0.5) + ' 0 1 1 ' + n(x + r * 0.2) + ' '
            + n(y + r * 0.45) + '" stroke="#fff" stroke-opacity=".55" stroke-width="' + n(r * 0.18) + '" fill="none"/>';
    }

    // A decorated sugar skull (calavera), centred on cx, cy, about 40 * s wide
    function sugarSkull(cx, cy, s) {
        function X(v) { return n(cx + v * s); }
        function Y(v) { return n(cy + v * s); }
        function R(v) { return n(v * s); }
        var out = '<circle cx="' + X(0) + '" cy="' + Y(-2) + '" r="' + R(20) + '" fill="' + BONE + '" stroke="' + BONE_LINE + '" stroke-width="' + R(0.8) + '"/>'
            + '<rect x="' + X(-12) + '" y="' + Y(8) + '" width="' + R(24) + '" height="' + R(15) + '" rx="' + R(6) + '" fill="' + BONE + '"/>';
        [[-8, PINK], [8, TURQ]].forEach(function (eye) {
            for (var i = 0; i < 8; i++) {
                var a = 360 * i / 8;
                var px = eye[0] + 7 * Math.cos(a * Math.PI / 180);
                var py = 7 * Math.sin(a * Math.PI / 180);
                out += '<ellipse cx="' + X(px) + '" cy="' + Y(py) + '" rx="' + R(2.4) + '" ry="' + R(1.4) + '" fill="' + eye[1]
                    + '" transform="rotate(' + a + ' ' + X(px) + ' ' + Y(py) + ')"/>';
            }
            out += '<circle cx="' + X(eye[0]) + '" cy="' + Y(0) + '" r="' + R(4.6) + '" fill="' + INK + '"/>'
                + '<circle cx="' + X(eye[0] + 1.4) + '" cy="' + Y(-1.4) + '" r="' + R(1.2) + '" fill="#fff"/>';
        });
        out += '<path d="M' + X(0) + ' ' + Y(11) + ' C' + X(-3) + ' ' + Y(8) + ' ' + X(-3.5) + ' ' + Y(5) + ' ' + X(-1.5) + ' ' + Y(5)
            + ' C' + X(-0.5) + ' ' + Y(5) + ' ' + X(0) + ' ' + Y(6) + ' ' + X(0) + ' ' + Y(6.5)
            + ' C' + X(0) + ' ' + Y(6) + ' ' + X(0.5) + ' ' + Y(5) + ' ' + X(1.5) + ' ' + Y(5)
            + ' C' + X(3.5) + ' ' + Y(5) + ' ' + X(3) + ' ' + Y(8) + ' ' + X(0) + ' ' + Y(11) + 'Z" fill="' + INK + '"/>'
            + '<path d="M' + X(-9) + ' ' + Y(16) + ' Q' + X(0) + ' ' + Y(19) + ' ' + X(9) + ' ' + Y(16) + '" stroke="' + INK
            + '" stroke-width="' + R(1.2) + '" fill="none" stroke-linecap="round"/>';
        for (var x = -7.5; x <= 7.6; x += 2.5) {
            out += '<path d="M' + X(x) + ' ' + Y(15.2) + ' L' + X(x) + ' ' + Y(19.4) + '" stroke="' + INK + '" stroke-width="' + R(0.9) + '"/>';
        }
        out += marigold(cx, cy - 14 * s, 4.6 * s)
            + '<circle cx="' + X(-7) + '" cy="' + Y(-16) + '" r="' + R(1.1) + '" fill="' + TURQ + '"/>'
            + '<circle cx="' + X(7) + '" cy="' + Y(-16) + '" r="' + R(1.1) + '" fill="' + PINK + '"/>'
            + '<path d="M' + X(-17) + ' ' + Y(6) + ' q' + R(2) + ' ' + R(-3) + ' ' + R(4) + ' 0" stroke="' + PURPLE + '" stroke-width="' + R(1.2) + '" fill="none"/>'
            + '<path d="M' + X(13) + ' ' + Y(6) + ' q' + R(2) + ' ' + R(-3) + ' ' + R(4) + ' 0" stroke="' + ORANGE + '" stroke-width="' + R(1.2) + '" fill="none"/>';
        return out;
    }

    // A crown of marigolds across the top of a skull centred on cx, cy
    function marigoldCrown(cx, cy, s) {
        var out = '';
        [-16, -8, 0, 8, 16].forEach(function (dx, i) {
            var dy = -Math.cos(dx / 20) * 18 - 2;
            out += i % 2 ? rose(cx + dx * s, cy + dy * s, 3.6 * s, i === 1 ? PINK : PURPLE) : marigold(cx + dx * s, cy + dy * s, 5 * s);
        });
        return out;
    }

    function bone(x1, y1, x2, y2, w) {
        return '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="' + BONE + '" stroke-width="' + w + '" stroke-linecap="round"/>';
    }

    // An arm from the shoulder: upper bone, elbow, forearm, a little hand
    function arm(cls, ox, oy, mx, my, ex, ey) {
        return '<g class="' + cls + '" style="transform-origin:' + ox + 'px ' + oy + 'px">'
            + bone(ox, oy, mx, my, 4.5) + '<circle cx="' + mx + '" cy="' + my + '" r="3" fill="' + BONE + '"/>'
            + bone(mx, my, ex, ey, 4) + '<circle cx="' + ex + '" cy="' + ey + '" r="3.6" fill="' + BONE + '"/></g>';
    }

    // Monarch butterfly seen from above, centred on 0, 0, wings flapping
    function monarch(x, y, s, delay) {
        var wing = '<path d="M1 -5 C6 -14 16 -15 19 -9 C21 -4 16 1 2 1 Z" fill="#f28c00" stroke="#1d1622" stroke-width="1.6"/>'
            + '<path d="M2 -3 L15 -10 M3 -1 L17 -5" stroke="#1d1622" stroke-width=".8"/>'
            + '<path d="M1 1 C10 1 15 6 12 12 C9 16 3 12 1 6 Z" fill="#f7a400" stroke="#1d1622" stroke-width="1.6"/>'
            + '<path d="M2 4 L10 9" stroke="#1d1622" stroke-width=".8"/>'
            + '<circle cx="17" cy="-10.5" r=".9" fill="#fff"/><circle cx="18.6" cy="-7" r=".9" fill="#fff"/>'
            + '<circle cx="12" cy="11" r=".8" fill="#fff"/>';
        return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><g class="yy-v-bob" style="animation-delay:' + delay + 's">'
            + '<g class="yy-v-flutter" style="transform-origin:0px 0px;animation-delay:' + delay + 's">' + wing + '</g>'
            + '<g class="yy-v-flutter" style="transform-origin:0px 0px;animation-delay:' + delay + 's"><g transform="scale(-1 1)">' + wing + '</g></g>'
            + '<ellipse cx="0" cy="1" rx="1.6" ry="8" fill="#1d1622"/><circle cx="0" cy="-8" r="2.2" fill="#1d1622"/>'
            + '<path d="M-.5 -9.5 Q-3 -15 -5 -15 M.5 -9.5 Q3 -15 5 -15" stroke="#1d1622" stroke-width=".8" fill="none"/>'
            + '</g></g>';
    }

    // Four monarchs on their way; 200 x 120 box
    function butterfliesSvg() {
        return svg('0 0 200 120', monarch(150, 40, 1.4, 0) + monarch(92, 70, 1.15, -0.07)
            + monarch(40, 34, 1, -0.12) + monarch(118, 100, 0.85, -0.04));
    }

    // Catrina in a long dress and a wide flower hat, dancing; 100 x 160 box
    function catrinaSvg() {
        var hem = 'M14 150';
        for (var i = 0; i < 8; i++) {
            hem += ' Q' + (14 + i * 9 + 4.5) + ' 158 ' + (14 + (i + 1) * 9) + ' 150';
        }
        return svg('0 0 100 160', ''
            + '<g class="yy-v-leg-l" style="transform-origin:44px 140px"><ellipse cx="42" cy="155" rx="6" ry="3.4" fill="' + INK + '"/></g>'
            + '<g class="yy-v-leg-r" style="transform-origin:56px 140px"><ellipse cx="58" cy="155" rx="6" ry="3.4" fill="' + INK + '"/></g>'
            + arm('yy-v-arm-l', 36, 76, 24, 92, 16, 106)
            + arm('yy-v-arm-r', 64, 76, 76, 92, 84, 106)
            + '<path d="M38 92 L62 92 L86 150 L14 150 Z" fill="#d6197a"/>'
            + '<path d="' + hem + ' L86 150 L84 145 L16 145 Z" fill="' + PURPLE + '"/>'
            + '<path d="M24 124 L76 124" stroke="' + ORANGE + '" stroke-width="4"/>'
            + '<path d="M30 110 L70 110" stroke="' + TURQ + '" stroke-width="2.5" stroke-dasharray="4 3"/>'
            + '<path d="M36 72 Q50 68 64 72 L62 94 L38 94 Z" fill="' + PURPLE + '"/>'
            + '<path d="M34 72 Q42 80 50 74 Q58 80 66 72 Q58 70 50 71 Q42 70 34 72 Z" fill="#fff"/>'
            + rose(50, 84, 3.6, PINK)
            + '<path d="M50 60 L50 70" stroke="' + BONE + '" stroke-width="5"/>'
            + sugarSkull(50, 44, 0.85)
            + '<path d="M28 26 Q30 8 50 8 Q70 8 72 26 Z" fill="' + DEEP + '"/>'
            + '<ellipse cx="50" cy="26" rx="36" ry="7" fill="' + DEEP + '"/>'
            + '<path d="M70 20 Q92 2 96 16 Q86 10 74 24 Z" fill="' + TURQ + '"/>'
            + marigold(36, 20, 6) + rose(46, 18, 5, PINK) + marigold(57, 17, 5.5) + rose(66, 21, 4.4, '#ff6fb5')
            + '<circle cx="28" cy="25" r="2" fill="' + ORANGE + '"/><circle cx="74" cy="26" r="2" fill="' + PINK + '"/>');
    }

    // Skeleton with a marigold crown playing the guitar; 110 x 150 box
    function guitarSkeletonSvg() {
        var ribs = '';
        for (var i = 0; i < 3; i++) {
            var y = 72 + i * 7;
            ribs += '<path d="M55 ' + y + ' Q' + (42 + i) + ' ' + (y - 2) + ' ' + (44 + i) + ' ' + (y + 5)
                + ' M55 ' + y + ' Q' + (68 - i) + ' ' + (y - 2) + ' ' + (66 - i) + ' ' + (y + 5) + '"/>';
        }
        return svg('0 0 110 150', ''
            + '<g class="yy-v-sparkle" style="transform-origin:90px 20px"><path d="M88 26 L88 12 L96 10 L96 22" stroke="' + PURPLE
            + '" stroke-width="1.8" fill="none"/><ellipse cx="85.5" cy="26" rx="3" ry="2.2" fill="' + PURPLE + '"/>'
            + '<ellipse cx="93.5" cy="22" rx="3" ry="2.2" fill="' + PURPLE + '"/></g>'
            + '<g class="yy-v-sparkle" style="transform-origin:16px 34px;animation-delay:-.45s"><path d="M18 38 L18 26" stroke="' + PINK
            + '" stroke-width="1.8"/><path d="M18 26 Q24 28 22 34" stroke="' + PINK + '" stroke-width="1.8" fill="none"/>'
            + '<ellipse cx="15.5" cy="38" rx="3" ry="2.2" fill="' + PINK + '"/></g>'
            + '<g class="yy-v-leg-l" style="transform-origin:49px 106px">' + bone(49, 106, 45, 124, 4.5) + bone(45, 124, 46, 140, 4)
            + '<ellipse cx="42" cy="143" rx="7" ry="3.5" fill="' + BONE + '"/></g>'
            + '<g class="yy-v-leg-r" style="transform-origin:61px 106px">' + bone(61, 106, 65, 124, 4.5) + bone(65, 124, 64, 140, 4)
            + '<ellipse cx="68" cy="143" rx="7" ry="3.5" fill="' + BONE + '"/></g>'
            + '<g style="filter:drop-shadow(0 0 1px ' + BONE_LINE + ')">'
            + bone(55, 62, 55, 102, 4.5)
            + '<g stroke="' + BONE + '" stroke-width="3" fill="none" stroke-linecap="round">' + ribs + '</g>'
            + '<path d="M44 100 Q55 94 66 100 Q66 108 60 110 L55 104 L50 110 Q44 108 44 100 Z" fill="' + BONE + '"/>'
            + bone(40, 66, 70, 66, 4) + '</g>'
            // guitar across the body, neck up to the left
            + '<path d="M30 58 L60 86" stroke="#7a4a22" stroke-width="5" stroke-linecap="round"/>'
            + '<rect x="22" y="50" width="11" height="8" rx="2" fill="#5a3418" transform="rotate(42 27 54)"/>'
            + '<path d="M58 80 C66 72 80 76 80 86 C86 88 90 96 84 104 C78 112 64 110 62 100 C54 98 50 88 58 80 Z" fill="#d08a3c" stroke="#8a5222" stroke-width="1.5"/>'
            + '<circle cx="71" cy="93" r="5" fill="#3a2414"/>'
            + '<path d="M66 98 L76 88" stroke="#8a5222" stroke-width="2"/>'
            + '<path d="M58 80 L84 104" stroke="#f3e1c0" stroke-width=".6" opacity=".7"/>'
            + rose(64, 104, 2.6, PINK)
            // the hand on the neck, the strumming hand
            + arm('', 40, 66, 30, 76, 34, 60)
            + '<g class="yy-v-strum" style="transform-origin:70px 66px">' + bone(70, 66, 80, 80, 4.5)
            + '<circle cx="80" cy="80" r="3" fill="' + BONE + '"/>' + bone(80, 80, 74, 92, 4) + '<circle cx="73" cy="93" r="3.6" fill="' + BONE + '"/></g>'
            + bone(55, 52, 55, 62, 5)
            + sugarSkull(55, 34, 0.8)
            + marigoldCrown(55, 34, 0.8));
    }

    // Skeleton in an embroidered shirt with a marigold crown, waving; 120 x 110 box
    function skeletonPeekSvg() {
        return svg('0 0 120 110', ''
            + '<path d="M16 110 Q18 80 60 78 Q102 80 104 110 Z" fill="' + TURQ + '"/>'
            + '<path d="M44 80 L60 96 L76 80" stroke="#fff" stroke-width="3" fill="none"/>'
            + rose(34, 96, 4, PINK) + marigold(86, 96, 5) + rose(60, 104, 3.4, PURPLE)
            + '<g class="yy-v-wave" style="transform-origin:92px 98px">'
            + '<path d="M92 98 L100 82" stroke="' + TURQ + '" stroke-width="13" stroke-linecap="round"/>'
            + bone(100, 80, 106, 60, 5) + '<circle cx="107" cy="56" r="5" fill="' + BONE + '"/>'
            + '<path d="M104 52 L102 44 M107 51 L107 42 M110 52 L112 44" stroke="' + BONE + '" stroke-width="2.4" stroke-linecap="round"/></g>'
            + bone(60, 66, 60, 80, 6)
            + sugarSkull(60, 46, 1.1)
            + marigoldCrown(60, 46, 1.1));
    }

    // Catrina head with her flower hat, ruffled collar and a waving hand; 120 x 110 box
    function catrinaPeekSvg() {
        return svg('0 0 120 110', ''
            + '<path d="M16 110 Q18 84 60 82 Q102 84 104 110 Z" fill="' + PURPLE + '"/>'
            + '<path d="M30 86 Q38 96 46 88 Q53 97 60 88 Q67 97 74 88 Q82 96 90 86 Q76 80 60 81 Q44 80 30 86 Z" fill="#fff"/>'
            + rose(60, 96, 4.4, PINK)
            + '<g class="yy-v-wave" style="transform-origin:92px 98px">'
            + '<path d="M92 98 L100 82" stroke="' + PURPLE + '" stroke-width="12" stroke-linecap="round"/>'
            + '<path d="M95 86 L104 84" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'
            + bone(101, 80, 106, 62, 4.5) + '<circle cx="107" cy="58" r="4.6" fill="' + BONE + '"/>'
            + '<path d="M104 54 L102 47 M107 53 L107 45 M110 54 L112 47" stroke="' + BONE + '" stroke-width="2.2" stroke-linecap="round"/></g>'
            + bone(60, 70, 60, 82, 6)
            + sugarSkull(60, 52, 1.05)
            + '<path d="M30 34 Q32 12 60 12 Q88 12 90 34 Z" fill="' + DEEP + '"/>'
            + '<ellipse cx="60" cy="34" rx="46" ry="8.5" fill="' + DEEP + '"/>'
            + '<path d="M86 26 Q112 4 118 20 Q106 14 90 32 Z" fill="' + TURQ + '"/>'
            + marigold(40, 26, 7.5) + rose(53, 23, 6, PINK) + marigold(67, 22, 7) + rose(80, 28, 5.4, '#ff6fb5')
            + '<circle cx="28" cy="33" r="2.4" fill="' + ORANGE + '"/><circle cx="94" cy="35" r="2.4" fill="' + PINK + '"/>');
    }
})();
