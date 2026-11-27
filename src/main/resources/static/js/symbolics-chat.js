/*
 * Symbolics mode: the chat of the command line, and the kitchen bot.
 *
 *   CHAT            #lunch, one channel for everyone who is logged in, full screen in the
 *                   style of an IRC client: /me <action>, /who, /clear, /join #kitchen,
 *                   /help, /quit (or Esc). Tab completes names, Up/Down recall your lines.
 *   WALL <text>     write to #lunch without opening it (FORTUNE | WALL works, too)
 *   WHO             who has the command line open right now
 *   TALK [KITCHEN]  a chat with the kitchen: a bot that runs only in this browser and
 *                   answers in German or English, whichever you write (also ELIZA)
 *
 * Messages come from /chat/messages (ChatController). While Symbolics is on, the browser
 * asks for new ones every 3 seconds with the chat open, every 20 otherwise (60 in a
 * hidden tab). New messages show at the right end of the command line ("2 NEW MESSAGES",
 * a click opens the chat); localStorage yy-chat-seen remembers the newest one you saw.
 * Everything is shown as text, never as HTML. Styles: css/symbolics.css.
 */
(function () {
    'use strict';

    var sh = window.yySymbolics;
    if (!sh) {
        return;
    }

    var make = sh.make;
    var clean = sh.clean;
    var SEEN_KEY = 'yy-chat-seen';
    var POLL_OPEN = 3000;
    var POLL_IDLE = 20000;
    var POLL_HIDDEN = 60000;
    var KEEP = 300;          // messages kept in the browser and lines in the chat window
    var NICK_COLORS = ['#00e5ff', '#ff2bd6', '#ffd60a', '#33ff66', '#4fb6ff', '#ff8a3d', '#b48cff', '#7dffd8'];

    var lunch = { me: null, messages: [], ids: {}, last: 0, top: 0, online: null, loaded: false, error: null };
    var room = null;         // the open #lunch window
    var pollTimer = null;
    var pending = null;      // the poll on its way

    // ── Helpers ──

    function padEnd(text, width) {
        text = String(text);
        return text + new Array(Math.max(0, width - text.length) + 1).join(' ');
    }

    function two(n) {
        return (n < 10 ? '0' : '') + n;
    }

    function stamp(date) {
        return '[' + two(date.getHours()) + ':' + two(date.getMinutes()) + ']';
    }

    // Every name keeps its colour; a new name takes the next free one from where its hash
    // points, so a small group never shares a colour
    var nickColors = {};

    function colorOf(name) {
        var key = name.toLowerCase();
        if (nickColors[key]) {
            return nickColors[key];
        }
        var hash = 0;
        for (var i = 0; i < key.length; i++) {
            hash = (hash * 31 + key.charCodeAt(i)) | 0;
        }
        var used = Object.keys(nickColors).map(function (other) {
            return nickColors[other];
        });
        var start = Math.abs(hash) % NICK_COLORS.length;
        var color = NICK_COLORS[start];
        for (var step = 0; step < NICK_COLORS.length; step++) {
            var candidate = NICK_COLORS[(start + step) % NICK_COLORS.length];
            if (used.indexOf(candidate) < 0) {
                color = candidate;
                break;
            }
        }
        nickColors[key] = color;
        return color;
    }

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Does the message name me?
    function mentions(message, me) {
        if (!me || !message || message.author.toLowerCase() === me.toLowerCase()) {
            return false;
        }
        return new RegExp('(^|[^a-z0-9äöüß])@?' + escapeRegExp(me) + '($|[^a-z0-9äöüß])', 'i').test(message.text);
    }

    function readSeen() {
        try {
            var value = window.localStorage.getItem(SEEN_KEY);
            return value === null ? null : Number(value) || 0;
        } catch (e) {
            return null;
        }
    }

    function writeSeen(id) {
        try {
            window.localStorage.setItem(SEEN_KEY, String(id));
        } catch (e) {
            // no storage: every page starts with nothing new
        }
    }

    // ── Talking to the server ──

    function api(path, options) {
        if (!window.fetch) {
            return Promise.reject(new Error('old'));
        }
        var settings = { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } };
        Object.keys(options || {}).forEach(function (key) {
            settings[key] = options[key];
        });
        return window.fetch(sh.appUrl('/chat' + path), settings).then(function (response) {
            if (response.status === 401 || /\/login/.test(response.url)) {
                throw new Error('login');
            }
            if (response.status === 429) {
                return response.json().then(null, function () {
                    return {};
                }).then(function (body) {
                    var err = new Error('slow');
                    err.retryAfter = body.retryAfter;
                    throw err;
                });
            }
            if (response.status === 403) {
                throw new Error('stale');
            }
            if (!response.ok) {
                throw new Error('http');
            }
            if ((response.headers.get('content-type') || '').indexOf('json') < 0) {
                throw new Error('login');
            }
            return response.json();
        });
    }

    function problem(err) {
        switch (err && err.message) {
            case 'login':
                return 'PLEASE LOG IN AND ENTER YOUR NAME FIRST.';
            case 'slow':
                return 'NOT SO FAST. AT MOST 5 LINES IN 5 SECONDS.';
            case 'stale':
                return 'THIS PAGE IS TOO OLD TO SEND FROM. RELOAD IT.';
            default:
                return 'NETWORK ERROR. THE KITCHEN IS NOT ANSWERING.';
        }
    }

    function sendHeaders() {
        var headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
        var meta = document.querySelector('meta[name="yy-csrf"]');
        if (meta && meta.getAttribute('data-header')) {
            headers[meta.getAttribute('data-header')] = meta.getAttribute('content');
        }
        return headers;
    }

    function remember(message) {
        if (lunch.ids[message.id]) {
            return false;
        }
        lunch.ids[message.id] = true;
        lunch.messages.push(message);
        lunch.top = Math.max(lunch.top, message.id);
        if (lunch.messages.length > KEEP) {
            delete lunch.ids[lunch.messages.shift().id];
        }
        return true;
    }

    // Lines go out one after the other; more than 5 in 5 seconds wait until the server
    // takes them again (it says when), so nothing gets lost or out of order
    var queue = [];
    var sending = false;

    function send(text) {
        return new Promise(function (resolve, reject) {
            queue.push({ text: text, resolve: resolve, reject: reject, tries: 0 });
            pump();
        });
    }

    function pump() {
        if (sending || !queue.length) {
            return;
        }
        sending = true;
        var item = queue[0];
        api('/messages', {
            method: 'POST',
            headers: sendHeaders(),
            body: JSON.stringify({ text: item.text })
        }).then(function (message) {
            queue.shift();
            sending = false;
            if (remember(message) && room) {
                room.add([message]);
                markSeen();
            }
            item.resolve(message);
            window.setTimeout(tick, 300); // what the others wrote in the meantime
            pump();
        }, function (err) {
            sending = false;
            if (err.message === 'slow' && item.tries++ < 5) {
                window.setTimeout(pump, Math.min(6000, err.retryAfter || 1500));
                return;
            }
            queue.shift();
            item.reject(err);
            pump();
        });
    }

    function schedule() {
        window.clearTimeout(pollTimer);
        if (!sh.active() || lunch.error === 'login') {
            return;
        }
        pollTimer = window.setTimeout(tick, room ? POLL_OPEN : (document.hidden ? POLL_HIDDEN : POLL_IDLE));
    }

    // A poll nobody waits for: its failure only shows in the chat window (see poll)
    function tick() {
        poll().then(null, function () {});
    }

    function poll() {
        if (!sh.active()) {
            return Promise.resolve();
        }
        if (pending) {
            return pending;
        }
        window.clearTimeout(pollTimer);
        pending = api('/messages' + (lunch.loaded ? '?after=' + lunch.last : '')).then(function (data) {
            pending = null;
            receive(data);
            schedule();
        }, function (err) {
            pending = null;
            if (room && lunch.error !== err.message) {
                room.system(problem(err));
            }
            lunch.error = err.message;
            schedule();
            throw err;
        });
        return pending;
    }

    function receive(data) {
        var before = lunch.online;
        lunch.me = data.me;
        lunch.loaded = true;
        lunch.error = null;
        lunch.online = data.online || [];
        var fresh = (data.messages || []).filter(function (message) {
            lunch.last = Math.max(lunch.last, message.id);
            return remember(message);
        });
        if (readSeen() === null) {
            writeSeen(lunch.top); // the very first time: old messages are not "new"
        }
        if (room) {
            if (before) {
                room.presence(before, lunch.online);
            }
            room.add(fresh);
            room.topic();
            markSeen();
        }
        updateNotice();
    }

    function markSeen() {
        if (lunch.top > (readSeen() || 0)) {
            writeSeen(lunch.top);
        }
        updateNotice();
    }

    // "2 NEW MESSAGES" at the right end of the command line
    function updateNotice() {
        if (!sh.active()) {
            return;
        }
        if (room) {
            sh.notice(null);
            return;
        }
        var seen = readSeen() || 0;
        var me = (lunch.me || '').toLowerCase();
        var unread = lunch.messages.filter(function (message) {
            return message.id > seen && message.author.toLowerCase() !== me;
        });
        if (!unread.length) {
            sh.notice(null);
        } else if (unread.some(function (message) { return mentions(message, lunch.me); })) {
            sh.notice('Message for you · type chat', true);
        } else {
            sh.notice(unread.length + (unread.length === 1 ? ' new message' : ' new messages') + ' · type chat', true);
        }
    }

    // ── The chat window (#lunch, and #kitchen for the bot) ──

    // options: { name, me(), topic(), nicks(), send(text) → Promise|void, command(cmd, arg, view) → handled, onClose() }
    function openRoom(options) {
        if (sh.screenOpen()) {
            return null;
        }
        var lines = [];
        var lineIndex = -1;
        var lastDay = null;
        var view = {};
        var screen = sh.screen({
            className: 'yy-chat',
            label: 'Chat ' + options.name,
            onClose: function () {
                if (options.onClose) {
                    options.onClose();
                }
            }
        });
        var top = make('div', 'yy-chat-top');
        var log = make('div', 'yy-chat-log');
        log.setAttribute('role', 'log');
        log.setAttribute('aria-live', 'polite');
        var form = make('div', 'yy-chat-form');
        var input = make('input', 'yy-chat-input');
        input.type = 'text';
        input.maxLength = 500;
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocapitalize', 'sentences');
        input.setAttribute('spellcheck', 'true');
        input.setAttribute('enterkeyhint', 'send');
        input.setAttribute('aria-label', 'Message to ' + options.name);
        var quit = make('button', 'yy-screen-quit', '/quit');
        quit.type = 'button';
        quit.addEventListener('click', function () {
            screen.close();
        });
        form.appendChild(make('span', 'yy-chat-prompt', '[' + options.name + ']'));
        form.appendChild(input);
        screen.el.appendChild(top);
        screen.el.appendChild(log);
        screen.el.appendChild(form);
        screen.el.appendChild(quit);

        function line(className, parts) {
            var div = make('div', 'yy-chat-line' + (className ? ' ' + className : ''));
            parts.forEach(function (part) {
                div.appendChild(typeof part === 'string' ? document.createTextNode(part) : part);
            });
            log.appendChild(div);
            while (log.childNodes.length > KEEP) {
                log.removeChild(log.firstChild);
            }
            log.scrollTop = log.scrollHeight;
        }

        view.system = function (text) {
            line('is-system', [make('span', 'yy-chat-time', stamp(new Date()) + ' '), '-!- ' + text]);
        };

        view.add = function (messages) {
            messages.forEach(function (message) {
                var date = new Date(message.time);
                var day = date.toDateString();
                if (lastDay && day !== lastDay) {
                    view.system('Day changed to ' + date.toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                    }));
                }
                lastDay = day;
                var me = options.me() || '';
                var own = message.author.toLowerCase() === me.toLowerCase();
                var action = /^\/me\s+/i.test(message.text);
                var nick = make('span', 'yy-chat-nick' + (own ? ' is-me' : ''), action ? message.author : '<' + message.author + '>');
                nick.style.color = colorOf(message.author);
                var time = make('span', 'yy-chat-time', stamp(date) + ' ');
                var mark = mentions(message, me) ? 'is-mention' : '';
                if (action) {
                    line('is-action ' + mark, [time, '* ', nick, ' ' + message.text.replace(/^\/me\s+/i, '')]);
                } else {
                    line(mark, [time, nick, ' ' + message.text]);
                }
            });
        };

        // Who came and went since the last look
        view.presence = function (before, after) {
            function names(list) {
                return list.map(function (presence) {
                    return presence.name;
                });
            }
            var old = names(before);
            var now = names(after);
            now.filter(function (name) { return old.indexOf(name) < 0; }).forEach(function (name) {
                view.system(name + ' has joined ' + options.name);
            });
            old.filter(function (name) { return now.indexOf(name) < 0; }).forEach(function (name) {
                view.system(name + ' has quit (lunch break)');
            });
        };

        view.topic = function (extra) {
            top.textContent = options.topic() + (extra ? '   · ' + extra : '');
        };

        view.open = function () {
            return !!screen.el.parentNode;
        };

        view.close = function () {
            screen.close();
        };

        function command(text) {
            var m = /^\/(\S+)\s*(.*)$/.exec(text);
            var cmd = m[1].toLowerCase();
            var arg = m[2];
            if (/^(quit|exit|part|q|bye)$/.test(cmd)) {
                screen.close();
            } else if (cmd === 'clear' || cmd === 'cls') {
                log.textContent = '';
            } else if (options.command && options.command(cmd, arg, view)) {
                // handled by the room
            } else if (cmd === 'help') {
                view.system('Commands: /me <action>, /who, /clear, /join #lunch or #kitchen, /quit (or Esc). Tab completes names.');
            } else {
                view.system('Unknown command: /' + cmd + '. Try /help.');
            }
        }

        function submit() {
            var text = clean(input.value);
            if (!text) {
                return;
            }
            lines.push(text);
            lineIndex = -1;
            input.value = '';
            if (text.charAt(0) === '/' && !/^\/me\s+\S/i.test(text)) {
                command(text);
                return;
            }
            var result = options.send(text);
            if (result && typeof result.then === 'function') {
                result.then(null, function (err) {
                    view.system('Not sent: ' + problem(err));
                    if (!input.value) {
                        input.value = text;
                    }
                });
            }
        }

        // Tab: the name that starts with the word before the cursor
        function completeNick() {
            var value = input.value;
            var end = input.selectionStart === null ? value.length : input.selectionStart;
            var start = value.lastIndexOf(' ', end - 1) + 1;
            var word = value.substring(start, end).replace(/^@/, '').toLowerCase();
            if (!word) {
                return;
            }
            var match = options.nicks().filter(function (nick) {
                return nick.toLowerCase().indexOf(word) === 0;
            })[0];
            if (match) {
                var insert = match + (start === 0 ? ': ' : ' ');
                input.value = value.substring(0, start) + insert + value.substring(end);
                var caret = start + insert.length;
                input.setSelectionRange(caret, caret);
            }
        }

        input.addEventListener('keydown', function (e) {
            if (e.isComposing) {
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                submit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                screen.close();
            } else if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                completeNick();
            } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && lines.length) {
                e.preventDefault();
                lineIndex = e.key === 'ArrowUp'
                    ? Math.min(lines.length - 1, lineIndex + 1)
                    : Math.max(-1, lineIndex - 1);
                input.value = lineIndex < 0 ? '' : lines[lines.length - 1 - lineIndex];
            }
        });
        screen.el.addEventListener('click', function (e) {
            if (e.target === screen.el || e.target === form || e.target === top) {
                input.focus();
            }
        });

        view.topic();
        input.focus();
        return view;
    }

    function onlineNames() {
        return (lunch.online || []).map(function (presence) {
            return presence.name;
        });
    }

    function openLunch() {
        var view = openRoom({
            name: '#lunch',
            me: function () {
                return lunch.me;
            },
            topic: function () {
                var names = onlineNames();
                return '#lunch · Yatta-Yam-Yam · ' + (names.length ? names.length + ' online: ' + names.join(', ') : 'connecting...');
            },
            nicks: function () {
                var nicks = onlineNames();
                lunch.messages.forEach(function (message) {
                    if (nicks.indexOf(message.author) < 0) {
                        nicks.push(message.author);
                    }
                });
                return nicks;
            },
            send: send,
            command: function (cmd, arg, v) {
                if (cmd === 'who' || cmd === 'names') {
                    v.system('Online: ' + (onlineNames().join(', ') || 'nobody'));
                } else if (cmd === 'join') {
                    var channel = arg.replace(/^#/, '').toLowerCase();
                    if (channel === 'kitchen') {
                        v.close();
                        window.setTimeout(openKitchen, 50);
                    } else if (!channel || channel === 'lunch') {
                        v.system('You are already in #lunch.');
                    } else {
                        v.system('#' + channel + ': no such channel. There are #lunch and #kitchen.');
                    }
                } else if (cmd === 'msg' || cmd === 'query') {
                    v.system('No private messages (yet): everyone who is logged in reads #lunch.');
                } else {
                    return false;
                }
                return true;
            },
            onClose: function () {
                room = null;
                updateNotice();
                schedule();
            }
        });
        if (!view) {
            return;
        }
        room = view;
        sh.notice(null);
        view.system('Welcome to #lunch. Everyone who is logged in can read along. /help lists the commands, Esc leaves.');
        if (lunch.loaded) {
            view.add(lunch.messages);
            markSeen();
        }
        poll().then(null, function (err) {
            if (!lunch.loaded && room === view) {
                view.system(problem(err));
            }
        });
    }

    // ── The kitchen bot ──

    var kitchen = (function () {
        var language = (navigator.language || '').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
        var GERMAN = ('ich du bist ist und nicht was wie warum wer wann hab habe gibt gibts heute essen danke bitte hallo '
            + 'moin servus tschüss ja nein der die das mir mich dich dir kannst können mag möchte hunger lecker guten '
            + 'schon noch auch mal jetzt gerade bin hast').split(' ');
        var ENGLISH = ('i you are is the what how why who when hungry thanks thank please hello hi yes no food today '
            + 'can my me do have want like am was it this that still now').split(' ');

        function words(text) {
            return text.toLowerCase().split(/[^a-zäöüß']+/).filter(Boolean);
        }

        function detect(text) {
            var de = 0;
            var en = 0;
            words(text).forEach(function (word) {
                if (GERMAN.indexOf(word) >= 0) {
                    de++;
                }
                if (ENGLISH.indexOf(word) >= 0) {
                    en++;
                }
            });
            if (de > en) {
                language = 'de';
            } else if (en > de) {
                language = 'en';
            }
            return language;
        }

        // A word (or words) on its own, umlauts included
        function w(list) {
            return new RegExp('(?:^|[^a-zäöüß])(?:' + list + ')(?=$|[^a-zäöüß])', 'i');
        }

        var REFLECT = {
            en: { i: 'you', me: 'you', my: 'your', mine: 'yours', am: 'are', myself: 'yourself', you: 'I', your: 'my', yours: 'mine' },
            de: { ich: 'du', mich: 'dich', mir: 'dir', mein: 'dein', meine: 'deine', meinen: 'deinen', meinem: 'deinem',
                bin: 'bist', du: 'ich', dich: 'mich', dir: 'mir', dein: 'mein', deine: 'meine' }
        };

        function reflect(text, lang) {
            return text.replace(/[.!?]+$/, '').split(' ').map(function (word) {
                var swap = REFLECT[lang][word.toLowerCase()];
                return swap || word;
            }).join(' ');
        }

        function pick(list) {
            return list[Math.floor(Math.random() * list.length)];
        }

        function clock() {
            var now = new Date();
            return { text: two(now.getHours()) + ':' + two(now.getMinutes()), minutes: now.getHours() * 60 + now.getMinutes() };
        }

        var JOKES = {
            en: [
                'What do you call a fake noodle? An impasta.',
                'I told a pizza joke once. It was too cheesy.',
                'Why do programmers prefer dark mode? Because light attracts bugs.',
                'Why did the developer go broke? He used up all his cache.',
                'There are 10 kinds of people: those who understand binary, and those who order pizza.'
            ],
            de: [
                'Treffen sich zwei Pizzen. Sagt die eine: "Na, alles klar?" Die andere: "Kann nicht klagen, bin gut belegt."',
                'Was ist ein Keks unter einem Baum? Ein schattiges Plätzchen.',
                'Warum mögen Programmierer keine Natur? Zu viele Bugs.',
                'Was bestellt ein Pirat beim Italiener? Pizza mit Arrrtischocken.',
                'Kommt ein Informatiker in die Küche. Fragt der Koch: "Was darf es sein?" Er: "Ja."'
            ]
        };

        // First match wins. en/de: answers ({name}, {1}, {2} are filled in), or answer(m, lang, name)
        var RULES = [
            { re: w('bye|tschüss|tschuess|ciao|tschau|auf wiedersehen|see you|bis später|bis dann|gute nacht|good night'), bye: true,
                en: ['See you at lunch, {name}.', 'Bye! And don\'t forget to eat.'],
                de: ['Bis später, {name}. Und nicht das Essen vergessen.', 'Tschüss! Die Küche schließt nie.'] },
            { re: w('hallo|hello|hi|hey|moin|servus|huhu|guten morgen|guten tag|good morning|grüß gott|yo'),
                en: ['Hello {name}! Hungry already?', 'Hi {name}. The oven is hot. What can I do for you?'],
                de: ['Hallo {name}! Schon Hunger?', 'Moin {name}. Der Ofen ist heiß. Was darf\'s sein?'] },
            { re: /(how are you|how'?s it going|wie geht'?s|wie geht es dir|alles klar bei dir)/i,
                en: ['Busy. Someone ordered pizza with pineapple again.', 'Hot. 450 degrees in here, literally. And you?'],
                de: ['Viel zu tun. Schon wieder hat jemand Pizza mit Ananas bestellt.', 'Heiß. Wortwörtlich 450 Grad hier drin. Und bei dir?'] },
            { re: /(who are you|what are you|your name|wer bist du|was bist du|wie hei(ß|ss)t du)/i,
                en: ['I am the kitchen. I live in this command line and dream of mise en place.'],
                de: ['Ich bin die Küche. Ich wohne in dieser Kommandozeile und träume von Mise en place.'] },
            { re: /(help|hilfe|what can you do|was kannst du)/i,
                en: ['Ask me what is open, what time it is, what you feel like eating, or for a joke. For real help, type HELP in the command line.'],
                de: ['Frag mich, was offen ist, wie spät es ist, worauf du Lust hast, oder nach einem Witz. Echte Hilfe gibt\'s mit HELP in der Kommandozeile.'] },
            { re: /(what'?s open|open orders|any orders|who'?s ordering|orders? today|bestell|offen|wer bestellt|was gibt'?s heute|was gibt es heute)/i,
                answer: function (m, lang) {
                    if (!sh.loadOrders) {
                        return lang === 'de' ? 'Mein Bestellbuch ist gerade nicht da. Typisch.' : 'My order book is not here right now. Typical.';
                    }
                    return sh.loadOrders().then(function (orders) {
                        var open = orders.filter(function (order) {
                            return order.status === 'OPEN';
                        }).map(function (order) {
                            return order.place;
                        });
                        if (!open.length) {
                            return lang === 'de'
                                ? 'Gerade ist keine Bestellung offen. Tipp ORDER <Ort> in die Kommandozeile und sei der Held.'
                                : 'No open orders right now. Type ORDER <place> in the command line and be the hero.';
                        }
                        return (lang === 'de' ? 'Gerade offen: ' : 'Open right now: ') + open.join(', ')
                            + (lang === 'de' ? '. Beeil dich lieber.' : '. Better hurry.');
                    }, function () {
                        return lang === 'de' ? 'Ich komme nicht an mein Bestellbuch. Typisch.' : 'I cannot reach my order book. Typical.';
                    });
                } },
            { re: /(what time|lunch ?time|time is it|wie spät|uhrzeit|wann gibt|wann essen|mittagspause|mittagessen)/i,
                answer: function (m, lang) {
                    var now = clock();
                    var de = lang === 'de';
                    if (now.minutes < 11 * 60 + 30) {
                        return de ? 'Es ist ' + now.text + '. Zu früh fürs Mittagessen. Dein Magen sieht das anders, oder?'
                            : 'It is ' + now.text + '. Too early for lunch. Your stomach disagrees, right?';
                    }
                    if (now.minutes < 14 * 60) {
                        return de ? 'Es ist ' + now.text + '. Mittagszeit! Was machst du noch hier?'
                            : 'It is ' + now.text + '. Lunch time! What are you still doing here?';
                    }
                    if (now.minutes < 18 * 60) {
                        return de ? 'Es ist ' + now.text + '. Mittag ist vorbei. Snackzeit.' : 'It is ' + now.text + '. Lunch is over. Snack time.';
                    }
                    return de ? 'Es ist ' + now.text + '. Die Küche hat zu. Der Kühlschrank nicht.'
                        : 'It is ' + now.text + '. The kitchen is closed. The fridge is not.';
                } },
            { re: /(pineapple|ananas|hawaii)/i,
                en: ['We do not talk about pineapple in this kitchen.'],
                de: ['Über Ananas reden wir in dieser Küche nicht.'] },
            { re: /(hungry|hunger|starving|kohldampf)/i,
                en: ['Then order something: ORDER <place> in the command line, or ask me what is open.', 'Hunger is the best cook. I am the second best.'],
                de: ['Dann bestell was: ORDER <Ort> in der Kommandozeile, oder frag mich, was offen ist.', 'Hunger ist der beste Koch. Ich bin der zweitbeste.'] },
            { re: /pizza/i,
                en: ['Pizza is always the right answer. Except with pineapple.', 'Margherita, salami or something with far too much cheese? Good choice either way.'],
                de: ['Pizza ist immer die richtige Antwort. Außer mit Ananas.', 'Margherita, Salami oder was mit viel zu viel Käse? Gute Wahl, so oder so.'] },
            { re: /(pasta|spaghetti|nudel|lasagne|carbonara|penne)/i,
                en: ['Pasta! Al dente, please. Spaghetti code is the only kind I do not serve.'],
                de: ['Pasta! Bitte al dente. Spaghetti-Code ist das Einzige, was ich nicht serviere.'] },
            { re: /sushi/i,
                en: ['Sushi. Fancy. Do not forget the ginger.'],
                de: ['Sushi. Schick. Den Ingwer nicht vergessen.'] },
            { re: /burger/i,
                en: ['A burger. Double patty, I hope. Napkins are on the left.'],
                de: ['Ein Burger. Hoffentlich doppelt. Servietten liegen links.'] },
            { re: /(döner|doener|kebab|kebap|dürüm|durum)/i,
                en: ['With everything and extra sauce? Respect.'],
                de: ['Mit alles und scharf? Respekt.'] },
            { re: /(salad|salat)/i,
                en: ['A salad. Bold. Is everything all right with you?'],
                de: ['Ein Salat. Mutig. Ist alles in Ordnung bei dir?'] },
            { re: /(vegan|vegetar|veggie|tofu)/i,
                en: ['Vegetables are welcome here. Even the green ones.'],
                de: ['Gemüse ist hier willkommen. Sogar das grüne.'] },
            { re: /(coffee|kaffee|espresso|cappuccino|latte)/i,
                en: ['Coffee is not a meal. But I understand you.', 'Try MAKE COFFEE in the command line. I warned you.'],
                de: ['Kaffee ist keine Mahlzeit. Aber ich verstehe dich.', 'Probier mal MAKE COFFEE in der Kommandozeile. Ich hab dich gewarnt.'] },
            { re: /(beer|bier|wein|wine)/i,
                en: ['After work. The kitchen has rules.'],
                de: ['Nach Feierabend. Die Küche hat Regeln.'] },
            { re: /(dessert|cake|kuchen|ice cream|tiramisu|nachtisch|schokolade|chocolate|eis$|eis\b)/i,
                en: ['There is always room for dessert. That is science.'],
                de: ['Für Nachtisch ist immer Platz. Das ist Wissenschaft.'] },
            { re: /(fries|pommes)/i,
                en: ['Fries go with everything. Even with fries.'],
                de: ['Pommes passen zu allem. Sogar zu Pommes.'] },
            { re: /(soup|suppe)/i,
                en: ['Soup is just a drinkable meal. I respect that.'],
                de: ['Suppe ist ein trinkbares Essen. Respekt.'] },
            { re: /(\bpay\b|\bowe\b|money|geld|bezahl|zahlen|schulde|paypal|wero)/i,
                en: ['Money talk? Type OWE in the command line to see what you still owe.'],
                de: ['Geld? Tipp OWE in die Kommandozeile, dann siehst du, was du noch schuldest.'] },
            { re: /(joke|witz|funny|lustig)/i,
                answer: function (m, lang) {
                    return pick(JOKES[lang]);
                } },
            { re: /(recipe|rezept|how do (i|you) cook|kochen)/i,
                en: ['My secret recipe: order early, eat warm.'],
                de: ['Mein Geheimrezept: früh bestellen, warm essen.'] },
            { re: /(weather|wetter|rain|regen|sonne|sunny)/i,
                en: ['In here it is 450 degrees, every single day.'],
                de: ['Hier drin hat es jeden Tag 450 Grad.'] },
            { re: /(\bbug\b|error|fehler|kaputt|broken|absturz|crash)/i,
                en: ['That is not a bug, that is the special of the day.'],
                de: ['Das ist kein Bug, das ist das Tagesgericht.'] },
            { re: /(monday|montag)/i,
                en: ['Mondays need pizza. Science again.'],
                de: ['Montage brauchen Pizza. Wieder Wissenschaft.'] },
            { re: /(friday|freitag)/i,
                en: ['Friday! The best day to order too much.'],
                de: ['Freitag! Der beste Tag, um zu viel zu bestellen.'] },
            { re: /sudo/i,
                en: ['Nice try. Not even the chef has sudo here.'],
                de: ['Netter Versuch. Nicht mal der Chef hat hier sudo.'] },
            { re: /(symbolics|easter ?egg|osterei)/i,
                en: ['Shh. We do not talk about the easter egg. You are standing in it.'],
                de: ['Pssst. Über das Easter Egg reden wir nicht. Du stehst mittendrin.'] },
            { re: /(danke|thanks|thank you|\bthx\b|merci)/i,
                en: ['You are welcome. Tips are appreciated.'],
                de: ['Gern geschehen. Trinkgeld wird gern genommen.'] },
            { re: /(i love|ich liebe) (.+)/i,
                en: ['Who does not love {2}?', 'I love you too. But I love pizza a little more.'],
                de: ['Wer liebt {2} nicht?', 'Ich dich auch. Aber Pizza ein bisschen mehr.'] },
            { re: /\bi(?:'m| am) (.+)/i,
                en: ['Why are you {1}?', 'How long have you been {1}?', 'Would you still be {1} after a good lunch?'] },
            { re: /(?:^|\s)ich bin (.+)/i,
                de: ['Warum bist du {1}?', 'Seit wann bist du {1}?', 'Wärst du nach einem guten Mittagessen immer noch {1}?'] },
            { re: /\bi (?:want|need|would like) (.+)/i,
                en: ['What would it mean to you if you got {1}?', 'Then order {1}. I will wait.'] },
            { re: /(?:^|\s)ich (?:will|möchte|moechte|brauche|hätte gern|hätte gerne) (.+)/i,
                de: ['Dann bestell doch {1}. Ich warte.', 'Und was würde {1} für dich ändern?'] },
            { re: /(because|weil)/i,
                en: ['Is that the real reason?'],
                de: ['Ist das der wahre Grund?'] },
            { re: /^(yes|yeah|yep|sure|ja|jo|jep|klar|genau)\b/i,
                en: ['You seem very sure.'],
                de: ['Du klingst sehr sicher.'] },
            { re: /^(no|nope|nein|nö|ne)\b/i,
                en: ['Why not?'],
                de: ['Warum nicht?'] },
            { re: /\?\s*$/,
                en: ['Why do you ask?', 'Good question. Ask me again after lunch.', 'What do you think?'],
                de: ['Warum fragst du?', 'Gute Frage. Frag mich nach dem Mittagessen nochmal.', 'Was denkst du denn?'] },
            { re: /[\s\S]/,
                en: ['Tell me more.', 'Interesting. Have you eaten today?', 'And what does your stomach say about that?', 'I see. Pizza helps with that, too.'],
                de: ['Erzähl mir mehr.', 'Interessant. Hast du heute schon gegessen?', 'Und was sagt dein Magen dazu?', 'Verstehe. Da hilft übrigens auch Pizza.'] }
        ];

        function fill(template, m, lang, name) {
            return template.replace(/\{name\}/g, name).replace(/\{(\d)\}/g, function (all, n) {
                return m[Number(n)] ? reflect(m[Number(n)], lang) : '';
            });
        }

        return {
            greeting: function (name) {
                return language === 'de'
                    ? 'Willkommen in der Küche, ' + name + '. Was darf es sein? (Hier liest niemand mit, ich bin ein Bot.)'
                    : 'Welcome to the kitchen, ' + name + '. What can I get you? (Nobody else reads this, I am a bot.)';
            },
            // { text: string or Promise, bye }
            reply: function (text, name) {
                var lang = detect(text);
                for (var i = 0; i < RULES.length; i++) {
                    var rule = RULES[i];
                    var answers = rule[lang];
                    if (!rule.answer && !answers) {
                        continue; // this rule speaks only the other language
                    }
                    var m = rule.re.exec(text);
                    if (m) {
                        return { text: rule.answer ? rule.answer(m, lang, name) : fill(pick(answers), m, lang, name), bye: !!rule.bye };
                    }
                }
                return { text: '...' };
            }
        };
    })();

    function displayName() {
        if (lunch.me) {
            return lunch.me;
        }
        var name = sh.userName();
        return name === 'GUEST' ? 'guest' : name.charAt(0) + name.substring(1).toLowerCase();
    }

    function openKitchen() {
        var name = displayName();
        var count = 0;
        var view = openRoom({
            name: '#kitchen',
            me: function () {
                return name;
            },
            topic: function () {
                return '#kitchen · the kitchen bot · runs in your browser, nobody else reads this';
            },
            nicks: function () {
                return ['kitchen', name];
            },
            send: function (text) {
                say(name, text);
                answer(text);
            },
            command: function (cmd, arg, v) {
                if (cmd === 'who' || cmd === 'names') {
                    v.system('Online: kitchen, ' + name);
                } else if (cmd === 'join') {
                    var channel = arg.replace(/^#/, '').toLowerCase();
                    if (channel === 'lunch') {
                        v.close();
                        window.setTimeout(openLunch, 50);
                    } else {
                        v.system(channel === 'kitchen' || !channel ? 'You are already in #kitchen.' : '#' + channel + ': no such channel. There are #lunch and #kitchen.');
                    }
                } else {
                    return false;
                }
                return true;
            }
        });
        if (!view) {
            return;
        }

        function say(author, text) {
            view.add([{ id: --count, author: author, text: text, time: Date.now() }]);
        }

        function answer(text) {
            var reply = kitchen.reply(text, name);
            view.topic('kitchen is typing...');
            Promise.resolve(reply.text).then(function (words) {
                sh.later(function () {
                    if (!view.open()) {
                        return;
                    }
                    say('kitchen', words);
                    view.topic();
                    if (reply.bye) {
                        sh.later(view.close, 1500);
                    }
                }, 500 + Math.random() * 900);
            });
        }

        view.topic('kitchen is typing...');
        sh.later(function () {
            if (view.open()) {
                say('kitchen', kitchen.greeting(name));
                view.topic();
            }
        }, 600);
    }

    // ── The commands ──

    sh.define(['CHAT', 'IRC', 'IRSSI'], {
        args: true, rank: 47,
        synopsis: 'CHAT', summary: 'open #lunch, the chat for everyone who is logged in',
        help: ['CHAT, WALL <TEXT>, WHO', 'THE #LUNCH CHAT FOR EVERYONE'],
        man: [
            'Opens #lunch full screen, in the style of an IRC client. Everyone who is',
            'logged in can read and write; messages are kept for 30 days.',
            'In the chat: /me <action>, /who, /clear, /join #kitchen (the bot),',
            '/help, /quit or Esc. Tab completes names, Up/Down recall your lines.',
            'New messages show at the right end of the command line; a click there',
            'opens the chat, too.'
        ],
        run: function (arg) {
            if (/kitchen/i.test(arg)) {
                openKitchen();
            } else {
                openLunch();
            }
        }
    });

    sh.define('WALL', {
        args: true,
        synopsis: 'WALL <TEXT>  |  <COMMAND> | WALL', summary: 'write a message to #lunch without opening it',
        man: ['Sends the text to #lunch. After a pipe it sends what the command printed:', 'FORTUNE | WALL.'],
        run: function (arg, stdin, word, out) {
            var text = clean(stdin ? stdin.join(' ') : arg);
            if (!text) {
                out.print('USAGE: WALL <TEXT>', 'info');
                return null;
            }
            return send(text).then(function () {
                out.print('BROADCAST MESSAGE SENT TO #LUNCH.', 'ok');
            }, function (err) {
                out.print('WALL: ' + problem(err), 'err');
            });
        }
    });

    sh.define(['WHO', 'W', 'USERS'], {
        args: true,
        synopsis: 'WHO', summary: 'show who has the command line open right now',
        man: ['Lists everyone whose command line asked the server for chat messages in', 'the last 90 seconds, and how long ago they last wrote in #lunch.'],
        run: function (arg, stdin, word, out) {
            return poll().then(function () {
                var me = (lunch.me || '').toLowerCase();
                out.print(padEnd('NAME', 16) + ' ' + padEnd('LINE', 8) + ' IDLE', 'info');
                (lunch.online || []).forEach(function (presence, i) {
                    var idle = presence.idleSeconds < 60 ? '.' : presence.idleSeconds < 3600
                        ? Math.floor(presence.idleSeconds / 60) + 'm' : Math.floor(presence.idleSeconds / 3600) + 'h';
                    out.print(padEnd(presence.name, 16) + ' ' + padEnd('pts/' + i, 8) + ' ' + padEnd(idle, 5)
                        + (presence.name.toLowerCase() === me ? ' (YOU)' : ''), 'ok');
                });
            }, function (err) {
                out.print('WHO: ' + problem(err), 'err');
            });
        }
    });

    sh.define(['TALK', 'ELIZA'], {
        args: true, rank: 48,
        synopsis: 'TALK [KITCHEN]', summary: 'chat with the kitchen, a bot',
        help: ['TALK', 'CHAT WITH THE KITCHEN (A BOT)'],
        man: [
            'Opens #kitchen, a chat with the kitchen: a little bot that runs only in',
            'this browser (nobody else reads it). It answers in German or English,',
            'whichever you write, knows what is open and what time it is, and has',
            'opinions about pineapple. /join #lunch goes to the real chat.'
        ],
        run: function (arg, stdin, word, out) {
            var who = clean(arg).toLowerCase();
            if (who && !/^(kitchen|küche|kueche|chef|bot)$/.test(who) && word.toUpperCase() === 'TALK') {
                out.print('TALK: ' + who.toUpperCase() + ' IS NOT ANSWERING. TRY CHAT, OR TALK KITCHEN.', 'warn');
                return;
            }
            openKitchen();
        }
    });

    // ── Starting and stopping with the Symbolics mode ──

    sh.onNoticeClick(openLunch);

    sh.onStart(function () {
        lunch.error = null;
        tick();
    });

    sh.onStop(function () {
        window.clearTimeout(pollTimer);
        queue.splice(0).forEach(function (item) {
            item.reject(new Error('stopped'));
        });
        room = null;
        lunch.online = null;
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && sh.active()) {
            tick();
        }
    });

    // Read in another tab
    window.addEventListener('storage', function (e) {
        if (e.key === SEEN_KEY) {
            updateNotice();
        }
    });
})();
