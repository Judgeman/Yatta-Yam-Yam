/*
 * Christmas visitors (see visitors.js for when and how they appear):
 *   - Santa in his sleigh, pulled by two reindeer, flies across the upper half,
 *   - Santa or a reindeer dances along the bottom edge,
 *   - Santa or a reindeer peeks in from the left, right or bottom edge and waves.
 * Typing "hohoho" outside a form field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('christmas', {
        call: 'hohoho',
        visitors: [
            {
                name: 'sleigh', weight: 2, motion: 'fly', facesRight: true, svg: sleighSvg,
                size: function (vw) {
                    var w = clamp(vw * 0.42, 240, 520);
                    return [w, w * 150 / 600];
                },
                speed: 0.24, minMs: 4500, maxMs: 11000
            },
            {
                name: 'dance-santa', weight: 1, motion: 'walk', svg: santaSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.2, 110, 170);
                    return [h * 100 / 150, h];
                },
                speed: 0.16, minMs: 6000, maxMs: 11000
            },
            {
                name: 'dance-reindeer', weight: 1, motion: 'walk', facesRight: true, inner: 'yy-v-dance',
                svg: function () {
                    return reindeerSvg('yy-v-prance');
                },
                size: function (vw, vh) {
                    var h = clamp(vh * 0.17, 90, 135);
                    return [h * 130 / 100, h];
                },
                speed: 0.16, minMs: 6000, maxMs: 11000
            },
            { name: 'peek-santa', weight: 1, motion: 'peek', svg: santaPeekSvg },
            { name: 'peek-reindeer', weight: 1, motion: 'peek', svg: reindeerPeekSvg }
        ]
    });

    // ── Figures (inline SVG; animated parts carry yy-v-* classes, see visitors.css) ──

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>';
    }

    // Reindeer seen from the side, facing right, in a 130 x 100 box
    function reindeerBody(extraClass) {
        function leg(cls, x, fill, hoof) {
            return '<g class="yy-v-leg ' + cls + '" style="transform-origin:' + (x + 3) + 'px 62px">'
                + '<rect x="' + x + '" y="60" width="6.5" height="29" rx="3.2" fill="' + fill + '"/>'
                + '<rect x="' + (x - 1) + '" y="86" width="8.5" height="5.5" rx="2" fill="' + hoof + '"/></g>';
        }
        return '<g class="yy-v-deer ' + (extraClass || '') + '">'
            + leg('yy-v-leg-back yy-v-far', 40, '#6e4520', '#2b1b10')
            + leg('yy-v-leg-front yy-v-far', 78, '#6e4520', '#2b1b10')
            + '<ellipse cx="22" cy="46" rx="7" ry="4.5" fill="#efe0c4" transform="rotate(-35 22 46)"/>'
            + '<ellipse cx="55" cy="55" rx="34" ry="17" fill="#8b5a2b"/>'
            + '<ellipse cx="58" cy="63" rx="22" ry="7.5" fill="#b8854f"/>'
            + leg('yy-v-leg-back', 31, '#8b5a2b', '#3a2414')
            + leg('yy-v-leg-front', 70, '#8b5a2b', '#3a2414')
            + '<path d="M70 46 Q82 34 91 24 L106 33 Q96 48 88 63 Z" fill="#8b5a2b"/>'
            + '<path d="M79 52 Q90 46 97 37" stroke="#c8102e" stroke-width="5" fill="none" stroke-linecap="round"/>'
            + '<circle cx="85" cy="54" r="3.6" fill="#f2c230" stroke="#b8860b"/>'
            + '<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">'
            + '<path d="M101 20 L104 5 M103 11 L111 5 M102 15 L96 8" stroke="#c2a172"/>'
            + '<path d="M95 20 L90 5 M91.5 10 L83 6 M93 14 L99 6" stroke="#dcbc8c"/></g>'
            + '<ellipse cx="90" cy="23" rx="8" ry="3.4" fill="#76491f" transform="rotate(-28 90 23)"/>'
            + '<ellipse cx="100" cy="29" rx="12.5" ry="10.5" fill="#8b5a2b"/>'
            + '<ellipse cx="111" cy="34" rx="9.5" ry="6.8" fill="#a8743f"/>'
            + '<circle cx="119.5" cy="32.5" r="4.2" fill="#3a2414"/>'
            + '<circle cx="118.6" cy="31.3" r="1.2" fill="#fff" opacity=".5"/>'
            + '<circle cx="101.5" cy="25.5" r="2.5" fill="#1d1d1d"/>'
            + '<circle cx="102.3" cy="24.7" r=".9" fill="#fff"/>'
            + '<path d="M108 38.5 Q111.5 41 115 38.5" stroke="#3a2414" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
            + '</g>';
    }

    function reindeerSvg(extraClass) {
        return svg('0 0 130 100', reindeerBody(extraClass));
    }

    function sleighSvg() {
        function star(x, y, r, delay) {
            return '<path class="yy-v-sparkle" style="transform-origin:' + x + 'px ' + y + 'px;animation-delay:' + delay + 's" d="M'
                + x + ' ' + (y - r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y + r)
                + ' Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z" fill="#ffd95a"/>';
        }
        var sparkles = star(10, 104, 5, 0) + star(28, 88, 4, -0.3) + star(22, 120, 3.5, -0.6) + star(44, 104, 3, -0.15);

        var santa = ''
            // sack of presents behind Santa
            + '<path d="M38 70 Q28 40 50 30 Q68 26 74 42 Q80 58 74 70 Z" fill="#7a3b1f"/>'
            + '<rect x="44" y="20" width="16" height="15" rx="1.5" fill="#1f8a52"/>'
            + '<rect x="50.5" y="20" width="3" height="15" fill="#f2c230"/>'
            + '<rect x="58" y="25" width="13" height="12" rx="1.5" fill="#2f7fd8"/>'
            + '<rect x="58" y="29.5" width="13" height="3" fill="#fff"/>'
            // body and the hand holding the reins
            + '<path d="M86 78 Q84 50 104 44 Q124 42 128 64 L128 80 Z" fill="#c8102e"/>'
            + '<path d="M120 62 L134 66" stroke="#c8102e" stroke-width="8" stroke-linecap="round"/>'
            + '<circle cx="137" cy="66" r="5" fill="#1f6b43"/>'
            // waving arm
            + '<g class="yy-v-wave" style="transform-origin:116px 54px">'
            + '<path d="M116 54 L128 34" stroke="#c8102e" stroke-width="9" stroke-linecap="round"/>'
            + '<path d="M127 36 L130 31" stroke="#fff" stroke-width="10" stroke-linecap="round"/>'
            + '<ellipse cx="132" cy="26" rx="5.5" ry="6.5" fill="#1f6b43"/></g>'
            // head
            + '<circle cx="108" cy="32" r="11" fill="#f6cfb0"/>'
            + '<path d="M96 31 Q94 52 108 56 Q122 52 120 31 Q114 38 108 38 Q102 38 96 31 Z" fill="#fff"/>'
            + '<path d="M108 36 Q102 33 99 38 Q104 40 108 38 Q112 40 117 38 Q114 33 108 36 Z" fill="#f4f4f4"/>'
            + '<circle cx="113" cy="33" r="2.6" fill="#ee9a86"/>'
            + '<path d="M109 27.5 q2 -2 4 0" stroke="#3a2a20" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
            // hat, blown backwards
            + '<path d="M96 24 C97 10 115 6 120 22 Z" fill="#c8102e"/>'
            + '<path d="M100 13 C90 9 82 12 76 21 L80 24 C86 17 94 16 104 17 Z" fill="#c8102e"/>'
            + '<circle cx="76" cy="23" r="4.5" fill="#fff"/>'
            + '<rect x="94" y="20" width="28" height="7" rx="3.5" fill="#fff"/>';

        var sleigh = ''
            + '<path d="M20 66 L150 66 Q170 66 175 48 Q179 34 192 36 Q183 41 185 52 Q184 94 140 96 L42 96 Q20 96 20 80 Z" fill="#c8102e"/>'
            + '<path d="M20 66 L150 66 Q170 66 175 48" stroke="#9e0c24" stroke-width="3" fill="none"/>'
            + '<path d="M24 74 L146 74" stroke="#f2c230" stroke-width="3"/>'
            + '<circle cx="84" cy="85" r="5" fill="none" stroke="#f2c230" stroke-width="2.5"/>'
            + '<path d="M40 96 L44 112 M136 96 L132 112" stroke="#d4a017" stroke-width="4"/>'
            + '<path d="M14 113 L168 113 Q192 113 192 99 Q192 91 184 93" stroke="#d4a017" stroke-width="5" fill="none" stroke-linecap="round"/>';

        return svg('0 0 600 150', sparkles
            + '<path d="M177 76 Q260 92 336 76 Q420 66 505 64" stroke="#5b3a1a" stroke-width="1.8" fill="none"/>'
            + '<g transform="translate(40 10)">' + santa + sleigh + '</g>'
            + '<g transform="translate(250 22)"><g class="yy-v-bob" style="animation-delay:-.25s">' + reindeerBody('yy-v-gallop') + '</g></g>'
            + '<g transform="translate(420 10)"><g class="yy-v-bob">' + reindeerBody('yy-v-gallop') + '</g></g>');
    }

    // Santa from the front, dancing; 100 x 150 box
    function santaSvg() {
        return svg('0 0 100 150', ''
            + '<g class="yy-v-leg-l" style="transform-origin:41px 106px">'
            + '<rect x="35" y="102" width="12" height="28" rx="5" fill="#c8102e"/>'
            + '<ellipse cx="38" cy="133" rx="11" ry="6.5" fill="#222"/></g>'
            + '<g class="yy-v-leg-r" style="transform-origin:59px 106px">'
            + '<rect x="53" y="102" width="12" height="28" rx="5" fill="#c8102e"/>'
            + '<ellipse cx="62" cy="133" rx="11" ry="6.5" fill="#222"/></g>'
            + '<g class="yy-v-arm-l" style="transform-origin:27px 72px">'
            + '<path d="M27 72 L13 94" stroke="#c8102e" stroke-width="11" stroke-linecap="round"/>'
            + '<path d="M14.5 92 L12 96" stroke="#fff" stroke-width="12" stroke-linecap="round"/>'
            + '<circle cx="10" cy="101" r="6.5" fill="#1f6b43"/></g>'
            + '<g class="yy-v-arm-r" style="transform-origin:73px 72px">'
            + '<path d="M73 72 L87 94" stroke="#c8102e" stroke-width="11" stroke-linecap="round"/>'
            + '<path d="M85.5 92 L88 96" stroke="#fff" stroke-width="12" stroke-linecap="round"/>'
            + '<circle cx="90" cy="101" r="6.5" fill="#1f6b43"/></g>'
            + '<path d="M26 76 Q28 62 50 62 Q72 62 74 76 Q82 92 79 107 Q50 115 21 107 Q18 92 26 76 Z" fill="#c8102e"/>'
            + '<rect x="46" y="63" width="8" height="46" fill="#fff"/>'
            + '<rect x="21" y="84" width="58" height="8" rx="2" fill="#262626"/>'
            + '<rect x="44" y="82" width="12" height="12" rx="2" fill="none" stroke="#f2c230" stroke-width="2.6"/>'
            + '<path d="M20 104 Q50 112 80 104 L80.5 110 Q50 118 19.5 110 Z" fill="#fff"/>'
            + '<circle cx="50" cy="44" r="16" fill="#f6cfb0"/>'
            + '<path d="M33 44 Q32 72 50 76 Q68 72 67 44 Q60 54 50 54 Q40 54 33 44 Z" fill="#fff"/>'
            + '<path d="M50 50 Q42 46 37 52 Q44 56 50 53 Q56 56 63 52 Q58 46 50 50 Z" fill="#f4f4f4"/>'
            + '<circle cx="50" cy="47" r="3.6" fill="#ee9a86"/>'
            + '<circle cx="39" cy="47" r="3.2" fill="#f2a08e" opacity=".55"/>'
            + '<circle cx="61" cy="47" r="3.2" fill="#f2a08e" opacity=".55"/>'
            + '<path d="M40 41 q3.5 -3.5 7 0 M53 41 q3.5 -3.5 7 0" stroke="#3a2a20" stroke-width="2" fill="none" stroke-linecap="round"/>'
            + '<path d="M33 34 Q36 8 58 10 Q74 12 81 27 Q73 22 67 27 L67 34 Z" fill="#c8102e"/>'
            + '<circle cx="81" cy="28" r="5.5" fill="#fff"/>'
            + '<rect x="31" y="29" width="38" height="9" rx="4.5" fill="#fff"/>');
    }

    // Head, shoulders and a waving arm; the lower edge is cut off. 120 x 110 box
    function santaPeekSvg() {
        return svg('0 0 120 110', ''
            + '<path d="M12 110 Q14 76 60 72 Q106 76 108 110 Z" fill="#c8102e"/>'
            + '<rect x="56" y="76" width="8" height="34" fill="#fff"/>'
            + '<g class="yy-v-wave" style="transform-origin:94px 94px">'
            + '<path d="M94 94 L105 62" stroke="#c8102e" stroke-width="13" stroke-linecap="round"/>'
            + '<path d="M105 61 L107 55" stroke="#fff" stroke-width="15" stroke-linecap="round"/>'
            + '<ellipse cx="109" cy="45" rx="7.5" ry="9" fill="#1f6b43"/>'
            + '<ellipse cx="101.5" cy="48" rx="3" ry="4.5" fill="#1f6b43" transform="rotate(-30 101.5 48)"/></g>'
            + '<circle cx="56" cy="46" r="19" fill="#f6cfb0"/>'
            + '<path d="M36 46 Q35 80 56 85 Q77 80 76 46 Q68 58 56 58 Q44 58 36 46 Z" fill="#fff"/>'
            + '<path d="M56 54 Q47 49 41 56 Q49 61 56 57 Q63 61 71 56 Q65 49 56 54 Z" fill="#f4f4f4"/>'
            + '<circle cx="56" cy="50.5" r="4.2" fill="#ee9a86"/>'
            + '<circle cx="43" cy="51" r="3.6" fill="#f2a08e" opacity=".55"/>'
            + '<circle cx="69" cy="51" r="3.6" fill="#f2a08e" opacity=".55"/>'
            + '<circle cx="48.5" cy="42" r="2.6" fill="#2a1e16"/><circle cx="49.3" cy="41.2" r=".9" fill="#fff"/>'
            + '<circle cx="63.5" cy="42" r="2.6" fill="#2a1e16"/><circle cx="64.3" cy="41.2" r=".9" fill="#fff"/>'
            + '<path d="M44 36 q4 -3 8 0 M60 36 q4 -3 8 0" stroke="#e6e6e6" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
            + '<path d="M37 34 Q38 6 62 6 Q80 8 86 30 Q78 24 72 28 L74 34 Z" fill="#c8102e"/>'
            + '<circle cx="86" cy="31" r="6" fill="#fff"/>'
            + '<rect x="34" y="28" width="44" height="10" rx="5" fill="#fff"/>');
    }

    function reindeerPeekSvg() {
        return svg('0 0 120 110', ''
            + '<path d="M28 110 Q30 80 60 78 Q90 80 92 110 Z" fill="#8b5a2b"/>'
            + '<path d="M36 92 Q60 103 84 92" stroke="#c8102e" stroke-width="6" fill="none" stroke-linecap="round"/>'
            + '<circle cx="60" cy="99.5" r="4.8" fill="#f2c230" stroke="#b8860b"/>'
            + '<g class="yy-v-wave" style="transform-origin:86px 98px">'
            + '<path d="M86 98 L100 64" stroke="#8b5a2b" stroke-width="10" stroke-linecap="round"/>'
            + '<ellipse cx="102" cy="58" rx="6.5" ry="5.5" fill="#3a2414" transform="rotate(20 102 58)"/></g>'
            + '<g fill="none" stroke="#dcbc8c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'
            + '<path d="M47 32 L36 10 M40 19 L27 17 M37 13 L40 3"/>'
            + '<path d="M73 32 L84 10 M80 19 L93 17 M83 13 L80 3"/></g>'
            + '<ellipse cx="36" cy="40" rx="11" ry="5" fill="#76491f" transform="rotate(22 36 40)"/>'
            + '<ellipse cx="84" cy="40" rx="11" ry="5" fill="#76491f" transform="rotate(-22 84 40)"/>'
            + '<ellipse cx="60" cy="52" rx="20" ry="23" fill="#8b5a2b"/>'
            + '<ellipse cx="60" cy="66" rx="14.5" ry="10.5" fill="#c49a6c"/>'
            + '<ellipse cx="60" cy="60" rx="6.5" ry="4.8" fill="#3a2414"/>'
            + '<ellipse cx="58" cy="58.6" rx="2" ry="1.2" fill="#fff" opacity=".45"/>'
            + '<path d="M53 70 Q60 76 67 70" stroke="#3a2414" stroke-width="1.9" fill="none" stroke-linecap="round"/>'
            + '<circle cx="52" cy="46" r="3.3" fill="#1d1d1d"/><circle cx="53" cy="45" r="1.1" fill="#fff"/>'
            + '<circle cx="68" cy="46" r="3.3" fill="#1d1d1d"/><circle cx="69" cy="45" r="1.1" fill="#fff"/>');
    }
})();
