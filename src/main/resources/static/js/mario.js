/*
 * Super Mario homage visitors (see visitors.js for when and how they appear). The look
 * shows on MAR10 Day (10 March) and as a ?theme=mario preview, see theme.js. A nod to
 * the 8-bit jump-and-run days in our own pixel art: none of the figures is, or looks
 * like, a character, enemy or item from the games.
 *   - our hero, a pixel chef in a white toque, jumps along the bottom edge past two coins,
 *   - a grumpy broccoli marches along the bottom edge,
 *   - a bird flaps across the upper half with a slice of pizza in its beak,
 *   - the chef peeks in from an edge and waves,
 *   - a brick block comes down on a chain, a coin bouncing out of it.
 * Typing "mario" outside a form field calls one at once.
 */
(function () {
    'use strict';

    if (!window.yyVisitors) {
        return;
    }
    var clamp = window.yyVisitors.clamp;

    window.yyVisitors.add('mario', {
        call: 'mario',
        visitors: [
            {
                name: 'jumping-chef', weight: 2, motion: 'walk', facesRight: true, svg: jumpingChefSvg,
                size: function (vw, vh) {
                    var h = clamp(vh * 0.2, 110, 160);
                    return [h * 40 / 34, h];
                },
                speed: 0.16, minMs: 6000, maxMs: 11000
            },
            {
                name: 'grumpy-broccoli', weight: 1, motion: 'walk', svg: broccoliSvg,
                size: function (vw, vh) {
                    var h = clamp(vh * 0.12, 64, 96);
                    return [h * 12 / 15, h];
                },
                speed: 0.1, minMs: 8000, maxMs: 14000
            },
            {
                name: 'pizza-bird', weight: 1, motion: 'fly', facesRight: true, svg: pizzaBirdSvg, tilt: false,
                size: function (vw) {
                    var w = clamp(vw * 0.12, 100, 150);
                    return [w, w * 10 / 24];
                },
                speed: 0.2, minMs: 4500, maxMs: 10000, climb: 30, wave: 22
            },
            { name: 'peek-chef', weight: 1, motion: 'peek', svg: chefPeekSvg },
            {
                name: 'drop-block', weight: 1, motion: 'drop', svg: brickBlockSvg,
                thread: { color: '#6b6b6b', width: '4px' },
                size: function (vw, vh) {
                    var w = clamp(Math.min(vw, vh) * 0.12, 64, 96);
                    return [w, w * 26 / 30];
                }
            }
        ]
    });

    // ── Figures: pixel art (rows of characters, one per pixel), see visitors.css ──

    // A few colours of the 8-bit console era
    var NES = {
        'k': '#000000', 'w': '#fcfcfc', 'a': '#747474', 'r': '#d82800', 's': '#fcb898', 'b': '#2038ec',
        'g': '#00a800', 'G': '#80d010', 'o': '#fcbc3c', 'y': '#fce4a0', 'n': '#ac7c00',
        'l': '#fca044', 'm': '#c84c0c', 'd': '#7a2a04'
    };

    function svg(viewBox, body) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '" shape-rendering="crispEdges">' + body + '</svg>';
    }

    // Turns rows of characters into rectangles; '.' stays empty, runs of a colour merge
    function pix(rows, size, ox, oy) {
        var out = '';
        rows.forEach(function (row, y) {
            var x = 0;
            while (x < row.length) {
                var c = row.charAt(x);
                var start = x;
                while (x < row.length && row.charAt(x) === c) {
                    x++;
                }
                if (NES[c]) {
                    out += '<rect x="' + (ox + start * size) + '" y="' + (oy + y * size) + '" width="' + ((x - start) * size)
                        + '" height="' + size + '" fill="' + NES[c] + '"/>';
                }
            }
        });
        return out;
    }

    var CHEF = [
        '...kkkkkk...',
        '..kwwwwwwk..',
        '.kwwwwwwwwk.',
        '.kwwwwwwwwk.',
        '..kwwwwwwk..',
        '..kkkkkkkk..',
        '..kssssssk..',
        '..kskssksk..',
        '..kssssssk..',
        '..kssrrssk..',
        '...kkkkkk...',
        '.kkrrrrrrkk.',
        'kswwwwwwwwsk',
        'kswwwwwwwwsk',
        '.kaaaaaaaak.',
        '.kaak..kaak.',
        '.kkk....kkk.'
    ];
    var BROC = [
        '.kk..kk..kk.',
        'kGgkkGgkkGgk',
        'kgGgggGgggGk',
        'kggGggggGggk',
        'kgkkggggkkgk',
        'kgggkggkgggk',
        'kggggkkggggk',
        '.kkGggggGkk.',
        '...kGGGGk...',
        '...kGGGGk...',
        '...kGGGGk...',
        '...kkkkkk...'
    ];
    var BIRD = [
        '..........kkkk....',
        '.........kbbbbk...',
        '.........kbkbbbkk.',
        '..kkkkkkkkbbbbbook',
        '.kbbbbbbbbbbbbbk..',
        'kbbbbbbbbbbbbbk...',
        '.kkbbbbbbbbbkk....',
        '...kkkkkkkkk......'
    ];
    var WING = [
        '.kkkk.',
        'kwwwwk',
        '.kwwk.'
    ];
    var SLICE = [
        'kkkkk',
        'knnnk',
        'kyryk',
        '.kyk.',
        '..k..'
    ];
    var BRICK = [
        'llllllldllllllld',
        'mmmmmmmdmmmmmmmd',
        'mmmmmmmdmmmmmmmd',
        'dddddddddddddddd',
        'lllldllllllldlll',
        'mmmmdmmmmmmmdmmm',
        'mmmmdmmmmmmmdmmm',
        'dddddddddddddddd'
    ];
    var COIN = [
        '..kkkk..',
        '.kooook.',
        'kooyyook',
        'kooynook',
        'kooynook',
        'kooynook',
        '.kooook.',
        '..kkkk..'
    ];
    var HAND = [
        '.ss.',
        'ssss',
        'ssss',
        'ssss',
        '.ss.',
        '.ww.',
        '.ww.',
        '.ww.'
    ];

    // The chef jumping along, two coins floating ahead; 40 x 34
    function jumpingChefSvg() {
        return svg('0 0 40 34', ''
            + '<g class="yy-v-bob">' + pix(COIN, 1, 22, 2) + pix(COIN, 1, 32, 6) + '</g>'
            + '<g class="yy-v-bunny-hop">' + pix(CHEF, 2, 0, 0) + '</g>');
    }

    // The grumpy broccoli marching, little legs kicking; 12 x 15
    function broccoliSvg() {
        return svg('0 0 12 15', ''
            + '<g class="yy-v-leg-l" style="transform-origin:4.5px 12px">' + pix(['k', 'k', 'kk'], 1, 4, 12) + '</g>'
            + '<g class="yy-v-leg-r" style="transform-origin:7.5px 12px">' + pix(['k', 'k', 'kk'], 1, 7, 12) + '</g>'
            + pix(BROC, 1, 0, 0));
    }

    // A bird with a slice of pizza in its beak, flapping; 24 x 10
    function pizzaBirdSvg() {
        return svg('0 0 24 10', ''
            + pix(BIRD, 1, 0, 1)
            + '<g class="yy-v-flutter" style="transform-origin:8px 4px">' + pix(WING, 1, 5, 2) + '</g>'
            + pix(SLICE, 1, 17, 4));
    }

    // The chef peeking in and waving; 120 x 110 box
    function chefPeekSvg() {
        return svg('0 0 120 110', ''
            + '<g class="yy-v-wave" style="transform-origin:100px 100px">' + pix(HAND, 6, 88, 54) + '</g>'
            + pix(CHEF.slice(0, 14), 7, 18, 14));
    }

    // A brick block on a chain (the chain meets its middle), a coin bouncing out to its
    // side; 30 x 26
    function brickBlockSvg() {
        return svg('0 0 30 26', ''
            + '<rect x="14" y="0" width="2" height="6" fill="#6b6b6b"/>'
            + pix(BRICK, 1, 7, 6) + pix(BRICK, 1, 7, 14)
            + '<rect x="7" y="6" width="16" height="16" fill="none" stroke="#000" stroke-width=".6"/>'
            + '<g class="yy-v-bob">' + pix(COIN, 1, 22, 0) + '</g>');
    }
})();
