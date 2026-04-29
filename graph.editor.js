// graph.editor.js
// Editor UI: feed-selector sidebar and all view-mode control bindings.
// Only loaded by view.php (not embed.php).

import { state, resetState, calcInterval } from './graph.state.js';
import { fetchFeedList, fetchPublicFeedList } from './graph.api.js';
import {
    graphReload, graphResize, graphDraw, graphDraw as redraw,
    pushfeedlist, datetimepickerInit, initViewWatcher, reloadDatetimePrep,
    getfeed,
} from './graph.chart.js';
import { initFeedControlsApp }  from './graph.feedcontrols.js';
import './graph.histogram.js';
import { initSavedGraphsApp }   from './graph.saved.js';
import { printCsv, csvShowHide } from './graph.csv.js';
import { downloadData }          from './graph.utils.js';

// ---------------------------------------------------------------------------
// Feed selector Vue app
// ---------------------------------------------------------------------------
let feedSelectorApp = null;

function initFeedSelectorApp(feeds, feedlist) {
    // Auto-collapse tag groups when there are many feeds, keeping selected ones open.
    const tagMap = {};
    for (const feed of feeds) {
        const tag = feed.tag || 'undefined';
        if (!tagMap[tag]) tagMap[tag] = [];
        tagMap[tag].push(feed);
    }
    const ntags = Object.keys(tagMap).length;
    const collapsedTags = {};
    if (feeds.length > 12 && ntags > 2) {
        const selectedTags = new Set(feedlist.map(f => f.tag || 'undefined'));
        for (const tag in tagMap) collapsedTags[tag] = !selectedTags.has(tag);
    }

    feedSelectorApp = new Vue({
        el: '#feed-selector-app',
        data: { feeds, feedlist, collapsedTags },
        computed: {
            feedsByTag() {
                const result = {};
                for (const feed of this.feeds) {
                    const tag = feed.tag || 'undefined';
                    if (!result[tag]) result[tag] = [];
                    result[tag].push(feed);
                }
                return result;
            },
            leftChecked()  { return new Set(this.feedlist.filter(f => f.yaxis == 1).map(f => f.id)); },
            rightChecked() { return new Set(this.feedlist.filter(f => f.yaxis == 2).map(f => f.id)); },
        },
        methods: {
            truncateName(name) { return name && name.length > 20 ? name.substr(0, 20) + '..' : name; },
            toggleTag(tag)     { this.$set(this.collapsedTags, tag, !this.collapsedTags[tag]); },
            onFeedTitleClick(feedid) { this.onLeftChange(feedid, !this.leftChecked.has(feedid)); },
            onLeftChange(feedid, checked) {
                let loaded = false;
                for (let z = this.feedlist.length - 1; z >= 0; z--) {
                    if (this.feedlist[z].id == feedid) {
                        if (!checked) { this.feedlist.splice(z, 1); }
                        else          { this.$set(this.feedlist[z], 'yaxis', 1); loaded = true; }
                    }
                }
                if (!loaded && checked) pushfeedlist(feedid, 1);
                graphReload();
            },
            onRightChange(feedid, checked) {
                let loaded = false;
                for (let z = this.feedlist.length - 1; z >= 0; z--) {
                    if (this.feedlist[z].id == feedid) {
                        if (!checked) { this.feedlist.splice(z, 1); }
                        else          { this.$set(this.feedlist[z], 'yaxis', 2); loaded = true; }
                    }
                }
                if (!loaded && checked) pushfeedlist(feedid, 2);
                graphReload();
            },
        },
        template: '#feed-selector-template',
    });
    return feedSelectorApp;
}

/**
 * Expand tag groups that contain a currently-selected feed.
 * Called after loading a saved graph to ensure selected feeds are visible.
 */
export function loadFeedSelector() {
    if (!feedSelectorApp) return;
    for (const feed of state.feedlist) {
        const tag = feed.tag || 'undefined';
        feedSelectorApp.$set(feedSelectorApp.collapsedTags, tag, false);
    }
}

// ---------------------------------------------------------------------------
// Editor init — called once from graph.js on page load
// ---------------------------------------------------------------------------
export function initEditor() {
    // Move sidebar HTML into the live menu, then mount the Vue feed selector.
    $('.menu-l3').html($('#sidebar_html').html());
    $('#sidebar_html').html('');

    feedSelectorApp = initFeedSelectorApp(state.feeds, state.feedlist);
    state.feedlist = feedSelectorApp.feedlist;

    if (menu.width >= 576) menu.show_l3();
    if (menu.obj.setup?.l2?.graph) {
        menu.obj.setup.l2.graph.l3 = [];
        menu.active_l3 = true;
    }

    if (session_write) initSavedGraphsApp();

    $('#info').show();
    if ($('#showmissing')[0]) $('#showmissing')[0].checked = state.showmissing;
    if ($('#showtag')[0])     $('#showtag')[0].checked     = state.showtag;
    if ($('#showlegend')[0])  $('#showlegend')[0].checked  = state.showlegend;

    datetimepickerInit();
    initViewWatcher();
    initFeedControlsApp();

    _bindEditorEvents();
}

