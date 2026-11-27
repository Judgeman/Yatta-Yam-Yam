/*
 * Symbolics mode: the extra programs of the command line. js/symbolics.js has the line
 * itself and its built-in commands; these come in through window.yySymbolics.define().
 * None of them needs anything new from the server: what they show comes from the page,
 * or from pages of the app fetched in the background (the dashboard, the start page).
 *
 * Listed in HELP:
 *   GREP <text> (FIND)     highlight text on the page, Enter on an empty line jumps on;
 *                          after a | it filters lines instead (HISTORY | GREP PIZZA)
 *   ORDER <place>          open "New Order" with the place filled in
 *   TOP (HTOP), PS         the open orders as processes: live and full screen, or a list
 *   OWE                    what you still have to pay, per order
 *   CALC <sum> (BC)        a calculator; CALC alone opens the payment calculator
 *   THEME [<look>|LIST]    preview a seasonal look
 *   NEOFETCH               system information, the way admins like it
 * Not listed (admins will find them): VIM (VI, NVIM, NANO, EMACS), SL, CMATRIX, REBOOT,
 * SHUTDOWN, UPTIME, PING, KILL, RM, MAKE, SSH, FORTUNE, COWSAY, LOLCAT. After ten
 * minutes without input, the matrix comes as a screensaver (not with reduced motion).
 *
 * Styles: css/symbolics.css.
 */
