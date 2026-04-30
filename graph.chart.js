// graph.chart.js
// Core chart lifecycle: resize, data load, post-process, draw.
// Also owns the Flot event bindings (zoom/pan/hover/select) and the
// datetimepicker setup that is shared by view.php and embed.php.
//
// Depends on:
//   graph.state.js  — state, calcInterval, snapToBoundary
//   graph.api.js    — fetchFeedData, fetchFeed
//   graph.utils.js  — feedStats, removeNullValues, scaleValues, offsetValues, tooltip
// graph.csv.js is injected via registerCsvPrinter() to avoid a circular import.

import {
    state,
    calcInterval,
    snapToBoundary,
    zoomIn, zoomOut, panLeft, panRight,
} from './graph.state.js';
import { fetchFeedData, fetchFeed } from './graph.api.js';
import {
    feedStats,
    removeNullValues, scaleValues, offsetValues,
    tooltip, parseTimepickerTime,
} from './graph.utils.js';

// ---------------------------------------------------------------------------
// Module-level flags and singletons
// ---------------------------------------------------------------------------

// Set to true by embed.php's init call.
let _embed = false;
export function setEmbed(val) { _embed = val; }

// Callback from graph.csv.js — avoids a circular import.
let _printCsv = null;
export function registerCsvPrinter(fn) { _printCsv = fn; }

// The active Flot plot instance.  Exported via getter so legend.js can call
// setData()/draw() without creating a circular module dependency.
let _plot = null;
export function getPlotInstance() { return _plot; }

// Datetimepicker jQuery plugin instances.
let _picker1 = null;
let _picker2 = null;

// Flot hover state.
let _previousPoint = null;

// Whether a pan/zoom gesture just finished (suppresses a spurious re-trigger).
let _panning = false;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function graphResize() {
    const bound       = document.getElementById('placeholder_bound');
    const placeholder = document.getElementById('placeholder');

    const width  = bound.clientWidth;
    let   height = width * 0.5;
    if (height < 300) height = 300;
    if (_embed)        height = window.innerHeight;

    const top_offset = _embed ? 35 : 0;

    placeholder.style.width  = width + 'px';
    bound.style.height       = (height - top_offset) + 'px';
    placeholder.style.height = (height - top_offset) + 'px';
}

// ---------------------------------------------------------------------------
// Feed lookup helpers
// ---------------------------------------------------------------------------

/** Return the feed object from state.feeds matching id, or false. */
export function getfeed(id) {
    return state.feeds.find(f => f.id == id) ?? false;
}

/** Return the unit string for a feed id, searching state.feeds. */
export function getFeedUnit(id) {
    const feed = state.feeds.find(f => f.id == id);
    return feed ? (feed.unit || '') : '';
}

/**
 * Fetch a single feed's metadata from the server (used when it isn't in
 * state.feeds, e.g. a public/foreign feed).
 * @param {number|string} feedid
 * @returns {Promise<Object|false>}
 */
async function fetchPublicFeed(feedid) {
    return fetchFeed(feedid);
}

/**
 * Add a feed to the feedlist, fetching its metadata if it isn't already
 * in state.feeds.  Now async because the public-feed fallback uses fetch().
 * @param {number|string} feedid
 * @param {number} yaxis — 1 (left) or 2 (right)
 */
export async function pushfeedlist(feedid, yaxis) {
    let f = getfeed(feedid);
    if (f === false) f = await fetchPublicFeed(feedid);
    if (f === false) return;

    const dp = f.value % 1 !== 0 ? 1 : 0;
    state.feedlist.push({
        id: feedid, name: f.name, tag: f.tag,
        yaxis, fill: 0, scale: 1.0, offset: 0.0,
        delta: 0, average: 0, dp, plottype: 'lines',
    });
}

// ---------------------------------------------------------------------------
// Data load
// ---------------------------------------------------------------------------

