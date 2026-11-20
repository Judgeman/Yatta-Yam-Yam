/*
 * Colour theme for every page (included via fragments/theme.html in <head>, so it
 * runs before the first paint and the page never flashes in the wrong colours).
 *
 * 1. Light / dark: follows the operating system (prefers-color-scheme) and switches
 *    live when the OS setting changes. Bootstrap 5.3 reads data-bs-theme on <html>.
 *
 * 2. Seasonal looks, switched on by the browser's local date and following light /
 *    dark like the normal look. Every few minutes a visitor drops by (js/visitors.js).
 *    - Christmas: fir-green menu bar with fairy lights, red buttons, falling snow,
 *      Santa hats on the avatars; from the Monday after Totensonntag up to and
 *      including 26 December. Visitors: Santa and his reindeer (js/christmas.js).
 *      Styles: css/christmas.css.
 *    - Easter: sky-blue menu bar with a string of painted eggs, pink buttons, falling
 *      blossom petals, a meadow along the bottom edge, bunny ears on the avatars;
 *      from the Monday two weeks before Easter up to and including Easter Monday.
 *      Visitors: the Easter bunny and a chick (js/easter.js). Styles: css/easter.css.
 *    - Halloween: night-purple menu bar with a string of pumpkin lanterns, orange
 *      buttons, falling autumn leaves, a graveyard along the bottom edge, skull masks
 *      on the avatars; from 18 October up to and including 31 October. Visitors: a witch
 *      on her broom, a skeleton, a ghost, a spider and a black cat (js/halloween.js).
 *      Styles: css/halloween.css.
 *    - Día de los Muertos: rosa-mexicano menu bar with a string of papel picado,
 *      marigold petals drifting down, an ofrenda with candles and marigolds along the
 *      bottom edge, sugar-skull masks on the avatars; 1 to 7 November. Visitors:
 *      monarch butterflies, a Catrina, a skeleton with a guitar (js/muertos.js).
 *      Styles: css/muertos.css.
 *    - Garlic: only on Garlic Day (19 April) and Garlic Lovers Day (6 October). Olive
 *      menu bar with a garlic braid, purple buttons, garlic-bulb avatars, falling cloves,
 *      a garlic patch along the bottom edge. Visitors: a dancing garlic bulb, a bat and
 *      a vampire who are not amused, a garlic charm on a string (js/garlic.js).
 *      Styles: css/garlic.css.
 *    - Pizza: the week around Pizza Day (9 February), 6 to 12 February. Tomato-red menu
 *      bar with a striped pizzeria awning, basil-green buttons, pizza avatars, falling
 *      toppings, a checked tablecloth along the bottom edge. Visitors: a flying pizza, a
 *      pizza slice, a pizzaiolo tossing dough, a slice on a string of cheese
 *      (js/pizza.js). Styles: css/pizza.css.
 *    Preview at any time: append ?theme=christmas, ?theme=easter, ?theme=halloween,
 *    ?theme=muertos, ?theme=garlic or ?theme=pizza to any page URL.
 *
 * 3. Link-only looks have no season and only ever show as a preview, for links shared
 *    on purpose on a particular day:
 *    - Pelmeni (?theme=pelmeni): dumplings, Gzhel-blue menu bar with a lace border,
 *      beetroot buttons, plate-with-smetana avatars, falling pelmeni and dill, a pastry
 *      board along the bottom edge. Visitors: pelmeni and their dumpling friends
 *      (js/pelmeni.js). Styles: css/pelmeni.css.
 *    - Pasta (?theme=pasta): Amalfi-teal menu bar with tagliatelle drying on a pole,
 *      tomato buttons, plate-of-spaghetti avatars, falling pasta shapes, a striped
 *      tablecloth along the bottom edge. Visitors: farfalle, a meatball, a pasta parade
 *      (js/pasta.js). Styles: css/pasta.css.
 *    - GTA VI homage (?theme=gta, "Food Order in Vice City"): our own Miami-at-sunset
 *      artwork, no game assets. Night-purple-to-pink menu bar with neon tubes, synthwave
 *      sun avatars, falling dollar bills, an ocean drive skyline along the bottom edge.
 *      Visitors: a car chase, a helicopter, a speedboat, a flamingo in shades, a bag of
 *      cash (js/gta.js). Styles: css/gta.css.
 *    The hidden page /themes lists every look with a preview link.
 *    The preview lasts until the browser tab is closed (sessionStorage),
 *    ?theme=default ends it.
 *
 * 4. Easter egg "Symbolics": a neon retro-terminal look styled after symbolics.com,
 *    the first .com domain ever registered. Toggle it by typing "symbolics" anywhere
 *    outside a form field, or by tapping the version badge on the release notes page
 *    7 times. A link can switch it, too: append ?theme=symbolics to any page URL
 *    (?theme=default switches back). The choice is kept per browser in localStorage.
 *    Styles: css/symbolics.css.
 *
 * Which look applies: a preview in this tab, else Symbolics if switched on,
 * else the season's look, else the normal look. While Symbolics hides a seasonal look,
 * theme-info.js shows a note with a way back to the standard look.
 */