// ---------------------------------------------------------------------------
// Editor event bindings (all jQuery handlers in one place)
// ---------------------------------------------------------------------------
function _bindEditorEvents() {

    // ---- Reload / Clear ----

    $('#reload').on('click', function () {
        if (!reloadDatetimePrep()) return;
        state.interval     = $('#request-interval').val();
        state.limitinterval = $('#request-limitinterval')[0].checked ? 1 : 0;
        graphReload();
    });

    $('#clear').on('click', function () {
        feedSelectorApp.feedlist.splice(0);
        state.feedlist = feedSelectorApp.feedlist;
        resetState();

        state.end   = Math.round(Date.now() / 1000) * 1000;
        state.start = state.end - 3600000 * 24 * 7;
        calcInterval();
        graphReload();
    });

    // ---- Display toggles ----

    $('#showmissing').on('click', function () { state.showmissing = this.checked; graphDraw(); });
    $('#showlegend').on('click',  function () { state.showlegend  = this.checked; graphDraw(); });
    $('#showtag').on('click',     function () { state.showtag     = this.checked; graphDraw(); });

    // ---- Request type / interval ----

    $('#request-fixinterval').on('click', function () {
        state.fixinterval = this.checked;
        $('#request-interval').prop('disabled', state.fixinterval);
    });

    $('#request-type').val('interval').on('change', function () {
        const mode = $(this).val();
        state.mode = mode;

        if (mode !== 'interval') {
            $('.fixed-interval-options').hide();
            state.fixinterval = true;
        } else {
            $('.fixed-interval-options').show();
            state.fixinterval = false;
        }

        const modeIntervals = { daily: 86400, weekly: 86400 * 7, monthly: 86400 * 30, annual: 86400 * 365 };
        if (modeIntervals[mode]) state.interval = modeIntervals[mode];

        graphReload();
    });

    // ---- Y-axis bounds ----

    $('body').on('change', '#yaxis-min',  function () { state.yaxismin  = $(this).val(); graphDraw(); });
    $('body').on('change', '#yaxis-max',  function () { state.yaxismax  = $(this).val(); graphDraw(); });
    $('body').on('change', '#yaxis-min2', function () { state.yaxismin2 = $(this).val(); graphDraw(); });
    $('body').on('change', '#yaxis-max2', function () { state.yaxismax2 = $(this).val(); graphDraw(); });

    $('body').on('click', '.reset-yaxis', function () {
        $(this).parent().find('input').each(function () {
            $(this).val('auto');
            const key = $(this).attr('id').replace(/-/g, ''); // e.g. "yaxis-min" → "yaxismin"
            state[key] = 'auto';
        });
        graphDraw();
    });

    // ---- CSV ----

    $('#showcsv').on('click', function () { csvShowHide('swap'); });

    $('#csvtimeformat').on('change', function () { state.csvtimeformat = $(this).val(); printCsv(); });
    $('#csvnullvalues').on('change', function () { state.csvnullvalues = $(this).val(); printCsv(); });
    $('#csvheaders').on('change',    function () { state.csvheaders    = $(this).val(); printCsv(); });

    $('#download-csv').on('click', function () { downloadData('graph.csv', $('#csv').val()); });

    $('.csvoptions').hide();

    // ---- Null-value removal ----

    $('.remove-null').on('change', function () {
        state.removeNull = this.checked;
        graphReload();
    });
    $('.remove-null-max-duration').on('change', function () {
        state.removeNullMaxDuration = parseFloat($(this).val()) || 900;
        graphReload();
    });

    // ---- Stats / options toggle ----

    $('.feed-options-show-stats').on('click', function (e) {
        state.showStats = true;
        e.preventDefault(); e.stopPropagation();
    });
    $('.feed-options-show-options').on('click', function (e) {
        state.showStats = false;
        e.preventDefault(); e.stopPropagation();
    });

    // ---- Collapsible feed-options panel ----

    $('.feed-options-header').on('click', function () {
        $(this).closest('.group-card').toggleClass('tables-collapsed');
    });

    // ---- Sidebar mobile open ----

    $(document).on('click', '.alert a.open-sidebar', function (e) {
        if (typeof show_sidebar !== 'undefined') show_sidebar();
        return false;
    });
}
