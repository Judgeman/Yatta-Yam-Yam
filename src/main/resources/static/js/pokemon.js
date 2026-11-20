/*
 * Pokémon homage visitors (see visitors.js for when and how they appear). The look is
 * link-only (?theme=pokemon), see theme.js. A nod to the 151 and the Red, Blue and
 * Yellow editions on the Game Boy: the visitors are made-up pixel "lunch monsters" in
 * the four greens of the old handheld screen. None of them is, or looks like, a
 * creature from the games.
 *   - a donut with sprinkles flaps across the upper half on little wings,
 *   - a wild BURGLIN walks along the bottom edge, its textbox above it,
 *   - a taco dances along the bottom edge,
 *   - a rice ball peeks in from an edge and waves,
 *   - a cartridge (red, blue or yellow) comes down on a link cable.
 * Typing "pokemon" outside a form field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('pokemon', {
        call: 'pokemon',
        visitors: [
            {
                name: 'flying-donut', weight: 2, motion: 'fly', svg: donutSvg, tilt: false,
                size: function (vw) {
                    var w = clamp(vw * 0.12, 100, 150);
                    return [w, w * 14 / 26];
                },
                speed: 0.17, minMs: 5000, maxMs: 12000, climb: 30, wave: 26
            },
            {
                name: 'wild-burger', weight: 1, motion: 'walk', facesRight: true, svg: wildBurgerSvg,
                size: function (vw, vh) {
                    var h = clamp(vh * 0.2, 110, 160);
                    return [h * 60 / 46, h];
                },
                speed: 0.12, minMs: 7000, maxMs: 13000
            },
            {
                name: 'dance-taco', weight: 1, motion: 'walk', svg: tacoSvg, inner: 'yy-v-dance',
                size: function (vw, vh) {
                    var h = clamp(vh * 0.12, 64, 96);
                    return [h * 16 / 13, h];
                },
                speed: 0.15, minMs: 6000, maxMs: 11000
            },
            { name: 'peek-onigiri', weight: 1, motion: 'peek', svg: onigiriPeekSvg },
            {
                name: 'drop-cartridge', weight: 1, motion: 'drop', svg: cartridgeSvg,
                thread: { color: '#7a7a8c', width: '5px' },
                size: function (vw, vh) {
                    var w = clamp(Math.min(vw, vh) * 0.1, 56, 84);
                    return [w, w * 20 / 14];
                }
            }
        ]
    });

    // ── Figures: pixel art (rows of characters, one per pixel), see visitors.css ──

    // The four greens of the old handheld screen, darkest to lightest
    var GB = { '0': '#081820', '1': '#346856', '2': '#88c070', '3': '#e0f8d0' };
    var EDITIONS = [['#e3263b', '#a3172a'], ['#2f5bd3', '#1d3e99'], ['#f2c230', '#b88a12']];

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '" shape-rendering="crispEdges">' + body + '</svg>';
    }

    // Turns rows of characters into rectangles; '.' stays empty, runs of a colour merge
    function pix(rows, palette, size, ox, oy) {
        var out = '';
        rows.forEach(function (row, y) {
            var x = 0;
            while (x < row.length) {
                var c = row.charAt(x);
                var start = x;
                while (x < row.length && row.charAt(x) === c) {
                    x++;
                }
                if (palette[c]) {
                    out += '<rect x="' + (ox + start * size) + '" y="' + (oy + y * size) + '" width="' + ((x - start) * size)
                        + '" height="' + size + '" fill="' + palette[c] + '"/>';
                }
            }
        });
        return out;
    }

    function mirror(rows) {
        return rows.map(function (row) {
            return row.split('').reverse().join('');
        });
    }

    var DONUT = [
        '....000000....',
        '..0031331300..',
        '.033033330330.',
        '.031330033310.',
        '03330....03330',
        '02220....02220',
        '02222000022220',
        '.022222222220.',
        '.002222222200.',
        '...00000000...'
    ];
    var WING = [
        '..00..',
        '.0330.',
        '033330',
        '033300',
        '.0000.'
    ];

    // A donut with icing and sprinkles, flapping two little wings; 26 x 14
    function donutSvg() {
        return svg('0 0 26 14', ''
            + '<g class="yy-v-flutter" style="transform-origin:6px 7px">' + pix(WING, GB, 1, 1, 4) + '</g>'
            + '<g class="yy-v-flutter" style="transform-origin:20px 7px">' + pix(mirror(WING), GB, 1, 19, 4) + '</g>'
            + pix(DONUT, GB, 1, 6, 2));
    }

    var BURGER = [
        '....00000000....',
        '..002232223200..',
        '.02222222222220.',
        '.02202222220220.',
        '0222222222222220',
        '0000000000000000',
        '0313131313131310',
        '0111111111111110',
        '0111111111111110',
        '0000000000000000',
        '0222222222222220',
        '.00000000000000.'
    ];

    // The textbox of an old handheld role-playing game, with a double frame
    function textbox(x, y, w, h, lines) {
        var out = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#f8f8f0"/>'
            + '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="' + (w - 1) + '" height="' + (h - 1) + '" fill="none" stroke="#081820" stroke-width="1"/>'
            + '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="' + (w - 4) + '" height="' + (h - 4) + '" fill="none" stroke="#081820" stroke-width=".5"/>';
        lines.forEach(function (line, i) {
            out += '<text x="' + (x + 4) + '" y="' + (y + 6.6 + i * 4.6) + '" font-family="Courier New, monospace" font-weight="700" font-size="4.2" fill="#081820">'
                + line + '</text>';
        });
        return out;
    }

    // A wild BURGLIN, walking, its textbox above it; 60 x 46
    function wildBurgerSvg() {
        return svg('0 0 60 46', ''
            + textbox(1, 0, 58, 14, ['A wild BURGLIN', 'appeared!'])
            + '<path d="M28 14 L30 17 L32 14" fill="#f8f8f0" stroke="#081820" stroke-width=".8"/>'
            + '<g class="yy-v-leg-l" style="transform-origin:24px 40px">' + pix(['00', '00', '000'], GB, 2, 22, 40) + '</g>'
            + '<g class="yy-v-leg-r" style="transform-origin:36px 40px">' + pix(['00', '00', '000'], GB, 2, 34, 40) + '</g>'
            + '<g class="yy-v-bob">' + pix(BURGER, GB, 2, 14, 17) + '</g>');
    }

    var TACO = [
        '...01101101100..',
        '.00313131313100.',
        '0222222222222220',
        '0222022222202220',
        '.02222200222220.',
        '.02212222221220.',
        '..022222222220..',
        '...0022222200...',
        '.....000000.....'
    ];

    // A dancing taco: a half-moon shell, filling on top, little legs; 16 x 13
    function tacoSvg() {
        return svg('0 0 16 13', ''
            + '<g class="yy-v-leg-l" style="transform-origin:6px 9px">' + pix(['0', '0', '00'], GB, 1, 5, 9) + '</g>'
            + '<g class="yy-v-leg-r" style="transform-origin:10px 9px">' + pix(['0', '0', '00'], GB, 1, 10, 9) + '</g>'
            + pix(TACO, GB, 1, 0, 0));
    }

    var ONIGIRI = [
        '......00......',
        '.....0330.....',
        '....033330....',
        '...03333330...',
        '...03033030...',
        '..0323333230..',
        '..0333003330..',
        '.033333333330.',
        '.011111111110.',
        '01111111111110',
        '01111111111110',
        '.000000000000.'
    ];

    // A rice ball with a strip of nori, peeking in and waving; 120 x 110 box
    function onigiriPeekSvg() {
        return svg('0 0 120 110', ''
            + '<g class="yy-v-wave" style="transform-origin:96px 80px">' + pix(['.0', '00', '00', '00', '00', '00'], GB, 6, 90, 44) + '</g>'
            + pix(ONIGIRI, GB, 7, 11, 26));
    }

    var CART = [
        '00000000000...',
        '0cccccccccc0..',
        '0ccccccccccc0.',
        '0cccccccccccc0',
        '0c0000000000c0',
        '0c0wwwwwwww0c0',
        '0c0ww0ww0ww0c0',
        '0c0wwwwwwww0c0',
        '0c0ww0000ww0c0',
        '0c0wwwwwwww0c0',
        '0c0000000000c0',
        '0cccccccccccc0',
        '0cdcdcdcdcdcc0',
        '00000000000000'
    ];

    // A cartridge in the colour of one of the three editions, on a link cable; 14 x 20
    function cartridgeSvg() {
        var edition = EDITIONS[Math.floor(Math.random() * EDITIONS.length)];
        return svg('0 0 14 20', ''
            + '<rect x="5" y="0" width="4" height="3" fill="#5a5a6e"/><rect x="6" y="3" width="2" height="3" fill="#7a7a8c"/>'
            + pix(CART, { '0': '#081820', 'c': edition[0], 'd': edition[1], 'w': '#f4f4ec' }, 1, 0, 6));
    }
})();
