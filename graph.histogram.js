// graph.histogram.js
// Histogram visualisation mode.
// Depends on: state (graph.state.js), Flot (global script via Flot.plot).

import { state } from './graph.state.js';
import { graphDraw } from './graph.chart.js';

// ---------------------------------------------------------------------------
// Event bindings — run once when the module is first imported
// ---------------------------------------------------------------------------

$('body').on('click', '.histogram', function () {
    $('#navigation').hide();
    $('#histogram-controls').show();

    const feedid = $(this).attr('feedid');
    state.active_histogram_feed = feedid;

    const index = state.feedlist.findIndex(f => f.id == feedid);
    const type = $('#histogram-type').val();

    let resolution = 1;
    if (index >= 0 && state.feedlist[index].stats) {
        const diff = state.feedlist[index].stats.diff;
        if (diff < 5000) resolution = 10;
        if (diff < 100)  resolution = 0.1;
    }
    $('#histogram-resolution').val(resolution);

    drawHistogram(feedid, type, resolution);
});

$('#histogram-resolution').on('change', function () {
    drawHistogram(
        state.active_histogram_feed,
        $('#histogram-type').val(),
        $(this).val()
    );
});

$('#histogram-type').on('change', function () {
    drawHistogram(
        state.active_histogram_feed,
        $(this).val(),
        $('#histogram-resolution').val()
    );
});

$('#histogram-back').on('click', function () {
    $('#navigation').show();
    $('#histogram-controls').hide();
    graphDraw();
});

// ---------------------------------------------------------------------------
// Histogram rendering
// ---------------------------------------------------------------------------

/**
 * Build and plot a histogram for one feed.
 * @param {number|string} feedid
 * @param {'timeatvalue'|'kwhatpower'} type
 * @param {number} resolution — bucket width in feed units
 */
export function drawHistogram(feedid, type, resolution) {
    const index = state.feedlist.findIndex(f => f.id == feedid);
    if (index === -1) return;

    const data = state.feedlist[index].data;
    const buckets = {};
    let val = 0;

    for (let i = 1; i < data.length; i++) {
        if (data[i][1] !== null) val = data[i][1];
        const key = Math.round(val / resolution) * resolution;
        if (buckets[key] === undefined) buckets[key] = 0;

        const dt = (data[i][0] - data[i - 1][0]) * 0.001; // seconds
        if (type === 'kwhatpower')  buckets[key] += (val * dt) / (3600 * 1000);
        if (type === 'timeatvalue') buckets[key] += dt;
    }

    const plotData = Object.entries(buckets)
        .map(([k, v]) => [Number(k), v])
        .sort((a, b) => a[0] - b[0]);

    let label = state.showtag ? `${state.feedlist[index].tag}: ` : '';
    label += state.feedlist[index].name;

    Flot.plot(document.getElementById('placeholder'), [{ label, data: plotData }], {
        series: { bars: { show: true, barWidth: resolution * 0.8 } },
        grid:   { hoverable: true }
    });
}