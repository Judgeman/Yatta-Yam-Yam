/*
 * Easter visitors (see visitors.js for when and how they appear):
 *   - the Easter bunny floats across the upper half in an egg-shaped balloon,
 *   - the Easter bunny hops along the bottom edge with a basket of eggs,
 *   - a chick in an eggshell cap dances along the bottom edge,
 *   - the bunny, or a chick in its egg, peeks in from the left, right or bottom edge
 *     and waves.
 * Typing "hoppel" outside a form field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('easter', {
        call: 'hoppel',
        visitors: [
            {
                name: 'balloon', weight: 2, motion: 'fly', svg: balloonSvg, inner: 'yy-v-sway', tilt: false,
                size: function (vw, vh) {
                    var h = clamp(vh * 0.32, 150, 250);
                    return [h * 160 / 230, h];
                },
                speed: 0.1, minMs: 7000, maxMs: 16000, climb: 30, wave: 14
            },
            {
                name: 'hop-bunny', weight: 1, motion: 'walk', facesRight: true, svg: bunnySvg, inner: 'yy-v-bunny-hop',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.16, 85, 125);
                    return [h * 120 / 100, h];
                },
                speed: 0.17, minMs: 6000, maxMs: 11000
            },
            {
                name: 'dance-chick', weight: 1, motion: 'walk', svg: chickSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.14, 75, 110);
                    return [h * 100 / 110, h];
                },
                speed: 0.15, minMs: 6000, maxMs: 11000
            },
            { name: 'peek-bunny', weight: 1, motion: 'peek', svg: bunnyPeekSvg },
            { name: 'peek-chick', weight: 1, motion: 'peek', svg: chickPeekSvg }
        ]
    });

    // ── Figures (inline SVG; animated parts carry yy-v-* classes, see visitors.css) ──

    var FUR = '#e3c49f';
    var FUR_DARK = '#c9a47b';
    var CREAM = '#f7ead8';
    var PINK = '#f4a6bd';
    var NOSE = '#e8799a';
    var EYE = '#2a1e16';
    var CHICK = '#ffd84d';
    var CHICK_LIGHT = '#ffe98f';
    var CHICK_WING = '#f5c531';
    var ORANGE = '#f59e2b';

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>';
    }

    function eye(x, y, r) {
        return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + EYE + '"/>'
            + '<circle cx="' + (x + r * 0.3) + '" cy="' + (y - r * 0.3) + '" r="' + (r * 0.35) + '" fill="#fff"/>';
    }

    // A small egg centred on x, y (narrower at the top)
    function egg(x, y, w, h, fill, band) {
        var d = 'M' + x + ' ' + (y - h)
            + ' C' + (x + w * 0.55) + ' ' + (y - h) + ' ' + (x + w) + ' ' + (y - h * 0.25) + ' ' + (x + w) + ' ' + (y + h * 0.25)
            + ' C' + (x + w) + ' ' + (y + h * 0.75) + ' ' + (x + w * 0.55) + ' ' + (y + h) + ' ' + x + ' ' + (y + h)
            + ' C' + (x - w * 0.55) + ' ' + (y + h) + ' ' + (x - w) + ' ' + (y + h * 0.75) + ' ' + (x - w) + ' ' + (y + h * 0.25)
            + ' C' + (x - w) + ' ' + (y - h * 0.25) + ' ' + (x - w * 0.55) + ' ' + (y - h) + ' ' + x + ' ' + (y - h) + 'Z';
        return '<path d="' + d + '" fill="' + fill + '"/>'
            + '<path d="M' + (x - w * 0.95) + ' ' + y + ' L' + (x + w * 0.95) + ' ' + y + '" stroke="' + band
            + '" stroke-width="' + (h * 0.28) + '" stroke-dasharray="' + (w * 0.35) + ' ' + (w * 0.2) + '"/>';
    }

    // Wicker basket with three eggs, its rim at y, centred on x
    function basket(x, y, w) {
        var h = w * 0.62;
        return egg(x - w * 0.27, y - 1, w * 0.17, w * 0.22, '#f7a8c4', '#e0679a')
            + egg(x + w * 0.02, y - 3, w * 0.17, w * 0.22, '#ffe082', '#f2b632')
            + egg(x + w * 0.3, y - 1, w * 0.17, w * 0.22, '#a8e6cf', '#4fbf8f')
            + '<path d="M' + (x - w / 2) + ' ' + y + ' L' + (x + w / 2) + ' ' + y + ' L' + (x + w * 0.4) + ' ' + (y + h)
            + ' Q' + x + ' ' + (y + h * 1.12) + ' ' + (x - w * 0.4) + ' ' + (y + h) + ' Z" fill="#c8894e"/>'
            + '<path d="M' + (x - w * 0.45) + ' ' + (y + h * 0.35) + ' L' + (x + w * 0.45) + ' ' + (y + h * 0.35)
            + ' M' + (x - w * 0.42) + ' ' + (y + h * 0.7) + ' L' + (x + w * 0.42) + ' ' + (y + h * 0.7)
            + '" stroke="#a96d36" stroke-width="' + (w * 0.05) + '"/>'
            + '<rect x="' + (x - w * 0.55) + '" y="' + (y - w * 0.06) + '" width="' + (w * 1.1) + '" height="' + (w * 0.13)
            + '" rx="' + (w * 0.06) + '" fill="#a96d36"/>';
    }

    // Easter bunny seen from the side, facing right, with a basket; 120 x 100 box
    function bunnySvg() {
        return svg('0 0 120 100', ''
            + '<g class="yy-v-ear" style="transform-origin:82px 30px">'
            + '<ellipse cx="78" cy="14" rx="6" ry="17" fill="' + FUR_DARK + '" transform="rotate(-22 78 14)"/></g>'
            + '<circle cx="23" cy="60" r="9" fill="#fff" stroke="#e2dccf"/>'
            + '<ellipse cx="44" cy="86" rx="17" ry="6.5" fill="' + FUR_DARK + '"/>'
            + '<ellipse cx="54" cy="63" rx="29" ry="22" fill="' + FUR + '"/>'
            + '<ellipse cx="44" cy="70" rx="13" ry="12" fill="' + FUR_DARK + '" opacity=".45"/>'
            + '<ellipse cx="66" cy="70" rx="13" ry="12" fill="' + CREAM + '"/>'
            + '<ellipse cx="72" cy="87" rx="8" ry="4.5" fill="' + FUR + '"/>'
            + '<g class="yy-v-ear yy-v-ear-alt" style="transform-origin:88px 30px">'
            + '<ellipse cx="88" cy="13" rx="6.5" ry="18" fill="' + FUR + '" transform="rotate(-8 88 13)"/>'
            + '<ellipse cx="88" cy="14" rx="3" ry="12.5" fill="' + PINK + '" transform="rotate(-8 88 14)"/></g>'
            + '<circle cx="88" cy="42" r="16" fill="' + FUR + '"/>'
            + '<ellipse cx="99" cy="48" rx="7.5" ry="6" fill="' + CREAM + '"/>'
            + '<ellipse cx="104" cy="44.5" rx="2.8" ry="2.2" fill="' + NOSE + '"/>'
            + eye(92, 38, 2.5)
            + '<circle cx="91" cy="49" r="3" fill="' + PINK + '" opacity=".6"/>'
            + '<path d="M101 48 L114 46 M101 50 L114 52" stroke="#9c8063" stroke-width=".7"/>'
            + basket(90, 70, 24)
            + '<ellipse cx="80" cy="70" rx="5" ry="4" fill="' + FUR + '"/>');
    }

    // Bunny from the front: head, tall ears, shoulders and a waving paw; 120 x 110 box
    function bunnyPeekSvg() {
        return svg('0 0 120 110', ''
            + '<g transform="rotate(-12 46 46)"><ellipse cx="46" cy="22" rx="10" ry="24" fill="' + FUR + '"/>'
            + '<ellipse cx="46" cy="24" rx="5" ry="17" fill="' + PINK + '"/></g>'
            + '<g class="yy-v-ear" style="transform-origin:72px 44px"><g transform="rotate(14 72 46)">'
            + '<ellipse cx="72" cy="22" rx="10" ry="24" fill="' + FUR + '"/>'
            + '<ellipse cx="72" cy="24" rx="5" ry="17" fill="' + PINK + '"/></g></g>'
            + '<path d="M16 110 Q18 80 60 78 Q102 80 104 110 Z" fill="' + FUR + '"/>'
            + '<ellipse cx="60" cy="104" rx="19" ry="15" fill="' + CREAM + '"/>'
            + '<g class="yy-v-wave" style="transform-origin:92px 98px">'
            + '<path d="M92 98 L104 66" stroke="' + FUR + '" stroke-width="12" stroke-linecap="round"/>'
            + '<ellipse cx="106" cy="59" rx="7.5" ry="7" fill="' + FUR + '"/>'
            + '<circle cx="106" cy="60" r="2.4" fill="' + PINK + '"/></g>'
            + '<ellipse cx="60" cy="60" rx="24" ry="21" fill="' + FUR + '"/>'
            + '<ellipse cx="53" cy="69" rx="8.5" ry="6.5" fill="' + CREAM + '"/>'
            + '<ellipse cx="67" cy="69" rx="8.5" ry="6.5" fill="' + CREAM + '"/>'
            + '<rect x="56.5" y="70" width="7" height="6" rx="1.5" fill="#fff" stroke="#e2dccf" stroke-width=".8"/>'
            + '<path d="M60 70 L60 76" stroke="#e2dccf" stroke-width=".8"/>'
            + '<ellipse cx="60" cy="64.5" rx="4.2" ry="3.2" fill="' + NOSE + '"/>'
            + eye(50, 55, 3.2) + eye(70, 55, 3.2)
            + '<circle cx="45" cy="64" r="3.6" fill="' + PINK + '" opacity=".6"/>'
            + '<circle cx="75" cy="64" r="3.6" fill="' + PINK + '" opacity=".6"/>'
            + '<path d="M47 68 L36 66 M47 70.5 L36 72 M73 68 L84 66 M73 70.5 L84 72" stroke="#9c8063" stroke-width=".7"/>'
            + '<path d="M52 84 L60 88 L68 84 L68 92 L60 88 L52 92 Z" fill="#9fd3f7" stroke="#4fa3dc" stroke-width="1"/>'
            + '<circle cx="60" cy="88" r="2.4" fill="#4fa3dc"/>');
    }

    // The top half of an eggshell with a zigzag edge, as a cap; centred on x, edge at y
    function shellCap(x, y, w, fill) {
        var d = 'M' + (x - w) + ' ' + y + ' Q' + (x - w) + ' ' + (y - w * 1.15) + ' ' + x + ' ' + (y - w * 1.15)
            + ' Q' + (x + w) + ' ' + (y - w * 1.15) + ' ' + (x + w) + ' ' + y;
        for (var i = 1; i <= 6; i++) {
            d += ' L' + (x + w - i * w / 3) + ' ' + (y + (i % 2 ? -w * 0.22 : 0));
        }
        return '<path d="' + d + ' Z" fill="' + fill + '" stroke="#e5ddd0" stroke-width="1"/>'
            + '<circle cx="' + (x - w * 0.35) + '" cy="' + (y - w * 0.6) + '" r="' + (w * 0.13) + '" fill="#9fd3f7"/>'
            + '<circle cx="' + (x + w * 0.3) + '" cy="' + (y - w * 0.75) + '" r="' + (w * 0.11) + '" fill="#f7a8c4"/>';
    }

    // A chick from the front, wearing its eggshell as a cap; 100 x 110 box
    function chickSvg() {
        return svg('0 0 100 110', ''
            + '<g class="yy-v-leg-l" style="transform-origin:42px 88px">'
            + '<path d="M42 88 L40 102 M40 102 L33 106 M40 102 L40 108 M40 102 L46 106" stroke="' + ORANGE
            + '" stroke-width="3" stroke-linecap="round" fill="none"/></g>'
            + '<g class="yy-v-leg-r" style="transform-origin:58px 88px">'
            + '<path d="M58 88 L60 102 M60 102 L54 106 M60 102 L60 108 M60 102 L67 106" stroke="' + ORANGE
            + '" stroke-width="3" stroke-linecap="round" fill="none"/></g>'
            + '<g class="yy-v-wing-l" style="transform-origin:28px 60px">'
            + '<ellipse cx="22" cy="68" rx="8" ry="14" fill="' + CHICK_WING + '" transform="rotate(25 22 68)"/></g>'
            + '<g class="yy-v-wing-r" style="transform-origin:72px 60px">'
            + '<ellipse cx="78" cy="68" rx="8" ry="14" fill="' + CHICK_WING + '" transform="rotate(-25 78 68)"/></g>'
            + '<circle cx="50" cy="66" r="27" fill="' + CHICK + '"/>'
            + '<ellipse cx="50" cy="75" rx="17" ry="13" fill="' + CHICK_LIGHT + '"/>'
            + '<circle cx="50" cy="34" r="18" fill="' + CHICK + '"/>'
            + eye(43, 34, 2.6) + eye(57, 34, 2.6)
            + '<circle cx="39" cy="41" r="3" fill="#ff9e7a" opacity=".55"/>'
            + '<circle cx="61" cy="41" r="3" fill="#ff9e7a" opacity=".55"/>'
            + '<path d="M45 40 L50 37 L55 40 L50 45 Z" fill="' + ORANGE + '"/>'
            + shellCap(50, 25, 17, '#fff'));
    }

    // A chick in the lower half of a painted egg, waving one wing; 120 x 110 box
    function chickPeekSvg() {
        var rim = 'M22 74';
        for (var i = 1; i <= 12; i++) {
            rim += ' L' + (22 + i * 6.33) + ' ' + (i % 2 ? 66 : 74);
        }
        var shell = rim + ' Q106 92 102 110 L18 110 Q14 92 22 74 Z';
        return svg('0 0 120 110', ''
            + '<defs><clipPath id="yy-v-shell"><path d="' + shell + '"/></clipPath></defs>'
            + '<g class="yy-v-wave" style="transform-origin:80px 68px">'
            + '<ellipse cx="90" cy="54" rx="7.5" ry="15" fill="' + CHICK_WING + '" transform="rotate(35 90 54)"/></g>'
            + '<circle cx="60" cy="70" r="25" fill="' + CHICK + '"/>'
            + '<circle cx="60" cy="42" r="18" fill="' + CHICK + '"/>'
            + eye(53, 41, 2.8) + eye(67, 41, 2.8)
            + '<circle cx="48" cy="49" r="3.2" fill="#ff9e7a" opacity=".55"/>'
            + '<circle cx="72" cy="49" r="3.2" fill="#ff9e7a" opacity=".55"/>'
            + '<path d="M55 47 L60 44 L65 47 L60 52 Z" fill="' + ORANGE + '"/>'
            + '<g transform="rotate(-16 60 30)">' + shellCap(60, 30, 15, '#c9b6f2') + '</g>'
            + '<path d="' + shell + '" fill="#c9b6f2"/>'
            + '<g clip-path="url(#yy-v-shell)">'
            + '<path d="M14 88 L24 82 L34 88 L44 82 L54 88 L64 82 L74 88 L84 82 L94 88 L104 82" stroke="#fff" stroke-width="5" fill="none"/>'
            + '<circle cx="34" cy="100" r="3.5" fill="#ffe082"/><circle cx="60" cy="102" r="3.5" fill="#f7a8c4"/>'
            + '<circle cx="86" cy="100" r="3.5" fill="#a8e6cf"/></g>'
            + '<path d="' + rim + '" stroke="#a48bd6" stroke-width="1.2" fill="none"/>'
            + '<ellipse cx="32" cy="70" rx="6" ry="10" fill="' + CHICK_WING + '" transform="rotate(-40 32 70)"/>');
    }

    // The bunny in the basket of an egg-shaped balloon, waving; 160 x 230 box
    function balloonSvg() {
        var envelope = 'M80 4 C114 4 142 40 142 96 C142 130 116 152 80 152 C44 152 18 130 18 96 C18 40 46 4 80 4 Z';
        var bands = [['#f7a8c4', 4, 40], ['#ffe082', 40, 66], ['#a8e6cf', 66, 98], ['#c9b6f2', 98, 124], ['#9fd3f7', 124, 156]];
        var body = '<defs><clipPath id="yy-v-envelope"><path d="' + envelope + '"/></clipPath></defs>'
            + '<path d="M44 140 L64 194 M116 140 L96 194" stroke="#8a6a46" stroke-width="1.6"/>'
            + '<g clip-path="url(#yy-v-envelope)">';
        bands.forEach(function (b) {
            body += '<rect x="0" y="' + b[1] + '" width="160" height="' + (b[2] - b[1]) + '" fill="' + b[0] + '"/>';
        });
        body += '<path d="M10 66 L22 58 L34 66 L46 58 L58 66 L70 58 L82 66 L94 58 L106 66 L118 58 L130 66 L142 58 L154 66"'
            + ' stroke="#fff" stroke-width="5" fill="none"/>'
            + '<circle cx="40" cy="82" r="5" fill="#fff"/><circle cx="66" cy="84" r="5" fill="#fff"/>'
            + '<circle cx="94" cy="84" r="5" fill="#fff"/><circle cx="120" cy="82" r="5" fill="#fff"/>'
            + '<path d="M10 111 L150 111" stroke="#fff" stroke-width="4" stroke-dasharray="9 6"/>'
            + '<ellipse cx="80" cy="78" rx="30" ry="76" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>'
            + '<ellipse cx="80" cy="78" rx="3" ry="76" fill="#fff" fill-opacity=".25"/>'
            + '</g>'
            + '<ellipse cx="52" cy="38" rx="9" ry="18" fill="#fff" opacity=".35" transform="rotate(25 52 38)"/>'
            + '<path d="M66 150 L94 150 L88 162 L72 162 Z" fill="#b39ae6"/>'
            // the bunny: ears, head and a waving paw above the basket rim
            + '<g transform="rotate(-10 74 186)"><ellipse cx="74" cy="160" rx="5" ry="15" fill="' + FUR + '"/>'
            + '<ellipse cx="74" cy="161" rx="2.4" ry="10" fill="' + PINK + '"/></g>'
            + '<g class="yy-v-ear" style="transform-origin:86px 180px"><g transform="rotate(12 86 186)">'
            + '<ellipse cx="86" cy="160" rx="5" ry="15" fill="' + FUR + '"/>'
            + '<ellipse cx="86" cy="161" rx="2.4" ry="10" fill="' + PINK + '"/></g></g>'
            + '<g class="yy-v-wave" style="transform-origin:94px 200px">'
            + '<path d="M94 200 L104 180" stroke="' + FUR + '" stroke-width="7" stroke-linecap="round"/>'
            + '<circle cx="105.5" cy="177" r="4.8" fill="' + FUR + '"/></g>'
            + '<circle cx="80" cy="186" r="13" fill="' + FUR + '"/>'
            + '<ellipse cx="75.5" cy="191" rx="5" ry="4" fill="' + CREAM + '"/>'
            + '<ellipse cx="84.5" cy="191" rx="5" ry="4" fill="' + CREAM + '"/>'
            + '<ellipse cx="80" cy="188" rx="2.6" ry="2" fill="' + NOSE + '"/>'
            + eye(75, 182, 2) + eye(85, 182, 2)
            // wicker basket
            + '<rect x="58" y="194" width="44" height="30" rx="5" fill="#c8894e"/>'
            + '<path d="M60 204 L100 204 M60 214 L100 214 M70 196 L70 222 M80 196 L80 222 M90 196 L90 222"'
            + ' stroke="#a96d36" stroke-width="1.6"/>'
            + '<rect x="55" y="191" width="50" height="7" rx="3.5" fill="#a96d36"/>';
        return svg('0 0 160 230', body);
    }
})();
