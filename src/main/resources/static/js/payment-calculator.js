/*
 * Payment calculator on the dashboard (markup: templates/fragments/payment-calculator.html).
 *
 * Lists every payment made for an order (PayPal, Wero or cash) grouped by order and
 * lets people filter it by "Paid by", payment type, PayPal / Wero link and order date.
 * Archived orders are hidden unless "Include archived orders" is switched on; amounts
 * people still owe for closed orders can be added with "Include amounts not paid yet".
 * Orders or single payments can be unticked, the viewer's own open debts added (to pay
 * them along with the rest), what others still owe the viewer subtracted, and a free
 * adjustment entered. Everything is added up in cents in the
 * browser; nothing is saved on the server. The filters (and the debt switches) are
 * remembered per browser in localStorage, unticked payments only while the page is open.
 *
 * Opens via the "Calculator" button, the shortcut Alt+C (⌥C on a Mac) or the link
 * /orders/dashboard?calculator (the parameter survives both login steps).
 */
(function () {
    'use strict';

    var modalEl = document.getElementById('paymentCalculatorModal');
    if (!modalEl || !window.bootstrap) {
        return;
    }

    var STORAGE_KEY = 'yy-payment-calculator';
    var URL_PARAM = 'calculator';
    var FACETS = ['payee', 'type', 'paypal', 'wero'];
    var TYPES = [
        {key: 'PAYPAL', label: 'PayPal', icon: 'bi-paypal'},
        {key: 'WERO', label: 'Wero', icon: 'bi-phone'},
        {key: 'CASH', label: 'Cash', icon: 'bi-cash-coin'}
    ];
    var UNKNOWN_TYPE = {key: 'NONE', label: 'Not specified', icon: 'bi-question-circle'};
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    var modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    var dataUrl = modalEl.getAttribute('data-url');
    var orderUrl = modalEl.getAttribute('data-order-url');

    var payments = [];
    var debts = [];
    var owed = [];          // what others still owe the viewer
    var loaded = false;
    var loading = false;
    var filters = emptyFilters();
    var debtsOn = false;
    var owedOn = false;
    var excluded = {};      // payment id → true while unticked
    var excludedDebts = {}; // order id → true while unticked
    var excludedOwed = {};  // participation id → true while unticked
    var orderViews = [];    // rendered orders: {head, checkbox, amountEl, rows: [{payment, row, checkbox}]}
    var debtViews = [];     // rendered debts: {debt, row, checkbox}
    var owedViews = [];     // rendered amounts owed to the viewer: {item, row, checkbox}

    function byId(id) {
        return document.getElementById(id);
    }

    // Builds an element; text children are inserted as text, never as HTML
    function el(tag, props, children) {
        var node = document.createElement(tag);
        Object.keys(props || {}).forEach(function (key) {
            if (key.indexOf('-') >= 0) {
                node.setAttribute(key, props[key]);
            } else {
                node[key] = props[key];
            }
        });
        (children || []).forEach(function (child) {
            if (child !== null && child !== undefined) {
                node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
            }
        });
        return node;
    }

    // ── Formatting ──

    // 1250 → "€12.50", -1250 → "−€12.50"; signed adds "+" to positive amounts
    function money(cents, signed) {
        var text = '€' + (Math.abs(cents) / 100).toFixed(2);
        if (cents < 0) {
            return '−' + text;
        }
        return signed && cents > 0 ? '+' + text : text;
    }

    // "2026-11-20" → "20 Nov 2026", like the order tiles
    function formatDate(iso) {
        var parts = (iso || '').split('-');
        if (parts.length !== 3) {
            return iso || '';
        }
        return parts[2] + ' ' + MONTHS[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
    }

    function plural(count, word) {
        return count + ' ' + word + (count === 1 ? '' : 's');
    }

    // "https://www.paypal.me/max/" → "paypal.me/max"
    function shortLink(link) {
        return link.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
    }

    function typeInfo(key) {
        for (var i = 0; i < TYPES.length; i++) {
            if (TYPES[i].key === key) {
                return TYPES[i];
            }
        }
        return UNKNOWN_TYPE;
    }

    function personKey(name) {
        return (name || '').trim().toLowerCase();
    }

    // ── Settings (filters + debt switches), kept per browser ──

    // Archived orders are left out unless "Include archived orders" is switched on
    function emptyFilters() {
        return {payee: {}, type: {}, paypal: {}, wero: {}, from: '', to: '', archived: false, unpaid: false};
    }

    function loadSettings() {
        try {
            var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
            if (!saved) {
                return;
            }
            FACETS.forEach(function (facet) {
                (Array.isArray(saved[facet]) ? saved[facet] : []).forEach(function (key) {
                    filters[facet][key] = true;
                });
            });
            filters.from = typeof saved.from === 'string' ? saved.from : '';
            filters.to = typeof saved.to === 'string' ? saved.to : '';
            filters.archived = saved.archived === true;
            filters.unpaid = saved.unpaid === true;
            debtsOn = saved.debts === true;
            owedOn = saved.owed === true;
        } catch (e) {
            // Blocked storage or broken entry: start without filters
        }
    }

    function saveSettings() {
        var data = {from: filters.from, to: filters.to, archived: filters.archived, unpaid: filters.unpaid, debts: debtsOn, owed: owedOn};
        FACETS.forEach(function (facet) {
            data[facet] = Object.keys(filters[facet]);
        });
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // Private mode: the filters then last until the page is left
        }
    }

    function hasAny(set) {
        return Object.keys(set).length > 0;
    }

    // ── Filtering ──

    function inDateRange(iso) {
        return (!filters.from || iso >= filters.from) && (!filters.to || iso <= filters.to);
    }

    function isArchived(p) {
        return p.status === 'ARCHIVED';
    }

    function archiveOk(p) {
        return filters.archived || !isArchived(p);
    }

    // Amounts not paid yet only count while "Include amounts not paid yet" is on
    function unpaidOk(p) {
        return filters.unpaid || !p.open;
    }

    function inPool(p) {
        return archiveOk(p) && unpaidOk(p);
    }

    function matches(p) {
        return inPool(p) && matchesFilters(p);
    }

    // All filters except the archive switch. No chip selected in a group = no restriction.
    // Link chips work across both link groups: with any link selected, only payments
    // made through a selected link count.
    function matchesFilters(p) {
        if (hasAny(filters.payee) && !filters.payee[p.payeeKey]) {
            return false;
        }
        if (p.open) {
            // Not paid yet, so the payment type is unknown: the type filter doesn't apply,
            // and the link filters match the order's PayPal or Wero link
            if (hasAny(filters.paypal) || hasAny(filters.wero)) {
                var viaOrderLink = (p.paypalLink && filters.paypal[p.paypalLink] === true)
                    || (p.weroLink && filters.wero[p.weroLink] === true);
                if (!viaOrderLink) {
                    return false;
                }
            }
            return inDateRange(p.orderDate);
        }
        if (hasAny(filters.type) && !filters.type[p.typeKey]) {
            return false;
        }
        if (hasAny(filters.paypal) || hasAny(filters.wero)) {
            var viaLink = (p.typeKey === 'PAYPAL' && filters.paypal[p.linkKey] === true)
                || (p.typeKey === 'WERO' && filters.wero[p.linkKey] === true);
            if (!viaLink) {
                return false;
            }
        }
        return inDateRange(p.orderDate);
    }

    // Amounts owed to the viewer: "Paid by" picks the person who owes it
    function owedMatches(o) {
        return (!hasAny(filters.payee) || filters.payee[o.debtorKey] === true) && inDateRange(o.orderDate);
    }

    function debtMatches(d) {
        return (!hasAny(filters.payee) || filters.payee[d.payeeKey] === true) && inDateRange(d.orderDate);
    }

    // ── Filter chips ──

    function payeeOptions(pool, withOwed) {
        var seen = {};
        var options = [];
        function add(name) {
            var key = personKey(name);
            if (key && !seen[key]) {
                seen[key] = true;
                options.push({key: key, label: name.trim()});
            }
        }
        pool.forEach(function (p) { add(p.paidBy); });
        debts.forEach(function (d) { add(d.payee); });
        if (withOwed) {
            owed.forEach(function (o) { add(o.debtor); });
        }
        return options.sort(function (a, b) {
            return a.label.localeCompare(b.label, undefined, {sensitivity: 'base'});
        });
    }

    function typeOptions() {
        var options = TYPES.slice();
        if (payments.some(function (p) { return p.typeKey === UNKNOWN_TYPE.key; })) {
            options.push(UNKNOWN_TYPE);
        }
        return options;
    }

    function linkOptions(type, pool) {
        var seen = {};
        var options = [];
        pool.forEach(function (p) {
            // Paid: the link the payment went through; not paid yet: the order's link
            var key = p.open ? ((type === 'PAYPAL' ? p.paypalLink : p.weroLink) || null)
                : (p.typeKey === type ? p.linkKey : null);
            if (key !== null && !seen[key]) {
                seen[key] = true;
                options.push(key
                    ? {key: key, label: shortLink(key), title: key}
                    : {key: '', label: 'No link', title: 'Paid via ' + typeInfo(type).label + ' on an order without a link'});
            }
        });
        // Links alphabetically, "No link" last
        return options.sort(function (a, b) {
            if (!a.key || !b.key) {
                return a.key ? -1 : (b.key ? 1 : 0);
            }
            return a.label.localeCompare(b.label);
        });
    }

    // Forget remembered chips that no longer exist, so no invisible filter hides payments
    function prune(facet, options) {
        var valid = {};
        options.forEach(function (o) { valid[o.key] = true; });
        Object.keys(filters[facet]).forEach(function (key) {
            if (!valid[key]) {
                delete filters[facet][key];
            }
        });
    }

    function renderFacet(facet, containerId, options) {
        var box = byId(containerId);
        box.textContent = '';
        options.forEach(function (opt, i) {
            var id = 'calc-' + facet + '-' + i;
            var input = el('input', {type: 'checkbox', className: 'btn-check', id: id, autocomplete: 'off'});
            input.checked = filters[facet][opt.key] === true;
            input.addEventListener('change', function () {
                if (input.checked) {
                    filters[facet][opt.key] = true;
                } else {
                    delete filters[facet][opt.key];
                }
                saveSettings();
                renderList();
            });
            var label = el('label', {
                className: 'btn btn-sm btn-outline-secondary calc-chip',
                htmlFor: id,
                title: opt.title || opt.label
            }, [opt.icon ? el('i', {className: 'bi ' + opt.icon + ' me-1'}) : null, opt.label]);
            box.appendChild(input);
            box.appendChild(label);
        });
        if (!options.length) {
            box.appendChild(el('span', {className: 'text-muted small'}, ['–']));
        }
    }

    function facetOptions(pool, withOwed) {
        return {
            payee: payeeOptions(pool, withOwed),
            type: typeOptions(),
            paypal: linkOptions('PAYPAL', pool),
            wero: linkOptions('WERO', pool)
        };
    }

    function renderFilters() {
        // Remembered chips are only forgotten when they no longer exist at all ...
        var all = facetOptions(payments, true);
        FACETS.forEach(function (facet) { prune(facet, all[facet]); });
        saveSettings();

        // ... but only chips from the shown payments are offered (plus any still selected),
        // so archived orders and unpaid amounts don't add chips while they are hidden
        var shown = facetOptions(payments.filter(inPool), owedOn);
        var facets = {};
        FACETS.forEach(function (facet) {
            var offered = {};
            shown[facet].forEach(function (o) { offered[o.key] = true; });
            facets[facet] = all[facet].filter(function (o) {
                return offered[o.key] || filters[facet][o.key] === true;
            });
        });

        renderFacet('payee', 'calcFacetPayee', facets.payee);
        renderFacet('type', 'calcFacetType', facets.type);
        renderFacet('paypal', 'calcFacetPaypal', facets.paypal);
        renderFacet('wero', 'calcFacetWero', facets.wero);

        // Link groups only when there is something to pick
        byId('calcFilterPaypal').classList.toggle('d-none', !facets.paypal.length);
        byId('calcFilterWero').classList.toggle('d-none', !facets.wero.length);
        byId('calcLinkHint').classList.toggle('d-none', !facets.paypal.length && !facets.wero.length);

        byId('calcDateFrom').value = filters.from;
        byId('calcDateTo').value = filters.to;

        // Switches only when there is something to switch on
        byId('calcUnpaidToggle').checked = filters.unpaid;
        byId('calcFilterUnpaid').classList.toggle('d-none', !filters.unpaid && !payments.some(function (p) { return p.open; }));
        byId('calcArchivedToggle').checked = filters.archived;
        byId('calcFilterArchive').classList.toggle('d-none', !filters.archived && !payments.some(isArchived));
    }

    // ── Payments, grouped by order ──

    function setExcluded(payment, off) {
        if (off) {
            excluded[payment.id] = true;
        } else {
            delete excluded[payment.id];
        }
    }

    function openLink(orderId, place) {
        return el('a', {
            href: orderUrl + orderId,
            target: '_blank',
            rel: 'noopener',
            className: 'calc-open',
            title: 'Open order in a new tab',
            'aria-label': 'Open order ' + place + ' in a new tab'
        }, [el('i', {className: 'bi bi-box-arrow-up-right'})]);
    }

    // "PayPal", "Wero", "Cash" — or "Not paid yet" for amounts still owed
    function methodLabel(p) {
        if (p.open) {
            return el('span', {className: 'calc-method calc-unpaid', title: 'Not paid yet: still owes this amount'},
                [el('i', {className: 'bi bi-hourglass-split me-1'}), 'Not paid yet']);
        }
        var type = typeInfo(p.typeKey);
        var via = 'Paid via ' + type.label + (p.typeKey !== 'CASH' && p.linkKey ? ' to ' + shortLink(p.linkKey) : '');
        return el('span', {className: 'calc-method', title: via},
            [el('i', {className: 'bi ' + type.icon + ' me-1'}), type.label]);
    }

    function renderOrder(group) {
        var o = group[0];
        var id = 'calc-order-' + o.orderId;
        var meta = [formatDate(o.orderDate), 'Created by ' + o.owner];
        if (personKey(o.paidBy) !== personKey(o.owner)) {
            meta.push('Paid by ' + o.paidBy);
        }

        var checkbox = el('input', {type: 'checkbox', className: 'form-check-input calc-check', id: id});
        var amountEl = el('span', {className: 'calc-amount fw-semibold'});
        var head = el('div', {className: 'calc-order-head'}, [
            checkbox,
            el('label', {className: 'calc-order-title', htmlFor: id}, [
                el('span', {className: 'fw-semibold'}, [o.place]),
                o.status === 'ARCHIVED'
                    ? el('span', {className: 'order-status-badge badge-archived ms-2'}, ['Archived'])
                    : null,
                el('span', {className: 'calc-meta'}, [meta.join(' · ')])
            ]),
            openLink(o.orderId, o.place),
            amountEl
        ]);

        var view = {head: head, checkbox: checkbox, amountEl: amountEl, rows: []};
        var list = el('ul', {className: 'calc-rows'});
        group.forEach(function (p) {
            var rowId = 'calc-payment-' + p.id;
            var cb = el('input', {type: 'checkbox', className: 'form-check-input calc-check', id: rowId});
            var row = el('li', {className: 'calc-row' + (p.open ? ' calc-row-unpaid' : '')}, [
                cb,
                el('label', {className: 'calc-row-label', htmlFor: rowId}, [
                    el('span', {className: 'calc-name'}, [p.participant]),
                    methodLabel(p)
                ]),
                el('span', {className: 'calc-amount'}, [money(p.amountCents)])
            ]);
            cb.addEventListener('change', function () {
                setExcluded(p, !cb.checked);
                update();
            });
            list.appendChild(row);
            view.rows.push({payment: p, row: row, checkbox: cb});
        });

        // Ticks or unticks every payment of the order (a half-ticked order becomes fully ticked)
        checkbox.addEventListener('change', function () {
            view.rows.forEach(function (r) { setExcluded(r.payment, !checkbox.checked); });
            update();
        });

        orderViews.push(view);
        return el('div', {className: 'calc-order'}, [head, list]);
    }

    // Number of active filters, shown next to "Filter" (useful while the block is collapsed)
    function renderFilterCount() {
        var count = (filters.from ? 1 : 0) + (filters.to ? 1 : 0) + (filters.archived ? 1 : 0) + (filters.unpaid ? 1 : 0);
        FACETS.forEach(function (facet) { count += Object.keys(filters[facet]).length; });
        var badge = byId('calcFilterCount');
        badge.textContent = count;
        badge.classList.toggle('d-none', count === 0);
        badge.title = plural(count, 'active filter');
    }

    function renderList() {
        renderFilterCount();
        var visible = payments.filter(matches);
        var groups = [];
        var byOrder = {};
        visible.forEach(function (p) {
            if (!byOrder[p.orderId]) {
                byOrder[p.orderId] = [];
                groups.push(byOrder[p.orderId]);
            }
            byOrder[p.orderId].push(p);
        });

        var box = byId('calcOrders');
        box.textContent = '';
        orderViews = [];
        groups.forEach(function (group) { box.appendChild(renderOrder(group)); });

        byId('calcEmpty').classList.toggle('d-none', groups.length > 0);
        byId('calcEmpty').textContent = payments.length
            ? 'No payments match these filters.'
            : 'No payments yet.';
        byId('calcSelectAll').disabled = !groups.length;
        byId('calcSelectNone').disabled = !groups.length;
        var hiddenArchived = filters.archived ? 0
            : payments.filter(function (p) { return isArchived(p) && matchesFilters(p); }).length;
        var unpaidCount = visible.filter(function (p) { return p.open; }).length;
        byId('calcMatchInfo').textContent = plural(visible.length - unpaidCount, 'payment')
            + (unpaidCount ? ' + ' + unpaidCount + ' not paid yet' : '')
            + ' in ' + plural(groups.length, 'order')
            + (hiddenArchived ? ' · ' + hiddenArchived + ' from archived orders hidden' : '');

        renderDebts();
        renderOwed();
        update();
    }

    // ── Own open debts ──

    function renderDebts() {
        byId('calcDebtsSection').classList.toggle('d-none', !debts.length);
        byId('calcDebtsToggle').checked = debtsOn;
        byId('calcDebtsPayeeHint').classList.toggle('d-none', !hasAny(filters.payee));

        var visible = debts.filter(debtMatches);
        var list = byId('calcDebtList');
        list.textContent = '';
        debtViews = [];
        visible.forEach(function (d) {
            var id = 'calc-debt-' + d.orderId;
            var cb = el('input', {type: 'checkbox', className: 'form-check-input calc-check', id: id});
            var row = el('li', {className: 'calc-row'}, [
                cb,
                el('label', {className: 'calc-row-label', htmlFor: id}, [
                    el('span', {className: 'calc-name'}, [d.place]),
                    el('span', {className: 'calc-method'}, [formatDate(d.orderDate) + ' · to ' + d.payee])
                ]),
                openLink(d.orderId, d.place),
                el('span', {className: 'calc-amount'}, [money(d.amountCents, true)])
            ]);
            cb.addEventListener('change', function () {
                if (cb.checked) {
                    delete excludedDebts[d.orderId];
                } else {
                    excludedDebts[d.orderId] = true;
                }
                update();
            });
            list.appendChild(row);
            debtViews.push({debt: d, row: row, checkbox: cb});
        });

        list.classList.toggle('d-none', !debtsOn || !visible.length);
        byId('calcDebtsEmpty').classList.toggle('d-none', !debtsOn || visible.length > 0);
    }

    // ── What others still owe me ──

    function renderOwed() {
        byId('calcOwedSection').classList.toggle('d-none', !owed.length);
        byId('calcOwedToggle').checked = owedOn;
        byId('calcOwedPayeeHint').classList.toggle('d-none', !hasAny(filters.payee));

        var visible = owed.filter(owedMatches);
        var list = byId('calcOwedList');
        list.textContent = '';
        owedViews = [];
        visible.forEach(function (o) {
            var id = 'calc-owed-' + o.id;
            var cb = el('input', {type: 'checkbox', className: 'form-check-input calc-check', id: id});
            var row = el('li', {className: 'calc-row'}, [
                cb,
                el('label', {className: 'calc-row-label', htmlFor: id}, [
                    el('span', {className: 'calc-name'}, [o.place]),
                    el('span', {className: 'calc-method'}, [formatDate(o.orderDate) + ' · from ' + o.debtor])
                ]),
                openLink(o.orderId, o.place),
                el('span', {className: 'calc-amount'}, [money(-o.amountCents)])
            ]);
            cb.addEventListener('change', function () {
                if (cb.checked) {
                    delete excludedOwed[o.id];
                } else {
                    excludedOwed[o.id] = true;
                }
                update();
            });
            list.appendChild(row);
            owedViews.push({item: o, row: row, checkbox: cb});
        });

        list.classList.toggle('d-none', !owedOn || !visible.length);
        byId('calcOwedEmpty').classList.toggle('d-none', !owedOn || visible.length > 0);
    }

    // ── Totals ──

    function adjustmentCents() {
        var value = parseFloat(String(byId('calcAdjust').value || '').replace(',', '.'));
        return isFinite(value) ? Math.round(value * 100) : 0;
    }

    function update() {
        var count = 0;
        var paymentsTotal = 0;
        var unpaidCount = 0;
        var unpaidTotal = 0;
        orderViews.forEach(function (view) {
            var included = 0;
            var sum = 0;
            view.rows.forEach(function (r) {
                var on = !excluded[r.payment.id];
                r.checkbox.checked = on;
                r.row.classList.toggle('calc-off', !on);
                if (!on) {
                    return;
                }
                included++;
                sum += r.payment.amountCents;
                if (r.payment.open) {
                    unpaidCount++;
                    unpaidTotal += r.payment.amountCents;
                } else {
                    count++;
                    paymentsTotal += r.payment.amountCents;
                }
            });
            view.checkbox.checked = included === view.rows.length;
            view.checkbox.indeterminate = included > 0 && included < view.rows.length;
            view.head.classList.toggle('calc-off', included === 0);
            view.amountEl.textContent = money(sum);
        });

        var debtCount = 0;
        var debtsTotal = 0;
        debtViews.forEach(function (view) {
            var on = !excludedDebts[view.debt.orderId];
            view.checkbox.checked = on;
            view.row.classList.toggle('calc-off', !on);
            if (debtsOn && on) {
                debtCount++;
                debtsTotal += view.debt.amountCents;
            }
        });

        var owedCount = 0;
        var owedTotal = 0;
        owedViews.forEach(function (view) {
            var on = !excludedOwed[view.item.id];
            view.checkbox.checked = on;
            view.row.classList.toggle('calc-off', !on);
            if (owedOn && on) {
                owedCount++;
                owedTotal += view.item.amountCents;
            }
        });

        var adjustment = adjustmentCents();
        // The viewer's own debts are added (paid along with the rest),
        // what others owe the viewer is subtracted
        var total = paymentsTotal + unpaidTotal + debtsTotal - owedTotal + adjustment;

        byId('calcPaymentCount').textContent = '(' + count + ')';
        byId('calcPaymentsTotal').textContent = money(paymentsTotal);
        byId('calcUnpaidLine').classList.toggle('d-none', !filters.unpaid);
        byId('calcUnpaidCount').textContent = '(' + unpaidCount + ')';
        byId('calcUnpaidTotal').textContent = money(unpaidTotal);
        byId('calcDebtsLine').classList.toggle('d-none', !debtsOn);
        byId('calcDebtCount').textContent = '(' + debtCount + ')';
        byId('calcDebtsTotal').textContent = money(debtsTotal, true);
        byId('calcOwedLine').classList.toggle('d-none', !owedOn);
        byId('calcOwedCount').textContent = '(' + owedCount + ')';
        byId('calcOwedTotal').textContent = money(-owedTotal);
        byId('calcAdjustLine').classList.toggle('d-none', adjustment === 0);
        byId('calcAdjustTotal').textContent = money(adjustment, true);
        byId('calcTotal').textContent = money(total);
        byId('calcTotal').classList.toggle('text-danger', total < 0);
    }

    // ── Loading ──

    function showState(state) {
        byId('calcLoading').classList.toggle('d-none', state !== 'loading');
        byId('calcError').classList.toggle('d-none', state !== 'error');
        byId('calcContent').classList.toggle('d-none', state !== 'content');
    }

    function preparePayment(p) {
        p.payeeKey = personKey(p.paidBy);
        p.typeKey = p.open ? 'OPEN' : (p.method || UNKNOWN_TYPE.key);
        p.linkKey = p.typeKey === 'PAYPAL' ? (p.paypalLink || '')
            : (p.typeKey === 'WERO' ? (p.weroLink || '') : '');
        return p;
    }

    function prepareOwed(o) {
        o.debtorKey = personKey(o.debtor);
        return o;
    }

    function prepareDebt(d) {
        d.payeeKey = personKey(d.payee);
        return d;
    }

    // Fetched every time the dialog opens, so new payments show up; unticked
    // payments stay unticked as long as the page is open.
    function load() {
        if (loading) {
            return;
        }
        loading = true;
        if (!loaded) {
            showState('loading');
        }
        fetch(dataUrl, {credentials: 'same-origin', cache: 'no-store', headers: {Accept: 'application/json'}})
            .then(function (res) {
                var type = res.headers.get('Content-Type') || '';
                // An expired session ends up on the login page (HTML) instead of JSON
                if (!res.ok || type.indexOf('json') < 0) {
                    throw new Error('Unexpected response: ' + res.status);
                }
                return res.json();
            })
            .then(function (data) {
                payments = (data.payments || []).map(preparePayment);
                debts = (data.debts || []).map(prepareDebt);
                owed = (data.owedToMe || []).map(prepareOwed);
                loaded = true;
                renderFilters();
                renderList();
                showState('content');
            })
            .catch(function () {
                showState('error');
            })
            .then(function () {
                loading = false;
            });
    }

    // ── Wiring ──

    loadSettings();

    // On phones the filters would fill the whole screen: start with them collapsed
    if (window.matchMedia && window.matchMedia('(max-width: 575.98px)').matches) {
        byId('calcFilterBody').classList.remove('show');
        byId('calcFilterToggle').setAttribute('aria-expanded', 'false');
    }

    modalEl.addEventListener('show.bs.modal', load);

    byId('calcResetFilters').addEventListener('click', function () {
        filters = emptyFilters();
        saveSettings();
        renderFilters();
        renderList();
    });

    ['calcDateFrom', 'calcDateTo'].forEach(function (id) {
        byId(id).addEventListener('change', function () {
            filters.from = byId('calcDateFrom').value;
            filters.to = byId('calcDateTo').value;
            saveSettings();
            renderList();
        });
    });

    byId('calcSelectAll').addEventListener('click', function () {
        orderViews.forEach(function (view) {
            view.rows.forEach(function (r) { setExcluded(r.payment, false); });
        });
        update();
    });

    byId('calcSelectNone').addEventListener('click', function () {
        orderViews.forEach(function (view) {
            view.rows.forEach(function (r) { setExcluded(r.payment, true); });
        });
        update();
    });

    byId('calcUnpaidToggle').addEventListener('change', function () {
        filters.unpaid = byId('calcUnpaidToggle').checked;
        saveSettings();
        renderFilters();
        renderList();
    });

    byId('calcArchivedToggle').addEventListener('change', function () {
        filters.archived = byId('calcArchivedToggle').checked;
        saveSettings();
        renderFilters();
        renderList();
    });

    byId('calcOwedToggle').addEventListener('change', function () {
        owedOn = byId('calcOwedToggle').checked;
        saveSettings();
        renderFilters(); // the people who owe the viewer become "Paid by" chips
        renderList();
    });

    byId('calcDebtsToggle').addEventListener('change', function () {
        debtsOn = byId('calcDebtsToggle').checked;
        saveSettings();
        renderDebts();
        update();
    });

    byId('calcAdjust').addEventListener('input', update);

    // Shortcut Alt+C (⌥C on a Mac, where e.key is "ç" — hence the check on e.code)
    document.addEventListener('keydown', function (e) {
        if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
        }
        if (e.code !== 'KeyC' && (e.key || '').toLowerCase() !== 'c') {
            return;
        }
        var otherDialog = document.querySelector('.modal.show');
        if (otherDialog && otherDialog !== modalEl) {
            return;
        }
        e.preventDefault();
        modal.show();
    });

    // Link: /orders/dashboard?calculator opens the dialog right away. The parameter
    // is then removed, so reloading the page doesn't open it again.
    (function openFromUrl() {
        var url;
        try {
            url = new URL(window.location.href);
        } catch (e) {
            return;
        }
        if (!url.searchParams.has(URL_PARAM)) {
            return;
        }
        url.searchParams.delete(URL_PARAM);
        if (window.history.replaceState) {
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
        modal.show();
    })();
})();