(function () {
    'use strict';

    var sh = window.yySymbolics;
    if (!sh) {
        return;
    }

    var print = sh.print;
    var make = sh.make;
    var clean = sh.clean;
    var BOOT_KEY = 'yy-terminal-boot';      // sessionStorage: when this tab first ran the line
    var PREFILL_KEY = 'yy-terminal-order';  // sessionStorage: the place ORDER brings along
    var IDLE_MS = 10 * 60 * 1000;           // screensaver after this long without input

    // ── Helpers ──

    function unquote(text) {
        return clean(text).replace(/^["'“„]+/, '').replace(/["'”]+$/, '');
    }

    function repeat(text, count) {
        return new Array(Math.max(0, count) + 1).join(text);
    }

    function padStart(text, width) {
        text = String(text);
        return repeat(' ', width - text.length) + text;
    }

    function padEnd(text, width) {
        text = String(text);
        return text + repeat(' ', width - text.length);
    }

    function two(n) {
        return (n < 10 ? '0' : '') + n;
    }

    function clock(date) {
        return two(date.getHours()) + ':' + two(date.getMinutes()) + ':' + two(date.getSeconds());
    }

    function bootTime() {
        try {
            var stored = Number(window.sessionStorage.getItem(BOOT_KEY));
            if (stored) {
                return stored;
            }
            window.sessionStorage.setItem(BOOT_KEY, String(Date.now()));
        } catch (e) {
            // no storage: since this page
        }
        return Date.now();
    }

    var booted = bootTime();

    function uptime() {
        var minutes = Math.floor((Date.now() - booted) / 60000);
        if (minutes < 60) {
            return minutes + ' min';
        }
        var hours = Math.floor(minutes / 60);
        var text = hours % 24 + ':' + two(minutes % 60);
        return hours >= 24 ? Math.floor(hours / 24) + ' days, ' + text : text;
    }

    function slug(text) {
        return text.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') || '?';
    }

    function lines(text) {
        return text.split('\n');
    }

    // Several lines as one block of output (one line each when piped)
    function block(textLines, kind) {
        var box = make('div', 'yy-term-' + (kind || 'ok'));
        box.setAttribute('data-lines', '');
        textLines.forEach(function (line) {
            box.appendChild(make('div', null, line || ' '));
        });
        sh.node(box);
    }

    // Another page of the app, fetched in the background and parsed
    function fetchPage(path) {
        if (!window.fetch || !window.DOMParser) {
            return Promise.reject(new Error('old'));
        }
        return window.fetch(sh.appUrl(path), { credentials: 'same-origin' }).then(function (response) {
            if (/\/login/.test(response.url)) {
                throw new Error('login');
            }
            if (!response.ok) {
                throw new Error('http');
            }
            return response.text();
        }).then(function (html) {
            return new DOMParser().parseFromString(html, 'text/html');
        });
    }

    function failed(err) {
        if (sh.active()) {
            print(err && err.message === 'login' ? 'PLEASE LOG IN FIRST.' : 'NETWORK ERROR. THE KITCHEN IS NOT ANSWERING.', 'err');
        }
    }

    function parseAmount(text) {
        var value = parseFloat((text || '').replace(/[^\d,.-]/g, '').replace(',', '.'));
        return isNaN(value) ? 0 : value;
    }

    // ── GREP: find text on the page ──

    var highlights = window.CSS && window.CSS.highlights && window.Highlight ? window.CSS.highlights : null;
    var grep = { ranges: [], index: -1 };

    function grepClear() {
        if (highlights) {
            highlights.delete('yy-grep');
            highlights.delete('yy-grep-current');
        }
        grep = { ranges: [], index: -1 };
        sh.onEmptyEnter(null);
    }

    function grepSearch(query) {
        grepClear();
        var q = query.toLowerCase();
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                var parent = node.parentElement;
                if (!parent || parent.closest('script, style, noscript, template, textarea, #yy-terminal, [aria-hidden="true"]')
                        || !parent.getClientRects().length) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var node;
        while ((node = walker.nextNode())) {
            var text = node.nodeValue.toLowerCase();
            var at = text.indexOf(q);
            while (at >= 0) {
                var range = document.createRange();
                range.setStart(node, at);
                range.setEnd(node, at + q.length);
                grep.ranges.push(range);
                at = text.indexOf(q, at + q.length);
            }
        }
        if (highlights && grep.ranges.length) {
            var all = new window.Highlight();
            grep.ranges.forEach(function (range) {
                all.add(range);
            });
            highlights.set('yy-grep', all);
        }
        return grep.ranges.length;
    }

    function grepNext() {
        var n = grep.ranges.length;
        if (!n) {
            return;
        }
        grep.index = (grep.index + 1) % n;
        var range = grep.ranges[grep.index];
        if (highlights) {
            var current = new window.Highlight();
            current.add(range);
            highlights.set('yy-grep-current', current);
        }
        var rect = range.getBoundingClientRect();
        window.scrollBy(0, rect.top - window.innerHeight / 3);
        print('MATCH ' + (grep.index + 1) + ' OF ' + n, 'info');
    }

    sh.define(['GREP', 'FIND'], {
        args: true, rank: 40,
        synopsis: 'GREP <TEXT>  |  <COMMAND> | GREP <TEXT>',
        summary: 'find text on this page, or filter what a command prints',
        help: ['GREP <TEXT>', 'FIND TEXT ON THIS PAGE (ENTER: NEXT MATCH)'],
        man: [
            'Highlights every place on the page where the text occurs (case does',
            'not matter) and scrolls to the first one; Enter on an empty line jumps',
            'to the next. GREP alone clears the highlights.',
            'After a pipe it filters lines like the real one: HISTORY | GREP OPEN,',
            'PS | GREP PIZZA, LS -LA | GREP LRWX.'
        ],
        run: function (arg, stdin) {
            var query = unquote(arg);
            if (stdin) {
                var q = query.toLowerCase();
                stdin.filter(function (line) {
                    return line.toLowerCase().indexOf(q) >= 0;
                }).forEach(function (line) {
                    print(line, 'ok');
                });
                return;
            }
            if (!query) {
                grepClear();
                print('GREP: HIGHLIGHTS CLEARED.', 'info');
                return;
            }
            var n = grepSearch(query);
            if (!n) {
                print('GREP: "' + query + '" NOT FOUND ON THIS PAGE.', 'warn');
                return;
            }
            print(n + (n === 1 ? ' MATCH' : ' MATCHES') + ' FOR "' + query + '". ENTER ON AN EMPTY LINE: NEXT. GREP ALONE: CLEAR.', 'ok');
            sh.onEmptyEnter(grepNext);
            grepNext();
        }
    });

    // ── ORDER: start a new order with the place filled in ──

    sh.define('ORDER', {
        args: true, rank: 41,
        synopsis: 'ORDER [<PLACE>]', summary: 'start a new order, with the place filled in',
        help: ['ORDER <PLACE>', 'START A NEW ORDER'],
        man: ['Opens "New Order" and fills in the place, e.g. ORDER PIZZA PALACE.', 'Everything else you choose on the form as usual.'],
        run: function (arg) {
            var place = unquote(arg);
            try {
                if (place) {
                    window.sessionStorage.setItem(PREFILL_KEY, place);
                }
            } catch (e) {
                // no storage: the form just stays empty
            }
            print('STARTING A NEW ORDER' + (place ? ' AT "' + place + '"' : '') + '...', 'ok');
            sh.go(sh.appUrl('/orders/create'));
        }
    });

    function prefill() {
        var place = null;
        try {
            place = window.sessionStorage.getItem(PREFILL_KEY);
            window.sessionStorage.removeItem(PREFILL_KEY);
        } catch (e) {
            return;
        }
        var field = document.getElementById('placeName');
        if (place && field && !field.value) {
            field.value = place;
            field.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // ── PS, TOP, KILL: the open orders as processes ──

    function ordersOf(doc) {
        return [].map.call(doc.querySelectorAll('a.order-card-link'), function (link) {
            var card = link.querySelector('.order-card') || link;
            var id = /\/orders\/(\d+)/.exec(link.getAttribute('href') || '');
            var people = /(\d+)\s+participant/.exec(card.textContent);
            function textOf(selector) {
                var el = card.querySelector(selector);
                return el ? clean(el.textContent) : '';
            }
            function besideIcon(icon) {
                var el = card.querySelector('.bi-' + icon);
                return el && el.parentElement ? clean(el.parentElement.textContent) : '';
            }
            return {
                id: id ? id[1] : '?',
                status: textOf('.order-status-badge').toUpperCase() || '?',
                date: textOf('.d-flex > .text-muted').split(' ').slice(0, 2).join(' '),
                place: textOf('h5') || '?',
                user: besideIcon('person').replace(/^Created by\s*/i, '').toLowerCase() || '?',
                people: people ? Number(people[1]) : 0
            };
        });
    }

    // For the kitchen bot in symbolics-chat.js: "what is open?"
    sh.loadOrders = function () {
        return fetchPage('/orders/dashboard').then(ordersOf);
    };

    function processLine(order) {
        return padStart(order.id, 5) + ' ' + padEnd(order.user.substring(0, 10), 10) + ' ' + padEnd(order.status, 8)
            + ' ' + padEnd(order.date, 7) + ' ' + padStart(order.people, 4) + '  ' + slug(order.place);
    }

    var PROCESS_HEAD = '  PID USER       STAT     START   %CPU  COMMAND';

    sh.define('PS', {
        args: true, rank: 42,
        synopsis: 'PS [AUX]', summary: 'list the open orders as processes',
        help: ['TOP, PS', 'OPEN ORDERS: LIVE, OR AS A LIST'],
        man: [
            'Lists the orders of the dashboard: PID is the order number, %CPU the',
            'number of people in it, COMMAND the place. Click a line to open it.',
            'TOP shows the same live and full screen.'
        ],
        run: function (arg, stdin, word, out) {
            return fetchPage('/orders/dashboard').then(function (doc) {
                var orders = ordersOf(doc);
                out.print(PROCESS_HEAD, 'info');
                if (!orders.length) {
                    out.print('(NO PROCESSES. EVERYONE HAS EATEN ALREADY.)', 'echo');
                    return;
                }
                out.picks(orders.map(function (order) {
                    return { text: processLine(order), command: 'OPEN #' + order.id };
                }));
            }, failed);
        }
    });

    sh.define(['TOP', 'HTOP'], {
        synopsis: 'TOP', summary: 'show the open orders live, like the process monitor',
        man: [
            'Full screen, refreshed every five seconds. Up/Down pick an order,',
            'Enter opens it, K tries to kill it, Q (or Esc) quits.'
        ],
        run: function () {
            var orders = [];
            var selected = 0;
            var note = '';
            var screen = sh.screen({ className: 'yy-top', label: 'top', onKey: key });
            var head = make('div', 'yy-top-head');
            var table = make('div', 'yy-top-table');
            var foot = make('div', 'yy-top-foot', '↑/↓ SELECT   ENTER OPEN   K KILL   Q QUIT');
            var quit = make('button', 'yy-screen-quit', 'Q');
            quit.type = 'button';
            quit.addEventListener('click', function () {
                screen.close();
            });
            screen.el.appendChild(head);
            screen.el.appendChild(table);
            screen.el.appendChild(foot);
            screen.el.appendChild(quit);

            function load() {
                if (!screen.el.parentNode) {
                    return;
                }
                fetchPage('/orders/dashboard').then(function (doc) {
                    orders = ordersOf(doc);
                    selected = Math.min(selected, Math.max(0, orders.length - 1));
                    draw();
                }, function (err) {
                    note = err && err.message === 'login' ? 'PLEASE LOG IN FIRST.' : 'NETWORK ERROR. RETRYING...';
                    draw();
                });
                sh.later(load, 5000);
            }

            function draw() {
                var count = { OPEN: 0, ORDERED: 0, CLOSED: 0 };
                var people = 0;
                var users = {};
                orders.forEach(function (order) {
                    count[order.status] = (count[order.status] || 0) + 1;
                    people += order.people;
                    users[order.user] = true;
                });
                var hungry = Math.min(99.9, people * 12.5);
                var userCount = Math.max(1, Object.keys(users).length);
                head.textContent = [
                    'top - ' + clock(new Date()) + ' up ' + uptime() + ',  ' + userCount
                        + (userCount === 1 ? ' user' : ' users') + ',  load average: ' + count.OPEN.toFixed(2) + ', ' + count.ORDERED.toFixed(2) + ', '
                        + count.CLOSED.toFixed(2),
                    'Tasks: ' + padStart(orders.length, 3) + ' total, ' + padStart(count.OPEN, 3) + ' open, '
                        + padStart(count.ORDERED, 3) + ' ordered, ' + padStart(count.CLOSED, 3) + ' closed',
                    '%Cpu(s): ' + padStart(hungry.toFixed(1), 4) + ' us (hungry),  0.0 sy, '
                        + padStart((100 - hungry).toFixed(1), 4) + ' id (waiting for food)',
                    'MiB Mem :   3 pizzas total,   1 salad free,   2 kebab used,   0 regrets',
                    note
                ].join('\n');
                table.textContent = '';
                table.appendChild(make('div', 'yy-top-row is-head', PROCESS_HEAD));
                if (!orders.length) {
                    table.appendChild(make('div', 'yy-top-row', '(NO PROCESSES. EVERYONE HAS EATEN ALREADY.)'));
                }
                orders.forEach(function (order, i) {
                    var row = make('div', 'yy-top-row' + (i === selected ? ' is-selected' : ''), processLine(order));
                    row.addEventListener('click', function () {
                        selected = i;
                        openSelected();
                    });
                    table.appendChild(row);
                });
            }

            function openSelected() {
                var order = orders[selected];
                if (order) {
                    screen.close(true);
                    print('OPENING ORDER #' + order.id + '...', 'ok');
                    sh.go(sh.appUrl('/orders/' + order.id));
                }
            }

            function key(e) {
                var k = e.key;
                if (k === 'q' || k === 'Q' || k === 'Escape' || (e.ctrlKey && (k === 'c' || k === 'C'))) {
                    e.preventDefault();
                    screen.close();
                } else if (k === 'ArrowDown' || k === 'ArrowUp') {
                    e.preventDefault();
                    selected = Math.max(0, Math.min(orders.length - 1, selected + (k === 'ArrowDown' ? 1 : -1)));
                    draw();
                } else if (k === 'Enter') {
                    e.preventDefault();
                    openSelected();
                } else if (k === 'k' || k === 'K') {
                    e.preventDefault();
                    note = orders[selected]
                        ? 'PID TO SIGNAL/KILL [DEFAULT PID = ' + orders[selected].id + ']: OPERATION NOT PERMITTED. IT IS LUNCH.'
                        : 'NOTHING TO KILL.';
                    draw();
                }
            }

            draw();
            load();
        }
    });

    sh.define(['KILL', 'KILLALL', 'PKILL'], {
        hidden: true, args: true,
        synopsis: 'KILL [-SIGNAL] <PID>', summary: 'send a signal to a process',
        man: ['Would end a process. The processes here are lunch orders.', 'Nobody kills a lunch order.'],
        run: function (arg, stdin, word) {
            var pid = clean(arg).split(' ').filter(function (part) {
                return part && part.charAt(0) !== '-';
            })[0];
            if (!pid) {
                print(word.toUpperCase() + ': USAGE: ' + word.toUpperCase() + ' [-SIGNAL] <PID>', 'info');
                return;
            }
            print(word.toUpperCase() + ': (' + pid.toUpperCase() + ') - OPERATION NOT PERMITTED: YOU CANNOT KILL A LUNCH ORDER.', 'err');
            print('TRY SUDO, IF YOU DARE.', 'echo');
        }
    });

    // ── OWE: what you still have to pay ──

    sh.define('OWE', {
        rank: 43, synopsis: 'OWE', summary: 'show what you still have to pay, per order',
        help: ['OWE', 'WHAT YOU STILL HAVE TO PAY'],
        man: ['Lists the closed orders you have not paid for yet, with the amount and', 'who gets it. Click a line to open the order.'],
        run: function (arg, stdin, word, out) {
            print('CHECKING THE BOOKS...', 'info');
            return fetchPage('/').then(function (doc) {
                var debts = [].map.call(doc.querySelectorAll('.open-debt-list a'), function (link) {
                    var id = /\/orders\/(\d+)/.exec(link.getAttribute('href') || '');
                    function textOf(selector) {
                        var el = link.querySelector(selector);
                        return el ? clean(el.textContent) : '';
                    }
                    return { id: id ? id[1] : '', place: textOf('.fw-semibold'), meta: textOf('small'), amount: textOf('.badge') };
                });
                if (!debts.length) {
                    out.print('YOU OWE NOTHING. RESPECT.', 'ok');
                    return;
                }
                var total = 0;
                out.picks(debts.map(function (debt) {
                    total += parseAmount(debt.amount);
                    return { text: padStart(debt.amount, 9) + '  ' + debt.place + '  (' + debt.meta + ')', command: 'OPEN #' + debt.id };
                }));
                out.print('TOTAL: €' + total.toFixed(2) + ' IN ' + debts.length + (debts.length === 1 ? ' ORDER' : ' ORDERS'), 'warn');
            }, failed);
        }
    });

    // ── CALC: a calculator without eval ──

    function calculate(expression) {
        var s = expression.replace(/,/g, '.').replace(/[\s€]/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/\*\*/g, '^');
        var i = 0;
        function peek() {
            return s.charAt(i);
        }
        function number() {
            var m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.substring(i));
            if (!m) {
                throw new Error('syntax');
            }
            i += m[0].length;
            return parseFloat(m[0]);
        }
        function power(base) {
            if (peek() === '^') {
                i++;
                return Math.pow(base, factor());
            }
            return base;
        }
        function factor() {
            var c = peek();
            if (c === '+') {
                i++;
                return factor();
            }
            if (c === '-') {
                i++;
                return -factor();
            }
            if (c === '(') {
                i++;
                var value = sum();
                if (peek() !== ')') {
                    throw new Error('syntax');
                }
                i++;
                return power(value);
            }
            return power(number());
        }
        function product() {
            var value = factor();
            while (peek() === '*' || peek() === '/' || peek() === '%') {
                var op = s.charAt(i++);
                var right = factor();
                value = op === '*' ? value * right : (op === '/' ? value / right : value % right);
            }
            return value;
        }
        function sum() {
            var value = product();
            while (peek() === '+' || peek() === '-') {
                var op = s.charAt(i++);
                var right = product();
                value = op === '+' ? value + right : value - right;
            }
            return value;
        }
        var result = sum();
        if (i < s.length) {
            throw new Error('syntax');
        }
        return result;
    }

    sh.define(['CALC', 'BC'], {
        args: true, rank: 44,
        synopsis: 'CALC <SUM>  |  CALC', summary: 'calculate, or open the payment calculator',
        help: ['CALC <SUM>', 'CALCULATE (ALONE: PAYMENT CALCULATOR)'],
        man: [
            'Knows + - * / % ^ and brackets; a comma works as the decimal point,',
            'so CALC 3*12,50/4 is fine. ECHO 2^10 | CALC works, too.',
            'CALC alone opens the payment calculator of the dashboard.'
        ],
        run: function (arg, stdin) {
            var expression = clean(stdin ? stdin.join(' ') : arg);
            if (!expression) {
                var button = document.querySelector('[data-bs-target="#paymentCalculatorModal"]');
                print('OPENING THE PAYMENT CALCULATOR...', 'ok');
                if (button) {
                    button.click();
                    sh.hideSoon();
                } else {
                    sh.go(sh.appUrl('/orders/dashboard?calculator'));
                }
                return;
            }
            var result;
            try {
                result = calculate(expression);
            } catch (e) {
                print('CALC: SYNTAX ERROR IN "' + expression + '"', 'err');
                return;
            }
            if (!isFinite(result)) {
                print('CALC: DIVISION BY ZERO. A PIZZA CANNOT BE SHARED BY NOBODY.', 'err');
                return;
            }
            var rounded = Math.round(result * 1e10) / 1e10;
            print('= ' + rounded, 'ok');
            if (Math.abs(rounded * 100 - Math.round(rounded * 100)) > 1e-6) {
                print('≈ ' + rounded.toFixed(2), 'echo');
            }
        }
    });

    // ── THEME: preview a seasonal look ──

    function looks() {
        var theme = window.yyTheme;
        return (theme ? theme.seasons.concat(theme.linkOnly) : []).concat(['symbolics', 'default']);
    }

    function lookTitle(key) {
        var info = window.yyThemeInfo;
        if (key === 'default') {
            return 'Standard look';
        }
        return info && info[key] ? info[key].title : key;
    }

    sh.define('THEME', {
        args: true, rank: 45,
        synopsis: 'THEME [LIST|<LOOK>]', summary: 'preview a seasonal look',
        help: ['THEME [<LOOK>]', 'PREVIEW A SEASONAL LOOK'],
        complete: function () {
            return ['LIST'].concat(looks().map(function (key) {
                return key.toUpperCase();
            }));
        },
        man: [
            'THEME alone (or THEME LIST) lists the looks; THEME CHRISTMAS shows that',
            "one in this tab. Type 'symbolics' outside a field to come back here.",
            'THEME DEFAULT switches to the standard look.'
        ],
        run: function (arg) {
            var name = unquote(arg).toLowerCase();
            if (!name || name === 'list') {
                var season = window.yyTheme ? window.yyTheme.season() : null;
                print('NOW: SYMBOLICS' + (season ? '. THE DATE CALLS FOR: ' + season.toUpperCase() : ''), 'info');
                sh.picks(looks().map(function (key) {
                    return { text: padEnd(key.toUpperCase(), 11) + lookTitle(key), command: 'THEME ' + key.toUpperCase() };
                }));
                return;
            }
            if (looks().indexOf(name) < 0) {
                print('THEME: UNKNOWN LOOK "' + name + '". TRY THEME LIST.', 'err');
                return;
            }
            if (name === 'symbolics') {
                print('YOU ARE ALREADY HERE.', 'info');
                return;
            }
            print(name === 'default'
                ? 'SWITCHING TO THE STANDARD LOOK...'
                : "PREVIEWING " + name.toUpperCase() + "... TYPE 'SYMBOLICS' TO COME BACK.", 'ok');
            sh.later(function () {
                var url = new URL(window.location.href);
                url.searchParams.set('theme', name);
                window.location.href = url.toString();
            }, 700);
        }
    });

    // ── NEOFETCH ──

    var LOGO = [
        '      )  )  )      ',
        '     (  (  (       ',
        '   .-"""""""-.     ',
        '  /  Y  Y  Y  \\    ',
        ' |   YATTA     |   ',
        ' |   YAM-YAM   |   ',
        '  \\           /    ',
        "   '-._____.-'     ",
        '      |___|        '
    ];

    sh.define(['NEOFETCH', 'SCREENFETCH', 'FASTFETCH'], {
        rank: 46, synopsis: 'NEOFETCH', summary: 'show system information',
        help: ['NEOFETCH', 'SYSTEM INFORMATION'],
        man: ['Shows the system information, the way admins like it.'],
        run: function () {
            var counts = { OPEN: 0, RUN: 0, SELECT: 0, EDIT: 0 };
            sh.targets(null).forEach(function (t) {
                counts[t.verb]++;
            });
            var user = sh.userName().toLowerCase();
            var title = user + '@yatta-yam-yam';
            var info = [
                ['', title],
                ['', repeat('-', title.length)],
                ['OS', 'Yatta-Yam-Yam ' + sh.version()],
                ['Host', 'symbolics.com tribute edition'],
                ['Kernel', 'Spring Boot 3.2 (Java 17)'],
                ['Uptime', uptime()],
                ['Packages', counts.OPEN + ' (links), ' + counts.RUN + ' (buttons), ' + (counts.SELECT + counts.EDIT) + ' (fields)'],
                ['Shell', 'lunch-sh 1.0'],
                ['Resolution', window.innerWidth + 'x' + window.innerHeight],
                ['Theme', 'Symbolics [dark]'],
                ['Terminal', 'Dynamic Lunch Listener'],
                ['CPU', 'Pizza Oven (4) @ 450°C'],
                ['GPU', 'Neon Glow 9000'],
                ['Memory', (1 + Math.floor(Math.random() * 3)) + ' pizzas / 4 pizzas']
            ];
            var box = make('div', 'yy-neofetch');
            box.setAttribute('data-lines', '');
            box.appendChild(make('pre', 'yy-neofetch-logo', LOGO.join('\n')));
            var list = make('div', 'yy-neofetch-info');
            list.setAttribute('data-lines', '');
            info.forEach(function (row) {
                var line = make('div');
                if (row[0]) {
                    line.appendChild(make('span', 'yy-neofetch-key', row[0]));
                    line.appendChild(document.createTextNode(': ' + row[1]));
                } else {
                    line.appendChild(make('span', 'yy-neofetch-key', row[1]));
                }
                list.appendChild(line);
            });
            var colors = make('div', 'yy-neofetch-colors');
            ['#000', '#ff4040', '#33ff66', '#ffd60a', '#4fb6ff', '#ff2bd6', '#00e5ff', '#e8e8e8'].forEach(function (color) {
                var swatch = make('span');
                swatch.style.background = color;
                colors.appendChild(swatch);
            });
            list.appendChild(colors);
            box.appendChild(list);
            sh.node(box);
        }
    });

    // ── Small classics for admins ──

    sh.define('UPTIME', {
        hidden: true, synopsis: 'UPTIME', summary: 'tell how long the system has been running',
        run: function () {
            print(' ' + clock(new Date()) + ' up ' + uptime() + ',  1 user,  load average: 2 pizzas, 1 salad, 0.5 kebab', 'ok');
        }
    });

    sh.define('PING', {
        hidden: true, args: true, synopsis: 'PING <HOST>', summary: 'send echo requests to a host',
        man: ['Pings a host four times. Ctrl+C stops it early. Try PING PIZZA-PALACE.'],
        run: function (arg) {
            var host = clean(arg).split(' ').filter(function (part) {
                return part && part.charAt(0) !== '-';
            })[0];
            if (!host) {
                print('PING: USAGE ERROR: DESTINATION ADDRESS REQUIRED', 'err');
                return;
            }
            host = host.toLowerCase();
            var local = /^(localhost|127\.|::1)/.test(host);
            var unit = local ? ' MS' : ' MIN';
            var suffix = local ? ' (YOU ARE ALREADY HERE)' : /pizza|kebab|burger|sushi|pasta/.test(host)
                ? ' (DELIVERY)' : /kitchen|kueche|küche/.test(host) ? ' (STILL COOKING)' : '';
            var count = 0;
            var times = [];
            var timer = null;
            var done = sh.job(function () {
                window.clearTimeout(timer);
                print('^C', 'echo');
                finish();
            });
            function finish() {
                done();
                var min = Math.min.apply(null, times);
                var max = Math.max.apply(null, times);
                var avg = times.reduce(function (a, b) { return a + b; }, 0) / (times.length || 1);
                print('--- ' + host.toUpperCase() + ' PING STATISTICS ---', 'info');
                print(count + ' PACKETS TRANSMITTED, ' + count + ' RECEIVED, 0% PACKET LOSS', 'ok');
                if (times.length) {
                    print('ROUND-TRIP MIN/AVG/MAX = ' + min.toFixed(1) + '/' + avg.toFixed(1) + '/' + max.toFixed(1) + unit, 'ok');
                }
            }
            function tick() {
                count++;
                var time = local ? Math.random() * 0.1 : 5 + Math.random() * 40;
                times.push(time);
                print('64 BYTES FROM ' + host.toUpperCase() + ': ICMP_SEQ=' + count + ' TTL=64 TIME=' + time.toFixed(1) + unit + suffix, 'ok');
                if (count < 4) {
                    timer = sh.later(tick, 1000);
                } else {
                    finish();
                }
            }
            print('PING ' + host.toUpperCase() + ' (10.0.' + host.length + '.' + (host.charCodeAt(0) % 250) + '): 56 DATA BYTES', 'info');
            timer = sh.later(tick, 400);
        }
    });

    sh.define('RM', {
        hidden: true, args: true, synopsis: 'RM <FILE>', summary: 'remove files',
        run: function (arg) {
            print("RM: CANNOT REMOVE '" + (unquote(arg) || '?') + "': PERMISSION DENIED", 'err');
            print('(NICE TRY.)', 'echo');
        }
    });

    sh.define('MAKE', {
        hidden: true, args: true, synopsis: 'MAKE [<TARGET>]', summary: 'build a target',
        run: function (arg) {
            var target = clean(arg);
            if (/^me a sandwich/i.test(target)) {
                print('WHAT? MAKE IT YOURSELF.', 'warn');
            } else if (!target) {
                print('MAKE: *** NO TARGETS SPECIFIED AND NO MAKEFILE FOUND.  STOP.', 'err');
            } else if (/^love\b/i.test(target)) {
                print("MAKE: *** NO RULE TO MAKE TARGET 'LOVE'.  NOT WAR?", 'err');
            } else if (/^(coffee|tea|espresso)\b/i.test(target)) {
                print("MAKE: *** " + target.split(' ')[0].toUpperCase() + ": 418 I'M A TEAPOT.", 'err');
            } else {
                print("MAKE: *** NO RULE TO MAKE TARGET '" + target.split(' ')[0].toUpperCase() + "'.  STOP.", 'err');
                if (/^lunch\b/i.test(target)) {
                    print('TRY: ORDER <PLACE>', 'info');
                }
            }
        }
    });

    sh.define('SSH', {
        hidden: true, args: true, synopsis: 'SSH [<USER>@]<HOST>', summary: 'log in to another machine',
        run: function (arg) {
            var target = clean(arg).split(' ').filter(function (part) {
                return part && part.charAt(0) !== '-';
            })[0];
            if (!target) {
                print('USAGE: SSH [<USER>@]<HOST>', 'info');
                return;
            }
            var host = target.split('@').pop().toUpperCase();
            if (/^root@/i.test(target)) {
                print(target.toUpperCase() + ': PERMISSION DENIED (PUBLICKEY,PIZZA).', 'err');
            } else if (/kitchen|kueche|küche/i.test(host)) {
                print('SSH: CONNECT TO HOST ' + host + ' PORT 22: CONNECTION REFUSED (THE KITCHEN IS BUSY)', 'err');
            } else {
                print('SSH: CONNECT TO HOST ' + host + ' PORT 22: CONNECTION TIMED OUT (PROBABLY AT LUNCH)', 'err');
            }
        }
    });

    var FORTUNES = [
        'THERE IS NO SUCH THING AS A FREE LUNCH. BUT THERE IS A SHARED PIZZA.',
        'A BUG IN THE CODE IS WORTH TWO IN THE SALAD.',
        'THE BEST CODE IS WRITTEN AFTER LUNCH. THE WORST, RIGHT BEFORE IT.',
        'IT WORKS ON MY PLATE.',
        'YOU WILL ORDER TOO MUCH TODAY. AND YOU WILL NOT REGRET IT.',
        'PREMATURE OPTIMIZATION IS THE ROOT OF ALL EVIL. SO IS COLD PIZZA.',
        'THERE ARE ONLY TWO HARD THINGS: CACHE INVALIDATION, NAMING THINGS AND PICKING A RESTAURANT.',
        'TO ERR IS HUMAN. TO ORDER DESSERT, DIVINE.',
        'A WATCHED PIZZA NEVER ARRIVES.',
        'HAVE YOU TRIED TURNING YOUR HUNGER OFF AND ON AGAIN?',
        'SOMEWHERE, SOMEONE IS EATING THE LAST SLICE. IT COULD HAVE BEEN YOU.',
        "TODAY'S SPECIAL: SPAGHETTI CODE.",
        '99 LITTLE BUGS IN THE CODE. TAKE ONE DOWN, ORDER A PIZZA: 127 LITTLE BUGS IN THE CODE.',
        "THE CLOUD IS JUST SOMEONE ELSE'S KITCHEN.",
        'LUNCH IS A STATE OF MIND. AND OF STOMACH.',
        'ALWAYS ORDER AS IF THE PERSON WHO PAYS IS WATCHING. THEY ARE.'
    ];

    sh.define('FORTUNE', {
        hidden: true, synopsis: 'FORTUNE', summary: 'print a random lunch wisdom',
        man: ['Prints a random lunch wisdom. FORTUNE | COWSAY is the classic.'],
        run: function () {
            print(FORTUNES[Math.floor(Math.random() * FORTUNES.length)], 'ok');
        }
    });

    function wrap(text, width) {
        var out = [];
        var line = '';
        text.split(/\s+/).forEach(function (word) {
            while (word.length > width) {
                if (line) {
                    out.push(line);
                    line = '';
                }
                out.push(word.substring(0, width));
                word = word.substring(width);
            }
            if (!word) {
                return;
            }
            if (line && (line + ' ' + word).length > width) {
                out.push(line);
                line = word;
            } else {
                line = line ? line + ' ' + word : word;
            }
        });
        if (line || !out.length) {
            out.push(line);
        }
        return out;
    }

    var COW = [
        '        \\',
        '         \\    ,__,',
        '          \\   (oo)_______',
        '              (__)       )\\',
        '                 ||--W--|| *',
        '                 ||     ||'
    ];

    sh.define('COWSAY', {
        hidden: true, args: true, synopsis: 'COWSAY <TEXT>', summary: 'let a cow say something',
        man: ['Lets a cow say the text, or what comes through a pipe: FORTUNE | COWSAY.'],
        run: function (arg, stdin) {
            var text = clean(stdin ? stdin.join(' ') : arg) || 'MOO.';
            var said = wrap(text, 38);
            var width = Math.max.apply(null, said.map(function (line) { return line.length; }));
            var out = [' ' + repeat('_', width + 2)];
            if (said.length === 1) {
                out.push('< ' + said[0] + ' >');
            } else {
                said.forEach(function (line, i) {
                    var last = i === said.length - 1;
                    out.push((i === 0 ? '/' : last ? '\\' : '|') + ' ' + padEnd(line, width) + ' ' + (i === 0 ? '\\' : last ? '/' : '|'));
                });
            }
            out.push(' ' + repeat('-', width + 2));
            block(out.concat(COW));
        }
    });

    sh.define('LOLCAT', {
        hidden: true, args: true, synopsis: 'LOLCAT <TEXT>', summary: 'print in rainbow colours',
        man: ['Prints the text, or what comes through a pipe, in rainbow colours:', 'FORTUNE | COWSAY | LOLCAT.'],
        run: function (arg, stdin) {
            var rows = stdin || [clean(arg) || 'LOL'];
            var seed = Math.floor(Math.random() * 360);
            var box = make('div', 'yy-term-lolcat');
            box.setAttribute('data-lines', '');
            rows.forEach(function (row, r) {
                var line = make('div');
                if (!row) {
                    line.textContent = ' ';
                }
                for (var i = 0; i < row.length; i++) {
                    var letter = make('span', null, row.charAt(i));
                    letter.style.color = 'hsl(' + ((seed + i * 7 + r * 14) % 360) + ', 100%, 62%)';
                    line.appendChild(letter);
                }
                box.appendChild(line);
            });
            sh.node(box);
        }
    });

    // ── SL: for those who mistype LS ──

    var TRAIN = [
        '          (@@)  ( )  (@)   ( )',
        '       (   )',
        '        ||_____          ______________________   ______________________',
        '   _____||     |___     |                      | |                      |',
        '  |  []  |  [] |   |____|    YATTA-YAM-YAM     |_|     DINING   CAR     |',
        '  |______|_____|___|    |       EXPRESS        | |   PIZZA  *  PASTA    |',
        ' /|_________________|___|______________________|_|______________________|',
        '   (O)  (O)    (O)(O)     (O)            (O)       (O)            (O)'
    ];

    sh.define('SL', {
        hidden: true, synopsis: 'SL', summary: 'steam locomotive (for those who mistype LS)',
        man: ['Sends a train across the screen. Ctrl+C does not stop it. It never did.'],
        run: function () {
            if (!sh.motion()) {
                block(TRAIN);
                return;
            }
            var band = make('div', 'yy-sl');
            band.setAttribute('aria-hidden', 'true');
            band.appendChild(make('pre', 'yy-sl-train', TRAIN.join('\n')));
            document.getElementById('yy-terminal').appendChild(band);
            var done;
            function onInterrupt() {
                print('SL: CTRL+C HAS NO EFFECT. ENJOY THE RIDE.', 'warn');
                done = sh.job(onInterrupt);
            }
            done = sh.job(onInterrupt);
            sh.later(function () {
                done();
                band.remove();
            }, 7200);
        }
    });

    // ── VIM: easy to get in ──

    var VIM_INTRO = [
        'YATTA-VIM - THE LUNCH EDITOR',
        '',
        'version ' + sh.version(),
        'by the Yatta-Yam-Yam kitchen',
        '',
        'type  :q<Enter>        to exit',
        'type  :help<Enter>     for help',
        '',
        'good luck'
    ];

    function vim(file) {
        var name = file || '';
        var buffer = [''];
        var row = 0;
        var mode = 'normal';
        var command = null;
        var message = name ? '"' + name + '" [New]' : '';
        var error = false;
        var strays = 0;
        var modified = false;
        var lastKey = '';
        var screen = sh.screen({ className: 'yy-vim', label: 'Vim', onKey: key });
        var body = make('div', 'yy-vim-body');
        var status = make('div', 'yy-vim-status');
        var escape = make('button', 'yy-screen-quit', ':q!');
        escape.type = 'button';
        escape.addEventListener('click', function () {
            leave('YOU ESCAPED VIM WITH A BUTTON. WE WILL NOT TELL ANYONE.');
        });
        screen.el.appendChild(body);
        screen.el.appendChild(status);
        screen.el.appendChild(escape);

        function leave(text) {
            screen.close();
            if (text) {
                print(text, 'ok');
            }
        }

        function say(text, isError) {
            message = text;
            error = !!isError;
        }

        function draw() {
            var rows = Math.max(8, Math.floor(window.innerHeight / 20) - 2);
            var out = buffer.map(function (line, i) {
                return line + (i === row && command === null ? '█' : '');
            });
            var empty = buffer.length === 1 && !buffer[0] && !modified;
            for (var i = out.length; i < rows; i++) {
                out.push('~');
            }
            if (empty) {
                var top = Math.max(1, Math.floor((rows - VIM_INTRO.length) / 2));
                VIM_INTRO.forEach(function (line, j) {
                    var width = Math.floor(window.innerWidth / 9.6);
                    out[top + j] = '~' + repeat(' ', Math.max(1, Math.floor((width - line.length) / 2) - 1)) + line;
                });
            }
            body.textContent = out.join('\n');
            status.className = 'yy-vim-status' + (error ? ' is-error' : '');
            if (command !== null) {
                status.textContent = ':' + command + '█';
            } else if (mode === 'insert') {
                status.textContent = '-- INSERT --';
            } else {
                status.textContent = padEnd(message, 50) + (row + 1) + ',' + (buffer[row].length + 1) + '        All';
            }
        }

        function run(text) {
            var c = clean(text);
            var write = /^w\s+(\S+)/.exec(c);
            if (/^qa?!$/.test(c) || (/^qa?$/.test(c) && !modified)) {
                leave('YOU EXITED VIM. IMPRESSIVE.');
            } else if (/^qa?$/.test(c)) {
                say('E37: No write since last change (add ! to override)', true);
            } else if (/^(wq|x)!?$/.test(c)) {
                if (!name) {
                    say('E32: No file name', true);
                } else {
                    leave('"' + name.toUpperCase() + '" ' + buffer.length + 'L WRITTEN. TO /DEV/NULL.');
                }
            } else if (write) {
                name = write[1];
                modified = false;
                say('"' + name + '" [New] ' + buffer.length + 'L written');
            } else if (c === 'w') {
                if (name) {
                    modified = false;
                    say('"' + name + '" ' + buffer.length + 'L written');
                } else {
                    say('E32: No file name', true);
                }
            } else if (/^h(elp)?$/.test(c)) {
                say('E149: Sorry, no help for lunch', true);
            } else if (c.charAt(0) === '!') {
                say('E145: Shell commands not allowed in a lunch app', true);
            } else if (/^set?\b/.test(c)) {
                say('Your settings are perfect as they are.');
            } else if (/^\d+$/.test(c)) {
                row = Math.max(0, Math.min(buffer.length - 1, Number(c) - 1));
            } else if (c) {
                say('E492: Not an editor command: ' + c, true);
            }
        }

        function stray() {
            strays++;
            if (strays >= 12) {
                say('Stack Overflow: "How do I exit Vim?" - 2.7 million views and counting', true);
            } else if (strays >= 5) {
                say('-- STILL HERE? TRY :q! AND ENTER --', true);
            }
        }

        function key(e) {
            var k = e.key;
            if (e.metaKey || (e.altKey && !e.ctrlKey) || /^(Shift|Control|Alt|Meta|CapsLock)$/.test(k)) {
                return;
            }
            e.preventDefault();
            if (command !== null) {
                if (k === 'Enter') {
                    var text = command;
                    command = null;
                    run(text);
                } else if (k === 'Escape' || (e.ctrlKey && k.toLowerCase() === 'c')) {
                    command = null;
                } else if (k === 'Backspace') {
                    command = command ? command.slice(0, -1) : null;
                } else if (k.length === 1 && !e.ctrlKey) {
                    command += k;
                }
            } else if (mode === 'insert') {
                if (k === 'Escape' || (e.ctrlKey && k === '[')) {
                    mode = 'normal';
                } else if (k === 'Enter') {
                    buffer.splice(++row, 0, '');
                    modified = true;
                } else if (k === 'Backspace') {
                    if (buffer[row]) {
                        buffer[row] = buffer[row].slice(0, -1);
                    } else if (row > 0) {
                        buffer.splice(row--, 1);
                    }
                    modified = true;
                } else if (k === 'Tab') {
                    buffer[row] += '    ';
                    modified = true;
                } else if (k.length === 1 && !e.ctrlKey) {
                    buffer[row] += k;
                    modified = true;
                }
            } else {
                var pair = lastKey + k;
                lastKey = k;
                if (e.ctrlKey && k.toLowerCase() === 'c') {
                    say('Type  :qa!  and press <Enter> to abandon all changes and exit Vim');
                } else if (k === ':') {
                    command = '';
                    say('');
                } else if (/^[iaAIoO]$/.test(k)) {
                    if (k === 'o' || k === 'O') {
                        buffer.splice(k === 'o' ? ++row : row, 0, '');
                        modified = true;
                    }
                    mode = 'insert';
                    say('');
                } else if (pair === 'ZZ') {
                    run('x');
                } else if (pair === 'ZQ') {
                    run('q!');
                } else if (pair === 'dd') {
                    buffer.splice(row, 1);
                    if (!buffer.length) {
                        buffer.push('');
                    }
                    row = Math.min(row, buffer.length - 1);
                    modified = true;
                    lastKey = '';
                } else if (k === 'j' || k === 'ArrowDown') {
                    row = Math.min(buffer.length - 1, row + 1);
                } else if (k === 'k' || k === 'ArrowUp') {
                    row = Math.max(0, row - 1);
                } else if (k === 'u') {
                    say('Already at oldest change');
                } else if (k !== 'Z' && k !== 'd') {
                    stray();
                }
            }
            draw();
        }

        draw();
    }

    sh.define(['VIM', 'VI', 'NVIM', 'VIEW'], {
        hidden: true, args: true, synopsis: 'VIM [<FILE>]', summary: 'Vi IMproved, a programmer\'s text editor',
        man: ['Opens the editor. Leaving it is left as an exercise to the reader.'],
        run: function (arg) {
            vim(unquote(arg));
        }
    });

    sh.define(['NANO', 'PICO', 'EMACS', 'NOTEPAD'], {
        hidden: true, args: true, synopsis: 'NANO [<FILE>]', summary: 'another text editor',
        run: function (arg, stdin, word) {
            print(word.toUpperCase() === 'EMACS'
                ? 'EMACS: A GREAT OPERATING SYSTEM, LACKING ONLY A DECENT EDITOR. OPENING VIM INSTEAD...'
                : word.toUpperCase() + '? REAL ADMINS USE VIM. OPENING VIM...', 'warn');
            sh.later(function () {
                vim(unquote(arg));
            }, 1200);
        }
    });

    // ── REBOOT and SHUTDOWN ──

    function typeLines(target, textLines, step, after) {
        textLines.forEach(function (line, i) {
            sh.later(function () {
                target.appendChild(make('div', line.className || null, line.text || line || ' '));
            }, step * (i + 1));
        });
        if (after) {
            sh.later(after, step * (textLines.length + 1));
        }
    }

    function reboot() {
        var screen = sh.screen({
            className: 'yy-bios', label: 'Reboot',
            onKey: function (e) {
                e.preventDefault();
                if (e.key === 'Escape') {
                    sh.go(null);
                } else if (e.key === 'Delete') {
                    screen.el.appendChild(make('div', 'yy-bios-warn', 'SETUP IS LOCKED. ASK YOUR ADMIN. (THAT IS YOU? THEN NO.)'));
                }
            }
        });
        var memory = make('div', null, 'Memory Test :       0K');
        screen.el.appendChild(make('div', 'yy-bios-title', 'YATTA BIOS v' + sh.version() + ', LUNCH EDITION'));
        screen.el.appendChild(make('div', null, 'Copyright (C) 1985-' + new Date().getFullYear() + ', Yatta-Yam-Yam Kitchen'));
        screen.el.appendChild(make('div', null, ' '));
        screen.el.appendChild(make('div', null, 'Main Processor : Pizza Oven 450°C'));
        screen.el.appendChild(memory);
        var kb = 0;
        (function count() {
            kb = Math.min(640, kb + 64);
            memory.textContent = 'Memory Test : ' + padStart(kb, 7) + 'K' + (kb === 640 ? ' OK  (640K OUGHT TO BE ENOUGH FOR ANYBODY)' : '');
            if (kb < 640) {
                sh.later(count, 90);
            }
        })();
        sh.later(function () {
            typeLines(screen.el, [
                ' ',
                'Detecting Primary Master   ... COFFEE MACHINE',
                'Detecting Primary Slave    ... FRIDGE (FULL)',
                'Detecting Secondary Master ... NONE',
                'Detecting Lunch Devices    ... 3 PIZZAS, 1 SALAD',
                ' ',
                { text: 'Press DEL to enter SETUP, ESC to skip', className: 'yy-bios-hint' },
                ' ',
                'Booting from Yatta-Yam-Yam...'
            ], 320, function () {
                sh.go(null);
            });
        }, 1100);
    }

    sh.define('REBOOT', {
        hidden: true, synopsis: 'REBOOT', summary: 'restart the system',
        run: reboot
    });

    sh.define(['SHUTDOWN', 'HALT', 'POWEROFF'], {
        hidden: true, args: true, synopsis: 'SHUTDOWN [-R] [NOW]', summary: 'bring the system down',
        run: function (arg) {
            if (/(^|\s)-r\b/i.test(arg)) {
                reboot();
                return;
            }
            var user = sh.userName().toLowerCase();
            print('BROADCAST MESSAGE FROM ' + user.toUpperCase() + '@YATTA-YAM-YAM: THE SYSTEM IS GOING DOWN FOR LUNCH NOW!', 'warn');
            var ready = false;
            var screen = sh.screen({
                className: 'yy-shutdown', label: 'Shutdown',
                onKey: function (e) {
                    e.preventDefault();
                    if (ready) {
                        screen.close();
                        print('WELCOME BACK. LUNCH IS STILL NOT READY.', 'ok');
                    }
                }
            });
            screen.el.addEventListener('click', function () {
                if (ready) {
                    screen.close();
                }
            });
            typeLines(screen.el, [
                { text: '[  OK  ] Stopped target Hunger.', className: '' },
                '[  OK  ] Stopped Pizza Oven Daemon.',
                '[  OK  ] Stopped Coffee Machine Service.',
                '[  OK  ] Unmounted /lunch.',
                '[  OK  ] Reached target Power-Off.'
            ], 380, function () {
                screen.el.textContent = '';
                screen.el.classList.add('is-off');
                screen.el.appendChild(make('div', 'yy-shutdown-safe', "It's now safe to turn off your computer."));
                ready = true;
            });
        }
    });

    // ── CMATRIX, also the screensaver ──

    var MATRIX_CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ'
        + 'ﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋ0123456789YATMPIZ$€';

    function matrix(screensaver) {
        if (sh.screenOpen()) {
            return;
        }
        var opened = Date.now();
        var screen = sh.screen({
            className: 'yy-matrix', label: screensaver ? 'Screensaver' : 'Matrix',
            onKey: function (e) {
                e.preventDefault();
                screen.close();
            },
            onClose: function () {
                window.cancelAnimationFrame(frame);
                window.removeEventListener('resize', resize);
                ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'].forEach(function (type) {
                    document.removeEventListener(type, wake, true);
                });
            }
        });
        var canvas = make('canvas');
        var ctx = canvas.getContext('2d');
        var text = make('div', 'yy-matrix-text');
        screen.el.appendChild(canvas);
        screen.el.appendChild(text);
        var size = 16;
        var drops = [];
        var frame = 0;
        var last = 0;

        function wake(e) {
            if (e.type === 'pointermove' && Date.now() - opened < 800) {
                return; // the mouse settling after the command was typed
            }
            if (e.type === 'keydown') {
                e.preventDefault();
            }
            screen.close(screensaver);
        }

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            drops = [];
            for (var i = 0; i < Math.ceil(canvas.width / size); i++) {
                drops.push(-Math.floor(Math.random() * 40));
            }
        }

        function draw(time) {
            frame = window.requestAnimationFrame(draw);
            if (time - last < 50) {
                return;
            }
            last = time;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = size + 'px monospace';
            for (var i = 0; i < drops.length; i++) {
                var y = drops[i] * size;
                ctx.fillStyle = Math.random() > 0.975 ? '#d8ffe4' : '#33ff66';
                ctx.fillText(MATRIX_CHARS.charAt(Math.floor(Math.random() * MATRIX_CHARS.length)), i * size, y);
                if (y > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        }

        var words = 'WAKE UP, ' + sh.userName() + '... THE LUNCH HAS YOU.';
        var shown = 0;
        (function typeOn() {
            if (!screen.el.parentNode) {
                return;
            }
            text.textContent = words.substring(0, ++shown);
            if (shown < words.length) {
                sh.later(typeOn, 90);
            } else {
                sh.later(function () {
                    text.classList.add('is-gone');
                }, 2500);
            }
        })();

        canvas.addEventListener('pointerdown', function () {
            screen.close();
        });
        window.addEventListener('resize', resize);
        if (screensaver) {
            ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'].forEach(function (type) {
                document.addEventListener(type, wake, true);
            });
        }
        resize();
        frame = window.requestAnimationFrame(draw);
    }

    sh.define(['CMATRIX', 'MATRIX'], {
        hidden: true, synopsis: 'CMATRIX', summary: 'show the matrix',
        man: ['Lets it rain green characters. Any key or click ends it.', 'After ten minutes without input it comes by itself.'],
        run: function () {
            matrix(false);
        }
    });

    var lastInput = Date.now();
    ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart', 'scroll'].forEach(function (type) {
        document.addEventListener(type, function () {
            lastInput = Date.now();
        }, { capture: true, passive: true });
    });
    window.setInterval(function () {
        if (sh.active() && !sh.screenOpen() && !document.hidden && sh.motion()
                && !document.querySelector('.modal.show') && Date.now() - lastInput >= IDLE_MS) {
            matrix(true);
        }
    }, 30000);

    sh.onStop(grepClear);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', prefill);
    } else {
        prefill();
    }
})();
