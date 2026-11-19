/*
 * Colour theme for every page (included via fragments/theme.html in <head>, so it
 * runs before the first paint and the page never flashes in the wrong colours).
 *
 * 1. Light / dark: follows the operating system (prefers-color-scheme) and switches
 *    live when the OS setting changes. Bootstrap 5.3 reads data-bs-theme on <html>.
 *
 * 2. Christmas: a festive look (fir-green menu bar with fairy lights, red buttons,
 *    falling snow, Santa hats on the avatars) that switches itself on from the Monday
 *    after Totensonntag until 26 December and is off again from 27 December, by the
 *    browser's local date. It follows light / dark like the normal look. Every few
 *    minutes Santa or a reindeer drops by (js/christmas.js).
 *    Preview at any time: append ?theme=christmas to any page URL. The preview lasts
 *    until the browser tab is closed (sessionStorage), ?theme=default ends it.
 *    Styles: css/christmas.css.
 *
 * 3. Easter egg "Symbolics": a neon retro-terminal look styled after symbolics.com,
 *    the first .com domain ever registered. Toggle it by typing "symbolics" anywhere
 *    outside a form field, or by tapping the version badge on the release notes page
 *    7 times. A link can switch it, too: append ?theme=symbolics to any page URL
 *    (?theme=default switches back). The choice is kept per browser in localStorage.
 *    Styles: css/symbolics.css.
 *
 * Which look applies: a Christmas preview in this tab, else Symbolics if switched on,
 * else Christmas during the season, else the normal look.
 */
(function () {
    'use strict';

    var root = document.documentElement;
    var STORAGE_KEY = 'yy-theme';           // localStorage: "symbolics" while the easter egg is on
    var PREVIEW_KEY = 'yy-theme-preview';   // sessionStorage: "christmas" while previewing it in this tab
    var EGG = 'symbolics';
    var XMAS = 'christmas';
    var URL_PARAM = 'theme';
    var URL_OFF = 'default';
    var TAPS_NEEDED = 7;
    var TAP_WINDOW_MS = 1500;
    var IDLE_TEXT = "READY FOR INPUT... (TYPE 'SYMBOLICS' TO EXIT)";

    var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var symbolics = readEgg();
    var preview = readPreview();
    var theme = null; // the look shown right now: EGG, XMAS or null

    // A shared link like /orders/12?theme=symbolics (or ?theme=christmas) switches the
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
        if (value !== EGG && value !== XMAS && value !== URL_OFF) {
            return;
        }
        var stored;
        if (value === XMAS) {
            preview = true;
            stored = writePreview(true);
        } else {
            symbolics = value === EGG;
            preview = false;
            var eggStored = writeEgg(symbolics);
            stored = writePreview(false) && eggStored;
        }
        if (stored && window.history.replaceState) {
            url.searchParams.delete(URL_PARAM);
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
    })();

    function readEgg() {
        try {
            return window.localStorage.getItem(STORAGE_KEY) === EGG;
        } catch (e) {
            return false;
        }
    }

    // Returns false if the choice could not be stored
    function writeEgg(on) {
        try {
            if (on) {
                window.localStorage.setItem(STORAGE_KEY, EGG);
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
            return window.sessionStorage.getItem(PREVIEW_KEY) === XMAS;
        } catch (e) {
            return false;
        }
    }

    // Returns false if the preview could not be stored
    function writePreview(on) {
        try {
            if (on) {
                window.sessionStorage.setItem(PREVIEW_KEY, XMAS);
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

    function currentTheme() {
        if (preview) {
            return XMAS;
        }
        if (symbolics) {
            return EGG;
        }
        return isChristmasSeason(new Date()) ? XMAS : null;
    }

    function applyTheme() {
        theme = currentTheme();
        if (theme === EGG) {
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
        if (theme === EGG) {
            buildChrome();
        } else {
            removeChrome();
        }
    }

    function setSymbolics(on, persist) {
        symbolics = on;
        if (persist) {
            writeEgg(on);
            // Switching the easter egg by hand ends a Christmas preview, so the change shows
            preview = false;
            writePreview(false);
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
        typed = (typed + e.key.toLowerCase()).slice(-EGG.length);
        if (typed === EGG) {
            typed = '';
            setSymbolics(theme !== EGG, true);
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
            setSymbolics(theme !== EGG, true);
        }
    });

    // Keep other open tabs in step
    window.addEventListener('storage', function (e) {
        if (e.key === STORAGE_KEY) {
            setSymbolics(readEgg(), false);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncChrome);
    } else {
        syncChrome();
    }
})();
