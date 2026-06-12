/* ─────────────────────────────────────────────────────────────────────────── *
 *  GraphLayoutApp  –  Vue 3 component for the graph view
 * ─────────────────────────────────────────────────────────────────────────── */

const GH = window.GraphHelpers;
const isEmbedGraph = typeof graph_embed !== 'undefined' && !!graph_embed;
// True only when the device has NO hover-capable pointer (e.g. phones/tablets).
// Hybrid laptops with a touchscreen still report touch points, so we must not
// key off maxTouchPoints/ontouchstart — those would wrongly disable tooltips
// for a mouse user. `any-hover: hover` is true if *any* input can hover.
const hasTouchInput = (
	typeof window !== 'undefined' &&
	!!window.matchMedia?.('(any-hover: none)')?.matches
);

/* ── Tiny fetch helpers ──────────────────────────────────────────────────── */

const apiUrl  = endpoint => `${path}${endpoint}${apikey ? `?apikey=${apikey}` : ''}`;
const getJson = url => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
const postJson = (url, params) => fetch(url, {
	method: 'POST',
	headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
	body: params.toString(),
}).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

/* ─────────────────────────────────────────────────────────────────────────── */

const GraphLayoutApp = {
	data: () => ({
		graphTimeHours: '168',
		errorMessage: '',
		errorType: 'danger',
		errorBadFeedIds: [],

		hiddenFeedIds: new Set(),
		startLocal: GH.msToDatetimeLocal(Date.now() - 168 * 3600_000),
		endLocal:   GH.msToDatetimeLocal(Math.round(Date.now() / 1000) * 1000),
		csvText: '',
		collapsedTags: {},
		savedGraphsCollapsed: false,
		savedGraphSelected: -1,
		savedGraphName: '',
		savedGraphs: [],
		savedGraphStatus: '',
		savedGraphStatusTimeout: null,
		feeds: [],
		state: GH.createDefaultGraphState(),
		histogramMode: false,
		activeHistogramFeed: null,
		histogramType: 'timeatvalue',
		histogramResolution: 1,
		showTimeManual: false,

		// Editor section
		editorMode: false,
		editPoint: null,
		editStatus: '',
		multiplyValues: {},
		multiplyStatus: {},
		feedMeta: {},
	}),

	/* ── Computed ──────────────────────────────────────────────────────────── */
	computed: {
		canWriteGraphs: () => !isEmbedGraph && !!session_write,
		canEdit: () => !isEmbedGraph && (!!session_write || !!apikey),

		windowInfo() {
			if (isEmbedGraph) return null;
			const { startMs, endMs } = this.getWindowRange();
			if (!isFinite(startMs) || !isFinite(endMs) || endMs < startMs) return null;

			const windowSecs = Math.max(0, Math.round((endMs - startMs) / 1000));
			const hours = Math.floor(windowSecs / 3600);
			const minsRaw = Math.round(((windowSecs / 3600) - hours) * 60);
			const mins = minsRaw > 0 ? (minsRaw < 10 ? `0${minsRaw}` : String(minsRaw)) : '';

			const formatTs = ms =>
				typeof GH.formatGraphWindowTime === 'function'
					? GH.formatGraphWindowTime(ms)
					: new Date(ms).toLocaleString();

			return { start: formatTs(startMs), end: formatTs(endMs), length: `${hours}h${mins} (${windowSecs} seconds)`, floating: !!this.state.floatingtime };
		},

		selectedSavedGraph() {
			const idx = Number(this.savedGraphSelected);
			return (isFinite(idx) && idx >= 0 && idx < this.savedGraphs.length)
				? this.savedGraphs[idx] ?? null : null;
		},

		savedGraphChanged() {
			if (!this.selectedSavedGraph) return false;
			const strip = g => { const c = GH.normalizeSavedGraphPayload(g); delete c.id; return c; };
			return JSON.stringify(strip(this.buildSavedGraphPayload())) !==
			       JSON.stringify(strip(this.selectedSavedGraph));
		},

		canSaveSavedGraph() {
			if (!this.canWriteGraphs || !GH.parseSavedGraphName(this.savedGraphName)) return false;
			return this.selectedSavedGraph ? this.savedGraphChanged : true;
		},

		activeSection() {
			if (this.editorMode) return 'editor';
			if (this.state.showcsv) return 'csv';
			if (this.state.showStats) return 'stats';
			return 'config';
		},

		// Hint shown in the editor when no datapoint is currently selected.
		pointEditHint() {
			if (this.state.mode !== 'interval')
				return GH.tr('Switch to Fixed Interval mode to edit individual datapoints');
			const anyEnabled = this.state.feedlist.some(f => this.isPointEditEnabled(f));
			return anyEnabled
				? GH.tr('Click a datapoint on the chart to edit it')
				: GH.tr('Zoom in to the feed interval to edit individual datapoints');
		},

		feedsByTag() {
			return this.feeds.reduce((acc, feed) => {
				const tag = feed.tag || 'undefined';
				(acc[tag] ??= []).push(feed);
				return acc;
			}, {});
		},

		leftChecked()    { return new Set(this.state.feedlist.filter(f => f.yaxis !== 2).map(f => String(f.id))); },
		rightChecked()   { return new Set(this.state.feedlist.filter(f => f.yaxis === 2).map(f => String(f.id))); },
		leftCount()      { return this.state.feedlist.filter(f => f.yaxis !== 2).length; },
		rightCount()     { return this.state.feedlist.filter(f => f.yaxis === 2).length; },
		leftAxisIsAuto()  { return this.state.yaxismin  === 'auto' && this.state.yaxismax  === 'auto'; },
		rightAxisIsAuto() { return this.state.yaxismin2 === 'auto' && this.state.yaxismax2 === 'auto'; },
		anyDeltaEnabled() { return this.state.feedlist.some(f => Number(f.delta)); },
	},

	/* ── Watchers ──────────────────────────────────────────────────────────── */
	watch: {
		savedGraphSelected(v) { this.onSavedGraphSelectedChange(v); },
		'state.showlegend':    'renderChart',
		// showmissing maps to the skipmissing fetch param, so it must re-fetch
		// (a re-render alone can't restore data the server already skipped).
		'state.showmissing':   'fetchFeedData',
		'state.showtag':       'renderChart',
		'state.csvtimeformat': 'updateCsvText',
		'state.csvnullvalues': 'updateCsvText',
		'state.csvheaders':    'updateCsvText',
	},

	/* ── Lifecycle ─────────────────────────────────────────────────────────── */
	mounted() {
		if (!isEmbedGraph) {
			this.$nextTick(() => {
				if (menu) menu.active_l3 = 'graph';
				menu?.show_l3?.();
			});
		}

		this._onHashChange = this.onSavedHashChange.bind(this);
		this._onColorModeChange = () => this.renderChart();
		window.addEventListener('hashchange', this._onHashChange);
		window.addEventListener('resize', this.onWindowResize);
		window.addEventListener('colormodechange', this._onColorModeChange);

		if (load_savegraphs) {
			this.loadSavedGraphById(load_savegraphs);
		} else if (this.canWriteGraphs) {
			this.fetchSavedGraphs();
		}
		this.fetchFeeds();
		this.fetchFeedData();
		this.bindPlotEvents();
		this.onWindowResize();
	},

	beforeUnmount() {
		this.unbindPlotEvents();
		this.removeTooltip();
		window.removeEventListener('hashchange', this._onHashChange);
		window.removeEventListener('resize', this.onWindowResize);
		window.removeEventListener('colormodechange', this._onColorModeChange);
		clearTimeout(this.savedGraphStatusTimeout);
		clearTimeout(this._resizeTimeout);
	},

	/* ── Methods ───────────────────────────────────────────────────────────── */
	methods: {
		showInlineError(message, type = 'danger', badFeedIds = []) {
			this.errorMessage = String(message || '').trim();
			this.errorType = type === 'info' ? 'info' : 'danger';
			this.errorBadFeedIds = Array.from(new Set((Array.isArray(badFeedIds) ? badFeedIds : []).map(String)));
		},

		clearInlineError() {
			this.errorMessage = '';
			this.errorType = 'danger';
			this.errorBadFeedIds = [];
		},

		onRemoveMissingFeeds() {
			if (!this.errorBadFeedIds.length) return;
			const bad = new Set(this.errorBadFeedIds.map(String));
			const kept = this.state.feedlist.filter(feed => !bad.has(String(feed.id)));
			this.state.feedlist.splice(0, Infinity, ...kept);
			this.clearInlineError();
			this.fetchFeedData();
		},

		parseFeedDataErrors(response) {
			const messages = [];
			const badFeedIds = [];

			if (response && typeof response === 'object' && !Array.isArray(response)) {
				if (response.success === false && response.message) {
					messages.push(response.message);
					if (Array.isArray(response.feeds)) badFeedIds.push(...response.feeds.map(String));
				}
			}

			if (Array.isArray(response)) {
				for (const item of response) {
					if (item?.data?.success === false) {
						if (item.data.message) messages.push(item.data.message);
						if (item.feedid !== undefined && item.feedid !== null) badFeedIds.push(String(item.feedid));
					}
				}
			}

			return {
				messages: Array.from(new Set(messages.filter(Boolean))),
				badFeedIds: Array.from(new Set(badFeedIds)),
			};
		},

		/* ── Tooltip ─────────────────────────────────────────────────────── */
		removeTooltip() {
			document.getElementById('tooltip')?.remove();
		},

		// Build and show the datapoint tooltip from a Flot hover/click item.
		// Shared by plothover (mouse) and plotclick (touch).
		showPointTooltip(item) {
			if (!item?.datapoint) { this.removeTooltip(); this._previousHoverPoint = null; return; }

			const { datapoint } = item;
			const key = datapoint.join(':');
			if (key === this._previousHoverPoint) return;
			this._previousHoverPoint = key;

			const feed    = this.state.feedlist[item.seriesIndex] ?? null;
			const dp      = isFinite(Number(feed?.dp)) ? Number(feed.dp) : 0;
			const isStack = datapoint[2] !== undefined;
			const raw     = isStack ? datapoint[1] - datapoint[2] : datapoint[1];

			if (!isFinite(raw)) { this.removeTooltip(); return; }

			const value = `${raw.toFixed(dp)} ${this.getFeedUnit(feed?.id)}`;
			const date  = typeof GH.formatGraphTooltipTime === 'function'
				? GH.formatGraphTooltipTime(datapoint[0])
				: new Date(datapoint[0]*1000).toString();
			const ts = datapoint[0];

			this.showTooltip(item.pageX, item.pageY,
				`<span style="font-size:11px">${item.series.label}</span><br>` +
				`${value}<br>` +
				`<span style="font-size:11px">${date}</span><br>` +
				`<span style="font-size:11px">(${ts})</span>`,
				'#fff');
		},

		showTooltip(x, y, contents, bgColor) {
			this.removeTooltip();
			const offset = 15;
			const elem = document.createElement('div');
			elem.id = 'tooltip';
			elem.innerHTML = contents;
			Object.assign(elem.style, {
				position: 'absolute', visibility: 'hidden',
				fontWeight: 'bold', border: '1px solid rgb(255,221,221)',
				padding: '2px', backgroundColor: bgColor, opacity: '0.8',
			});
			document.body.appendChild(elem);
			const top  = Math.max(0, y - elem.offsetHeight - offset);
			const left = Math.max(0, x - elem.offsetWidth  - offset);
			Object.assign(elem.style, { top: `${top}px`, left: `${left}px`, visibility: 'visible' });
		},

		/* ── Feed Utilities ──────────────────────────────────────────────── */
		getFeedUnit(feedid) {
			const id = String(feedid);
			return this.feeds.find(f => String(f.id) === id)?.unit
				?? this.state.feedlist.find(f => String(f.id) === id)?.unit
				?? '';
		},

		feedName(feed) { return GH.buildFeedLabel(feed, this.state.showtag); },

		feedColor(feed) {
			return GH.normalizeColor(feed.color) || GH.normalizeColor(feed.autoColor) || '#000000';
		},

		findFeedById(feedid) {
			return this.feeds.find(f => String(f.id) === String(feedid)) ?? null;
		},

		/* ── Legend Toggle ───────────────────────────────────────────────── */
		// Flot renders the legend as static SVG, so click-to-toggle isn't built in.
		// This method wires it up manually: it finds each <g> in the legend SVG,
		// clones the node to strip any previous listener, then attaches a click
		// handler that flips the series' visibility in hiddenFeedIds and calls
		// plot.setData/draw to redraw without a full re-render. It then re-runs
		// itself so the opacity of each legend item stays in sync with hidden state.
		attachLegendToggle(plot) {
			if (!plot || typeof plot.getData !== 'function') return;

			const placeholder = plot.getPlaceholder?.();
			const legendHost  = placeholder?.querySelector?.('.legend')
				?? document.getElementById('legend')?.querySelector('.legend')
				?? document.getElementById('legend');
			if (!legendHost) return;

			legendHost.style.pointerEvents = 'auto';
			const series = plot.getData();
			const groups = [...legendHost.querySelectorAll('svg > g')];
			if (!groups.length) return;

			groups.forEach((group, i) => {
				const seriesItem = series[i];
				if (!seriesItem) return;

				const hidden = this.hiddenFeedIds.has(seriesItem.id);
				const fresh  = group.cloneNode(true);
				Object.assign(fresh.style, { cursor: 'pointer', opacity: hidden ? '0.4' : '1' });
				group.parentNode.replaceChild(fresh, group);

				fresh.addEventListener('click', () => {
					const current     = plot.getData();
					const cur         = current[i];
					if (!cur) return;
					const feed        = this.state.feedlist.find(f => String(f.id) === String(cur.id));
					if (!feed) return;

					const nowHidden = this.hiddenFeedIds.has(cur.id);
					nowHidden ? this.hiddenFeedIds.delete(cur.id) : this.hiddenFeedIds.add(cur.id);
					const show = nowHidden;

					if (cur.lines)  cur.lines  = { ...cur.lines,  show: show && feed.plottype !== 'bars'   && feed.plottype !== 'points' };
					if (cur.bars)   cur.bars   = { ...cur.bars,   show: show && feed.plottype === 'bars' };
					if (cur.points) cur.points = { ...cur.points, show: show && feed.plottype === 'points' };

					plot.setData(current);
					plot.draw();
					this.attachLegendToggle(plot);
				});
			});
		},

		/* ── Window / Time ───────────────────────────────────────────────── */
		syncWindowInputs(startMs, endMs) {
			this.startLocal = GH.msToDatetimeLocal(startMs);
			this.endLocal   = GH.msToDatetimeLocal(endMs);
		},

		getWindowRange() {
			const parse = s => Date.parse(s && s.replace(' ', 'T'));
			const start = parse(this.startLocal);
			const end   = parse(this.endLocal);
			if (!isFinite(start) || !isFinite(end) || start >= end) {
				const now = Date.now();
				return { startMs: now - 86400_000, endMs: now };
			}
			return { startMs: start, endMs: end };
		},

		calcIntervalForWindow(startMs, endMs) {
			if (this.state.mode !== 'interval' || this.state.fixinterval) return;
			this.state.interval = String(GH.pickIntervalForWindow(startMs, endMs, min_feed_interval ?? 10));
		},

		setWindowAndReload(startMs, endMs, floating) {
			this.state.floatingtime = floating ? 1 : 0;
			this.calcIntervalForWindow(startMs, endMs);
			this.syncWindowInputs(startMs, endMs);
			this.fetchFeedData();
		},

		onReload()            { const r = this.getWindowRange(); this.setWindowAndReload(r.startMs, r.endMs, false); },

		onIntervalInputClick() {
			if (this.state.fixinterval) return;
			this.state.fixinterval = true;
			this.$nextTick(() => {
				const input = document.getElementById('request-interval');
				if (input) { input.focus(); input.select(); }
			});
		},

		onIntervalInputChange(event) {
			const val = parseInt(event.target.value, 10);
			if (!isNaN(val) && val > 0) this.state.interval = String(val);
			this.onReload();
		},

		onIntervalResetAuto() {
			this.state.fixinterval = false;
			this.onReload();
		},

		/* Allow only positive integers (for interval seconds) */
		onIntegerKeydown(event) {
			const nav = ['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
			if (nav.includes(event.key) || event.ctrlKey || event.metaKey) return;
			if (!/^\d$/.test(event.key)) event.preventDefault();
		},

		/* Allow signed decimals (for y-axis bounds) */
		onDecimalKeydown(event) {
			const nav = ['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
			if (nav.includes(event.key) || event.ctrlKey || event.metaKey) return;
			if (!/^[\d.\-]$/.test(event.key)) { event.preventDefault(); return; }
			const val = event.target.value;
			if (event.key === '-' && val.length !== 0) { event.preventDefault(); return; }
			if (event.key === '.' && val.includes('.')) event.preventDefault();
		},

		onGraphTimeRefresh() {
			const hours  = Number(this.graphTimeHours) || 168;
			const endMs  = Math.round(Date.now() / 1000) * 1000;
			this.setWindowAndReload(endMs - hours * 3600_000, endMs, true);
		},

		onZoomOut() {
			const { startMs, endMs } = this.getWindowRange();
			const mid = (startMs + endMs) / 2, half = endMs - startMs;
			this.setWindowAndReload(mid - half, mid + half, false);
		},

		onZoomIn() {
			const { startMs, endMs } = this.getWindowRange();
			const mid = (startMs + endMs) / 2, quarter = (endMs - startMs) / 4;
			this.setWindowAndReload(mid - quarter, mid + quarter, false);
		},

		onPan(direction) {
			const { startMs, endMs } = this.getWindowRange();
			const shift = (endMs - startMs) * 0.2 * direction;
			this.setWindowAndReload(startMs + shift, endMs + shift, false);
		},

		/* ── Data Fetch ──────────────────────────────────────────────────── */
		fetchFeedData() {
			if (!this.state.feedlist.length) {
				this.showInlineError(GH.tr('Please select a feed from the Feeds List'), 'info');
				this.renderChart();
				return;
			}

			this.clearInlineError();
			if (this.editorMode) this.fetchEditorMeta();

			const { startMs, endMs } = this.getWindowRange();
			const params = GH.buildFeedDataParams(this.state.feedlist, startMs, endMs, this.state);
			if (apikey) params.set('apikey', apikey);

			getJson(`${path}feed/data.json?${params}`)
				.then(response => {
					const { messages, badFeedIds } = this.parseFeedDataErrors(response);
					if (messages.length) {
						this.showInlineError(`${GH.tr('Request error')}: ${messages.join(', ')}`, 'danger', badFeedIds);
					} else {
						this.clearInlineError();
					}

					const byId = {};
					if (Array.isArray(response)) {
						for (const item of response) {
							if (item) byId[String(item.feedid)] = Array.isArray(item.data) ? item.data : [];
						}
					}
					for (const feed of this.state.feedlist) {
						feed.data = byId[String(feed.id)] || [];
					}
					this.renderChart();
				})
				.catch(err => {
					console.error('Failed to fetch feed data:', err);
					this.showInlineError(`${GH.tr('Request error')}: ${err?.message || String(err)}`, 'danger');
				});
		},

		fetchFeeds() {
			getJson(apiUrl('feed/list.json'))
				.then(data => {
					if (!Array.isArray(data)) return;
					this.feeds = data;
					const nextCollapsedTags = {};
					for (const feed of data) {
						const tag = feed.tag || 'undefined';
						nextCollapsedTags[tag] = Object.prototype.hasOwnProperty.call(this.collapsedTags, tag)
							? this.collapsedTags[tag]
							: true;
					}
					this.collapsedTags = nextCollapsedTags;
					if (this.state.feedlist.length) {
						this.expandTagsForSelectedFeeds();
					} else if (!load_savegraphs) {
						this.applyUrlFeedSelection();
					}
				})
				.catch(err => console.error('Failed to fetch feed list:', err));
		},

		expandTagsForSelectedFeeds() {
			if (!Array.isArray(this.state.feedlist) || !this.state.feedlist.length) return;
			const expandedTags = new Set();
			for (const selected of this.state.feedlist) {
				const feed = this.findFeedById(selected.id);
				if (!feed) continue;
				expandedTags.add(feed.tag || 'undefined');
			}
			for (const tag of expandedTags) {
				this.collapsedTags[tag] = false;
			}
		},

		/* ── CSV ─────────────────────────────────────────────────────────── */
		buildCsvText() {
			return GH.buildCsvText(this.state.feedlist, this.state.csvtimeformat,
			                    this.state.csvnullvalues, this.state.csvheaders);
		},

		updateCsvText() {
			if (this.state.showcsv) this.csvText = this.buildCsvText();
		},

		onDownloadCsv() {
			if (!this.state.showcsv) return;
			const csv = this.buildCsvText();
			if (!csv) return;
			this.csvText = csv;

			const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
			const link = Object.assign(document.createElement('a'), { href: url, download: 'emoncms-graph.csv' });
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
		},

		onCopyCsv() {
			if (!this.state.showcsv) return;
			const csv = this.buildCsvText();
			if (!csv) return;
			this.csvText = csv;

			const csvEl = document.getElementById('csv');
			if (typeof copyToClipboardCustomMsg === 'function' && csvEl) {
				copyToClipboardCustomMsg(csvEl, 'copy-csv-feedback', GH.tr('Copied'), GH.tr('Copy not supported'));
				return;
			}

			navigator.clipboard?.writeText(csv).then(() => {
				const fb = document.getElementById('copy-csv-feedback');
				if (!fb) return;
				fb.textContent = GH.tr('Copied');
				setTimeout(() => fb.textContent = '', 2000);
			});
		},

		/* ── Plot Events ─────────────────────────────────────────────────── */
		bindPlotEvents() {
			const placeholder = document.getElementById('placeholder');
			if (!placeholder) return;

			this._onPlotSelected = ({ detail }) => {
				const ranges = detail?.[0];
				if (!ranges?.xaxis) return;
				const startMs = GH.toMsFromPlotValue(ranges.xaxis.from);
				const endMs   = GH.toMsFromPlotValue(ranges.xaxis.to);
				if (isFinite(startMs) && isFinite(endMs) && endMs > startMs)
					this.setWindowAndReload(startMs, endMs, false);
			};

			this._onPlotPanOrZoom = ({ detail }) => {
				const plot = detail?.[0];
				if (typeof plot?.getAxes !== 'function') return;
				const { xaxis } = plot.getAxes();
				if (!xaxis) return;
				const startMs = GH.toMsFromPlotValue(xaxis.min);
				const endMs   = GH.toMsFromPlotValue(xaxis.max);
				if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) return;
				clearTimeout(this._panZoomTimeout);
				this._panZoomTimeout = setTimeout(() => this.setWindowAndReload(startMs, endMs, false), 250);
			};

			this._onPlotHover = ({ detail }) => {
				if (hasTouchInput) return;
				this.showPointTooltip(detail?.[1]);
			};

			// Touch devices don't fire plothover, but a tap fires plotclick — so on
			// touch we surface the same tooltip on tap (in addition to editor edits).
			this._onPlotClick = ({ detail }) => {
				const item = detail?.[1];
				this.onEditorPlotClick(item);
				if (hasTouchInput) this.showPointTooltip(item);
			};

			placeholder.addEventListener('plotselected', this._onPlotSelected);
			placeholder.addEventListener('plotpan',      this._onPlotPanOrZoom);
			placeholder.addEventListener('plotzoom',     this._onPlotPanOrZoom);
			placeholder.addEventListener('plothover',    this._onPlotHover);
			placeholder.addEventListener('plotclick',    this._onPlotClick);
		},

		unbindPlotEvents() {
			const placeholder = document.getElementById('placeholder');
			if (placeholder) {
				placeholder.removeEventListener('plotselected', this._onPlotSelected);
				placeholder.removeEventListener('plotpan',      this._onPlotPanOrZoom);
				placeholder.removeEventListener('plotzoom',     this._onPlotPanOrZoom);
				placeholder.removeEventListener('plothover',    this._onPlotHover);
				placeholder.removeEventListener('plotclick',    this._onPlotClick);
			}
			clearTimeout(this._panZoomTimeout);
			this.removeTooltip();
		},

		/* ── Null-Gap Removal ────────────────────────────────────────────── */
		onRemoveNullChange() {
			const v = parseFloat(this.state.removeNullMaxDuration);
			if (!isFinite(v) || v <= 0) this.state.removeNullMaxDuration = '900';
			this.renderChart();
		},

		getProcessingParams() { return GH.deriveProcessingParams(this.state); },

		/* ── Chart Rendering ─────────────────────────────────────────────── */
		graphResize() {
			const bound       = document.getElementById('placeholder_bound');
			const placeholder = document.getElementById('placeholder');
			if (!bound || !placeholder) return;
			const width = bound.clientWidth;
			let height;
			if (isEmbedGraph) {
				const nav = document.getElementById('navigation') || document.querySelector('.graph-embed-view > div:first-child');
				const navHeight = nav ? nav.offsetHeight : 0;
				height = Math.max(200, window.innerHeight - navHeight - 8);
			} else {
				height = Math.max(380, width * 0.5);
			}
			placeholder.style.cssText += `width:${width}px;height:${height}px;`;
			bound.style.height = `${height}px`;
		},

		onWindowResize() {
			this.graphResize();
			clearTimeout(this._resizeTimeout);
			this._resizeTimeout = setTimeout(() => this.renderChart(), 150);
		},

		buildPlotData() {
			const p = this.getProcessingParams();
			const { startMs, endMs } = this.getWindowRange();
			const timeInWindowSeconds = (endMs - startMs) / 1000;

			return this.state.feedlist.map(feed => {
				let data = Array.isArray(feed.data) ? feed.data.map(pt => [pt[0], pt[1]]) : [];

				const scale  = isFinite(parseFloat(feed.scale))  ? parseFloat(feed.scale)  : 1;
				const offset = isFinite(parseFloat(feed.offset)) ? parseFloat(feed.offset) : 0;

				// 1. Fill null gaps with last value if enabled.
				if (p.removeNull && data.length > 1)
					data = GH.fillShortNullGaps(data, p.intervalSeconds, p.maxDuration);

				// 2. Apply scale/offset to the data for plotting.
				data = GH.applyScaleOffset(data, scale, offset);

				// 3. Stats use the full processed data so nulls count toward quality
				feed.stats = GH.calculateFeedStats(data, timeInWindowSeconds);

				// 4. Removes remaining nulls if this option is disabled.
				if (!this.state.showmissing)
					data = data.filter(pt => pt[1] !== null);

				const label   = GH.buildFeedLabel(feed, this.state.showtag);
				const stacked = !!feed.stack;
				const fillVal = feed.fill ? (stacked ? 1.0 : 0.5) : 0;
				const hidden  = this.hiddenFeedIds.has(feed.id);

				const series = { label, data, yaxis: feed.yaxis || 1, stack: stacked, id: feed.id };
				if (feed.color) series.color = feed.color;

				const PLOT_TYPES = {
					lines:  () => { series.lines  = { show: !hidden, fill: fillVal, lineWidth: 2 }; },
					bars:   () => { series.bars   = { show: !hidden, fill: fillVal, align: 'center', barWidth: 0.8 }; },
					points: () => { series.points = { show: !hidden, radius: 3 }; },
					steps:  () => { series.lines  = { show: !hidden, fill: fillVal, steps: true }; },
				};
				(PLOT_TYPES[feed.plottype] ?? PLOT_TYPES.lines)();

				return series;
			});
		},

		renderChart() {
			const placeholder = document.getElementById('placeholder');
			if (!placeholder) return;
			this.graphResize();

			const { startMs, endMs } = this.getWindowRange();

			const options = GH.buildFlotOptions(startMs, endMs, this.state);

			if (!window.Flot || typeof window.Flot.plot !== 'function') return;

			const plot     = window.Flot.plot(placeholder, this.buildPlotData(), options);
			const rendered = plot.getData?.() ?? [];

			this.attachLegendToggle(plot);

			// Back-fill auto colors
			for (const series of rendered) {
				const feed = this.state.feedlist.find(f => String(f.id) === String(series.id));
				if (feed && !feed.color) feed.autoColor = GH.normalizeColor(series.color);
			}

			if (this.state.showcsv) this.csvText = this.buildCsvText();
		},

		/* ── Histogram ───────────────────────────────────────────────────── */
		onHistogramClick(feedid) {
			const feed = this.state.feedlist.find(f => String(f.id) === String(feedid));
			if (!feed) return;

			this.histogramMode = true;
			this.activeHistogramFeed = feedid;
			this.histogramResolution = GH.suggestHistogramResolution(feed.stats?.diff ?? 100);
			this.drawHistogram();
		},

		onHistogramBackClick() {
			this.histogramMode = false;
			this.activeHistogramFeed = null;
			this.renderChart();
		},

		drawHistogram() {
			if (!this.histogramMode || !this.activeHistogramFeed) return;
			const feed       = this.state.feedlist.find(f => String(f.id) === String(this.activeHistogramFeed));
			if (!feed) return;

			const resolution = parseFloat(this.histogramResolution) || 1;
			const buckets    = GH.calculateHistogramBuckets(feed.data, this.histogramType, resolution);
			const plotData   = Object.entries(buckets)
				.map(([k, v]) => [Number(k), v])
				.sort((a, b) => a[0] - b[0]);

			const label = GH.buildFeedLabel(feed, this.state.showtag);
			const placeholder = document.getElementById('placeholder');
			if (!placeholder) return;

			Flot.plot(placeholder, [{ label, data: plotData, color: feed.color || undefined }], {
				series: { bars: { show: true, barWidth: 0.8 } },
				grid:   { hoverable: true },
				xaxis:  { tickFormatter: v => v.toFixed(2) },
				yaxis:  { tickFormatter: v => this.histogramType === 'kwhatpower'
					? `${v.toFixed(2)} kWh`
					: `${(v / 3600).toFixed(1)} h` },
			});
		},

		/* ── Y-Axis Controls ─────────────────────────────────────────────── */
		onYAxisInputClick(side, bound, event) {
			const key = side === 'left'
				? (bound === 'min' ? 'yaxismin' : 'yaxismax')
				: (bound === 'min' ? 'yaxismin2' : 'yaxismax2');
			if (this.state[key] !== 'auto') return;
			this.state[key] = '';
			this.$nextTick(() => { if (event?.target) event.target.focus(); });
		},

		onYAxisMinMaxChange(side, bound, event) {
			const val = event.target.value;
			if (side === 'left')  { if (bound === 'min') this.state.yaxismin  = val; else this.state.yaxismax  = val; }
			if (side === 'right') { if (bound === 'min') this.state.yaxismin2 = val; else this.state.yaxismax2 = val; }
			this.renderChart();
		},

		resetYAxis(side) {
			if (side === 'left')  { this.state.yaxismin  = 'auto'; this.state.yaxismax  = 'auto'; }
			if (side === 'right') { this.state.yaxismin2 = 'auto'; this.state.yaxismax2 = 'auto'; }
			this.renderChart();
		},

		/* ── Feed Management ─────────────────────────────────────────────── */
		moveFeed(index, direction) {
			const next = index + direction;
			if (next < 0 || next >= this.state.feedlist.length) return;
			[this.state.feedlist[index], this.state.feedlist[next]] =
			[this.state.feedlist[next],  this.state.feedlist[index]];
			this.renderChart();
		},

		_setFeedPropRender(feed, prop, value) { feed[prop] = value; this.renderChart(); },
		_setFeedPropFetch(feed, prop, value)  { feed[prop] = value; this.fetchFeedData(); },

		setPlottype(feed, e)   { this._setFeedPropRender(feed, 'plottype', e.target.value); },
		setColor(feed, e)  { feed.color = feed.autoColor = e.target.value; this.renderChart(); },
		setFill(feed, e)   { this._setFeedPropRender(feed, 'fill',    e.target.checked ? 1 : 0); },
		setStack(feed, e)  { this._setFeedPropRender(feed, 'stack',   e.target.checked ? 1 : 0); },
		setScale(feed, e)  { this._setFeedPropRender(feed, 'scale',   e.target.value); },
		setOffset(feed, e) { this._setFeedPropRender(feed, 'offset',  e.target.value); },
		setDelta(feed, e)  {
			feed.delta = e.target.checked ? 1 : 0;
			// Delta sums values across each window (day/month/year); dropping missing
			// points discards the current incomplete period, so force gaps on.
			if (feed.delta && !this.state.showmissing) { this.state.showmissing = true; return; }
			this.fetchFeedData();
		},
		setAverage(feed, e){ this._setFeedPropFetch(feed,  'average', e.target.checked ? 1 : 0); },
		setDp(feed, e)     { this._setFeedPropRender(feed, 'dp',      Number(e.target.value)); },

		normalizeFeedId(feedid)           { return String(feedid); },
		toggleFeedLeft(feedid)            { this.onYAxisChange(feedid, 1, !this.leftChecked.has(this.normalizeFeedId(feedid))); },
		toggleTag(tag)                    { this.collapsedTags[tag] = !this.collapsedTags[tag]; },

		setSection(section) {
			const valid = ['config', 'stats', 'csv', 'editor'];
			const nextSection = valid.includes(section) ? section : 'config';
			const showCsv = nextSection === 'csv';
			this.state.showStats = nextSection === 'stats';
			this.editorMode = nextSection === 'editor';
			if (showCsv && !this.state.showcsv) this.csvText = this.buildCsvText();
			this.state.showcsv = showCsv;
		},

		showOptions() {
			this.setSection('config');
		},

		showStats() {
			this.setSection('stats');
		},

		showCsvSection() {
			this.setSection('csv');
		},

		showEditorSection() {
			this.setSection('editor');
			this.fetchEditorMeta();
		},

		/* ── Editor ─────────────────────────────────────────── */
		// Fetch native interval/engine metadata for the selected feeds so we
		// can decide when individual datapoint editing should be enabled.
		fetchEditorMeta() {
			for (const feed of this.state.feedlist) {
				const id = String(feed.id);
				if (this.feedMeta[id]) continue;
				getJson(`${path}feed/getmeta.json?id=${encodeURIComponent(id)}${apikeystr}`)
					.then(meta => {
						if (meta && typeof meta === 'object') this.feedMeta = { ...this.feedMeta, [id]: meta };
					})
					.catch(err => console.error('Failed to fetch feed meta:', err));
			}
		},

		// Editing is disabled when a display scale or offset is applied, since
		// the plotted values no longer match what is stored in the feed.
		feedHasScaleOffset(feed) {
			const scale  = isFinite(parseFloat(feed.scale))  ? parseFloat(feed.scale)  : 1;
			const offset = isFinite(parseFloat(feed.offset)) ? parseFloat(feed.offset) : 0;
			return scale !== 1 || offset !== 0;
		},

		// Individual datapoint editing is enabled once the request interval has
		// been zoomed in to (or below) the feed's native storage interval.
		isPointEditEnabled(feed) {
			if (!feed || this.state.mode !== 'interval') return false;
			if (this.feedHasScaleOffset(feed)) return false;
			const meta = this.feedMeta[String(feed.id)];
			const feedInterval = meta && isFinite(Number(meta.interval)) ? Number(meta.interval) : 0;
			if (feedInterval <= 0) return false;
			const reqInterval = parseInt(this.state.interval, 10) || 0;
			return reqInterval > 0 && reqInterval <= feedInterval;
		},

		// Validate against the same patterns the scalerange backend accepts:
		// NAN, abs(x), a signed float, or a (signed) unit fraction like 1/2.
		isValidMultiplyValue(value) {
			return /^(NAN|abs\(x\)|(1\/|-1\/|-)?[0-9]+([.,][0-9]+)?)$/i.test(value);
		},

		onMultiplySubmit(feed) {
			const id = String(feed.id);
			if (this.feedHasScaleOffset(feed)) {
				this.multiplyStatus = { ...this.multiplyStatus, [id]: GH.tr('Remove the scale and offset to edit this feed') };
				return;
			}
			const raw = String(this.multiplyValues[id] ?? '').trim();
			if (!raw) { this.multiplyStatus = { ...this.multiplyStatus, [id]: GH.tr('Enter a value') }; return; }
			if (!this.isValidMultiplyValue(raw)) {
				this.multiplyStatus = { ...this.multiplyStatus, [id]: GH.tr('Invalid value. Use a float, a fraction (1/2), NAN or abs(x).') };
				return;
			}
			if (!window.confirm(GH.tr('Multiply the data shown in the current window? This writes to the feed and cannot be undone.'))) return;

			const { startMs, endMs } = this.getWindowRange();
			const start = Math.round(startMs / 1000);
			const end   = Math.round(endMs / 1000);
			const url = `${path}feed/scalerange.json?id=${encodeURIComponent(id)}&start=${start}&end=${end}&value=${encodeURIComponent(raw)}${apikeystr}`;

			getJson(url)
				.then(res => {
					// scalerange returns the number of bytes written on success,
					// false on failure, or a string for unsupported engines.
					const ok = typeof res === 'number' && res > 0;
					this.multiplyStatus = { ...this.multiplyStatus, [id]: ok
						? GH.tr('Saved')
						: (typeof res === 'string' ? res : (res?.message || `${GH.tr('Request error')}`)) };
					if (ok) this.multiplyValues = { ...this.multiplyValues, [id]: '' };
					this.fetchFeedData();
				})
				.catch(err => {
					this.multiplyStatus = { ...this.multiplyStatus, [id]: `${GH.tr('Request error')}: ${err?.message || String(err)}` };
				});
		},

		onPointSave() {
			if (!this.editPoint) return;
			const { feedid, time, value } = this.editPoint;
			const t = parseInt(time, 10);
			if (!isFinite(t)) { this.editStatus = GH.tr('Enter a value'); return; }
			if (String(value).trim() === '') { this.editStatus = GH.tr('Enter a value'); return; }

			const url = `${path}feed/post.json?id=${encodeURIComponent(feedid)}&time=${t}&value=${encodeURIComponent(value)}&skipbuffer=1${apikeystr}`;
			getJson(url)
				.then(() => { this.editStatus = GH.tr('Saved'); this.fetchFeedData(); })
				.catch(err => { this.editStatus = `${GH.tr('Request error')}: ${err?.message || String(err)}`; });
		},

		// Click handler for the chart while the editor section is open: selects
		// the clicked datapoint into the edit box, reversing any display
		// scale/offset to recover the stored feed value.
		onEditorPlotClick(item) {
			if (!this.editorMode || !item || !item.datapoint) return;
			const feed = this.state.feedlist[item.seriesIndex];
			if (!feed) return;

			if (this.feedHasScaleOffset(feed)) {
				this.editPoint = null;
				this.editStatus = GH.tr('Remove the scale and offset to edit this feed');
				return;
			}

			if (!this.isPointEditEnabled(feed)) {
				this.editPoint = null;
				this.editStatus = GH.tr('Editing not available for this datapoint at the current zoom level');
				return;
			}

			const dp = item.datapoint;
			const seconds = dp[0] > 1e12 ? Math.round(dp[0] / 1000) : Math.round(dp[0]);

			const scale  = isFinite(parseFloat(feed.scale))  ? parseFloat(feed.scale)  : 1;
			const offset = isFinite(parseFloat(feed.offset)) ? parseFloat(feed.offset) : 0;
			const plotted = dp[2] !== undefined ? dp[1] - dp[2] : dp[1];
			const raw = scale !== 0 ? (plotted - offset) / scale : plotted;
			const value = Number.isInteger(raw) ? raw : parseFloat(raw.toFixed(3));

			this.editStatus = '';
			this.editPoint = { feedid: feed.id, name: this.feedName(feed), time: seconds, value };
		},

		onYAxisChange(feedid, yaxis, checked) {
			const normalizedFeedId = this.normalizeFeedId(feedid);
			const idx = this.state.feedlist.findIndex(f => this.normalizeFeedId(f.id) === normalizedFeedId);
			if (checked) {
				if (idx === -1) {
					const feed = this.feeds.find(f => this.normalizeFeedId(f.id) === normalizedFeedId);
					if (feed) this.state.feedlist.push(Object.assign(GH.defaultFeedProps(), { yaxis, average: GH.defaultAverageForUnit(feed.unit) }, feed));
				} else {
					this.state.feedlist[idx].yaxis = yaxis;
				}
			} else if (idx !== -1) {
				this.state.feedlist.splice(idx, 1);
			}
			this.fetchFeedData();
		},

		onClearAll() {
			this.hiddenFeedIds.clear();
			this.clearInlineError();
			this._previousHoverPoint = null;
			this.removeTooltip();
			this.state.feedlist.splice(0);
			GH.applyGraphState(this.state, {});
			Object.assign(this.state, GH.GRAPH_CLEAR_EXTRA_DEFAULTS);

			const endMs   = Math.round(Date.now() / 1000) * 1000;
			const startMs = endMs - 7 * 24 * 3600_000;
			this.graphTimeHours = '168';
			this.calcIntervalForWindow(startMs, endMs);
			this.syncWindowInputs(startMs, endMs);
			this.renderChart();
		},

		/* ── URL / Path Feed Selection ───────────────────────────────────── */
		getPathFeedIds() {
			const parts = (window.location.pathname || '').split('graph/');
			if (parts.length < 2) return [];
			const segment = parts.at(-1).split('/')[0];
			return segment ? GH.parseFeedIds(segment) : [];
		},

		addInitialFeed(feedMeta, yaxis) {
			if (!feedMeta) return;
			const existing = this.state.feedlist.find(f => String(f.id) === String(feedMeta.id));
			if (existing) { existing.yaxis = yaxis; return; }
			this.state.feedlist.push(Object.assign(GH.defaultFeedProps(), { yaxis, average: GH.defaultAverageForUnit(feedMeta.unit) }, feedMeta));
		},

		applyUrlFeedSelection() {
			const leftIds  = [...this.getPathFeedIds(), ...GH.parseFeedIds(feedidsLH)];
			const rightIds = GH.parseFeedIds(feedidsRH);
			if (!leftIds.length && !rightIds.length) return;

			for (const id of leftIds)  this.addInitialFeed(this.findFeedById(id), 1);
			for (const id of rightIds) this.addInitialFeed(this.findFeedById(id), 2);
			this.expandTagsForSelectedFeeds();
			this.fetchFeedData();
		},

		/* ── Saved Graphs ────────────────────────────────────────────────── */
		showSavedGraphStatus(message) {
			this.savedGraphStatus = message;
			clearTimeout(this.savedGraphStatusTimeout);
			this.savedGraphStatusTimeout = setTimeout(() => this.savedGraphStatus = '', 2000);
		},

		// Extract the saved graph ID from the URL hash if it matches the expected pattern.
		getSavedHashId() {
			const hash = String(window.location.hash || '');
			return hash.startsWith('#/Saved/') ? hash.replace('#/Saved/', '').trim() : '';
		},

		// When a graph is selected, update the URL hash so it can be linked to or reloaded.
		setSavedHashId(id) { if (id) window.location.hash = `/Saved/${id}`; },
		clearSavedHash()   { history.replaceState(null, null, ' '); },

		// When the URL hash changes, if it matches the pattern for a saved graph, select that graph in the UI.
		onSavedHashChange() {
			if (!this.canWriteGraphs || !this.savedGraphs.length) return;
			const hashId = this.getSavedHashId();
			if (!hashId) return;
			const idx = this.findSavedGraphIndexById(hashId);
			if (idx !== -1 && this.savedGraphSelected !== idx) this.savedGraphSelected = idx;
		},

		findSavedGraphIndexById(id) {
			return this.savedGraphs.findIndex(g => String(g.id) === String(id));
		},

		loadSavedGraphById(id) {
			const graphId = String(id || '').trim();
			if (!graphId) return;
			this.clearInlineError();
			getJson(`${path}graph/get?id=${encodeURIComponent(graphId)}${apikeystr}`)
				.then(graph => {
					if (graph && graph.success === false) throw new Error(GH.tr('Graph not found'));
					this.savedGraphSelected = -1;
					this.applySavedGraphPayload(graph);
					this.clearInlineError();
				})
				.catch(err => {
					console.error('Failed to load saved graph:', err);
					this.state.feedlist.splice(0);
					this.renderChart();
					this.showInlineError(err?.message || GH.tr('Graph not found'));
				});
		},

		// Apply persisted graph-level settings onto the live reactive state object
		// without replacing the state reference that Vue is tracking.
		applySavedGraphState(savedState) { GH.applyGraphState(this.state, savedState); },

		// Build the payload sent to create/update endpoints from the current window,
		// graph settings, and visible feed configuration.
		buildSavedGraphPayload() {
			const { startMs, endMs } = this.getWindowRange();
			const payload = {
				name:     GH.parseSavedGraphName(this.savedGraphName),
				start:    startMs,
				end:      endMs,
				...GH.normalizeGraphState(this.state),
				feedlist: this.state.feedlist.map(GH.normalizeSavedFeed),
			};
			const selected = this.savedGraphs[this.savedGraphSelected];
			if (this.savedGraphSelected > -1 && selected) payload.id = selected.id;
			return payload;
		},

		// Apply a saved graph payload back into the UI, preserving the current
		// window if the saved timestamps are missing or invalid.
		applySavedGraphPayload(graph) {
			if (!graph || typeof graph !== 'object') return;
			const normalized = GH.normalizeSavedGraphPayload(graph);
			const { startMs, endMs } = this.getWindowRange();
			let { start: s, end: e } = normalized;
			if (!isFinite(s) || !isFinite(e) || s >= e) { s = startMs; e = endMs; }
			// A floating-time graph stores a relative window: re-anchor it to "now"
			// on load, keeping the saved duration, so it always shows recent data.
			else if (normalized.floatingtime) {
				const now = Math.round(Date.now() / 1000) * 1000;
				this.graphTimeHours = String(Math.round((e - s) / 3600_000));
				s = now - (e - s);
				e = now;
			}

			this.syncWindowInputs(s, e);
			this.applySavedGraphState(normalized);
			this.hiddenFeedIds.clear();
			this.state.feedlist.splice(0, Infinity, ...normalized.feedlist.map(GH.buildStateFeedFromSaved));
			// Delta requires gaps on (see setDelta) — enforce on load too.
			if (this.anyDeltaEnabled) this.state.showmissing = true;
			this.expandTagsForSelectedFeeds();
			this.fetchFeedData();
			if (this.state.showcsv) this.updateCsvText();
		},

		onSavedGraphSelectedChange(newVal) {
			const idx = Number(newVal);
			if (!isFinite(idx) || idx < 0 || idx >= this.savedGraphs.length) {
				this.savedGraphName = '';
				this.clearSavedHash();
				return;
			}

			const selected = this.savedGraphs[idx];
			if (!selected) return;
			this.savedGraphName = selected.name || '';
			this.setSavedHashId(selected.id);

			if (selected.feedlist) { this.applySavedGraphPayload(selected); return; }

			getJson(`${path}graph/get?id=${encodeURIComponent(String(selected.id))}${apikeystr}`)
				.then(graph => this.applySavedGraphPayload(graph))
				.catch(err => console.error('Failed to load saved graph:', err));
		},

		fetchSavedGraphs() {
			return getJson(apiUrl('graph/getall'))
				.then(result => {
					const list = Array.isArray(result) ? result : (result?.user ?? []);
					this.savedGraphs = GH.sortSavedGraphs(list);
					const targetId = String(load_savegraphs || this.getSavedHashId() || '');
					if (!targetId) return;
					const idx = this.savedGraphs.findIndex(g => String(g.id) === targetId);
					if (idx !== -1) this.savedGraphSelected = idx;
				})
				.catch(err => console.error('Failed to fetch saved graphs:', err));
		},

		onSaveSavedGraph() {
			if (!this.canWriteGraphs) return;
			const name = GH.parseSavedGraphName(this.savedGraphName);
			if (!name) { this.showSavedGraphStatus(GH.tr('Graph Name required')); return; }

			const payload    = this.buildSavedGraphPayload();
			payload.name     = encodeURIComponent(name);
			const isUpdate   = !!payload.id;
			const endpoint   = isUpdate ? 'graph/update' : 'graph/create';
			const params     = new URLSearchParams({ data: JSON.stringify(payload) });
			if (isUpdate) params.set('id', String(payload.id));

			postJson(apiUrl(endpoint), params)
				.then(res => {
					if (!res || res.success === false) throw new Error(res?.message || 'Save failed');
					this.showSavedGraphStatus(res.message || GH.tr('Saved'));

					const match     = !payload.id && String(res.message || '').match(/graph saved id\s*:\s*(\d+)/i);
					const createdId = match ? match[1] : null;

					return this.fetchSavedGraphs().then(() => {
						const targetId = createdId || payload.id;
						if (!targetId) return;
						const idx = this.savedGraphs.findIndex(g => String(g.id) === String(targetId));
						if (idx !== -1) this.savedGraphSelected = idx;
					});
				})
				.catch(err => this.showSavedGraphStatus(`Error: ${err.message}`));
		},

		onDeleteSavedGraph() {
			if (!this.canWriteGraphs) return;
			const graph = this.savedGraphs[this.savedGraphSelected];
			if (!graph) return;
			if (!window.confirm(`Delete ${graph.name || ''} (#${graph.id})?`)) return;

			postJson(apiUrl('graph/delete'), new URLSearchParams({ id: String(graph.id) }))
				.then(res => {
					if (!res || res.success === false) throw new Error(res?.message || 'Delete failed');
					this.savedGraphSelected = -1;
					this.savedGraphName = '';
					this.clearSavedHash();
					this.showSavedGraphStatus(res.message || GH.tr('Deleted'));
					return this.fetchSavedGraphs();
				})
				.catch(err => this.showSavedGraphStatus(`Error: ${err.message}`));
		},
	},
};

Vue.createApp(GraphLayoutApp).component('DateTimePicker', DateTimePicker).mount('#graph-view-app');
