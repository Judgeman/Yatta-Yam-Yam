/*
 * Symbolics mode (switched by theme.js): the command line at the bottom of the screen.
 *
 * Pointing at a link, button or form field shows the command a click would run:
 * OPEN "Contacts", RUN "Switch", SELECT "Cost split", EDIT "Place Name". The line takes
 * typed commands, too: click it (or press "/" outside a form field), type and press Enter.
 * After a page change the line has the focus again if it had it before.
 *
 *   OPEN "<link>", OPEN #12  follow a link, open order 12 (after checking it exists)
 *   RUN "<button>"           press a button
 *   SELECT "<option>"        tick a checkbox or radio button
 *   EDIT "<field>"           jump into a form field
 *   DIR [...], LS -LA        list what can be commanded on this page
 *   CD "<link>", CD .., BACK, FORWARD, HOME, CLS, WHOAMI, DATE, ECHO
 *   HISTORY, !!, !N, ALIAS, UNALIAS, MAN <command>, HELP (also --help, -h, /?), EXIT
 *   <command> --help shows how to use one; a | sends what a command prints to the next
 *
 * More programs (GREP, TOP, NEOFETCH, ... and a few for admins) come from
 * symbolics-apps.js through window.yySymbolics.
 *
 * Names are the labels the line shows on hover, matched without regard to case; the
 * quotes are optional. Tab completes the command or the name: a single match is written
 * out in full, several are listed and completed as far as they agree, and pressing Tab
 * again cycles through them (Shift+Tab backwards); while the list shows, ↑/↓ move
 * through it, too, and Enter runs the one picked (a picked command that needs a name
 * just stays in the line). Enter runs an exact match, or the only name that starts with
 * what was typed or has a word starting with it. If there is none, a message says so
 * and offers similar names; a name that fits several lists them. Without the list,
 * ↑/↓ recall earlier commands (sessionStorage, so they survive page changes in this
 * tab), Ctrl+R searches them, Ctrl+L clears, Ctrl+C cancels, PgUp/PgDn scroll the page
 * (with Shift the output), Esc closes the output window. SUDO … has a few surprises.
 *
 * The line is built while html[data-yy-theme="symbolics"] is set and removed when it
 * goes. Styles: css/symbolics.css.
 */