(function () {
    'use strict';

    var root = document.documentElement;
    var STORAGE_KEY = 'yy-theme';           // localStorage: "symbolics" while the easter egg is on
    var PREVIEW_KEY = 'yy-theme-preview';   // sessionStorage: the seasonal look previewed in this tab
    var SYMBOLICS = 'symbolics';
    var XMAS = 'christmas';
    var EASTER = 'easter';
    var HALLOWEEN = 'halloween';
    var MUERTOS = 'muertos';
    var GARLIC = 'garlic';
    var PIZZA = 'pizza';
    var PELMENI = 'pelmeni';
    var PASTA = 'pasta';
    var GTA = 'gta';
    var SEASONS = [XMAS, EASTER, HALLOWEEN, MUERTOS, GARLIC, PIZZA];
    var LINK_ONLY = [PELMENI, PASTA, GTA];        // no season: only ever shown as a preview
    var PREVIEWABLE = SEASONS.concat(LINK_ONLY);
    var URL_PARAM = 'theme';
    var URL_OFF = 'default';
    var TAPS_NEEDED = 7;
    var TAP_WINDOW_MS = 1500;
    var IDLE_TEXT = "READY FOR INPUT... (TYPE 'SYMBOLICS' TO EXIT)";

    var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var symbolics = readSymbolics();
    var preview = readPreview();
    var theme = null; // the look shown right now: SYMBOLICS, one of PREVIEWABLE, or null

    // A shared link like /orders/12?theme=symbolics (or ?theme=easter) switches the
    // look before the first paint. Once the choice is stored, the parameter is removed
    // from the address bar, so reloading or copying the URL does not switch it again.
    (function themeFromUrl() {
        var url;
        try {
            url = new URL(window.location.href);
        } catch (e) {
            return;
        }
        var value = (url.searchParams.get(URL_PARAM) || '').toLowerCase();
        if (value !== SYMBOLICS && value !== URL_OFF && PREVIEWABLE.indexOf(value) < 0) {
            return;
        }
        var stored;
        if (PREVIEWABLE.indexOf(value) >= 0) {
            preview = value;
            stored = writePreview(value);
        } else {
            symbolics = value === SYMBOLICS;
            preview = null;
            var symbolicsStored = writeSymbolics(symbolics);
            stored = writePreview(null) && symbolicsStored;
        }
        if (stored && window.history.replaceState) {
            url.searchParams.delete(URL_PARAM);
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
    })();

    function readSymbolics() {
        try {
            return window.localStorage.getItem(STORAGE_KEY) === SYMBOLICS;
        } catch (e) {
            return false;
        }
    }

    // Returns false if the choice could not be stored
    function writeSymbolics(on) {
        try {
            if (on) {
                window.localStorage.setItem(STORAGE_KEY, SYMBOLICS);
            } else {
                window.localStorage.removeItem(STORAGE_KEY);
            }
            return true;
        } catch (e) {
            // Private mode or blocked storage: the mode then lasts for this page only
            return false;
        }
    }

    function readPreview() {
        try {
            var value = window.sessionStorage.getItem(PREVIEW_KEY);
            return PREVIEWABLE.indexOf(value) >= 0 ? value : null;
        } catch (e) {
            return null;
        }
    }

    // Returns false if the preview could not be stored
    function writePreview(value) {
        try {
            if (value) {
                window.sessionStorage.setItem(PREVIEW_KEY, value);
            } else {
                window.sessionStorage.removeItem(PREVIEW_KEY);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    // Christmas season: from the Monday after Totensonntag (the last Sunday before
    // Advent, always between 20 and 26 November) up to and including 26 December.
    function isChristmasSeason(now) {
        var year = now.getFullYear();
        var totensonntag = 26 - new Date(year, 10, 26).getDay(); // Sunday on or before 26 Nov
        var start = new Date(year, 10, totensonntag + 1);
        var end = new Date(year, 11, 27); // off again from 27 December
        return now >= start && now < end;
    }

    // Easter Sunday in the Gregorian calendar (anonymous Gregorian algorithm)
    function easterSunday(year) {
        var a = year % 19;
        var b = Math.floor(year / 100);
        var c = year % 100;
        var d = Math.floor(b / 4);
        var e = b % 4;
        var f = Math.floor((b + 8) / 25);
        var g = Math.floor((b - f + 1) / 3);
        var h = (19 * a + b - d - g + 15) % 30;
        var i = Math.floor(c / 4);
        var k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = Math.floor((a + 11 * h + 22 * l) / 451);
        var n = h + l - 7 * m + 114;
        return new Date(year, Math.floor(n / 31) - 1, n % 31 + 1);
    }

    // Easter season: from the Monday two weeks before Easter Sunday (the Monday before
    // Palm Sunday) up to and including Easter Monday.
    function isEasterSeason(now) {
        var easter = easterSunday(now.getFullYear());
        var y = easter.getFullYear();
        var mo = easter.getMonth();
        var d = easter.getDate();
        var start = new Date(y, mo, d - 13);
        var end = new Date(y, mo, d + 2); // off again from the Tuesday after Easter
        return now >= start && now < end;
    }

    // Halloween season: the last two weeks of October, 18 to 31 October
    function isHalloweenSeason(now) {
        var year = now.getFullYear();
        return now >= new Date(year, 9, 18) && now < new Date(year, 10, 1);
    }

    // Día de los Muertos: the first week of November (1 to 7), right after Halloween
    function isMuertosSeason(now) {
        var year = now.getFullYear();
        return now >= new Date(year, 10, 1) && now < new Date(year, 10, 8);
    }

    // Garlic: Garlic Day (19 April) and Garlic Lovers Day (6 October), these two days only
    function isGarlicDay(now) {
        var month = now.getMonth();
        var day = now.getDate();
        return (month === 3 && day === 19) || (month === 9 && day === 6);
    }

    // Pizza: a week around Pizza Day (9 February), from 6 to 12 February
    function isPizzaWeek(now) {
        return now.getMonth() === 1 && now.getDate() >= 6 && now.getDate() <= 12;
    }

    // The single days come first: Garlic Day can fall into the Easter weeks
    function seasonOf(now) {
        if (isGarlicDay(now)) {
            return GARLIC;
        }
        if (isPizzaWeek(now)) {
            return PIZZA;
        }
        if (isChristmasSeason(now)) {
            return XMAS;
        }
        if (isEasterSeason(now)) {
            return EASTER;
        }
        if (isHalloweenSeason(now)) {
            return HALLOWEEN;
        }
        return isMuertosSeason(now) ? MUERTOS : null;
    }

    function currentTheme() {
        if (preview) {
            return preview;
        }
        if (symbolics) {
            return SYMBOLICS;
        }
        return seasonOf(new Date());
    }

    function applyTheme() {
        theme = currentTheme();
        if (theme === SYMBOLICS) {
            root.setAttribute('data-bs-theme', 'dark'); // Symbolics is always dark
        } else {
            root.setAttribute('data-bs-theme', media && media.matches ? 'dark' : 'light');
        }
        if (theme) {
            root.setAttribute('data-yy-theme', theme);
        } else {
            root.removeAttribute('data-yy-theme');
        }
    }

    applyTheme();

    if (media) {
        if (media.addEventListener) {
            media.addEventListener('change', applyTheme);
        } else if (media.addListener) {
            media.addListener(applyTheme); // Safari < 14
        }
    }

    // ── Symbolics chrome: a command line at the bottom of the screen ──

    // "/orders/12/close" → "C:\YATTA-YAM-YAM\ORDERS\12\CLOSE>"
    function prompt() {
        var parts = window.location.pathname.split('/').filter(Boolean);
        return ['C:', 'YATTA-YAM-YAM'].concat(parts).join('\\').toUpperCase() + '>';
    }

    function setCommand(text) {
        var cmd = document.getElementById('yy-terminal-cmd');
        if (cmd) {
            cmd.textContent = text;
        }
    }

    function label(el) {
        var text = el.getAttribute('aria-label') || el.getAttribute('title')
            || el.getAttribute('placeholder') || el.textContent || el.value || el.name || '';
        text = text.replace(/\s+/g, ' ').trim();
        return text.length > 40 ? text.substring(0, 39) + '…' : text;
    }

    // Shows the command a click on the item under the pointer would run
    function describe(target) {
        var el = target.closest ? target.closest('a, button, input, select, textarea, label') : null;
        if (!el) {
            return IDLE_TEXT;
        }
        var name = label(el);
        var arg = name ? ' "' + name + '"' : '';
        var tag = el.tagName;
        if (tag === 'A') {
            return 'OPEN' + arg;
        }
        if (tag === 'BUTTON' || (tag === 'INPUT' && /^(submit|button|reset)$/i.test(el.type))) {
            return 'RUN' + arg;
        }
        if ((tag === 'INPUT' && /^(checkbox|radio)$/i.test(el.type)) || tag === 'LABEL') {
            return 'SELECT' + arg;
        }
        return 'EDIT' + arg;
    }

    function onMouseOver(e) {
        setCommand(describe(e.target));
    }

    function buildChrome() {
        if (document.getElementById('yy-terminal') || !document.body) {
            return;
        }
        var bar = document.createElement('div');
        bar.id = 'yy-terminal';
        bar.className = 'yy-terminal';
        bar.setAttribute('aria-hidden', 'true');

        var line = document.createElement('div');
        line.className = 'yy-terminal-line';
        line.appendChild(document.createTextNode(prompt() + ' '));
        var cmd = document.createElement('span');
        cmd.id = 'yy-terminal-cmd';
        cmd.className = 'yy-terminal-cmd';
        cmd.textContent = IDLE_TEXT;
        var cursor = document.createElement('span');
        cursor.className = 'yy-terminal-cursor';
        line.appendChild(cmd);
        line.appendChild(cursor);

        var status = document.createElement('div');
        status.className = 'yy-terminal-status';
        status.textContent = 'System status: online';

        bar.appendChild(line);
        bar.appendChild(status);
        document.body.appendChild(bar);
        document.addEventListener('mouseover', onMouseOver);
    }

    function removeChrome() {
        var bar = document.getElementById('yy-terminal');
        if (bar) {
            bar.parentNode.removeChild(bar);
        }
        document.removeEventListener('mouseover', onMouseOver);
    }

    function syncChrome() {
        if (theme === SYMBOLICS) {
            buildChrome();
        } else {
            removeChrome();
        }
    }

    function setSymbolics(on, persist) {
        symbolics = on;
        if (persist) {
            writeSymbolics(on);
            // Switching the easter egg by hand ends a seasonal preview, so the change shows
            preview = null;
            writePreview(null);
        }
        applyTheme();
        syncChrome();
        if (on) {
            setCommand("LOADING SYMBOLICS.EXE... OK. TYPE 'SYMBOLICS' AGAIN TO EXIT");
        }
    }

    // ── Triggers ──

    // Typing "symbolics" anywhere except in form fields
    var typed = '';
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) {
            return;
        }
        var t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
            return;
        }
        typed = (typed + e.key.toLowerCase()).slice(-SYMBOLICS.length);
        if (typed === SYMBOLICS) {
            typed = '';
            setSymbolics(theme !== SYMBOLICS, true);
        }
    });

    // Tapping the version badge on the release notes page (works on phones, too)
    var taps = 0;
    var lastTap = 0;
    document.addEventListener('click', function (e) {
        var badge = e.target.closest ? e.target.closest('#release-version') : null;
        if (!badge) {
            return;
        }
        var now = Date.now();
        taps = now - lastTap < TAP_WINDOW_MS ? taps + 1 : 1;
        lastTap = now;
        if (taps >= TAPS_NEEDED) {
            taps = 0;
            setSymbolics(theme !== SYMBOLICS, true);
        }
    });

    // Keep other open tabs in step
    window.addEventListener('storage', function (e) {
        if (e.key === STORAGE_KEY) {
            setSymbolics(readSymbolics(), false);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncChrome);
    } else {
        syncChrome();
    }

    // For theme-info.js and the /themes page: which seasonal look the date calls for
    // (whatever is shown right now), and switching Symbolics off in place, like typing
    // "symbolics" or ?theme=default
    window.yyTheme = {
        season: function () {
            return seasonOf(new Date());
        },
        // For the /themes page: the seasonal look of any date, and the lists of looks
        seasonOn: function (date) {
            return seasonOf(date);
        },
        seasons: SEASONS.slice(),
        linkOnly: LINK_ONLY.slice(),
        useStandard: function () {
            setSymbolics(false, true);
        }
    };
})();
