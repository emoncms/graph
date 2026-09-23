/*
 All Emoncms code is released under the GNU Affero General Public License.
 See COPYRIGHT.txt and LICENSE.txt.

 ---------------------------------------------------------------------
 Emoncms - open source energy visualisation
 Part of the OpenEnergyMonitor project:
 http://openenergymonitor.org
*/

/*
 A graph drawn into an element, with no framework.

 The graph page runs a Vue component, graph.core.js, which carries the editor,
 the saved graph list, the stats table and the CSV export. A dashboard needs
 none of that and loads no framework, so this is the second reader of the same
 core. Both call graph.lib.js for the state, the feed parameters, the flot
 options and the series.

   const chart = new GraphChart();
   chart.render(element, config);
   chart.setWindow(startMs, endMs);
   chart.destroy();

 The config is a saved graph payload, or the same fields with the graph level
 settings under a state key, which is the form the dashboard document holds:

   { start, end, state: { mode, showlegend, ... }, feedlist: [ ... ] }

 It owns the window, the fetch and the flot call. A dashboard wide window is
 the reason setWindow is separate from render: the window comes from outside,
 and onWindowChange reports a pan or a zoom back out.

 Needs graph.lib.js, flot, and the path global.
*/

(function () {
	'use strict';

	const GH = window.GraphHelpers;
	if (!GH) return;

	const DAY_MS = 86400000;
	const REDRAW_DELAY = 150;
	const PAN_ZOOM_DELAY = 250;

	// How many datapoints to ask for, as a share of the width of the box. Two
	// per pixel, because power data is spiky and one sample per pixel loses the
	// peaks between samples. The multigraph this replaces asked for 2400
	// whatever size it was drawn at, which is about four per pixel on a box of
	// the usual width. The bounds keep a box that is very small or very wide
	// sensible, and a box with no width yet, one in a panel that has not opened,
	// falls back to the number the graph page uses.
	const POINTS_PER_PIXEL = 2;
	const POINTS_MIN = 300;
	const POINTS_MAX = 2000;
	const POINTS_DEFAULT = 600;
	// How much the box has to change size by before the data is read again
	// rather than redrawn from what is already here.
	const POINTS_REFETCH = 1.25;

	// The line around the plot area. A shade darker than the grid lines, so it
	// reads as the edge of the chart rather than as one more grid line.
	const GRID_BORDER = '#ccc';

	const apiPath = () => (typeof window.path === 'string' ? window.path : '');

	// The shortest interval the feeds can be read at, set by the graph page.
	// Ten seconds matches what the page falls back to.
	const minFeedInterval = () =>
		isFinite(window.min_feed_interval) ? window.min_feed_interval : 10;

	// A config either nests the graph level settings under state, which is what
	// a dashboard widget holds, or carries them flat like a saved graph.
	const flattenConfig = config => {
		const source = config && typeof config === 'object' ? config : {};
		const { state, ...rest } = source;
		return { ...rest, ...(state && typeof state === 'object' ? state : {}) };
	};

	// One tooltip is on the page at a time, whichever chart drew it. Held here
	// rather than per chart, so moving the pointer from one chart to another
	// takes the first one with it.
	let tooltip = null;

	const dropTooltip = () => {
		if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
		tooltip = null;
	};

	// One line of a tooltip. Built as text so a feed name never reaches the
	// page as markup.
	const tooltipLine = (text, size) => {
		const line = document.createElement('div');
		if (size) line.style.fontSize = `${size}px`;
		line.textContent = text;
		return line;
	};

	class GraphChart {
		constructor() {
			this.element = null;
			this.state = null;
			this.plot = null;
			this.startMs = 0;
			this.endMs = 0;
			this.hiddenIds = new Set();

			// Called with (startMs, endMs) after a pan, a zoom or a selection.
			this.onWindowChange = null;
			// Called with an Error when the fetch fails.
			this.onError = null;
			// Called after each draw, for a caller holding anything of its own
			// over the chart.
			this.onDraw = null;

			this._controller = null;
			this._observer = null;
			this._redrawTimeout = 0;
			this._panZoomTimeout = 0;
			this._width = 0;
			this._height = 0;
			this._points = 0;
			this._hovered = null;
		}

		/* ── Public ──────────────────────────────────────────────────────── */

		render(element, config) {
			if (!element) return;
			if (this.element && this.element !== element) this.destroy();

			this.element = element;
			this.applyConfig(config);
			this.bindEvents();
			this.observeResize();
			this.fetch();
		}

		setWindow(startMs, endMs, floating) {
			if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) return;
			this.startMs = startMs;
			this.endMs = endMs;
			if (floating !== undefined) this.state.floatingtime = floating ? 1 : 0;
			this.calcInterval();
			this.fetch();
		}

		// The window as it stands, for a caller holding several charts.
		getWindow() {
			return { startMs: this.startMs, endMs: this.endMs };
		}

		// Fetch again. A floating window moves up to now first, which is what
		// keeps a dashboard showing recent data.
		refresh() {
			if (this.state && this.state.floatingtime) {
				const now = Math.round(Date.now() / 1000) * 1000;
				const length = this.endMs - this.startMs;
				this.startMs = now - length;
				this.endMs = now;
				this.calcInterval();
			}
			this.fetch();
		}

		// Show or hide the legend. The data is already here, so the chart is
		// redrawn rather than read again.
		setLegend(show) {
			if (!this.state) return;
			this.state.showlegend = !!show;
			this.draw();
		}

		destroy() {
			if (this._controller) this._controller.abort();
			this._controller = null;

			clearTimeout(this._redrawTimeout);
			clearTimeout(this._panZoomTimeout);

			if (this._observer) this._observer.disconnect();
			this._observer = null;

			this.unbindEvents();

			if (this.plot && typeof this.plot.shutdown === 'function') this.plot.shutdown();
			this.plot = null;

			if (this.element) this.element.innerHTML = '';
			this.element = null;
		}

		/* ── Config ──────────────────────────────────────────────────────── */

		applyConfig(config) {
			const flat = flattenConfig(config);

			this.state = GH.createDefaultGraphState();
			GH.applyGraphState(this.state, flat);
			// Fill nulls is a view setting on the graph page and not part of the
			// state schema, so it is read here. A dashboard holds it as 1 or 0.
			if (flat.removeNull !== undefined) this.state.removeNull = !!Number(flat.removeNull);
			if (flat.removeNullMaxDuration !== undefined) {
				const max = parseFloat(flat.removeNullMaxDuration);
				if (isFinite(max) && max > 0) this.state.removeNullMaxDuration = String(max);
			}
			this.state.feedlist = (Array.isArray(flat.feedlist) ? flat.feedlist : [])
				.map(GH.buildStateFeedFromSaved);

			// Delta needs the gaps left in, the same rule the graph page applies
			// when it loads a saved graph.
			if (this.state.feedlist.some(feed => Number(feed.delta))) this.state.showmissing = true;

			this.hiddenIds.clear();
			this.applyWindow(flat);
			this.calcInterval();
		}

		applyWindow(flat) {
			let start = Number(flat.start);
			let end = Number(flat.end);
			const now = Math.round(Date.now() / 1000) * 1000;

			if (!isFinite(start) || !isFinite(end) || start >= end) {
				end = now;
				start = end - DAY_MS;
			} else if (this.state.floatingtime) {
				// A floating window is stored as a length. Anchor it to now on
				// load so the chart shows recent data.
				start = now - (end - start);
				end = now;
			}

			this.startMs = start;
			this.endMs = end;
		}

		calcInterval() {
			this._points = this.targetPoints();
			if (this.state.mode !== 'interval' || this.state.fixinterval) return;
			this.state.interval = String(GH.pickIntervalForWindow(
				this.startMs, this.endMs, minFeedInterval(), this._points));
		}

		// The number of datapoints this box is worth.
		targetPoints() {
			const width = this.element ? this.element.clientWidth : 0;
			if (!width) return POINTS_DEFAULT;
			return Math.min(POINTS_MAX, Math.max(POINTS_MIN, Math.round(width * POINTS_PER_PIXEL)));
		}

		/* ── Data ────────────────────────────────────────────────────────── */

		fetch() {
			if (!this.element || !this.state) return;

			if (this._controller) this._controller.abort();

			if (!this.state.feedlist.length) {
				this._controller = null;
				this.draw();
				return;
			}

			const params = GH.buildFeedDataParams(this.state.feedlist, this.startMs, this.endMs, this.state);
			if (window.apikey) params.set('apikey', window.apikey);

			const controller = new AbortController();
			this._controller = controller;

			window.fetch(`${apiPath()}feed/data.json?${params}`, { signal: controller.signal })
				.then(response => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.json();
				})
				.then(response => {
					// A later window may have been asked for while this was in
					// flight, in which case its answer is the one to draw.
					if (this._controller !== controller) return;
					this._controller = null;
					this.applyFeedData(response);
					this.draw();
				})
				.catch(err => {
					if (err && err.name === 'AbortError') return;
					if (this._controller === controller) this._controller = null;
					if (typeof this.onError === 'function') this.onError(err);
					else console.warn('Graph chart update failed:', err);
				});
		}

		applyFeedData(response) {
			const byId = {};
			if (Array.isArray(response)) {
				for (const item of response) {
					if (item) byId[String(item.feedid)] = Array.isArray(item.data) ? item.data : [];
				}
			}
			for (const feed of this.state.feedlist) {
				feed.data = byId[String(feed.id)] || [];
			}
		}

		/* ── Drawing ─────────────────────────────────────────────────────── */

		draw() {
			if (!this.element || !this.state) return;
			if (!window.Flot || typeof window.Flot.plot !== 'function') return;
			if (!this.element.clientWidth || !this.element.clientHeight) return;

			const options = GH.buildFlotOptions(this.startMs, this.endMs, this.state);
			// A chart on a dashboard sits straight on the page with nothing
			// around it, so the plot area is given a light border to bound it.
			options.grid.borderWidth = 1;
			options.grid.borderColor = GRID_BORDER;
			// A dashboard may give the chart an axis colour, for a box that is
			// not white. Set by the widget, see graph_render.js.
			if (this.axisColor) {
				const font = { color: this.axisColor, fill: this.axisColor };
				options.xaxis.font = font;
				for (const axis of options.yaxes) axis.font = font;
				options.grid.color = this.axisColor;
				options.grid.borderColor = this.axisColor;
			}
			const data = GH.buildPlotData(this.state.feedlist, this.state, this.startMs, this.endMs, this.hiddenIds);

			this.plot = window.Flot.plot(this.element, data, options);
			this._width = this.element.clientWidth;
			this._height = this.element.clientHeight;

			if (typeof this.onDraw === 'function') this.onDraw();
		}

		// Where the plot area sits inside the element, in pixels from each
		// edge. What is outside it is the axis labels. A caller drawing over
		// the chart reads this to keep off them.
		plotOffset() {
			if (!this.plot || typeof this.plot.getPlotOffset !== 'function') return null;
			return this.plot.getPlotOffset();
		}

		/* ── Events ──────────────────────────────────────────────────────── */

		bindEvents() {
			this.unbindEvents();

			this._onPlotSelected = event => {
				const ranges = event.detail && event.detail[0];
				if (!ranges || !ranges.xaxis) return;
				this.windowFromPlot(GH.toMsFromPlotValue(ranges.xaxis.from), GH.toMsFromPlotValue(ranges.xaxis.to), 0);
			};

			this._onPlotPanOrZoom = event => {
				const plot = event.detail && event.detail[0];
				if (!plot || typeof plot.getAxes !== 'function') return;
				const xaxis = plot.getAxes().xaxis;
				if (!xaxis) return;
				this.windowFromPlot(GH.toMsFromPlotValue(xaxis.min), GH.toMsFromPlotValue(xaxis.max), PAN_ZOOM_DELAY);
			};

			// A touch device fires no plothover, but a tap fires plotclick, so
			// the same tooltip is shown either way.
			this._onPlotHover = event => this.showTooltip(event.detail && event.detail[1]);
			this._onPlotClick = event => this.showTooltip(event.detail && event.detail[1]);

			this.element.addEventListener('plotselected', this._onPlotSelected);
			this.element.addEventListener('plotpan', this._onPlotPanOrZoom);
			this.element.addEventListener('plotzoom', this._onPlotPanOrZoom);
			this.element.addEventListener('plothover', this._onPlotHover);
			this.element.addEventListener('plotclick', this._onPlotClick);
		}

		unbindEvents() {
			if (!this.element || !this._onPlotSelected) return;
			this.element.removeEventListener('plotselected', this._onPlotSelected);
			this.element.removeEventListener('plotpan', this._onPlotPanOrZoom);
			this.element.removeEventListener('plotzoom', this._onPlotPanOrZoom);
			this.element.removeEventListener('plothover', this._onPlotHover);
			this.element.removeEventListener('plotclick', this._onPlotClick);
			this._onPlotSelected = null;
			this._onPlotPanOrZoom = null;
			this._onPlotHover = null;
			this._onPlotClick = null;
			this.removeTooltip();
		}

		// A pan holds the mouse down over many events, so the fetch waits for it
		// to settle. A selection is one event and is acted on at once.
		windowFromPlot(startMs, endMs, delay) {
			if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) return;
			clearTimeout(this._panZoomTimeout);
			const act = () => {
				this.state.floatingtime = 0;
				this.setWindow(startMs, endMs);
				if (typeof this.onWindowChange === 'function') this.onWindowChange(startMs, endMs);
			};
			if (delay) this._panZoomTimeout = setTimeout(act, delay);
			else act();
		}

		/* ── Tooltip ─────────────────────────────────────────────────────── */

		// The reading under the pointer, in the same words the graph page uses.
		// One tooltip is on the page at a time, whichever chart is hovered.
		showTooltip(item) {
			if (!item || !item.datapoint) {
				this.removeTooltip();
				this._hovered = null;
				return;
			}

			const point = item.datapoint;
			const key = point.join(':');
			if (key === this._hovered) return;
			this._hovered = key;

			const feed = this.state.feedlist[item.seriesIndex] || null;
			const dp = isFinite(Number(feed && feed.dp)) ? Number(feed.dp) : 0;
			// A stacked series carries what it was stacked on in the third
			// slot, so the reading is the difference.
			const value = point[2] !== undefined ? point[1] - point[2] : point[1];
			// A gap in a feed is a null reading, and isFinite says a null is a
			// finite number, so it is asked what it is rather than how big.
			if (typeof value !== 'number' || !isFinite(value)) { this.removeTooltip(); return; }

			const unit = feed && feed.unit ? feed.unit : '';
			const when = GH.formatGraphTooltipTime(point[0]);

			dropTooltip();

			const box = document.createElement('div');
			box.className = 'graph-chart-tooltip';
			box.appendChild(tooltipLine(item.series.label, 11));
			box.appendChild(tooltipLine(`${value.toFixed(dp)} ${unit}`.trim(), 0));
			box.appendChild(tooltipLine(when, 11));

			Object.assign(box.style, {
				position: 'absolute', visibility: 'hidden', zIndex: '100',
				fontWeight: 'bold', border: '1px solid rgb(255,221,221)',
				padding: '2px', backgroundColor: '#fff', opacity: '0.9',
			});

			document.body.appendChild(box);
			tooltip = box;

			const offset = 15;
			box.style.top = `${Math.max(0, item.pageY - box.offsetHeight - offset)}px`;
			box.style.left = `${Math.max(0, item.pageX - box.offsetWidth - offset)}px`;
			box.style.visibility = 'visible';
		}

		removeTooltip() {
			dropTooltip();
			this._hovered = null;
		}

		// A box that has changed size is redrawn from the data already here. One
		// that has changed size enough to be worth a different number of
		// datapoints is read again, which covers a box that had no width when it
		// was first drawn.
		resized() {
			const points = this.targetPoints();
			const grown = this._points > 0
				&& (points / this._points > POINTS_REFETCH || this._points / points > POINTS_REFETCH);
			if (grown) this.setWindow(this.startMs, this.endMs);
			else this.draw();
		}

		observeResize() {
			if (typeof ResizeObserver !== 'function') return;
			// Rendered again into the same element, the earlier observer goes.
			if (this._observer) this._observer.disconnect();

			this._observer = new ResizeObserver(() => {
				if (!this.element) return;
				if (this.element.clientWidth === this._width && this.element.clientHeight === this._height) return;
				clearTimeout(this._redrawTimeout);
				this._redrawTimeout = setTimeout(() => this.resized(), REDRAW_DELAY);
			});
			this._observer.observe(this.element);
		}
	}

	window.GraphChart = GraphChart;
})();