(function () {
    'use strict';

    var root = document.documentElement;
    var SYMBOLICS = 'symbolics';
    var HISTORY_KEY = 'yy-terminal-history';   // sessionStorage: earlier commands, newest last
    var HISTORY_MAX = 50;
    var LABEL_MAX = 40;        // longer names are cut with "…", like on hover
    var OUTPUT_MAX = 120;      // lines kept in the output window
    var SUGGEST_MAX = 10;      // completions listed at once
    var LIST_MAX = 40;         // lines DIR prints
    var HIDE_AFTER_MS = 1500;  // output window after a command that did something
    var TARGETS = 'a, button, input, select, textarea, label';
    var IDLE_TEXT = "READY FOR INPUT... (PRESS / TO TYPE A COMMAND, 'SYMBOLICS' TO EXIT)";
    var FOCUS_TEXT = 'TYPE HELP, OR THE START OF A NAME AND PRESS TAB';
    var BOOT_TEXT = "LOADING SYMBOLICS.EXE... OK. TYPE 'SYMBOLICS' AGAIN TO EXIT";

    var VERBS = ['OPEN', 'RUN', 'SELECT', 'EDIT'];
    var NOUN = { OPEN: 'LINK', RUN: 'BUTTON', SELECT: 'OPTION', EDIT: 'FIELD' };
    var ALIAS_KEY = 'yy-terminal-aliases';     // localStorage: { NAME: 'command' }
    var REFOCUS_KEY = 'yy-terminal-focus';     // sessionStorage: the line had the focus when the page was left

    var SUDO_REPORTS = [
        'A COPY WENT TO THE KITCHEN. YOUR NEXT PIZZA MAY ARRIVE LUKEWARM.',
        'THE COFFEE MACHINE HAS BEEN NOTIFIED. IT IS VERY DISAPPOINTED IN YOU.',
        'PENALTY: YOU GET THE SALAD NEXT TIME.',
        'REPORT FILED UNDER "HANGRY". A SNACK IS ADVISED.'
    ];

    var reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    var bar = null;          // the command line while Symbolics is on, else null
    var els = {};            // its parts
    var hoverText = null;    // what the line shows for the element under the pointer
    var completion = null;   // { value, items, index } while Tab cycles through matches
    var historyIndex = -1;   // -1: not browsing the history
    var draft = '';          // what was typed before ↑
    var sudo = null;         // { tries } while asking for the password
    var search = null;       // { query, pos, match, draft } during Ctrl+R
    var capture = null;      // lines collected while a command's output goes into a pipe
    var emptyEnter = null;   // what Enter on an empty line does (GREP: the next match)
    var screens = [];        // full-screen programs that are open
    var jobs = [];           // what Ctrl+C stops
    var stopHooks = [];      // called when the line goes (Symbolics switched off)
    var leaving = false;     // a command is taking us to another page
    var timers = [];
    var hideTimer = null;
    var frame = 0;
    var theme = root.getAttribute('data-yy-theme');
    var started = false;

    // ── Small helpers ──

    function make(tag, className, text) {
        var el = document.createElement(tag);
        if (className) {
            el.className = className;
        }
        if (text) {
            el.textContent = text;
        }
        return el;
    }

    function later(fn, ms) {
        var id = window.setTimeout(function () {
            var index = timers.indexOf(id);
            if (index >= 0) {
                timers.splice(index, 1);
            }
            if (bar) {
                fn();
            }
        }, ms);
        timers.push(id);
        return id;
    }

    function isField(el) {
        return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    }

    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function motion() {
        return !(reducedMotion && reducedMotion.matches);
    }

    // ── Names: what the line calls a link, button or field ──

    function clean(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
    }

    function shorten(text) {
        return text.length > LABEL_MAX ? text.substring(0, LABEL_MAX - 1) + '…' : text;
    }

    // For comparing: lower case, single spaces, without quotes or a trailing "…"
    // (so a name can be typed with or without quotes, and a completed one matches)
    function normalize(text) {
        return clean(text).toLowerCase()
            .replace(/^["'“”„]+/, '')
            .replace(/["'“”]+$/, '')
            .replace(/(…|\.\.\.)$/, '')
            .trim();
    }

    function isFormField(el) {
        return /^(SELECT|TEXTAREA)$/.test(el.tagName)
            || (el.tagName === 'INPUT' && !/^(submit|button|reset|image)$/i.test(el.type || ''));
    }

    // The caption of a field that is not tied to it with for="…" (a common pattern here):
    // the closest label before it, in its parent or grandparent, that has no field of its own
    function caption(el) {
        var box = el.parentElement;
        for (var depth = 0; box && depth < 2; depth++, box = box.parentElement) {
            var found = null;
            var labels = box.getElementsByTagName('label');
            for (var i = 0; i < labels.length; i++) {
                if (!labels[i].control && (labels[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                    found = labels[i];
                }
            }
            if (found) {
                return found.textContent;
            }
        }
        return '';
    }

    // Roughly what a screen reader would announce
    function fullLabel(el) {
        var field = isFormField(el);
        var candidates = [el.getAttribute('aria-label'), el.getAttribute('title')];
        if (field) {
            candidates.push(el.labels && el.labels.length ? el.labels[0].textContent : '', caption(el));
        }
        candidates.push(el.getAttribute('placeholder'));
        if (el.tagName === 'SELECT') {
            candidates.push(el.selectedOptions && el.selectedOptions.length ? el.selectedOptions[0].text : '');
        } else {
            candidates.push(el.textContent);
        }
        if (!/^(checkbox|radio)$/i.test(el.type || '')) {
            candidates.push(el.value);
        }
        candidates.push(el.getAttribute('name'));
        for (var i = 0; i < candidates.length; i++) {
            var text = clean(candidates[i]);
            if (text) {
                return text;
            }
        }
        return '';
    }

    function verbOf(el) {
        var tag = el.tagName;
        var type = tag === 'INPUT' ? (el.type || '').toLowerCase() : '';
        if (tag === 'A') {
            return 'OPEN';
        }
        if (tag === 'BUTTON' || /^(submit|button|reset|image)$/.test(type)) {
            return 'RUN';
        }
        if (/^(checkbox|radio)$/.test(type)) {
            return 'SELECT';
        }
        return 'EDIT';
    }

    function usable(el) {
        if (bar && bar.contains(el)) {
            return false;
        }
        if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled')) {
            return false;
        }
        if (el.closest('[aria-hidden="true"], [inert]') || !el.getClientRects().length) {
            return false;
        }
        return window.getComputedStyle(el).visibility !== 'hidden';
    }

    // Everything on the page a command can reach (all verbs if verb is null), one per name
    function targets(verb) {
        var list = [];
        var seen = {};
        var nodes = document.querySelectorAll(TARGETS);
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var field = el;
            if (el.tagName === 'LABEL') {
                // A label counts only for a hidden field (a styled toggle): otherwise the
                // field is the target itself, and a caption without a field is none
                if (!el.control || usable(el.control)) {
                    continue;
                }
                field = el.control;
            }
            var v = verbOf(field);
            if ((verb && v !== verb) || !usable(el)) {
                continue;
            }
            var full = fullLabel(field);
            var norm = normalize(full);
            if (!norm || seen[v + ' ' + norm]) {
                continue;
            }
            seen[v + ' ' + norm] = true;
            var label = shorten(full);
            list.push({ el: el, verb: v, label: label, norm: norm, short: normalize(label) });
        }
        return list;
    }

    function commandFor(t) {
        return t.verb + ' "' + t.label + '"';
    }

    // Shows the command a click on the item under the pointer would run
    function describe(target) {
        var el = target && target.closest ? target.closest(TARGETS) : null;
        if (el && el.tagName === 'LABEL') {
            el = el.control; // a click on a label goes to its field
        }
        if (!el) {
            return null;
        }
        var name = shorten(fullLabel(el));
        return verbOf(el) + (name ? ' "' + name + '"' : '');
    }

    // Matches for a typed name, best first, in five tiers: [0] the exact name,
    // [1] names starting with it, [2] names with a word starting with it (these three may
    // run on Enter), [3] names containing it, [4] names containing all of its words
    function find(list, query) {
        var q = normalize(query);
        var tiers = [[], [], [], [], []];
        if (!q) {
            return tiers;
        }
        var words = q.split(' ');
        list.forEach(function (t) {
            if (t.norm === q || t.short === q) {
                tiers[0].push(t);
            } else if (t.norm.indexOf(q) === 0) {
                tiers[1].push(t);
            } else if ((' ' + t.norm).indexOf(' ' + q) >= 0) {
                tiers[2].push(t);
            } else if (t.norm.indexOf(q) >= 0) {
                tiers[3].push(t);
            } else if (words.every(function (w) { return t.norm.indexOf(w) >= 0; })) {
                tiers[4].push(t);
            }
        });
        return tiers;
    }

    // ── The prompt ──

    function pathParts() {
        return window.location.pathname.split('/').filter(Boolean).map(function (part) {
            try {
                return decodeURIComponent(part);
            } catch (e) {
                return part;
            }
        });
    }

    // "/orders/12/close" → "C:\YATTA-YAM-YAM\ORDERS\12\CLOSE"
    function promptPath() {
        return ['C:', 'YATTA-YAM-YAM'].concat(pathParts()).join('\\').toUpperCase();
    }

    // For phones: "C:\…\CLOSE"
    function shortPromptPath() {
        var parts = pathParts();
        return parts.length ? ('C:\\…\\' + parts[parts.length - 1]).toUpperCase() : 'C:\\YATTA-YAM-YAM';
    }

    function setPrompt(full, short) {
        els.promptFull.textContent = full;
        els.promptShort.textContent = short || full;
    }

    function resetPrompt() {
        setPrompt(promptPath() + '>', shortPromptPath() + '>');
    }

    function userName() {
        var badge = document.querySelector('.navbar .user-badge');
        var name = badge && badge.parentNode ? badge.parentNode.querySelector('.text-white') : null;
        var text = name ? clean(name.textContent) : '';
        return text ? text.toUpperCase() : 'GUEST';
    }

    // ── Output window ──

    function showPanel() {
        window.clearTimeout(hideTimer);
        els.panel.hidden = false;
    }

    function hidePanel() {
        window.clearTimeout(hideTimer);
        els.panel.hidden = true;
        clearSuggestions();
    }

    function hideSoon() {
        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(function () {
            if (bar) {
                hidePanel();
            }
        }, HIDE_AFTER_MS);
    }

    function scrollDown() {
        els.out.scrollTop = els.out.scrollHeight;
    }

    // The plain text lines of an output node, for a pipe
    function linesOf(node) {
        var lines = [];
        if (node.classList.contains('yy-term-rows')) {
            for (var i = 0; i + 1 < node.children.length; i += 2) {
                lines.push(node.children[i].textContent + '  ' + node.children[i + 1].textContent);
            }
            return lines;
        }
        if (node.classList.contains('yy-term-picks')) {
            return [].map.call(node.children, function (child) {
                return child.textContent;
            });
        }
        if (node.hasAttribute('data-lines')) {
            [].forEach.call(node.children, function (child) {
                lines.push.apply(lines, linesOf(child));
            });
            return lines;
        }
        return node.textContent.split('\n');
    }

    function addLine(node) {
        if (capture) {
            capture.push.apply(capture, linesOf(node));
            return;
        }
        els.out.appendChild(node);
        while (els.out.childNodes.length > OUTPUT_MAX) {
            els.out.removeChild(els.out.firstChild);
        }
        showPanel();
        scrollDown();
    }

    // kind: echo, ok, info, warn or err
    function print(text, kind) {
        addLine(make('div', 'yy-term-' + (kind || 'ok'), text));
    }

    function echoLine(line) {
        print(promptPath() + '> ' + line, 'echo');
    }

    // A button that writes a command into the line (Enter then runs it)
    function pickButton(text, active, command) {
        var button = make('button', 'yy-term-pick' + (active ? ' is-active' : ''), text);
        button.type = 'button';
        button.setAttribute('tabindex', '-1');
        button.addEventListener('mousedown', function (e) {
            e.preventDefault(); // keep the focus in the line
        });
        button.addEventListener('click', function () {
            completion = null;
            clearSuggestions();
            setValue(command || text);
            els.input.focus();
        });
        return button;
    }

    // Two columns (a command and what it does); one below the other on phones
    function printRows(rows) {
        var box = make('div', 'yy-term-rows');
        rows.forEach(function (row) {
            box.appendChild(make('span', 'yy-term-key', row[0]));
            box.appendChild(make('span', 'yy-term-desc', row[1]));
        });
        addLine(box);
    }

    // items: commands, or { text, command } to show one thing and write another
    function printPicks(items) {
        var box = make('div', 'yy-term-picks');
        items.forEach(function (item) {
            box.appendChild(typeof item === 'string'
                ? pickButton(item, false)
                : pickButton(item.text, false, item.command));
        });
        addLine(box);
    }

    function showSuggestions(items, index) {
        var box = els.suggest;
        box.textContent = '';
        var start = 0;
        if (items.length > SUGGEST_MAX && index > 0) {
            start = Math.min(Math.max(0, index - 2), items.length - SUGGEST_MAX);
        }
        if (start > 0) {
            box.appendChild(make('div', 'yy-term-info', '… ' + start + ' MORE ABOVE'));
        }
        items.slice(start, start + SUGGEST_MAX).forEach(function (item, i) {
            box.appendChild(pickButton(item.text, start + i === index));
        });
        var below = items.length - start - SUGGEST_MAX;
        if (below > 0) {
            box.appendChild(make('div', 'yy-term-info', '… ' + below + ' MORE (KEEP PRESSING TAB)'));
        }
        box.hidden = false;
        showPanel();
    }

    function suggestNothing() {
        els.suggest.textContent = '';
        els.suggest.appendChild(make('div', 'yy-term-warn', 'NO MATCH ON THIS PAGE.'));
        els.suggest.hidden = false;
        showPanel();
    }

    function clearSuggestions() {
        if (els.suggest) {
            els.suggest.textContent = '';
            els.suggest.hidden = true;
            if (!els.out.childNodes.length) {
                els.panel.hidden = true;
            }
        }
    }

    // ── The input line and its block cursor ──

    function setValue(text) {
        var input = els.input;
        input.value = text;
        if (input.setSelectionRange) {
            input.setSelectionRange(text.length, text.length);
        }
        input.scrollLeft = input.scrollWidth;
        update(true);
    }

    function textWidth(text) {
        els.measure.textContent = text;
        return els.measure.getBoundingClientRect().width;
    }

    function placeCursor(focused) {
        var input = els.input;
        var x = 0;
        if (!sudo) {
            if (input.value) {
                var end = input.value.length;
                if (focused && typeof input.selectionEnd === 'number') {
                    end = input.selectionDirection === 'backward' ? input.selectionStart : input.selectionEnd;
                }
                x = textWidth(input.value.slice(0, end)) - input.scrollLeft;
            } else if (!focused) {
                x = textWidth(els.ghost.textContent);
            }
        }
        var max = els.field.clientWidth - els.cursor.offsetWidth;
        x = Math.max(0, Math.min(x, max));
        els.cursor.style.transform = 'translateX(' + Math.round(x) + 'px)';
    }

    function render() {
        if (!bar) {
            return;
        }
        var focused = document.activeElement === els.input;
        bar.classList.toggle('is-focused', focused);
        bar.classList.toggle('has-value', !!els.input.value);
        bar.classList.toggle('is-secret', !!sudo);
        els.ghost.textContent = hoverText || (focused ? FOCUS_TEXT : IDLE_TEXT);
        placeCursor(focused);
    }

    // After typing or moving the caret: redraw once per frame, and keep the cursor solid
    // for a moment (it blinks again when nothing happens)
    function update(typing) {
        if (!bar) {
            return;
        }
        if (typing) {
            els.cursor.classList.remove('is-steady');
            void els.cursor.offsetWidth; // restart the blink
            els.cursor.classList.add('is-steady');
        }
        if (!frame) {
            frame = window.requestAnimationFrame(function () {
                frame = 0;
                render();
            });
        }
    }

    // ── History ──

    function readHistory() {
        try {
            var list = JSON.parse(window.sessionStorage.getItem(HISTORY_KEY) || '[]');
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function writeHistory(list) {
        try {
            window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-HISTORY_MAX)));
        } catch (e) {
            // Blocked storage: no history then
        }
    }

    function pushHistory(line) {
        var list = readHistory();
        if (list[list.length - 1] !== line) {
            list.push(line);
        }
        writeHistory(list);
    }

    // step 1: one further back (↑), -1: one forward (↓)
    function recall(step) {
        var list = readHistory();
        if (!list.length || (historyIndex === -1 && step < 0)) {
            return;
        }
        if (historyIndex === -1) {
            draft = els.input.value;
        }
        var next = Math.min(historyIndex + step, list.length - 1);
        completion = null;
        clearSuggestions();
        if (next < 0) {
            historyIndex = -1;
            setValue(draft);
            return;
        }
        historyIndex = next;
        setValue(list[list.length - 1 - next]);
    }

    // ── Commands: a registry the extra programs (symbolics-apps.js) add to ──

    // name → { name, names, run(arg, stdin, word), synopsis, summary, man: [lines], args,
    //          hidden (not completed, not in HELP), complete() → [options], help: [row], rank }
    var registry = {};
    var helpRows = [];

    function define(names, def) {
        def.names = [].concat(names).map(function (name) {
            return name.toUpperCase();
        });
        def.name = def.names[0];
        def.names.forEach(function (name) {
            registry[name] = def;
        });
        if (def.help) {
            helpRows.push({ rank: def.rank || 50, row: def.help });
            helpRows.sort(function (a, b) {
                return a.rank - b.rank;
            });
        }
        return def;
    }

    function lookup(word) {
        var key = (word || '').toUpperCase();
        return registry.hasOwnProperty(key) ? registry[key] : null;
    }

    // ── Aliases (localStorage, so they stay in this browser) ──

    function readAliases() {
        try {
            var map = JSON.parse(window.localStorage.getItem(ALIAS_KEY) || '{}');
            return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
        } catch (e) {
            return {};
        }
    }

    function writeAliases(map) {
        try {
            window.localStorage.setItem(ALIAS_KEY, JSON.stringify(map));
            return true;
        } catch (e) {
            return false;
        }
    }

    // Only the first word, and only once (an alias may use a command of the same name)
    function expandAlias(text) {
        var m = /^(\S+)([\s\S]*)$/.exec(text);
        if (!m) {
            return text;
        }
        var map = readAliases();
        var key = m[1].toUpperCase();
        return map.hasOwnProperty(key) ? map[key] + m[2] : text;
    }

    // ── History expansion: !! (the last command), !N (number N), !-N, !text ──

    function expandHistory(line) {
        if (line.indexOf('!') < 0) {
            return { line: line };
        }
        var list = readHistory();
        var failed = null;
        var out = line.replace(/(^|\s)!(!|-?\d+|[A-Za-z][^\s]*)/g, function (all, lead, ref) {
            var hit;
            if (ref === '!') {
                hit = list[list.length - 1];
            } else if (/^-\d+$/.test(ref)) {
                hit = list[list.length + Number(ref)];
            } else if (/^\d+$/.test(ref)) {
                hit = list[Number(ref) - 1];
            } else {
                for (var i = list.length - 1; i >= 0 && hit === undefined; i--) {
                    if (list[i].toLowerCase().indexOf(ref.toLowerCase()) === 0) {
                        hit = list[i];
                    }
                }
            }
            if (hit === undefined) {
                failed = failed || '!' + ref;
                return all;
            }
            return lead + hit;
        });
        return failed ? { error: failed.toUpperCase() } : { line: out };
    }

    // ── Tab completion ──

    function commonStart(texts) {
        var first = texts[0];
        var end = first.length;
        texts.forEach(function (text) {
            var i = 0;
            while (i < end && i < text.length && text.charAt(i).toLowerCase() === first.charAt(i).toLowerCase()) {
                i++;
            }
            end = i;
        });
        return first.substring(0, end);
    }

    // The best matches for a name: exact and starting with it, else the next tier
    function bestMatches(list, query) {
        var tiers = find(list, query);
        var best = tiers[0].concat(tiers[1]);
        return best.length ? best : (tiers[2].length ? tiers[2] : (tiers[3].length ? tiers[3] : tiers[4]));
    }

    // What Tab offers for the first word: the listed commands and your aliases
    function commandNames() {
        var names = Object.keys(registry).filter(function (name) {
            return !registry[name].hidden;
        });
        Object.keys(readAliases()).forEach(function (name) {
            if (names.indexOf(name) < 0) {
                names.push(name);
            }
        });
        return names.sort();
    }

    function takesArgument(name) {
        var def = lookup(name);
        return !def || !!def.args; // an alias may be followed by more
    }

    // What Tab can make of the line: { items: [{ text, part }], lead, query } — lead is
    // the text before the name when all items share it (for completing as far as they agree)
    function completionsFor(value) {
        var m = /^\s*(\S*)(\s*)([\s\S]*)$/.exec(value);
        var word = m[1].toUpperCase();
        var rest = m[3];
        if (!m[2]) {
            var names = commandNames().filter(function (name) {
                return word && name.indexOf(word) === 0;
            });
            if (names.length) {
                return {
                    lead: '',
                    query: word.toLowerCase(),
                    items: names.map(function (name) {
                        return { text: name + (takesArgument(name) ? ' ' : ''), part: name };
                    })
                };
            }
        }
        var verb = word === 'CD' ? 'OPEN' : word;
        if (VERBS.indexOf(verb) >= 0) {
            var lead = word + ' "';
            var list = targets(verb);
            return {
                lead: lead,
                query: normalize(rest),
                // Nothing typed after the command yet: every name is a match
                items: (normalize(rest) ? bestMatches(list, rest) : list).map(function (t) {
                    return { text: lead + t.label + '"', part: t.label };
                })
            };
        }
        var def = lookup(word);
        if (def && def.complete && m[2]) {
            var typed = clean(rest).toLowerCase();
            var start = word + ' ';
            return {
                lead: start,
                query: typed,
                items: def.complete().filter(function (option) {
                    return option.toLowerCase().indexOf(typed) === 0;
                }).map(function (option) {
                    return { text: start + option, part: option };
                })
            };
        }
        // No command: look for the whole line among all names
        return {
            lead: null,
            query: normalize(value),
            items: bestMatches(targets(null), value).map(function (t) {
                return { text: commandFor(t), part: t.label };
            })
        };
    }

    function complete(step) {
        var value = els.input.value;
        if (completion && completion.value === value) {
            var n = completion.items.length;
            completion.index = completion.index < 0
                ? (step > 0 ? 0 : n - 1)
                : (completion.index + step + n) % n;
            setValue(completion.items[completion.index].text);
            completion.value = els.input.value;
            showSuggestions(completion.items, completion.index);
            return;
        }
        completion = null;
        var found = completionsFor(value);
        var items = found.items;
        if (!items.length) {
            clearSuggestions();
            suggestNothing();
            return;
        }
        if (items.length === 1) {
            clearSuggestions();
            setValue(items[0].text);
            return;
        }
        // Several: complete as far as they agree, else go straight to the first one
        var common = commonStart(items.map(function (item) { return item.part; }));
        var agrees = common.length > found.query.length && common.toLowerCase().indexOf(found.query) === 0;
        if (agrees) {
            setValue((found.lead === null ? '' : found.lead) + common);
            completion = { value: els.input.value, items: items, index: -1 };
            showSuggestions(items, -1);
            return;
        }
        completion = { value: value, items: items, index: -1 };
        complete(step);
    }

    // ── Running commands ──

    function submit() {
        var raw = els.input.value;
        completion = null;
        historyIndex = -1;
        clearSuggestions();
        setValue('');
        if (sudo) {
            password(raw);
            return;
        }
        var line = clean(raw);
        if (!line) {
            if (emptyEnter) {
                emptyEnter();
            }
            return;
        }
        var expanded = expandHistory(line);
        if (expanded.error) {
            echoLine(line);
            print(expanded.error + ': EVENT NOT FOUND', 'err');
            return;
        }
        pushHistory(expanded.line);
        echoLine(expanded.line);
        runLine(expanded.line);
    }

    // "fortune | cowsay": what a command prints goes to the next one instead of the screen
    function splitPipes(line) {
        var stages = [];
        var current = '';
        var quote = null;
        for (var i = 0; i < line.length; i++) {
            var c = line.charAt(i);
            if (quote) {
                if (c === quote) {
                    quote = null;
                }
            } else if (c === '"' || c === "'") {
                quote = c;
            } else if (c === '|') {
                stages.push(current);
                current = '';
                continue;
            }
            current += c;
        }
        stages.push(current);
        return stages;
    }

    // Where a command's output goes: the screen, or (before a |) the next command.
    // Commands that answer later (PS loads the dashboard) write through this.
    function sink(collected) {
        function into(fn) {
            return function () {
                var outer = capture;
                capture = collected || outer;
                try {
                    fn.apply(null, arguments);
                } finally {
                    capture = outer;
                }
            };
        }
        return { print: into(print), picks: into(printPicks), rows: into(printRows), node: into(addLine) };
    }

    function runLine(line) {
        var stages = splitPipes(line);
        if (stages.length > 1 && stages.some(function (stage) { return !clean(stage); })) {
            print("SYNTAX ERROR NEAR UNEXPECTED TOKEN '|'", 'err');
            return;
        }
        (function next(i, stdin) {
            if (i >= stages.length) {
                return;
            }
            var collected = i < stages.length - 1 ? [] : null;
            var outer = capture;
            var result = null;
            capture = collected || outer;
            try {
                result = runCommand(clean(stages[i]), stdin, sink(collected));
            } catch (err) {
                capture = outer;
                print('SEGMENTATION FAULT (CORE DUMPED)', 'err');
                if (window.console && window.console.error) {
                    window.console.error(err);
                }
            } finally {
                capture = outer;
            }
            if (collected && result && typeof result.then === 'function') {
                // the next command waits for this one's answer
                result.then(function () {
                    next(i + 1, collected);
                }, function () {
                    next(i + 1, collected);
                });
            } else {
                next(i + 1, collected);
            }
        })(0, null);
    }

    var HELP_FLAG = /^(--help|-h|-\?|\/\?)$/i;

    function runCommand(text, stdin, out) {
        var m = /^(\S+)\s*([\s\S]*)$/.exec(expandAlias(text));
        var word = m[1];
        var arg = m[2];
        if (HELP_FLAG.test(word)) {
            help();
            return;
        }
        var def = lookup(word);
        if (def) {
            if (HELP_FLAG.test(clean(arg))) {
                usage(def);
                return null;
            }
            return def.run(arg, stdin || null, word, out || sink(null));
        }
        if (/^#\d+$/.test(word) && !arg) {
            openOrder(word.substring(1));
            return;
        }
        // A bare name works, too, if it is exactly the name of something on the page
        var exact = find(targets(null), m[0])[0];
        if (exact.length) {
            execute(exact[0]);
            return;
        }
        print('BAD COMMAND OR FILE NAME: ' + word.toUpperCase(), 'err');
        print('TYPE HELP (OR --HELP) FOR A LIST OF COMMANDS.', 'info');
    }

    function command(verb, arg) {
        var noun = NOUN[verb];
        var order = /^["']?#(\d+)["']?$/.exec(clean(arg));
        if (verb === 'OPEN' && order) {
            openOrder(order[1]);
            return;
        }
        if (!normalize(arg)) {
            print('USAGE: ' + verb + ' "<' + noun + '>"   (TAB COMPLETES THE NAME, DIR ' + verb + ' LISTS THEM)', 'info');
            return;
        }
        var tiers = find(targets(verb), arg);
        if (tiers[0].length) {
            execute(tiers[0][0]);
            return;
        }
        var likely = tiers[1].concat(tiers[2]);
        if (likely.length === 1) {
            execute(likely[0]);
            return;
        }
        var shown = '"' + clean(arg).replace(/^["'“„]+/, '').replace(/["'”]+$/, '') + '"';
        if (likely.length > 1) {
            print(shown + ' FITS ' + likely.length + ' ' + noun + 'S. WHICH ONE?', 'warn');
            printPicks(likely.slice(0, LIST_MAX).map(commandFor));
            return;
        }
        print(noun + ' NOT FOUND: ' + shown, 'err');
        var similar = tiers[3].concat(tiers[4]);
        if (similar.length) {
            print('DID YOU MEAN:', 'info');
            printPicks(similar.slice(0, LIST_MAX).map(commandFor));
        } else {
            print('TYPE DIR ' + verb + ' TO LIST THE ' + noun + 'S ON THIS PAGE.', 'info');
        }
    }

    function execute(t) {
        var el = t.el;
        var name = '"' + t.label + '"';
        if (t.verb === 'EDIT') {
            var field = el.control || el;
            print('EDITING ' + name + '...', 'ok');
            field.focus();
            if (field.scrollIntoView) {
                field.scrollIntoView({ block: 'center' });
            }
            hideSoon();
            return;
        }
        if (t.verb === 'OPEN') {
            print('OPENING ' + name + '...', 'ok');
        } else if (t.verb === 'RUN') {
            print('RUNNING ' + name + '...', 'ok');
        }
        hideSoon();
        el.click();
        if (t.verb === 'SELECT') {
            var box = el.tagName === 'LABEL' ? el.control : el;
            var on = box && box.checked;
            var mark = box && box.type === 'radio' ? (on ? '(•) ' : '( ) ') : (on ? '[X] ' : '[ ] ');
            print(mark + t.label, 'ok');
        }
    }

    // The app's base path (in case it runs below a context path), from the app-name link
    function appUrl(path) {
        var brand = document.querySelector('.navbar-brand[href]');
        var base = '';
        if (brand) {
            var m = /^(.*)\/orders\/dashboard\/?$/.exec(brand.pathname || '');
            base = m ? m[1] : '';
        }
        return base + path;
    }

    function appVersion() {
        var el = document.querySelector('.version-footer a, #release-version');
        var text = el ? clean(el.textContent).replace(/^v/i, '') : '';
        return /^\d/.test(text) ? text : '?';
    }

    // A command takes us to another page (or reloads this one): the line keeps the focus
    function go(url) {
        leaving = true;
        if (url) {
            window.location.href = url;
        } else {
            window.location.reload();
        }
    }

    // OPEN #12: checks that the order exists before going there
    function openOrder(id) {
        var url = appUrl('/orders/' + id);
        if (!window.fetch) {
            window.location.href = url;
            return;
        }
        print('LOOKING UP ORDER #' + id + '...', 'info');
        window.fetch(url, { credentials: 'same-origin' }).then(function (response) {
            if (!bar) {
                return;
            }
            // A missing order sends us back to the dashboard: only the order page itself counts
            var path = '';
            try {
                path = new URL(response.url).pathname.replace(/\/$/, '');
            } catch (e) {
                // keep it empty
            }
            if (/\/login$/.test(path)) {
                print('PLEASE LOG IN FIRST.', 'err');
            } else if (response.ok && path.slice(-('/orders/' + id).length) === '/orders/' + id) {
                print('OPENING ORDER #' + id + '...', 'ok');
                go(url);
            } else {
                print('ORDER #' + id + ' NOT FOUND.', 'err');
            }
        }, function () {
            if (bar) {
                print('NETWORK ERROR. THE KITCHEN IS NOT ANSWERING.', 'err');
            }
        });
    }

    function help() {
        print('NAMES ARE WHAT THIS LINE SHOWS WHEN YOU POINT AT SOMETHING.', 'info');
        printRows(helpRows.map(function (entry) {
            return entry.row;
        }));
        print('KEYS: TAB COMPLETES (↑/↓ PICK)   ↑/↓ HISTORY   CTRL+R SEARCH   CTRL+L CLEAR   '
            + 'CTRL+C CANCEL   PGUP/PGDN SCROLL   ESC CLOSE', 'info');
        print('SOME COMMANDS ARE NOT LISTED. ADMINS WILL KNOW WHICH.', 'echo');
    }

    // <command> --help
    function usage(def) {
        print('USAGE: ' + def.synopsis, 'info');
        print(def.summary.toUpperCase(), 'ok');
        if (def.names.length > 1) {
            print('ALSO: ' + def.names.slice(1).join(', '), 'echo');
        }
        print('MORE: MAN ' + def.name, 'echo');
    }

    function centerLine(left, middle, right, width) {
        var gap = Math.max(1, width - left.length - middle.length - right.length);
        var before = Math.floor(gap / 2);
        return left + new Array(before + 1).join(' ') + middle + new Array(gap - before + 1).join(' ') + right;
    }

    function man(arg) {
        var word = clean(arg).split(' ')[0];
        if (!word) {
            print('WHAT MANUAL PAGE DO YOU WANT?', 'warn');
            print("FOR EXAMPLE, TRY 'MAN MAN'.", 'info');
            return;
        }
        var def = lookup(word);
        if (!def) {
            print('NO MANUAL ENTRY FOR ' + word.toUpperCase(), 'err');
            return;
        }
        var title = def.name + '(1)';
        var indent = '       ';
        var month = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        print(centerLine(title, 'YATTA-YAM-YAM MANUAL', title, 64), 'echo');
        print('NAME', 'info');
        print(indent + def.name.toLowerCase() + ' - ' + def.summary, 'ok');
        print('SYNOPSIS', 'info');
        print(indent + def.synopsis, 'ok');
        print('DESCRIPTION', 'info');
        (def.man || [def.summary + '.']).forEach(function (line) {
            print(indent + line, 'ok');
        });
        if (def.names.length > 1) {
            print('ALIASES', 'info');
            print(indent + def.names.slice(1).join(', '), 'ok');
        }
        print(centerLine('Yatta-Yam-Yam ' + appVersion(), month, title, 64), 'echo');
    }

    function dir(arg) {
        var word = clean(arg).toUpperCase();
        if (/^-[A-Z]*L/.test(word)) {
            longList();
            return;
        }
        var verb = VERBS.indexOf(word) >= 0 ? word : null;
        var list = targets(verb);
        if (word && !verb) {
            var tiers = find(list, arg);
            list = tiers[0].concat(tiers[1], tiers[2], tiers[3], tiers[4]);
        }
        if (!list.length) {
            print(word ? 'FILE NOT FOUND' : 'NOTHING TO COMMAND ON THIS PAGE.', 'warn');
            return;
        }
        print(' DIRECTORY OF ' + promptPath(), 'info');
        printPicks(list.slice(0, LIST_MAX).map(commandFor));
        if (list.length > LIST_MAX) {
            print('... AND ' + (list.length - LIST_MAX) + ' MORE. NARROW IT DOWN: DIR OPEN, DIR RUN, DIR <NAME>', 'info');
        }
        print('      ' + list.length + (list.length === 1 ? ' ITEM' : ' ITEMS'), 'info');
    }

    function padStart(text, width) {
        text = String(text);
        return text.length >= width ? text : new Array(width - text.length + 1).join(' ') + text;
    }

    function padEnd(text, width) {
        text = String(text);
        return text.length >= width ? text : text + new Array(width - text.length + 1).join(' ');
    }

    // LS -LA: links are symlinks to where they go, buttons are executables, fields are files
    function longList() {
        var list = targets(null);
        var user = padEnd(userName().toLowerCase(), 8);
        var now = new Date();
        var stamp = now.toLocaleString('en-GB', { month: 'short' }) + ' ' + padStart(now.getDate(), 2) + ' '
            + padStart(now.getHours(), 2).replace(' ', '0') + ':' + padStart(now.getMinutes(), 2).replace(' ', '0');
        function line(mode, owner, size, name) {
            return mode + '  1 ' + owner + ' lunch ' + padStart(size, 5) + ' ' + stamp + ' ' + name;
        }
        print('TOTAL ' + (list.length + 2), 'info');
        var rows = [
            { text: line('drwxr-xr-x', user, 4096, '.'), command: 'DIR' },
            { text: line('drwxr-xr-x', padEnd('root', 8), 4096, '..'), command: 'CD ..' }
        ];
        list.forEach(function (t) {
            var text;
            if (t.verb === 'OPEN') {
                var href = t.el.getAttribute('href') || '';
                text = line('lrwxrwxrwx', user, t.label.length, t.label + (href ? ' -> ' + href : ''));
            } else if (t.verb === 'RUN') {
                text = line('-rwxr-xr-x', user, t.label.length, t.label + '*');
            } else if (t.verb === 'SELECT') {
                var box = t.el.tagName === 'LABEL' ? t.el.control : t.el;
                text = line('-rw-r--r--', user, t.label.length, (box && box.checked ? '[x] ' : '[ ] ') + t.label);
            } else {
                text = line('-rw-rw-r--', user, t.label.length, t.label);
            }
            rows.push({ text: text, command: commandFor(t) });
        });
        printPicks(rows);
    }

    function back() {
        if (window.history.length <= 1) {
            print('NOWHERE TO GO BACK TO.', 'warn');
            return;
        }
        print('GOING BACK...', 'ok');
        window.history.back();
    }

    function home() {
        print('GOING HOME...', 'ok');
        go(appUrl('/orders/dashboard'));
    }

    function cd(arg) {
        var to = clean(arg);
        if (!to) {
            print(promptPath(), 'ok');
        } else if (/^\.\.[\\/]?$/.test(to)) {
            back();
        } else if (/^[\\/~]$/.test(to)) {
            home();
        } else {
            command('OPEN', to);
        }
    }

    function cls() {
        els.out.textContent = '';
        hidePanel();
    }

    function whoami() {
        var name = userName();
        if (name === 'GUEST') {
            print('GUEST (NOT LOGGED IN)', 'ok');
            return;
        }
        print('YATTA\\' + name, 'ok');
        print('STATUS: HUNGRY', 'info');
    }

    function date() {
        var now = new Date();
        var text;
        try {
            text = now.toLocaleString('en-GB', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch (e) {
            text = now.toString();
        }
        print(text.toUpperCase(), 'ok');
        var hour = now.getHours();
        if (hour >= 11 && hour < 14) {
            print('IT IS LUNCH TIME.', 'warn');
        }
    }

    function exit() {
        if (!window.yyTheme || !window.yyTheme.useStandard) {
            print('EXIT FAILED. TYPE "SYMBOLICS" OUTSIDE THIS LINE INSTEAD.', 'err');
            return;
        }
        print('SHUTTING DOWN SYMBOLICS.EXE...', 'info');
        later(function () {
            window.yyTheme.useStandard();
        }, 600);
    }

    function historyCommand(arg) {
        if (/^-c$/i.test(clean(arg))) {
            writeHistory([]);
            print('HISTORY CLEARED.', 'ok');
            return;
        }
        var list = readHistory();
        if (!list.length) {
            print('NO HISTORY YET.', 'info');
            return;
        }
        printPicks(list.map(function (cmd, i) {
            return { text: padStart(i + 1, 4) + '  ' + cmd, command: cmd };
        }));
    }

    function alias(arg) {
        var text = clean(arg);
        var map = readAliases();
        if (!text) {
            var keys = Object.keys(map).sort();
            if (!keys.length) {
                print("NO ALIASES YET. FOR EXAMPLE: ALIAS LL='LS -LA'", 'info');
            }
            keys.forEach(function (key) {
                print('ALIAS ' + key + "='" + map[key] + "'", 'ok');
            });
            return;
        }
        var m = /^([^\s=]+)\s*=\s*([\s\S]*)$/.exec(text);
        if (!m) {
            var key = text.toUpperCase();
            if (map.hasOwnProperty(key)) {
                print('ALIAS ' + key + "='" + map[key] + "'", 'ok');
            } else {
                print('ALIAS: ' + text + ': NOT FOUND', 'err');
            }
            return;
        }
        var name = m[1].toUpperCase();
        var value = clean(m[2].replace(/^(['"])([\s\S]*)\1$/, '$2'));
        if (!/^[A-Z0-9_.-]+$/.test(name)) {
            print("ALIAS: '" + m[1] + "': INVALID ALIAS NAME", 'err');
            return;
        }
        if (!value) {
            print('ALIAS: WHAT SHOULD ' + name + ' DO? FOR EXAMPLE: ALIAS ' + name + "='DIR OPEN'", 'err');
            return;
        }
        map[name] = value;
        print('ALIAS ' + name + "='" + value + "'", 'ok');
        if (!writeAliases(map)) {
            print('(STORAGE IS BLOCKED: THE ALIAS IS GONE ON THE NEXT PAGE.)', 'warn');
        }
    }

    function unalias(arg) {
        var name = clean(arg).toUpperCase();
        var map = readAliases();
        if (name === '-A') {
            writeAliases({});
            print('ALL ALIASES REMOVED.', 'ok');
        } else if (map.hasOwnProperty(name)) {
            delete map[name];
            writeAliases(map);
            print('ALIAS ' + name + ' REMOVED.', 'ok');
        } else {
            print('UNALIAS: ' + (name || '?') + ': NOT FOUND', 'err');
        }
    }

    // ── SUDO: never works, always entertains ──

    function sudoCommand(arg) {
        var what = clean(arg);
        if (!what) {
            print('USAGE: SUDO <COMMAND>', 'info');
            print('WITH GREAT POWER COMES GREAT RESPONSIBILITY. AND A LUNCH ORDER.', 'warn');
            return;
        }
        if (/sandwich/i.test(what)) {
            print('OKAY.', 'ok');
            fly('🥪', 7);
            return;
        }
        if (/^rm(\s|$)/i.test(what)) {
            meltdown();
            return;
        }
        sudo = { tries: 0 };
        setPrompt('[SUDO] PASSWORD FOR ' + userName() + ':');
        update(true);
    }

    function endSudo() {
        sudo = null;
        resetPrompt();
        update(true);
    }

    function password(typed) {
        print(els.promptFull.textContent, 'echo'); // like sudo: nothing of the password shows
        sudo.tries++;
        var guess = clean(typed).toLowerCase();
        if (sudo.tries < 3) {
            if (guess === 'hunter2') {
                print('HUNTER2? ALL WE SEE IS *******. SORRY, TRY AGAIN.', 'err');
            } else if (guess.indexOf('pizza') >= 0) {
                print('SORRY, TRY AGAIN. (NO, IT IS NOT "PIZZA".)', 'err');
            } else {
                print('SORRY, TRY AGAIN.', 'err');
            }
            return;
        }
        endSudo();
        print('SUDO: 3 INCORRECT PASSWORD ATTEMPTS', 'err');
        print(userName() + ' IS NOT IN THE SUDOERS FILE. THIS INCIDENT WILL BE REPORTED.', 'err');
        alarm();
        later(function () {
            print(pick(SUDO_REPORTS), 'warn');
        }, 1800);
    }

    function cancelSudo() {
        print(els.promptFull.textContent + ' ^C', 'echo');
        endSudo();
    }

    // A class on <html> for a while; css/symbolics.css does the rest
    function effect(name, ms) {
        var cls = 'yy-fx-' + name;
        root.classList.remove(cls);
        void root.offsetWidth; // restart the animation if it is still running
        root.classList.add(cls);
        later(function () {
            root.classList.remove(cls);
        }, ms);
    }

    function alarm() {
        effect('alarm', 4000);
        els.status.textContent = 'System status: intruder alert';
        later(function () {
            els.status.textContent = 'System status: online';
        }, 4000);
    }

    // sudo rm …: a fake meltdown with a happy end
    function meltdown() {
        var steps = [
            ['rm: REMOVING /ORDERS ............ DONE', 'warn'],
            ['rm: REMOVING /CONTACTS .......... DONE', 'warn'],
            ['rm: REMOVING /LUNCH ............. DONE', 'warn'],
            ['rm: REMOVING /DESSERT ........... DONE', 'warn'],
            ['rm: REMOVING /COFFEE ............ FAILED', 'err'],
            ['rm: /COFFEE IS PROTECTED BY THE KERNEL. NOBODY TOUCHES THE COFFEE.', 'err']
        ];
        steps.forEach(function (step, i) {
            later(function () {
                print(step[0], step[1]);
            }, 350 * (i + 1));
        });
        var t = 350 * (steps.length + 1);
        later(function () {
            effect('glitch', 1200);
            print('KERNEL PANIC - NOT SYNCING: OUT OF LUNCH', 'err');
        }, t);
        later(function () {
            print('...', 'echo');
        }, t + 1500);
        later(function () {
            print('JUST KIDDING. NOTHING WAS DELETED.', 'ok');
            print('PLEASE DO NOT DO THAT AGAIN. THE COFFEE MACHINE IS STILL SHAKING.', 'ok');
        }, t + 2400);
    }

    function fly(emoji, count) {
        for (var i = 0; i < count; i++) {
            var node = make('span', 'yy-terminal-fly', emoji);
            node.setAttribute('aria-hidden', 'true');
            node.style.left = (6 + Math.random() * 84) + 'vw';
            node.style.animationDelay = (i * 0.18) + 's';
            bar.appendChild(node);
            later(node.remove.bind(node), 3200 + i * 180);
        }
    }

    // Switching Symbolics on: the screen powers up like a CRT
    function powerOn() {
        if (!motion()) {
            return;
        }
        var crt = make('div', 'yy-terminal-crt');
        crt.setAttribute('aria-hidden', 'true');
        bar.appendChild(crt);
        later(crt.remove.bind(crt), 1000);
    }

    // ── Jobs (Ctrl+C stops them) and full-screen programs ──

    function job(cancel) {
        jobs.push(cancel);
        return function done() {
            var index = jobs.indexOf(cancel);
            if (index >= 0) {
                jobs.splice(index, 1);
            }
        };
    }

    function interrupt() {
        var running = jobs;
        jobs = [];
        running.forEach(function (cancel) {
            cancel();
        });
        return running.length;
    }

    // A program that takes the whole screen (vim, top, ...): it gets the keys until it
    // closes, then the line has the focus again. options: { className, label, onKey(e), onClose() }
    function openScreen(options) {
        var el = make('div', 'yy-terminal-screen ' + (options.className || ''));
        el.tabIndex = -1;
        el.setAttribute('role', 'application');
        el.setAttribute('aria-label', options.label || 'Program');
        var screen = { el: el };
        screen.close = function (quiet) {
            if (!el.parentNode) {
                return;
            }
            el.parentNode.removeChild(el);
            screens.splice(screens.indexOf(screen), 1);
            if (options.onClose) {
                options.onClose();
            }
            if (!quiet && bar) {
                els.input.focus();
            }
        };
        el.addEventListener('keydown', function (e) {
            e.stopPropagation(); // the page's own keys (and "symbolics") stay out of it
            if (options.onKey) {
                options.onKey(e, screen);
            }
        });
        hidePanel();
        bar.appendChild(el);
        screens.push(screen);
        el.focus();
        return screen;
    }

    // ── The built-in commands ──

    function verbCommand(verb) {
        return function (arg) {
            command(verb, arg);
        };
    }

    define('OPEN', {
        args: true, rank: 10, run: verbCommand('OPEN'),
        synopsis: 'OPEN "<LINK>"  |  OPEN #<ORDER>',
        summary: 'follow a link on this page, or open an order by its number',
        help: ['OPEN "<LINK>", OPEN #12', 'FOLLOW A LINK, OPEN ORDER 12'],
        man: [
            'Follows the link with that name: the name this line shows when you',
            'point at the link. Case does not matter, the quotes are optional,',
            'and the start of the name is enough while only one link fits.',
            'Tab completes the name; several matches are listed.',
            'OPEN #12 (or just #12) opens order 12, after checking it exists.'
        ]
    });
    define('RUN', {
        args: true, rank: 11, run: verbCommand('RUN'),
        synopsis: 'RUN "<BUTTON>"', summary: 'press a button on this page',
        help: ['RUN "<BUTTON>"', 'PRESS A BUTTON'],
        man: ['Presses the button with that name, as if clicked. Names work like with OPEN.']
    });
    define('SELECT', {
        args: true, rank: 12, run: verbCommand('SELECT'),
        synopsis: 'SELECT "<OPTION>"', summary: 'tick a checkbox or pick a radio button',
        help: ['SELECT "<OPTION>"', 'TICK A CHECKBOX OR OPTION'],
        man: ['Clicks the checkbox or radio button with that name and shows its new state.']
    });
    define('EDIT', {
        args: true, rank: 13, run: verbCommand('EDIT'),
        synopsis: 'EDIT "<FIELD>"', summary: 'jump into a form field',
        help: ['EDIT "<FIELD>"', 'JUMP INTO A FORM FIELD'],
        man: ['Puts the cursor into the field with that name (its label, or the', 'caption above it). Press / to come back to this line.']
    });
    define(['DIR', 'LS'], {
        args: true, rank: 20, run: dir,
        synopsis: 'DIR [OPEN|RUN|SELECT|EDIT|<NAME>]  |  LS -LA',
        summary: 'list what this line can reach on this page',
        help: ['DIR, LS -LA', 'LIST WHAT IS ON THIS PAGE'],
        complete: function () {
            return VERBS.concat(['-LA']);
        },
        man: [
            'Lists the links, buttons, options and fields on this page, as commands.',
            'DIR OPEN lists only links (and so on); DIR <NAME> the ones matching.',
            'LS -LA lists them the Unix way: links are symlinks to where they go,',
            'buttons are executables, fields are files. Click a line to use it.'
        ]
    });
    define(['CD', 'CHDIR'], {
        args: true, rank: 30, run: cd,
        synopsis: 'CD "<LINK>"  |  CD ..  |  CD \\',
        summary: 'open a link, go back, or go to the dashboard',
        help: ['CD "<LINK>", CD ..', 'OPEN A LINK, GO BACK'],
        man: ['CD alone prints where you are. CD .. goes back, CD \\ (or CD /, CD ~)', 'goes to the dashboard, anything else works like OPEN.']
    });
    define('CD..', { hidden: true, run: back, synopsis: 'CD..', summary: 'go back one page, the DOS way' });
    define('BACK', {
        run: back, rank: 31, synopsis: 'BACK', summary: 'go back one page',
        help: ['BACK, FORWARD, HOME', 'BROWSE (HOME IS THE DASHBOARD)']
    });
    define('FORWARD', {
        run: function () {
            print('GOING FORWARD...', 'ok');
            window.history.forward();
        },
        synopsis: 'FORWARD', summary: 'go forward one page again'
    });
    define('HOME', { run: home, synopsis: 'HOME', summary: 'go to the dashboard' });
    define(['HISTORY', 'H'], {
        args: true, rank: 80, run: historyCommand,
        synopsis: 'HISTORY [-C]', summary: 'list earlier commands',
        help: ['HISTORY, !!, !<N>', 'EARLIER COMMANDS (CTRL+R SEARCHES)'],
        man: [
            'Lists the commands of this tab, oldest first. HISTORY -C forgets them.',
            '!! repeats the last command, !N command number N, !-N the Nth last,',
            '!TEXT the last one starting with TEXT. SUDO !! works, too. Sort of.',
            'Up/Down step through them, Ctrl+R searches backwards as you type.'
        ]
    });
    define('ALIAS', {
        args: true, rank: 81, run: alias,
        synopsis: "ALIAS [<NAME>='<COMMAND>']", summary: 'define your own short commands',
        help: ["ALIAS <NAME>='<COMMAND>'", 'YOUR OWN SHORT COMMANDS'],
        man: [
            "ALIAS LL='LS -LA' makes LL run LS -LA; anything after LL is added.",
            'ALIAS alone lists them, UNALIAS <NAME> removes one, UNALIAS -A all.',
            'They are kept in this browser.'
        ]
    });
    define('UNALIAS', { args: true, run: unalias, synopsis: 'UNALIAS <NAME>  |  UNALIAS -A', summary: 'remove an alias' });
    define(['HELP', '?'], {
        args: true, run: help, synopsis: 'HELP  |  --HELP  |  <COMMAND> --HELP',
        summary: 'list the commands',
        man: ['HELP, --HELP, -H and /? list the commands; <COMMAND> --HELP shows how', 'to use one, MAN <COMMAND> tells more.']
    });
    define('MAN', {
        args: true, rank: 85, run: man,
        synopsis: 'MAN <COMMAND>', summary: 'show the manual page of a command',
        help: ['MAN <COMMAND>, <COMMAND> --HELP', 'MANUAL PAGE, SHORT HELP'],
        complete: function () {
            return Object.keys(registry).filter(function (name) {
                return !registry[name].hidden;
            }).sort();
        },
        man: ['Shows the manual page of a command. Even of some that HELP does not list.']
    });
    define(['CLS', 'CLEAR'], {
        run: cls, rank: 90, synopsis: 'CLS', summary: 'clear the screen (Ctrl+L does the same)',
        help: ['CLS, WHOAMI, DATE, ECHO', 'THE USUAL']
    });
    define('WHOAMI', { run: whoami, synopsis: 'WHOAMI', summary: 'show who is logged in' });
    define(['DATE', 'TIME'], { run: date, synopsis: 'DATE', summary: 'show the date and time' });
    define('ECHO', {
        args: true,
        run: function (arg) {
            print(arg || 'ECHO IS ON.', 'ok');
        },
        synopsis: 'ECHO <TEXT>', summary: 'print a text (handy before a |)'
    });
    define(['EXIT', 'QUIT', 'LOGOUT', 'SYMBOLICS'], {
        run: exit, rank: 99, synopsis: 'EXIT', summary: 'leave the Symbolics mode',
        help: ['EXIT', 'LEAVE SYMBOLICS MODE'],
        man: ["Switches back to the standard look. Typing 'symbolics' outside a field", 'brings this mode back.']
    });
    define('SUDO', {
        hidden: true, args: true, run: sudoCommand,
        synopsis: 'SUDO <COMMAND>', summary: 'run a command as the superuser',
        man: ['Runs a command with the rights of the superuser.', 'You are not the superuser.']
    });
    define('XYZZY', {
        hidden: true, synopsis: 'XYZZY', summary: 'a magic word',
        run: function () {
            print('NOTHING HAPPENS.', 'info');
        }
    });
    define(['HELLO', 'HI'], {
        hidden: true, synopsis: 'HELLO', summary: 'say hello',
        run: function () {
            print('HELLO, ' + userName() + '. HUNGRY?', 'ok');
        }
    });

    // ── Keys ──

    // The list of matches Tab opened is showing (↑/↓ then move through it)
    function listOpen() {
        return !!completion && !els.suggest.hidden;
    }

    function ctrlC() {
        if (interrupt() && !els.input.value) {
            return; // the running program says what Ctrl+C did to it
        }
        if (sudo) {
            cancelSudo();
            return;
        }
        print(promptPath() + '> ' + els.input.value + '^C', 'echo');
        completion = null;
        clearSuggestions();
        setValue('');
    }

    // Ctrl+R: (reverse-i-search) through the history as you type
    function startSearch() {
        search = { query: '', pos: -1, match: '', draft: els.input.value };
        completion = null;
        clearSuggestions();
        showSearch(true);
    }

    // Looks for the query from position "from" (0 = the latest command) backwards
    function searchFrom(from) {
        var list = readHistory();
        var q = search.query.toLowerCase();
        for (var i = Math.max(0, from); i < list.length; i++) {
            var cmd = list[list.length - 1 - i];
            if (cmd.toLowerCase().indexOf(q) >= 0) {
                search.pos = i;
                search.match = cmd;
                return true;
            }
        }
        return false;
    }

    function showSearch(found) {
        setPrompt((found ? '(' : '(FAILED ') + "REVERSE-I-SEARCH)'" + search.query + "':");
        setValue(search.match);
    }

    function endSearch(keep) {
        var value = keep ? search.match : search.draft;
        search = null;
        resetPrompt();
        setValue(value);
    }

    function onSearchKey(e) {
        var key = e.key;
        var ctrl = e.ctrlKey && !e.altKey && !e.metaKey;
        if (ctrl && (key === 'r' || key === 'R')) {
            e.preventDefault();
            showSearch(searchFrom(search.pos + 1) || false);
        } else if ((ctrl && (key === 'g' || key === 'G' || key === 'c' || key === 'C')) || key === 'Escape') {
            e.preventDefault();
            endSearch(false);
        } else if (key === 'Enter') {
            e.preventDefault();
            endSearch(true);
            submit();
        } else if (key === 'Backspace') {
            e.preventDefault();
            search.query = search.query.slice(0, -1);
            search.match = '';
            showSearch(!search.query || searchFrom(0));
        } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            search.query += key;
            showSearch(searchFrom(Math.max(search.pos, 0)));
        } else if (/^(Arrow|Tab|Home|End)/.test(key)) {
            e.preventDefault();
            endSearch(true); // like bash: take the match into the line to edit it
        }
    }

    function onKeyDown(e) {
        if (e.isComposing) {
            return;
        }
        if (search) {
            onSearchKey(e);
            return;
        }
        var ctrl = e.ctrlKey && !e.altKey && !e.metaKey;
        var key = (e.key || '').toLowerCase();
        if (ctrl && !sudo && key === 'r') {
            e.preventDefault();
            startSearch();
            return;
        }
        if (ctrl && key === 'l') {
            e.preventDefault();
            cls();
            return;
        }
        if (ctrl && key === 'c' && els.input.selectionStart === els.input.selectionEnd) {
            e.preventDefault(); // with text selected, Ctrl+C still copies
            ctrlC();
            return;
        }
        switch (e.key) {
            case 'Tab':
                if (e.ctrlKey || e.altKey || e.metaKey) {
                    return;
                }
                if (!els.input.value.trim() && !completion) {
                    return; // an empty line lets Tab move on, like any other field
                }
                e.preventDefault();
                complete(e.shiftKey ? -1 : 1);
                break;
            case 'Enter':
                e.preventDefault();
                if (listOpen() && completion.index >= 0 && / $/.test(completion.items[completion.index].text)) {
                    // A command picked from the list that needs a name: keep it and go on typing
                    completion = null;
                    clearSuggestions();
                    update(true);
                } else {
                    submit();
                }
                break;
            case 'Escape':
                e.preventDefault();
                if (sudo) {
                    cancelSudo();
                } else if (!els.panel.hidden) {
                    completion = null;
                    hidePanel();
                } else if (els.input.value) {
                    setValue('');
                } else {
                    els.input.blur();
                }
                break;
            case 'ArrowUp':
            case 'ArrowDown':
                if (sudo || e.altKey || e.ctrlKey || e.metaKey) {
                    return;
                }
                e.preventDefault();
                if (listOpen()) {
                    complete(e.key === 'ArrowDown' ? 1 : -1); // move through the Tab list
                } else {
                    recall(e.key === 'ArrowUp' ? 1 : -1);
                }
                break;
            case 'PageUp':
            case 'PageDown':
                // The page scrolls without leaving the line; with Shift the output window
                e.preventDefault();
                var sign = e.key === 'PageUp' ? -1 : 1;
                if (e.shiftKey && !els.panel.hidden) {
                    els.out.scrollTop += sign * els.out.clientHeight * 0.8;
                } else {
                    window.scrollBy(0, sign * window.innerHeight * 0.8);
                }
                break;
            default:
                return;
        }
    }

    // ── Building and removing the line ──

    function build() {
        bar = make('div', 'yy-terminal');
        bar.id = 'yy-terminal';

        var panel = make('div', 'yy-terminal-panel');
        panel.hidden = true;
        var head = make('div', 'yy-terminal-panel-bar');
        head.appendChild(make('span', 'yy-terminal-panel-title', 'Dynamic Lunch Listener'));
        var close = make('button', 'yy-terminal-close', 'Esc \u00D7');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close the output');
        close.setAttribute('tabindex', '-1');
        close.addEventListener('mousedown', function (e) {
            e.preventDefault();
        });
        close.addEventListener('click', function () {
            completion = null;
            hidePanel();
        });
        head.appendChild(close);
        var out = make('div', 'yy-terminal-out');
        out.setAttribute('role', 'log');
        out.setAttribute('aria-live', 'polite');
        var suggest = make('div', 'yy-terminal-suggest');
        suggest.hidden = true;
        panel.appendChild(head);
        panel.appendChild(out);
        panel.appendChild(suggest);

        var line = make('label', 'yy-terminal-line');
        var promptEl = make('span', 'yy-terminal-prompt');
        promptEl.setAttribute('aria-hidden', 'true');
        var promptFull = make('span', 'yy-terminal-prompt-full');
        var promptShort = make('span', 'yy-terminal-prompt-short');
        promptEl.appendChild(promptFull);
        promptEl.appendChild(promptShort);

        var field = make('span', 'yy-terminal-field');
        var input = make('input', 'yy-terminal-input');
        input.type = 'text';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('enterkeyhint', 'go');
        input.setAttribute('aria-label', 'Command line. Type HELP for the commands, Tab completes names.');
        var ghost = make('span', 'yy-terminal-ghost');
        ghost.setAttribute('aria-hidden', 'true');
        var cursor = make('span', 'yy-terminal-cursor');
        cursor.setAttribute('aria-hidden', 'true');
        var measure = make('span', 'yy-terminal-measure');
        measure.setAttribute('aria-hidden', 'true');
        field.appendChild(input);
        field.appendChild(ghost);
        field.appendChild(cursor);
        field.appendChild(measure);

        line.appendChild(promptEl);
        line.appendChild(field);

        var status = make('div', 'yy-terminal-status', 'System status: online');

        bar.appendChild(panel);
        bar.appendChild(line);
        bar.appendChild(status);

        els = {
            panel: panel, out: out, suggest: suggest, promptFull: promptFull, promptShort: promptShort,
            field: field, input: input, ghost: ghost, cursor: cursor, measure: measure, status: status
        };
        resetPrompt();

        input.addEventListener('keydown', onKeyDown);
        input.addEventListener('input', function () {
            completion = null;
            historyIndex = -1; // typing starts afresh: ↑ goes to the latest command again
            if (!els.suggest.hidden) {
                clearSuggestions();
            }
            update(true);
        });
        input.addEventListener('scroll', function () {
            update(false);
        });
        input.addEventListener('focus', function () {
            if (els.out.childNodes.length) {
                showPanel();
            }
            update(true);
        });
        input.addEventListener('blur', function () {
            update(false);
            later(function () {
                if (!bar.contains(document.activeElement)) {
                    completion = null;
                    hidePanel();
                }
            }, 150);
        });

        document.body.appendChild(bar);
        render();
        refocus();
    }

    // Whoever typed here before the page changed (a command, a form sent with RUN, the
    // browser's back button) can go on typing right away
    function refocus() {
        var wanted = false;
        try {
            wanted = window.sessionStorage.getItem(REFOCUS_KEY) === '1';
            window.sessionStorage.removeItem(REFOCUS_KEY);
        } catch (e) {
            return;
        }
        if (wanted && bar && !document.querySelector('.modal.show')) {
            els.input.focus({ preventScroll: true });
        }
    }

    function teardown() {
        screens.slice().forEach(function (screen) {
            screen.close(true);
        });
        interrupt();
        stopHooks.forEach(function (hook) {
            try {
                hook();
            } catch (e) {
                // a program that fails to clean up must not keep the line
            }
        });
        timers.forEach(window.clearTimeout);
        timers = [];
        window.clearTimeout(hideTimer);
        root.classList.remove('yy-fx-alarm', 'yy-fx-glitch');
        if (bar && bar.parentNode) {
            bar.parentNode.removeChild(bar);
        }
        bar = null;
        els = {};
        sudo = null;
        search = null;
        capture = null;
        emptyEnter = null;
        completion = null;
        hoverText = null;
        historyIndex = -1;
    }

    function sync() {
        var was = theme;
        theme = root.getAttribute('data-yy-theme');
        if (theme === SYMBOLICS) {
            if (!bar && document.body) {
                build();
                if (started && was !== SYMBOLICS) {
                    // Switched on just now (not a page load in Symbolics mode)
                    hoverText = BOOT_TEXT;
                    render();
                    powerOn();
                }
            }
        } else if (bar) {
            teardown();
        }
    }

    // ── Page-wide listeners (idle while the line is off) ──

    document.addEventListener('mouseover', function (e) {
        if (!bar || bar.contains(e.target)) {
            return;
        }
        var text = describe(e.target);
        if (text !== hoverText) {
            hoverText = text;
            render();
        }
    });

    // "/" outside a form field jumps into the line (not while a dialog is open:
    // Bootstrap keeps the focus inside it)
    document.addEventListener('keydown', function (e) {
        if (!bar || e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) {
            return;
        }
        if (isField(e.target) || document.querySelector('.modal.show')) {
            return;
        }
        e.preventDefault();
        els.input.focus();
    });

    // A click elsewhere closes the output window
    document.addEventListener('pointerdown', function (e) {
        if (bar && !els.panel.hidden && !bar.contains(e.target)) {
            completion = null;
            hidePanel();
        }
    });

    document.addEventListener('selectionchange', function () {
        if (bar && document.activeElement === els.input) {
            update(true);
        }
    });

    window.addEventListener('resize', function () {
        update(false);
    });

    window.addEventListener('pagehide', function () {
        try {
            if (bar && (leaving || document.activeElement === els.input)) {
                window.sessionStorage.setItem(REFOCUS_KEY, '1');
            } else {
                window.sessionStorage.removeItem(REFOCUS_KEY);
            }
        } catch (e) {
            // Blocked storage: the line just doesn't get the focus back
        }
    });

    // Back to a page the browser kept in memory
    window.addEventListener('pageshow', function (e) {
        leaving = false;
        if (e.persisted) {
            refocus();
        }
    });

    // For the extra programs in symbolics-apps.js
    window.yySymbolics = {
        define: define,
        active: function () {
            return !!bar;
        },
        screenOpen: function () {
            return screens.length > 0;
        },
        onEmptyEnter: function (fn) {
            emptyEnter = fn;
        },
        onStop: function (fn) {
            stopHooks.push(fn);
        },
        print: print,
        rows: printRows,
        picks: printPicks,
        node: addLine,
        make: make,
        clean: clean,
        later: later,
        effect: effect,
        motion: motion,
        job: job,
        screen: openScreen,
        run: runLine,
        go: go,
        hideSoon: hideSoon,
        userName: userName,
        promptPath: promptPath,
        appUrl: appUrl,
        version: appVersion,
        targets: targets,
        find: find,
        execute: execute,
        commandFor: commandFor
    };

    if (window.MutationObserver) {
        new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-yy-theme'] });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sync);
    } else {
        sync();
    }
    started = true;
})();
