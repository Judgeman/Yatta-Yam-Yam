/*
 * January only: places the small hint for the year-end review (/wrapped) at the
 * bottom right of the page. The markup is a <template id="yy-wrapped-hint"> from
 * fragments/theme.html, which only renders it in January for logged-in users.
 * The × shrinks the hint to the gift icon; that is remembered per browser and year.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'yy-wrapped-hint-min';

    function readMinimised() {
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function writeMinimised(year) {
        try {
            window.localStorage.setItem(STORAGE_KEY, year);
        } catch (e) { /* only for this page then */ }
    }

    function init() {
        var template = document.getElementById('yy-wrapped-hint');
        if (!template || !template.content || !document.body) return;
        var hint = template.content.firstElementChild.cloneNode(true);
        var year = hint.getAttribute('data-year');
        if (readMinimised() === year) hint.classList.add('is-min');

        hint.querySelector('.wrapped-hint-min').addEventListener('click', function () {
            hint.classList.add('is-min');
            writeMinimised(year);
            hint.querySelector('.wrapped-hint-link').focus();
        });
        document.body.appendChild(hint);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
