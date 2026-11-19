/*
 * While a special look is on (a seasonal look or the Symbolics mode, see theme.js), an
 * (i) button sits at the start of the right-hand group in the menu bar. It opens a
 * Bootstrap modal with a few lines about the occasion: what it is, when the look is
 * shown and how to call the visitors. Pages without a menu bar get no button.
 *
 * The button follows the look: it appears, changes or disappears when data-yy-theme
 * on <html> changes (e.g. typing "symbolics", or a ?theme=... link).
 *
 * Symbolics hides the seasonal looks. So that its users notice them anyway, a small
 * note ("Incoming message") appears on every page while Symbolics is on and the date
 * calls for a seasonal look, with a button that switches to the standard look in place
 * (no reload, like typing "symbolics" again). "Not now" hides the note for the rest of
 * that occasion (localStorage, yy-season-hint-dismissed); the Symbolics info modal keeps
 * the same way back. Styles: css/symbolics.css.
 */
(function () {
    'use strict';

    var root = document.documentElement;
    var PREVIEW_KEY = 'yy-theme-preview';
    var MODAL_ID = 'yy-theme-info';
    var HINT_ID = 'yy-season-hint';
    var DISMISS_KEY = 'yy-season-hint-dismissed';

    var INFO = {
        christmas: {
            emoji: '🎄',
            title: 'Christmas',
            when: 'From the Monday after Totensonntag until 26 December.',
            text: 'In Germany the Christmas decorations traditionally go up after Totensonntag, the last Sunday '
                + 'before Advent. Then it is time for Advent candles, Christmas markets, mulled wine and cookies, '
                + 'all the way to the second day of Christmas on 26 December.',
            tip: 'Santa and his reindeer drop by every few minutes. Can’t wait? Type “hohoho” anywhere '
                + 'outside a text field.'
        },
        easter: {
            emoji: '🐣',
            title: 'Easter',
            when: 'The two weeks before Easter Sunday, up to and including Easter Monday.',
            text: 'Easter falls on the first Sunday after the first full moon of spring, so its date moves between '
                + '22 March and 25 April. Painted eggs, chocolate bunnies and the Easter egg hunt belong to it; '
                + 'Good Friday and Easter Monday are public holidays in Germany.',
            tip: 'The Easter bunny and a chick drop by every few minutes. Type “hoppel” to call them.'
        },
        garlic: {
            emoji: '🧄',
            title: 'Garlic Day',
            when: 'Only on Garlic Day (19 April) and Garlic Lovers Day (6 October).',
            text: 'Two days for everyone who can’t get enough garlic. Both come from the US and celebrate the bulb '
                + 'that seasons kitchens all over the world – and, as everybody knows, keeps vampires away. '
                + 'Who orders the garlic bread?',
            tip: 'A garlic bulb, a bat and a rather unhappy vampire drop by. Type “knoblauch” to call one.'
        },
        halloween: {
            emoji: '🎃',
            title: 'Halloween',
            when: 'The last two weeks of October, up to and including 31 October.',
            text: 'Halloween is the evening before All Saints’ Day (“All Hallows’ Eve”). It goes back to '
                + 'the Celtic festival of Samhain and reached Germany from Ireland by way of the USA: carved '
                + 'pumpkins, costumes and children going from door to door for “trick or treat”.',
            tip: 'A witch, a skeleton, a ghost and a spider drop by every few minutes. Type “spuk” to summon one.'
        },
        muertos: {
            emoji: '🌼',
            title: 'Día de los Muertos',
            when: 'The first week of November, 1 to 7 November.',
            text: 'The Day of the Dead is one of Mexico’s biggest festivals and part of UNESCO’s intangible '
                + 'cultural heritage. Families remember their dead with joy rather than mourning: they build '
                + 'ofrendas (home altars) with candles, photos and favourite food, and the scent of orange '
                + 'cempasúchil marigolds is said to guide the souls home. Sugar skulls (calaveras) and the '
                + 'elegant skeleton lady La Catrina are its best-known symbols.',
            tip: 'Monarch butterflies – said to carry the souls – and La Catrina drop by now and then. '
                + 'Type “calavera” to call them.'
        },
        pizza: {
            emoji: '🍕',
            title: 'Pizza Week',
            when: 'The week around Pizza Day on 9 February, 6 to 12 February.',
            text: 'Pizza Day comes from the US, the pizza itself from Naples, where the art of the pizzaiuolo has '
                + 'been UNESCO intangible cultural heritage since 2017. According to legend, the Margherita was '
                + 'named after Queen Margherita of Italy in 1889. A good week to order pizza together!',
            tip: 'A flying pizza, a dancing slice and a pizzaiolo drop by. Type “pizza” to call one.'
        },
        pelmeni: {
            emoji: '\uD83E\uDD5F',
            title: 'Pelmeni',
            when: 'This look has no season. It only comes by special link, on days worth celebrating.',
            text: 'Today is Triple-T (\u201CTeig-Taschen-Tag\u201D) \u2013 get ready to be surprised!',
            tip: 'Pelmeni and their dumpling friends drop by now and then. Type \u201Cpelmeni\u201D to call them.'
        },
        symbolics: {
            emoji: '🖥️',
            title: 'Symbolics mode',
            when: 'Switched on by you. Type “symbolics” again, or tap the version badge on the release notes '
                + '7 times, to switch it off.',
            text: 'symbolics.com was the very first .com domain ever registered, on 15 March 1985, by the computer '
                + 'maker Symbolics. This mode is a nod to the neon retro look of the site.',
            tip: 'Point at a button or link: the command line at the bottom shows what a click would run.'
        }
    };

    var button = null;

    function currentInfo() {
        var key = root.getAttribute('data-yy-theme');
        return key && INFO.hasOwnProperty(key) ? INFO[key] : null;
    }

    function isPreview() {
        try {
            return window.sessionStorage.getItem(PREVIEW_KEY) === root.getAttribute('data-yy-theme');
        } catch (e) {
            return false;
        }
    }

    // The right-hand group of the menu bar (user badge, Contacts, Archive, ...). Form pages
    // only show the app name; they get a group of their own on the right.
    function menuGroup() {
        var container = document.querySelector('.navbar > .container');
        if (!container) {
            return null;
        }
        var last = container.lastElementChild;
        if (last && last.classList.contains('d-flex')) {
            return last;
        }
        var group = document.createElement('div');
        group.className = 'd-flex align-items-center gap-3';
        container.appendChild(group);
        return group;
    }

    function buildButton() {
        var b = document.createElement('button');
        b.type = 'button';
        b.id = 'yy-theme-info-button';
        b.className = 'btn btn-outline-light btn-sm';
        b.innerHTML = '<i class="bi bi-info-circle" aria-hidden="true"></i>';
        b.addEventListener('click', openInfo);
        return b;
    }

    // ── The note about a seasonal look that Symbolics hides ──

    // The seasonal look the date calls for, while Symbolics is in front of it
    function hiddenSeason() {
        if (root.getAttribute('data-yy-theme') !== 'symbolics' || !window.yyTheme) {
            return null;
        }
        var season = window.yyTheme.season();
        return season && INFO.hasOwnProperty(season) ? season : null;
    }

    // One key per occasion, so "Not now" lasts until the next one (garlic comes twice a year)
    function occasionKey(season) {
        var now = new Date();
        return season + ':' + now.getFullYear() + (season === 'garlic' ? '-' + (now.getMonth() + 1) : '');
    }

    function isDismissed(season) {
        try {
            return window.localStorage.getItem(DISMISS_KEY) === occasionKey(season);
        } catch (e) {
            return false;
        }
    }

    function dismiss(season) {
        try {
            window.localStorage.setItem(DISMISS_KEY, occasionKey(season));
        } catch (e) {
            // Blocked storage: the note comes back on the next page
        }
    }

    // A link to the standard look; with JavaScript it switches in place
    function standardLink(className, text, after) {
        var url = new URL(window.location.href);
        url.searchParams.set('theme', 'default');
        var a = document.createElement('a');
        a.className = className;
        a.href = url.pathname + url.search + url.hash;
        a.textContent = text;
        a.addEventListener('click', function (e) {
            if (window.yyTheme) {
                e.preventDefault();
                window.yyTheme.useStandard();
                if (after) {
                    after();
                }
            }
        });
        return a;
    }

    function syncHint() {
        var season = hiddenSeason();
        var hint = document.getElementById(HINT_ID);
        if (!season || isDismissed(season)) {
            if (hint) {
                hint.parentNode.removeChild(hint);
            }
            return;
        }
        if (hint && hint.getAttribute('data-season') === season) {
            return;
        }
        if (hint) {
            hint.parentNode.removeChild(hint);
        }
        var info = INFO[season];
        hint = document.createElement('div');
        hint.id = HINT_ID;
        hint.className = 'yy-season-hint card shadow';
        hint.setAttribute('role', 'status');
        hint.setAttribute('data-season', season);
        hint.innerHTML = ''
            + '<div class="card-header d-flex align-items-center justify-content-between gap-2">'
            + '<span>Incoming message</span>'
            + '<button type="button" class="btn-close" aria-label="Not now" title="Not now"></button>'
            + '</div>'
            + '<div class="card-body">'
            + '<p class="mb-1 fw-semibold"><span class="me-1" data-field="emoji"></span><span data-field="headline"></span></p>'
            + '<p class="small mb-3" data-field="text"></p>'
            + '<div data-field="action"></div>'
            + '<p class="small text-muted mt-2 mb-0">Type \u201Csymbolics\u201D to come back any time.</p>'
            + '</div>';
        hint.querySelector('[data-field="emoji"]').textContent = info.emoji;
        hint.querySelector('[data-field="headline"]').textContent = info.title + ' in Yatta-Yam-Yam!';
        hint.querySelector('[data-field="text"]').textContent = 'There is a special ' + info.title
            + ' look right now, with a few surprises. Symbolics mode hides it.';
        hint.querySelector('[data-field="action"]').appendChild(
            standardLink('btn btn-primary btn-sm', 'Switch to the standard look'));
        hint.querySelector('.btn-close').addEventListener('click', function () {
            dismiss(season);
            syncHint();
        });
        document.body.appendChild(hint);
    }

    // ── The (i) button ──

    function sync() {
        syncHint();
        var info = currentInfo();
        if (!info) {
            if (button) {
                button.hidden = true;
            }
            var modal = document.getElementById(MODAL_ID);
            if (modal && window.bootstrap) {
                window.bootstrap.Modal.getOrCreateInstance(modal).hide();
            }
            return;
        }
        if (!button) {
            var group = menuGroup();
            if (!group) {
                return;
            }
            button = buildButton();
            group.insertBefore(button, group.firstChild);
        }
        button.hidden = false;
        button.title = 'About the ' + info.title + ' look';
        button.setAttribute('aria-label', button.title);
    }

    function modalElement() {
        var el = document.getElementById(MODAL_ID);
        if (el) {
            return el;
        }
        el = document.createElement('div');
        el.className = 'modal fade';
        el.id = MODAL_ID;
        el.tabIndex = -1;
        el.setAttribute('aria-labelledby', MODAL_ID + '-title');
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = ''
            + '<div class="modal-dialog modal-dialog-centered">'
            + '<div class="modal-content">'
            + '<div class="modal-header">'
            + '<h5 class="modal-title" id="' + MODAL_ID + '-title"><span class="me-2" data-field="emoji"></span><span data-field="title"></span></h5>'
            + '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>'
            + '</div>'
            + '<div class="modal-body">'
            + '<p class="text-muted small mb-2"><i class="bi bi-calendar-event me-1" aria-hidden="true"></i><span data-field="when"></span></p>'
            + '<p class="small mb-2 fw-semibold text-primary" data-field="preview" hidden>'
            + '<i class="bi bi-eye me-1" aria-hidden="true"></i>This is a preview. It ends when you close this tab, '
            + 'or with ?theme=default in the address bar.</p>'
            + '<p data-field="text"></p>'
            + '<p class="small text-muted mb-0"><i class="bi bi-stars me-1" aria-hidden="true"></i><span data-field="tip"></span></p>'
            + '<div class="alert alert-warning small mt-3 mb-0" data-field="season" hidden></div>'
            + '</div>'
            + '<div class="modal-footer">'
            + '<button type="button" class="btn btn-primary" data-bs-dismiss="modal">Got it</button>'
            + '</div>'
            + '</div></div>';
        document.body.appendChild(el);
        return el;
    }

    function openInfo() {
        var info = currentInfo();
        if (!info || !window.bootstrap) {
            return;
        }
        var el = modalElement();
        ['emoji', 'title', 'when', 'text', 'tip'].forEach(function (field) {
            el.querySelector('[data-field="' + field + '"]').textContent = info[field];
        });
        el.querySelector('[data-field="preview"]').hidden = !isPreview();

        // In Symbolics mode: point to the seasonal look it hides
        var season = hiddenSeason();
        var box = el.querySelector('[data-field="season"]');
        box.hidden = !season;
        box.textContent = '';
        if (season) {
            box.appendChild(document.createTextNode(INFO[season].emoji + ' Right now it\u2019s ' + INFO[season].title + '. '));
            box.appendChild(standardLink('alert-link', 'Switch to the standard look to see it.', function () {
                window.bootstrap.Modal.getOrCreateInstance(el).hide();
            }));
        }
        window.bootstrap.Modal.getOrCreateInstance(el).show();
    }

    if (window.MutationObserver) {
        new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-yy-theme'] });
    }
    sync();
})();
