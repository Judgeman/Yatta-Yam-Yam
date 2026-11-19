/*
 * Halloween visitors (see visitors.js for when and how they appear):
 *   - a witch on her broomstick, a black cat riding along, flies across the upper half,
 *   - a skeleton dances along the bottom edge,
 *   - a ghost floats along the bottom edge,
 *   - a spider lets itself down from the top on a thread, waves and climbs back up,
 *   - a black cat or a ghost ("Boo!") peeks in from the left, right or bottom edge.
 * Typing "spuk" outside a form field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('halloween', {
        call: 'spuk',
        visitors: [
            {
                name: 'witch', weight: 2, motion: 'fly', facesRight: true, svg: witchSvg,
                size: function (vw) {
                    var w = clamp(vw * 0.3, 200, 340);
                    return [w, w * 130 / 260];
                },
                speed: 0.22, minMs: 4500, maxMs: 11000, climb: 50, wave: 26
            },
            {
                name: 'dance-skeleton', weight: 1, motion: 'walk', svg: skeletonSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.21, 115, 175);
                    return [h * 100 / 150, h];
                },
                speed: 0.16, minMs: 6000, maxMs: 11000
            },
            {
                name: 'float-ghost', weight: 1, motion: 'walk', svg: ghostSvg, inner: 'yy-v-float',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.17, 90, 135);
                    return [h * 100 / 120, h];
                },
                speed: 0.12, minMs: 7000, maxMs: 13000
            },
            {
                name: 'drop-spider', weight: 1, motion: 'drop', svg: spiderSvg,
                size: function (vw, vh) {
                    var w = clamp(Math.min(vw, vh) * 0.13, 70, 110);
                    return [w, w * 90 / 100];
                }
            },
            { name: 'peek-cat', weight: 1, motion: 'peek', svg: catPeekSvg },
            { name: 'peek-ghost', weight: 1, motion: 'peek', svg: ghostPeekSvg }
        ]
    });

    // ── Figures (inline SVG; animated parts carry yy-v-* classes, see visitors.css) ──

    var BONE = '#f4f1e8';
    var BONE_LINE = '#c9c1ae';
    var GHOST = '#fbfbfd';
    var GHOST_LINE = '#d9dbe6';
    var CAT = '#26212b';
    var CAT_LINE = '#4b4257';
    var PURPLE = '#5b2a86';
    var HAT = '#2a1838';
    var ORANGE = '#f07f1e';

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>';
    }

    function eye(x, y, r) {
        return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#1d1622"/>'
            + '<circle cx="' + (x + r * 0.3) + '" cy="' + (y - r * 0.3) + '" r="' + (r * 0.35) + '" fill="#fff"/>';
    }

    function star(x, y, r, delay, color) {
        return '<path class="yy-v-sparkle" style="transform-origin:' + x + 'px ' + y + 'px;animation-delay:' + delay + 's" d="M'
            + x + ' ' + (y - r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y + r)
            + ' Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z" fill="' + color + '"/>';
    }

    // Witch on a broomstick with a black cat on its tail, facing right; 260 x 130 box
    function witchSvg() {
        var sparkles = star(10, 96, 5, 0, '#ffb347') + star(26, 78, 4, -0.3, '#c9a2ff')
            + star(22, 116, 3.5, -0.6, '#ffd95a') + star(42, 100, 3, -0.15, '#ffb347');
        var broom = ''
            + '<path d="M52 96 L240 74" stroke="#7a4a22" stroke-width="5" stroke-linecap="round"/>'
            + '<path d="M60 92 Q36 84 14 80 Q20 96 12 114 Q38 108 62 102 Z" fill="#d9a441"/>'
            + '<path d="M58 95 L20 88 M58 97 L18 100 M59 99 L22 110" stroke="#b07f2a" stroke-width="1.4"/>'
            + '<path d="M58 90 L62 104" stroke="#8e2b2b" stroke-width="5" stroke-linecap="round"/>';
        var cat = ''
            + '<path d="M78 90 Q66 76 72 62 Q74 72 82 78" stroke="' + CAT + '" stroke-width="4" fill="none" stroke-linecap="round"/>'
            + '<ellipse cx="90" cy="84" rx="11" ry="9" fill="' + CAT + '"/>'
            + '<circle cx="100" cy="72" r="8" fill="' + CAT + '"/>'
            + '<path d="M94 67 L95 58 L100 65 Z M101 65 L106 58 L107 68 Z" fill="' + CAT + '"/>'
            + '<ellipse cx="98" cy="71" rx="1.8" ry="2.2" fill="#c6f25b"/><ellipse cx="104" cy="71" rx="1.8" ry="2.2" fill="#c6f25b"/>'
            + '<path d="M98 71 L98 71.5 M104 71 L104 71.5" stroke="#1d1622" stroke-width="1"/>';
        var witch = ''
            // hair blown back
            + '<path d="M140 34 Q124 40 112 60 Q126 54 132 58 Q122 66 118 78 Q134 66 146 56 Z" fill="#e86a1c"/>'
            // stocking and boot
            + '<path d="M160 104 L172 122" stroke="#1d1622" stroke-width="7" stroke-linecap="round"/>'
            + '<path d="M162 107 L165 111 M166 113 L169 117" stroke="' + ORANGE + '" stroke-width="7"/>'
            + '<path d="M168 120 L184 122 Q188 118 186 114 L180 117 Z" fill="#1d1622"/>'
            // skirt over the broom, body
            + '<path d="M128 88 Q150 78 174 88 L178 110 Q150 118 120 110 Z" fill="' + PURPLE + '"/>'
            + '<path d="M140 90 L144 58 Q152 52 160 58 L164 90 Z" fill="' + PURPLE + '"/>'
            + '<path d="M144 76 L162 76" stroke="' + ORANGE + '" stroke-width="3"/>'
            // the hand on the broom
            + '<path d="M160 64 L184 80" stroke="' + PURPLE + '" stroke-width="7" stroke-linecap="round"/>'
            + '<circle cx="187" cy="81" r="4.5" fill="#f3c9a7"/>'
            // waving arm
            + '<g class="yy-v-wave" style="transform-origin:150px 62px">'
            + '<path d="M150 62 L164 40" stroke="' + PURPLE + '" stroke-width="7" stroke-linecap="round"/>'
            + '<circle cx="166" cy="36" r="4.5" fill="#f3c9a7"/></g>'
            // head
            + '<circle cx="152" cy="44" r="11" fill="#f3c9a7"/>'
            + '<path d="M162 44 L167 46 L161 48 Z" fill="#e8b08a"/>'
            + eye(156, 41, 1.8)
            + '<path d="M153 49 Q157 52 161 49" stroke="#7a3b2a" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
            + '<circle cx="150" cy="48" r="2.6" fill="#f09a8a" opacity=".6"/>'
            // hat
            + '<path d="M136 36 Q138 18 132 6 Q150 12 160 34 Z" fill="' + HAT + '"/>'
            + '<path d="M138 31 Q148 27 159 31 L160 35 Q148 31 137 35 Z" fill="' + ORANGE + '"/>'
            + '<ellipse cx="150" cy="36" rx="22" ry="4.5" fill="' + HAT + '" transform="rotate(-6 150 36)"/>';
        return svg('0 0 260 130', sparkles + broom + cat + witch);
    }

    // Skeleton from the front with an orange bow tie, dancing; 100 x 150 box
    function skeletonSvg() {
        function limb(cls, ox, oy, mx, my, ex, ey, end) {
            return '<g class="' + cls + '" style="transform-origin:' + ox + 'px ' + oy + 'px">'
                + '<path d="M' + ox + ' ' + oy + ' L' + mx + ' ' + my + ' L' + ex + ' ' + ey + '" stroke="' + BONE
                + '" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
                + '<circle cx="' + mx + '" cy="' + my + '" r="3.4" fill="' + BONE + '"/>'
                + end + '</g>';
        }
        var ribs = '';
        for (var i = 0; i < 4; i++) {
            var y = 54 + i * 8;
            var spread = 15 - i * 1.5;
            ribs += '<path d="M50 ' + y + ' Q' + (50 - spread) + ' ' + (y - 2) + ' ' + (50 - spread + 2) + ' ' + (y + 6)
                + ' M50 ' + y + ' Q' + (50 + spread) + ' ' + (y - 2) + ' ' + (50 + spread - 2) + ' ' + (y + 6) + '"/>';
        }
        return svg('0 0 100 150', ''
            + '<g style="filter:drop-shadow(0 0 1px ' + BONE_LINE + ')">'
            + limb('yy-v-leg-l', 43, 100, 38, 118, 40, 136, '<ellipse cx="36" cy="139" rx="7" ry="3.5" fill="' + BONE + '"/>')
            + limb('yy-v-leg-r', 57, 100, 62, 118, 60, 136, '<ellipse cx="64" cy="139" rx="7" ry="3.5" fill="' + BONE + '"/>')
            + limb('yy-v-arm-l', 35, 52, 24, 68, 16, 84, '<circle cx="15" cy="87" r="4" fill="' + BONE + '"/>')
            + limb('yy-v-arm-r', 65, 52, 76, 68, 84, 84, '<circle cx="85" cy="87" r="4" fill="' + BONE + '"/>')
            + '<path d="M50 42 L50 96" stroke="' + BONE + '" stroke-width="5" stroke-linecap="round"/>'
            + '<g stroke="' + BONE + '" stroke-width="3.2" fill="none" stroke-linecap="round">' + ribs + '</g>'
            + '<path d="M34 51 L66 51" stroke="' + BONE + '" stroke-width="4" stroke-linecap="round"/>'
            + '<path d="M38 94 Q50 88 62 94 Q62 104 55 106 L50 100 L45 106 Q38 104 38 94 Z" fill="' + BONE + '"/>'
            + '<circle cx="50" cy="24" r="16" fill="' + BONE + '"/>'
            + '<rect x="40" y="32" width="20" height="10" rx="4" fill="' + BONE + '"/></g>'
            + '<ellipse cx="44" cy="23" rx="4.6" ry="5.4" fill="#2a2030"/>'
            + '<ellipse cx="56" cy="23" rx="4.6" ry="5.4" fill="#2a2030"/>'
            + '<circle cx="45.5" cy="21.5" r="1.3" fill="#fff"/><circle cx="57.5" cy="21.5" r="1.3" fill="#fff"/>'
            + '<path d="M50 28 L47.5 32 L52.5 32 Z" fill="#2a2030"/>'
            + '<path d="M42 37 L58 37 M45 35 L45 40 M50 35 L50 40 M55 35 L55 40" stroke="#8a8170" stroke-width="1.1"/>'
            + '<path d="M50 47 L41 42 L41 52 Z M50 47 L59 42 L59 52 Z" fill="' + ORANGE + '"/>'
            + '<circle cx="50" cy="47" r="2.6" fill="#c4520c"/>');
    }

    function ghostBody(x, top, w, bottom) {
        // A dome with a wavy hem; the hem has four scallops
        var d = 'M' + (x - w) + ' ' + bottom + ' L' + (x - w) + ' ' + (top + w)
            + ' A' + w + ' ' + w + ' 0 0 1 ' + (x + w) + ' ' + (top + w) + ' L' + (x + w) + ' ' + bottom;
        var step = w / 2;
        for (var i = 0; i < 4; i++) {
            var x1 = x + w - step * i;
            d += ' Q' + (x1 - step / 2) + ' ' + (bottom + (i % 2 ? -8 : 8)) + ' ' + (x1 - step) + ' ' + bottom;
        }
        return d + ' Z';
    }

    // Ghost from the front, arms flapping; 100 x 120 box
    function ghostSvg() {
        return svg('0 0 100 120', ''
            + '<g class="yy-v-wing-l" style="transform-origin:22px 58px">'
            + '<ellipse cx="14" cy="64" rx="10" ry="6" fill="' + GHOST + '" stroke="' + GHOST_LINE + '" transform="rotate(30 14 64)"/></g>'
            + '<g class="yy-v-wing-r" style="transform-origin:78px 58px">'
            + '<ellipse cx="86" cy="64" rx="10" ry="6" fill="' + GHOST + '" stroke="' + GHOST_LINE + '" transform="rotate(-30 86 64)"/></g>'
            + '<path d="' + ghostBody(50, 8, 32, 104) + '" fill="' + GHOST + '" stroke="' + GHOST_LINE + '" stroke-width="1.5" opacity=".95"/>'
            + '<ellipse cx="39" cy="44" rx="5.5" ry="8" fill="#1d1622"/><ellipse cx="61" cy="44" rx="5.5" ry="8" fill="#1d1622"/>'
            + '<circle cx="41" cy="40.5" r="2" fill="#fff"/><circle cx="63" cy="40.5" r="2" fill="#fff"/>'
            + '<ellipse cx="50" cy="64" rx="6" ry="7.5" fill="#1d1622"/>'
            + '<ellipse cx="50" cy="67" rx="3.4" ry="3" fill="#e0607e"/>'
            + '<circle cx="31" cy="56" r="4" fill="#f7b3c5" opacity=".6"/><circle cx="69" cy="56" r="4" fill="#f7b3c5" opacity=".6"/>');
    }

    // Ghost head and shoulders with a waving arm and a "Boo!" bubble; 120 x 110 box
    function ghostPeekSvg() {
        return svg('0 0 120 110', ''
            + '<g class="yy-v-wave" style="transform-origin:86px 80px">'
            + '<path d="M84 82 Q100 70 104 54 Q108 50 112 54 Q108 74 90 92 Z" fill="' + GHOST + '" stroke="' + GHOST_LINE + '" stroke-width="1.5"/></g>'
            + '<path d="M22 110 L22 54 A36 36 0 0 1 94 54 L94 110 Z" fill="' + GHOST + '" stroke="' + GHOST_LINE + '" stroke-width="1.5"/>'
            + '<ellipse cx="46" cy="56" rx="6" ry="9" fill="#1d1622"/><ellipse cx="70" cy="56" rx="6" ry="9" fill="#1d1622"/>'
            + '<circle cx="48" cy="52" r="2.2" fill="#fff"/><circle cx="72" cy="52" r="2.2" fill="#fff"/>'
            + '<ellipse cx="58" cy="80" rx="8" ry="10" fill="#1d1622"/>'
            + '<ellipse cx="58" cy="84" rx="4.5" ry="4" fill="#e0607e"/>'
            + '<circle cx="36" cy="70" r="4.5" fill="#f7b3c5" opacity=".6"/><circle cx="80" cy="70" r="4.5" fill="#f7b3c5" opacity=".6"/>'
            + '<path d="M2 6 Q2 0 8 0 L36 0 Q42 0 42 6 L42 18 Q42 24 36 24 L22 24 L18 32 L16 24 L8 24 Q2 24 2 18 Z" fill="#fff" stroke="' + GHOST_LINE + '"/>'
            + '<text x="22" y="17" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="12" fill="#5b2a86">Boo!</text>');
    }

    // Black cat head and shoulders with an orange collar and a waving paw; 120 x 110 box
    function catPeekSvg() {
        return svg('0 0 120 110', ''
            + '<path d="M16 110 Q18 82 60 80 Q102 82 104 110 Z" fill="' + CAT + '" stroke="' + CAT_LINE + '" stroke-width="1.2"/>'
            + '<path d="M38 88 Q60 98 82 88" stroke="' + ORANGE + '" stroke-width="6" fill="none" stroke-linecap="round"/>'
            + '<circle cx="60" cy="95.5" r="4.5" fill="#f2c230" stroke="#b8860b"/>'
            + '<g class="yy-v-wave" style="transform-origin:92px 98px">'
            + '<path d="M92 98 L104 66" stroke="' + CAT + '" stroke-width="11" stroke-linecap="round"/>'
            + '<ellipse cx="106" cy="60" rx="7.5" ry="7" fill="' + CAT + '" stroke="' + CAT_LINE + '" stroke-width="1.2"/>'
            + '<circle cx="106" cy="61" r="2.6" fill="#f4a6bd"/></g>'
            + '<path d="M36 50 L34 18 L56 38 Z M84 50 L86 18 L64 38 Z" fill="' + CAT + '" stroke="' + CAT_LINE + '" stroke-width="1.2" stroke-linejoin="round"/>'
            + '<path d="M39 42 L38 26 L50 37 Z M81 42 L82 26 L70 37 Z" fill="#f4a6bd" opacity=".75"/>'
            + '<ellipse cx="60" cy="58" rx="27" ry="23" fill="' + CAT + '" stroke="' + CAT_LINE + '" stroke-width="1.2"/>'
            + '<ellipse cx="49" cy="54" rx="6.5" ry="7.5" fill="#c6f25b"/><ellipse cx="71" cy="54" rx="6.5" ry="7.5" fill="#c6f25b"/>'
            + '<ellipse cx="49" cy="54" rx="2" ry="6" fill="#1d1622"/><ellipse cx="71" cy="54" rx="2" ry="6" fill="#1d1622"/>'
            + '<circle cx="51" cy="51" r="1.5" fill="#fff"/><circle cx="73" cy="51" r="1.5" fill="#fff"/>'
            + '<path d="M57 63 L63 63 L60 66.5 Z" fill="#f4a6bd"/>'
            + '<path d="M60 66.5 Q57 71 53 69 M60 66.5 Q63 71 67 69" stroke="#8d8399" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
            + '<path d="M46 64 L28 61 M46 67 L28 70 M74 64 L92 61 M74 67 L92 70" stroke="#8d8399" stroke-width=".9"/>');
    }

    // Friendly spider hanging from its thread, waving a leg; 100 x 90 box
    function spiderSvg() {
        function leg(cls, d, origin) {
            return '<g class="' + cls + '" style="transform-origin:' + origin + '"><path d="' + d
                + '" stroke="#1f1a24" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
        }
        return svg('0 0 100 90', ''
            + '<path d="M50 0 L50 30" stroke="#c9c9d6" stroke-width="1.2"/>'
            + leg('yy-v-legs-l', 'M42 44 L22 32 L10 44 M41 50 L18 46 L8 60 M42 56 L20 60 L14 76 M44 61 L28 70 L26 86', '44px 52px')
            + leg('yy-v-legs-r', 'M58 50 L82 46 L92 60 M58 56 L80 60 L86 76 M56 61 L72 70 L74 86', '56px 52px')
            + leg('yy-v-wave', 'M58 44 L76 30 L90 18', '58px 44px')
            + '<ellipse cx="50" cy="55" rx="16" ry="15" fill="#1f1a24"/>'
            + '<ellipse cx="45" cy="50" rx="5" ry="3.5" fill="#5b2a86" opacity=".6"/>'
            + '<circle cx="50" cy="36" r="11" fill="#2a2330"/>'
            + '<circle cx="45.5" cy="35" r="4.4" fill="#fff"/><circle cx="54.5" cy="35" r="4.4" fill="#fff"/>'
            + eye(46, 35.5, 2.2) + eye(55, 35.5, 2.2)
            + '<path d="M46 41.5 Q50 44.5 54 41.5" stroke="#f07f1e" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
            + '<path d="M50 28 L44 24 L44 32 Z M50 28 L56 24 L56 32 Z" fill="' + ORANGE + '"/>'
            + '<circle cx="50" cy="28" r="1.8" fill="#c4520c"/>');
    }
})();
