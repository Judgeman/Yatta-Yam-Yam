/*
 * Symbolics mode (switched by theme.js): the command line at the bottom of the screen.
 *
 * Pointing at a link, button or form field shows the command a click would run:
 * OPEN "Contacts", RUN "Switch", SELECT "Cost split", EDIT "Place". The line takes
 * typed commands, too: click it (or press "/" outside a form field), type and press Enter.
 *
 *   OPEN "<link>"       follow a link on the page
 *   RUN "<button>"      press a button
 *   SELECT "<option>"   tick a checkbox or radio button
 *   EDIT "<field>"      jump into a form field
 *   DIR [OPEN|RUN|...]  list what can be commanded on this page
 *   CD "<link>", CD ..  open a link, go back;  BACK, HOME, CLS, WHOAMI, DATE, ECHO
 *   HELP                the list;  EXIT switches Symbolics off
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
 * tab). Esc closes the output window. SUDO … has a few surprises.
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
    // Completed after the first word; SUDO and the other jokes stay a surprise
    var COMPLETABLE = ['BACK', 'CD', 'CLS', 'DATE', 'DIR', 'ECHO', 'EDIT', 'EXIT', 'HELP', 'HOME',
        'OPEN', 'RUN', 'SELECT', 'WHOAMI'];
    var TAKES_ARGUMENT = ['CD', 'DIR', 'ECHO', 'EDIT', 'OPEN', 'RUN', 'SELECT'];

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

    function addLine(node) {
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
    function pickButton(text, active) {
        var button = make('button', 'yy-term-pick' + (active ? ' is-active' : ''), text);
        button.type = 'button';
        button.setAttribute('tabindex', '-1');
        button.addEventListener('mousedown', function (e) {
            e.preventDefault(); // keep the focus in the line
        });
        button.addEventListener('click', function () {
            completion = null;
            clearSuggestions();
            setValue(text);
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

    function printPicks(texts) {
        var box = make('div', 'yy-term-picks');
        texts.forEach(function (text) {
            box.appendChild(pickButton(text, false));
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

    function pushHistory(line) {
        var list = readHistory();
        if (list[list.length - 1] !== line) {
            list.push(line);
        }
        try {
            window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-HISTORY_MAX)));
        } catch (e) {
            // Blocked storage: no history then
        }
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

    // What Tab can make of the line: { items: [{ text, part }], lead } — lead is the
    // text before the name when all items share it (for completing as far as they agree)
    function completionsFor(value) {
        var m = /^\s*(\S*)(\s*)([\s\S]*)$/.exec(value);
        var word = m[1].toUpperCase();
        var rest = m[3];
        if (!m[2]) {
            var names = COMPLETABLE.filter(function (name) {
                return word && name.indexOf(word) === 0;
            });
            if (names.length) {
                return {
                    lead: '',
                    query: word.toLowerCase(),
                    items: names.map(function (name) {
                        return { text: name + (TAKES_ARGUMENT.indexOf(name) >= 0 ? ' ' : ''), part: name };
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
            return;
        }
        pushHistory(line);
        echoLine(line);
        run(line);
    }

    function run(line) {
        var m = /^(\S+)\s*(.*)$/.exec(line);
        var word = m[1].toUpperCase();
        var arg = m[2];
        if (VERBS.indexOf(word) >= 0) {
            command(word, arg);
            return;
        }
        if (COMMANDS.hasOwnProperty(word)) {
            COMMANDS[word](arg);
            return;
        }
        if (/^make me a sandwich/i.test(line)) {
            print('WHAT? MAKE IT YOURSELF.', 'warn');
            return;
        }
        // A bare name works, too, if it is exactly the name of something on the page
        var exact = find(targets(null), line)[0];
        if (exact.length) {
            execute(exact[0]);
            return;
        }
        print('BAD COMMAND OR FILE NAME: ' + m[1].toUpperCase(), 'err');
        print('TYPE HELP FOR A LIST OF COMMANDS.', 'info');
    }

    function command(verb, arg) {
        var noun = NOUN[verb];
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

    function help() {
        print('NAMES ARE WHAT THIS LINE SHOWS WHEN YOU POINT AT SOMETHING.', 'info');
        printRows([
            ['OPEN "<LINK>"', 'FOLLOW A LINK ON THIS PAGE'],
            ['RUN "<BUTTON>"', 'PRESS A BUTTON'],
            ['SELECT "<OPTION>"', 'TICK A CHECKBOX OR OPTION'],
            ['EDIT "<FIELD>"', 'JUMP INTO A FORM FIELD'],
            ['DIR [OPEN|RUN|...]', 'LIST WHAT IS ON THIS PAGE'],
            ['CD "<LINK>", CD ..', 'OPEN A LINK, GO BACK'],
            ['BACK, HOME', 'PREVIOUS PAGE, DASHBOARD'],
            ['CLS', 'CLEAR THE SCREEN'],
            ['WHOAMI, DATE, ECHO', 'THE USUAL'],
            ['EXIT', 'LEAVE SYMBOLICS MODE']
        ]);
        print('TAB COMPLETES (AGAIN OR \u2191/\u2193: PICK A MATCH)   \u2191/\u2193 HISTORY   ESC CLOSES THIS WINDOW', 'info');
    }

    function dir(arg) {
        var word = clean(arg).toUpperCase();
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

    function back() {
        if (window.history.length <= 1) {
            print('NOWHERE TO GO BACK TO.', 'warn');
            return;
        }
        print('GOING BACK...', 'ok');
        window.history.back();
    }

    function home() {
        var brand = document.querySelector('.navbar-brand[href]');
        print('GOING HOME...', 'ok');
        window.location.href = brand ? brand.href : '/';
    }

    function cd(arg) {
        var to = clean(arg);
        if (!to) {
            print(promptPath(), 'ok');
        } else if (/^\.\.[\\/]?$/.test(to)) {
            back();
        } else if (/^[\\/]$/.test(to)) {
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

    var COMMANDS = {
        HELP: help,
        '?': help,
        MAN: help,
        DIR: dir,
        LS: dir,
        BACK: back,
        'CD..': back,
        CD: cd,
        HOME: home,
        CLS: cls,
        CLEAR: cls,
        WHOAMI: whoami,
        DATE: date,
        TIME: date,
        ECHO: function (arg) {
            print(arg || 'ECHO IS ON.', 'ok');
        },
        EXIT: exit,
        QUIT: exit,
        SYMBOLICS: exit,
        SUDO: sudoCommand,
        XYZZY: function () {
            print('NOTHING HAPPENS.', 'info');
        },
        HELLO: function () {
            print('HELLO, ' + userName() + '. HUNGRY?', 'ok');
        }
    };
    COMMANDS.HI = COMMANDS.HELLO;

    // ── Keys ──

    // The list of matches Tab opened is showing (↑/↓ then move through it)
    function listOpen() {
        return !!completion && !els.suggest.hidden;
    }

    function onKeyDown(e) {
        if (e.isComposing) {
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
    }

    function teardown() {
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