/** Build the query params object, snap boundaries, then fetch all feed data. */
export async function graphReload() {
    // Snap start/end for non-interval modes; interval mode is snapped inside calcInterval.
    if (state.mode !== 'interval') {
        snapToBoundary();
    } else {
        state.start = Math.floor((state.start * 0.001) / state.interval) * state.interval * 1000;
        state.end   = Math.ceil ((state.end   * 0.001) / state.interval) * state.interval * 1000;
    }

    if (state.feedlist.length === 0) {
        graphResize();
        graphDraw();
        const icon    = '<svg class="icon show_chart"><use xlink:href="#icon-show_chart"></use></svg>';
        const title   = _lang['Select a feed'] + '.';
        const message = _lang['Please select a feed from the Feeds List'];
        $('#error').show().html(
            `<div class="alert alert-info"><a href="#" class="open-sidebar"><strong>${icon}${title}</strong>${message}</a></div>`
        );
        return;
    }

    $('#graph-wrapper').removeClass('empty');
    $('#cloned_toggle').remove();

    const ids      = state.feedlist.map(f => f.id).join(',');
    const averages = state.feedlist.map(f => f.average || 0).join(',');
    const deltas   = state.feedlist.map(f => f.delta   || 0).join(',');
    const interval = state.mode !== 'interval' ? state.mode : state.interval;

    try {
        const response = await fetchFeedData({
            ids, average: averages, delta: deltas,
            start: state.start, end: state.end,
            interval,
            skipmissing:   state.skipmissing,
            limitinterval: state.limitinterval,
            timeformat: 'unix'
        });
        _onFeedDataReceived(response);
        _checkFeedDataForErrors(response);
    } catch (err) {
        const msg = err.message || String(err);
        $('#error').html(
            `<div class="alert alert-danger"><strong>${translations['Request error']}:</strong> ${msg}</div>`
        ).show();
    }
}

function _onFeedDataReceived(response) {
    let valid = false;
    for (const feed of state.feedlist) {
        for (const item of response) {
            if (parseInt(feed.id) === parseInt(item.feedid) && item.data !== undefined) {
                feed.postprocessed = false;
                feed.data = item.data;
            }
            if (!item || !item.data || typeof item.data.success === 'undefined') {
                valid = true;
            }
        }
    }
    if (valid) _processFeedData();
}

function _checkFeedDataForErrors(response) {
    const messages = [];
    const badfeeds = [];

    if (typeof response === 'object' && response.message) {
        if (response.success === false && response.feeds) badfeeds.push(...response.feeds);
        messages.push(response.message);
    } else {
        for (const item of response) {
            if (item.data?.success === false) {
                messages.push(item.data.message);
            }
        }
    }

    if (messages.length === 0) { $('#error').hide(); return; }

    let html = `<div class="alert alert-danger"><strong>${translations['Request error']}:</strong> ${messages.join(', ')}`;
    if (badfeeds.length) {
        html += `<button id="remove_missing" type="button" class="btn">${_('Remove missing')}</button>`;
    }
    html += '</div>';
    $('#error').html(html).show();

    if (badfeeds.length) {
        $('#remove_missing').one('click', () => {
            state.feedlist = state.feedlist.filter(f => !badfeeds.includes(f.id));
            graphReload();
        });
    }
}

// ---------------------------------------------------------------------------
// Post-processing (scale, offset, null removal)
// ---------------------------------------------------------------------------

