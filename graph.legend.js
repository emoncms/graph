// graph.legend.js
// Custom legend rendering and click-to-toggle interaction.
// Imports the Flot plot instance getter from graph.chart.js.
// `path` is an emoncms global set before any scripts run.

import { getPlotInstance } from './graph.chart.js';
import { state } from './graph.state.js';

/**
 * Hook for Flot: rebuild the #legend div from the plot's internal legend table,
 * splitting entries into left-axis and right-axis columns.
 * Pass this as a Flot `hooks.draw` callback.
 * @param {Object} _flot      — Flot plot instance (unused, we use getPlotInstance())
 * @param {jQuery} placeholder
 */
export function buildLegend(_flot, placeholder) {
    const legend = document.getElementById('legend');
    const flotLegend = placeholder[0].nextSibling;
    if (!flotLegend) { legend.innerHTML = ''; return; }

    const rows = Array.from(flotLegend.querySelectorAll('table tbody tr'));
    const left  = rows.filter(r => !r.querySelector('.label-right'));
    const right = rows.filter(r =>  r.querySelector('.label-right'));

    legend.innerHTML = [
        '<div class="grid-container">',
        '  <div class="col left"><ul class="unstyled">', buildRows(left),  '</ul></div>',
        '  <div class="col right"><ul class="unstyled">', buildRows(right), '</ul></div>',
        '</div>'
    ].join('');

    flotLegend.style.display = 'none';

    legend.querySelectorAll('[data-legend-series] a').forEach(link => {
        link.addEventListener('click', onClickLegendLink);
    });
}

/** Toggle a series visible/hidden when its legend link is clicked. */
function onClickLegendLink(event) {
    event.preventDefault();
    const link = event.currentTarget;
    link.classList.toggle('faded');

    const plot = getPlotInstance();
    if (!plot) return;

    const index = Number(link.dataset.index);
    const current = plot.getData();
    const feed = state.feedlist.find(f => f.id == current[index]?.id);
    if (!feed) return;

    const series = current[index];
    const show = !({
        lines:  series.lines?.show,
        bars:   series.bars?.show,
        points: series.points?.show,
        steps:  series.lines?.show,   // steps reuse lines
    }[feed.plottype] ?? true);

    if (feed.plottype === 'lines' || feed.plottype === 'steps') series.lines  = { ...series.lines,  show };
    if (feed.plottype === 'bars')                               series.bars   = { ...series.bars,   show };
    if (feed.plottype === 'points')                             series.points = { ...series.points, show };

    plot.setData(current);
    plot.draw();
}

/** Build <li> markup for one column of legend rows. */
function buildRows(rows) {
    return rows.map(row => {
        const label  = row.querySelector('.legendLabel');
        const span   = label.querySelector('span');
        const index  = span.dataset.index;
        const id     = span.dataset.id;
        const colour = '<div class="legendColorBox">' + row.querySelector('.legendColorBox').innerHTML + '</div>';
        return `<li data-legend-series><a href="${path}graph/${id}" data-index="${index}" data-id="${id}">${colour}${label.innerText}</a></li>`;
    }).join('');
}