function _processFeedData() {
    const { removeNull, removeNullMaxDuration, interval } = state;

    for (const feed of state.feedlist) {
        if (feed.postprocessed !== false) continue;
        feed.postprocessed = true;

        if (removeNull) {
            feed.data = removeNullValues(feed.data, interval, removeNullMaxDuration);
        }
        feed.data = scaleValues(feed.data, feed.scale);
        feed.data = offsetValues(feed.data, feed.offset);
    }

    graphDraw();
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

export function graphDraw() {
    const options = {
        lines:  { fill: false },
        xaxis:  {
            mode:       'time',
            timezone:   'browser',
            min:        state.start,
            max:        state.end,
            monthNames: typeof moment !== 'undefined' ? moment.monthsShort() : null,
            dayNames:   typeof moment !== 'undefined' ? moment.weekdaysMin() : null,
        },
        yaxes: [
            {},
            { alignTicksWithAxis: 1, position: 'right' },
        ],
        grid:      { hoverable: true, clickable: true },
        selection: { mode: 'x' },
        legend: {
            show:     state.showlegend,
            position: 'nw',
            toggle:   true,
            labelFormatter(label, item) {
                const cls  = item.isRight ? 'label-right' : 'label-left';
                const title = item.isRight ? 'Right Axis' : 'Left Axis';
                return `<span data-id="${item.id}" data-index="${item.index}" class="${cls}" title="${title}">${label}</span>`;
            },
        },
        toggle: { scale: 'visible' },
        touch:  { pan: 'x', scale: 'x' },
    };

    // Y-axis bounds
    if (state.yaxismin !== 'auto' && state.yaxismin !== '') options.yaxes[0].min = state.yaxismin;
    if (state.yaxismax !== 'auto' && state.yaxismax !== '') options.yaxes[0].max = state.yaxismax;
    if (state.yaxismin2 !== 'auto' && state.yaxismin2 !== '') options.yaxes[1].min = state.yaxismin2;
    if (state.yaxismax2 !== 'auto' && state.yaxismax2 !== '') options.yaxes[1].max = state.yaxismax2;

    // Window info bar
    const windowSecs = (state.end - state.start) / 1000;
    state.time_in_window = windowSecs;
    const hours = Math.floor(windowSecs / 3600);
    const minsRaw = Math.round(((windowSecs / 3600) - hours) * 60);
    const mins = minsRaw > 0 ? (minsRaw < 10 ? '0' + minsRaw : minsRaw) : '';
    if (!_embed) {
        $('#window-info').html(
            `<b>${_lang['Window']}:</b> ${moment(state.start).format('D/MMM/YYYY HH:mm:ss')} <b>\u2192</b> ${moment(state.end).format('D/MMM/YYYY HH:mm:ss')}<br>` +
            `<b>${_lang['Length']}:</b> ${hours}h${mins} (${windowSecs} seconds)`
        );
    }

    // Build plotdata
    const plotdata = [];
    let num_left = 0, num_right = 0;

    for (const feed of state.feedlist) {
        let data = feed.data ?? [];

        if (!state.showmissing) {
            data = data.filter(pt => pt[1] !== null);
        }

        let label = '';
        if (state.showtag) label += feed.tag + ': ';
        label += feed.name;

        const stacked = !!feed.stack;
        const fillVal = feed.fill ? (stacked ? 1.0 : 0.5) : 0;

        const series = {
            label, data,
            yaxis: feed.yaxis,
            color: feed.color,
            stack: stacked,
            isRight: feed.yaxis === 2,
            id:    feed.id,
            index: state.feedlist.indexOf(feed),
        };

        if (feed.plottype === 'lines')  series.lines  = { show: true, fill: fillVal };
        if (feed.plottype === 'bars')   series.bars   = { show: true, fill: fillVal, align: 'center', barWidth: state.interval * 1000 * 0.75 };
        if (feed.plottype === 'points') series.points = { show: true, radius: 3 };
        if (feed.plottype === 'steps')  series.lines  = { show: true, fill: fillVal, steps: true };

        plotdata.push(series);

        if (feed.yaxis === 1) num_left++;
        else if (feed.yaxis === 2) num_right++;
    }

    state.num_left  = num_left;
    state.num_right = num_right;

    _plot = Flot.plot(document.getElementById('placeholder'), plotdata, options);

    if (!_embed) {
        for (const feed of state.feedlist) {
            Vue.set(feed, 'stats', feedStats(feed.data ?? []));
        }
        if (state.showcsv && _printCsv) _printCsv();
    }
}

// ---------------------------------------------------------------------------
// Datetimepicker init
// ---------------------------------------------------------------------------

export function datetimepickerInit() {
    $('#datetimepicker1').datetimepicker({ language: 'en-EN' });
    $('#datetimepicker2').datetimepicker({ language: 'en-EN' });

    // Embed-only: manual time window toggle
    $('.navigation-timewindow').on('click', function () {
        $('#navigation-timemanual').show();
        $('#navigation').hide();
    });
    $('.navigation-timewindow-set').on('click', function () {
        $('#navigation-timemanual').hide();
        $('#navigation').show();
        if (reloadDatetimePrep()) graphReload();
    });

    _picker1 = $('#datetimepicker1').data('datetimepicker');
    _picker2 = $('#datetimepicker2').data('datetimepicker');
}

/**
 * Read the start/end datetimepickers, validate them, and write to state.
 * Returns true on success, false (with an alert) on invalid input.
 */
export function reloadDatetimePrep() {
    const start = parseTimepickerTime($('#request-start').val());
    const end   = parseTimepickerTime($('#request-end').val());
    if (!start) { alert('Please enter a valid start date.'); return false; }
    if (!end)   { alert('Please enter a valid end date.');   return false; }
    if (start >= end) { alert('Start date must be further back in time than end date.'); return false; }
    state.start = start * 1000;
    state.end   = end * 1000;
    return true;
}

// ---------------------------------------------------------------------------
// Vue view-watcher  (syncs state → DOM controls reactively)
// ---------------------------------------------------------------------------

export function initViewWatcher() {
    const watcher = new Vue();

    function syncPickers() {
        if (_picker1) { _picker1.setLocalDate(new Date(state.start)); _picker1.setEndDate(new Date(state.end)); }
        if (_picker2) { _picker2.setLocalDate(new Date(state.end));   _picker2.setStartDate(new Date(state.start)); }
    }

    watcher.$watch(() => state.start,    syncPickers);
    watcher.$watch(() => state.end,      syncPickers);
    watcher.$watch(() => state.interval, val => $('#request-interval').val(val));
    watcher.$watch(() => state.limitinterval, val => {
        const el = document.getElementById('request-limitinterval');
        if (el) el.checked = !!val;
    });

    watcher.$watch(() => state.num_left, n => {
        n > 0 ? $('#yaxis_left').show() : $('#yaxis_left').hide();
    }, { immediate: true });

    watcher.$watch(() => state.num_right, n => {
        n > 0 ? $('#yaxis_right').show() : $('#yaxis_right').hide();
    }, { immediate: true });

    watcher.$watch(() => state.feedlist.length, len => {
        len > 0 ? $('.feed-options').show() : $('.feed-options').hide();
    }, { immediate: true });

    watcher.$watch(() => state.showStats, showStats => {
        if (showStats) {
            $('.feed-options-show-options').removeClass('hide');
            $('.feed-options-show-stats').addClass('hide');
        } else {
            $('.feed-options-show-options').addClass('hide');
            $('.feed-options-show-stats').removeClass('hide');
        }
    }, { immediate: true });
}

// ---------------------------------------------------------------------------
// Flot event bindings  (shared by view.php and embed.php)
// ---------------------------------------------------------------------------

$('#graph_zoomout').on('click', () => { state.floatingtime = 0; zoomOut(); graphReload(); });
$('#graph_zoomin').on('click',  () => { state.floatingtime = 0; zoomIn();  graphReload(); });
$('#graph_right').on('click',   () => { state.floatingtime = 0; panRight(); graphReload(); });
$('#graph_left').on('click',    () => { state.floatingtime = 0; panLeft();  graphReload(); });

$('.graph_time').on('change', function () {
    state.floatingtime = 1;
    const days = Number($(this).val()) / 24.0;
    state.end   = Math.round(Date.now() / 1000) * 1000;
    state.start = state.end - days * 86400 * 1000;
    calcInterval();
    graphReload();
});

$('.graph_time_refresh').on('click', function () {
    state.floatingtime = 1;
    const days = Number($('.graph_time').val()) / 24.0;
    state.end   = Math.round(Date.now() / 1000) * 1000;
    state.start = state.end - days * 86400 * 1000;
    calcInterval();
    graphReload();
});

const _pholder = document.getElementById('placeholder');

_pholder.addEventListener('plotselected', function (event) {
    const [ranges] = event.detail;
    state.floatingtime = 0;
    state.start = ranges.xaxis.from * 1000;
    state.end   = ranges.xaxis.to * 1000;
    calcInterval();
    graphReload();
    _panning = true; setTimeout(() => { _panning = false; }, 100);
});

_pholder.addEventListener('plothover', function (event) {
    const [pos, item] = event.detail;
    if (!item) { document.getElementById('tooltip')?.remove(); return; }
    if (item.datapoint === _previousPoint) return;
    _previousPoint = item.datapoint;

    document.getElementById('tooltip')?.remove();

    const feed    = state.feedlist[item.seriesIndex];
    const feedid  = feed?.id;
    const dp      = feed?.dp ?? 0;
    const isStack = typeof item.datapoint[2] !== 'undefined';
    const raw     = isStack ? item.datapoint[1] - item.datapoint[2] : item.datapoint[1];
    const value   = raw.toFixed(dp) + ' ' + getFeedUnit(feedid);
    const date    = moment(item.datapoint[0]).format('llll');
    const ts      = item.datapoint[0] / 1000;

    tooltip(
        item.pageX, item.pageY,
        `<span style="font-size:11px">${item.series.label}</span><br>${value}<br>` +
        `<span style="font-size:11px">${date}</span><br><span style="font-size:11px">(${ts})</span>`,
        '#fff'
    );
});

let _panZoomTimeout = null;
function _onPanOrZoom(event) {
    const [plot] = event.detail;
    const axes = plot.getAxes();
    state.floatingtime = 0;
    state.start = axes.xaxis.min;
    state.end   = axes.xaxis.max;
    clearTimeout(_panZoomTimeout);
    _panZoomTimeout = setTimeout(() => {
        calcInterval();
        graphReload();
        _panning = true; setTimeout(() => { _panning = false; }, 100);
    }, 300);
}
_pholder.addEventListener('plotpan',  _onPanOrZoom);
_pholder.addEventListener('plotzoom', _onPanOrZoom);

$(document).on('window.resized hidden.sidebar.collapse shown.sidebar.collapse', function () {
    graphResize();
    graphDraw();
});
