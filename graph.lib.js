/* ─────────────────────────────────────────────────────────────────────────── *
 *  GraphHelpers  –  pure utility module, no DOM / Vue dependencies
 * ─────────────────────────────────────────────────────────────────────────── */

const INTERVAL_LADDER = [
	1, 5, 10, 15, 20, 30,
	60, 120, 180, 300, 600, 900, 1200, 1800,
	3600, 7200, 10800, 14400, 18000, 21600, 43200, 86400,
];

const coerceBoolean = (value, fallback = false) => {
	if (value === undefined || value === null) return fallback;
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	if (typeof value === 'string') {
		const v = value.trim().toLowerCase();
		if (!v) return false;
		if (['0', 'false', 'off', 'no', 'null', 'undefined'].includes(v)) return false;
		if (['1', 'true', 'on', 'yes'].includes(v)) return true;
	}
	return !!value;
};

const GRAPH_STATE_SCHEMA = {
	interval:      { default: 60,             coerce: v => (isFinite(Number(v)) ? Number(v) : 60) },
	mode:          { default: 'interval',     coerce: v => String(v || 'interval') },
	limitinterval: { default: 1,              coerce: v => (Number(v) ? 1 : 0) },
	fixinterval:   { default: false,          coerce: v => coerceBoolean(v, false) },
	floatingtime:  { default: 0,              coerce: v => (Number(v) ? 1 : 0) },
	yaxismin:      { default: 'auto',         coerce: v => (v !== undefined ? String(v) : 'auto') },
	yaxismax:      { default: 'auto',         coerce: v => (v !== undefined ? String(v) : 'auto') },
	yaxismin2:     { default: 'auto',         coerce: v => (v !== undefined ? String(v) : 'auto') },
	yaxismax2:     { default: 'auto',         coerce: v => (v !== undefined ? String(v) : 'auto') },
	showmissing:   { default: true,           coerce: v => coerceBoolean(v, true) },
	showtag:       { default: false,          coerce: v => coerceBoolean(v, false) },
	showlegend:    { default: true,           coerce: v => coerceBoolean(v, true) },
	showcsv:       { default: false,          coerce: v => coerceBoolean(v, false) },
	csvtimeformat: { default: 'unix',         coerce: v => String(v || 'unix') },
	csvnullvalues: { default: 'show',         coerce: v => String(v || 'show') },
	csvheaders:    { default: 'showNameTag',  coerce: v => String(v || 'showNameTag') },
};

const GRAPH_CLEAR_EXTRA_DEFAULTS = {
	showStats: false,
	removeNull: false,
	removeNullMaxDuration: '900',
};

/* ── Translations ────────────────────────────────────────────────────────── */

const graphTranslation = key => {
	const t = (typeof window !== 'undefined' && window.graphTranslations) || {};
	return Object.prototype.hasOwnProperty.call(t, key) ? t[key] : key;
};

/* ── Graph State ─────────────────────────────────────────────────────────── */

const normalizeGraphState = (source = {}) =>
	Object.fromEntries(
		Object.entries(GRAPH_STATE_SCHEMA).map(([key, { coerce }]) => [key, coerce(source[key])])
	);

const applyGraphState = (target, source) => {
	const normalized = normalizeGraphState(source);
	Object.assign(target, normalized);
	target.interval = String(target.interval);
};

const createDefaultGraphState = () => ({
	...normalizeGraphState({}),
	...GRAPH_CLEAR_EXTRA_DEFAULTS,
	feedlist: [],
});

/* ── Time Helpers ────────────────────────────────────────────────────────── */

const pad2 = n => String(n).padStart(2, '0');

const toLocaleTag = value => {
	const text = String(value || '').trim();
	if (!text) return '';
	return text.replace('_', '-');
};

const graphLocale = (() => {
	const userLocale =
		typeof window !== 'undefined' && window._user && window._user.lang
			? window._user.lang
			: '';
	const docLocale = typeof document !== 'undefined' ? document.documentElement.lang : '';
	return toLocaleTag(userLocale) || toLocaleTag(docLocale) || 'en-GB';
})();

const isTouchPrimaryDevice = () => {
	if (typeof window === 'undefined') return false;

	const hasTouchPointer =
		('ontouchstart' in window) ||
		navigator.maxTouchPoints > 0 ||
		!!window.matchMedia?.('(any-pointer: coarse)')?.matches;

	const hasMouseLikePointer =
		!!window.matchMedia?.('(any-hover: hover)')?.matches ||
		!!window.matchMedia?.('(any-pointer: fine)')?.matches;

	// Disable drag selection only on touch-primary environments.
	// Hybrid devices (touch + mouse/trackpad) should keep mouse drag-select.
	return hasTouchPointer && !hasMouseLikePointer;
};

const makeDateFormatter = options => {
	try {
		return new Intl.DateTimeFormat(graphLocale, options);
	} catch {
		return new Intl.DateTimeFormat('en-GB', options);
	}
};

const monthFormatter = makeDateFormatter({ month: 'short' });
const dayFormatter = makeDateFormatter({ weekday: 'short' });
const tooltipFormatter = makeDateFormatter({
	weekday: 'short',
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
});

const monthNamesShort = Array.from({ length: 12 }, (_, month) =>
	monthFormatter.format(new Date(Date.UTC(2020, month, 1)))
);

const dayNamesShort = Array.from({ length: 7 }, (_, day) =>
	dayFormatter.format(new Date(Date.UTC(2020, 10, 1 + day)))
);

const formatGraphWindowTime = ms => {
	const date = new Date(ms);
	return `${date.getDate()}/${monthFormatter.format(date)}/${date.getFullYear()} ` +
	       `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

const formatGraphTooltipTime = seconds => {
	const date = new Date(Number(seconds) * 1000);
	return tooltipFormatter.format(date);
};

const msToDatetimeLocal = ms => {
	const d = new Date(ms);
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
	       `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const toMsFromPlotValue = value => (value < 1e12 ? value * 1000 : value);

const pickIntervalForWindow = (startMs, endMs, minStep) => {
	const windowSecs  = (endMs - startMs) / 1000;
	const raw         = windowSecs / 600;
	const resolvedMin = isFinite(Number(minStep)) ? Number(minStep) : 10;
	return (
		INTERVAL_LADDER.find(step => step >= raw && step >= resolvedMin) ??
		INTERVAL_LADDER.at(-1)
	);
};

/* ── Series Processing ───────────────────────────────────────────────────── */

const fillShortNullGaps = (data, intervalSeconds, maxDurationSeconds) => {
	const out = data.map(pt => [pt[0], pt[1]]);
	let lastValid = 0;

	for (let i = 0; i < out.length; i++) {
		if (out[i][1] !== null) {
			if ((i - lastValid) * intervalSeconds < maxDurationSeconds) {
				for (let x = lastValid + 1; x < i; x++) out[x][1] = out[lastValid][1];
			}
			lastValid = i;
		}
	}
	return out;
};

const applyScaleOffset = (data, scale, offset) => {
	if (scale === 1 && offset === 0) return data;
	return data.map(([t, v]) => {
		if (v === null) return [t, null];
		const n = Number(v);
		return [t, isFinite(n) ? n * scale + offset : v];
	});
};

const buildProcessedDataForStats = (feed, intervalSeconds, maxDuration, removeNullEnabled) => {
	let data = Array.isArray(feed.data) ? feed.data.map(pt => [pt[0], pt[1]]) : [];

	if (removeNullEnabled && data.length > 1) {
		data = fillShortNullGaps(data, intervalSeconds, maxDuration);
	}

	const scale  = isFinite(parseFloat(feed.scale))  ? parseFloat(feed.scale)  : 1;
	const offset = isFinite(parseFloat(feed.offset)) ? parseFloat(feed.offset) : 0;
	return applyScaleOffset(data, scale, offset);
};

const calculateFeedStats = (data, timeInWindowSeconds) => {
	const valid = data.map(([, v]) => v).filter(v => v !== null);
	const total = data.length;
	const good  = valid.length;
	const quality = total > 0 ? Math.round(100 * good / total) : 0;

	if (good === 0) return { min: 0, max: 0, diff: 0, mean: 0, stdev: 0, quality, good, total, wh: 0 };

	const min  = valid.reduce((a, b) => b < a ? b : a);
	const max  = valid.reduce((a, b) => b > a ? b : a);
	const mean = valid.reduce((s, v) => s + v, 0) / good;
	const stdev = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / good);
	const wh = Math.round((mean * timeInWindowSeconds) / 3600);

	return { min, max, diff: max - min, mean, stdev, quality, good, total, wh };
};

/* ── CSV ─────────────────────────────────────────────────────────────────── */

const formatCsvTimestamp = (time, startTime, csvtimeformat) => {
	if (csvtimeformat === 'seconds') return Math.round(time - startTime);
	if (csvtimeformat === 'datestr') {
		const d = new Date(time*1000);
		return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
		       `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
	}
	return Math.round(time);
};

const buildCsvText = (feedlist, csvtimeformat, csvnullvalues, csvheaders) => {
	if (!feedlist.length) return '';
	const firstData = feedlist[0].data;
	if (!Array.isArray(firstData) || !firstData.length) return '';

	const showName = csvheaders === 'showNameTag' || csvheaders === 'showName';
	const showTag  = csvheaders === 'showNameTag';
	const startTime = firstData[0][0];

	let csv = '';

	if (showName || showTag) {
		const TIME_LABELS = { unix: 'Unix timestamp', seconds: 'Seconds since start', datestr: 'Date-time string' };
		const header = [TIME_LABELS[csvtimeformat] ?? 'Unix timestamp', ...feedlist.map(f => {
			const tag  = showTag  ? (f.tag  || '') : '';
			const name = showName ? (f.name || '') : '';
			return tag + (tag && name ? ':' : '') + name;
		})];
		csv = '"' + header.join('", "') + '"\n';
	}

	const lastValues = new Array(feedlist.length).fill(null);

	for (let z = 0; z < firstData.length; z++) {
		const line = [formatCsvTimestamp(firstData[z][0], startTime, csvtimeformat)];
		let nullFound = false;

		for (let f = 0; f < feedlist.length; f++) {
			const point = feedlist[f].data[z];
			if (point === undefined) continue;

			if (point[1] === null) nullFound = true;
			if (point[1] !== null || csvnullvalues === 'show') lastValues[f] = point[1];

			const v = lastValues[f];
			const numeric = v !== null ? Number(v) : NaN;
			line.push(v === null ? String(v) : isFinite(numeric) ? numeric.toFixed(feedlist[f].dp) : String(v));
		}

		if (csvnullvalues === 'remove' && nullFound) continue;
		csv += line.join(', ') + '\n';
	}

	return csv;
};

/* ── Saved Graphs & Feed Utilities ───────────────────────────────────────── */

const parseSavedGraphName = name => String(name || '').trim();

const sortSavedGraphs = graphs =>
	[...graphs].sort((a, b) => {
		const an = String(a?.name ?? '').toLowerCase();
		const bn = String(b?.name ?? '').toLowerCase();
		return an < bn ? -1 : an > bn ? 1 : 0;
	});

const normalizeSavedFeed = (feed = {}) => ({
	id:       String(feed.id   || ''),
	name:     String(feed.name || ''),
	tag:      String(feed.tag  || ''),
	unit:     String(feed.unit || ''),
	yaxis:    Number(feed.yaxis) === 2 ? 2 : 1,
	fill:     Number(feed.fill)  ? 1 : 0,
	stack:    Number(feed.stack) ? 1 : 0,
	scale:    String(feed.scale  !== undefined ? feed.scale  : '1'),
	offset:   String(feed.offset !== undefined ? feed.offset : '0'),
	delta:    Number(feed.delta)   ? 1 : 0,
	average:  Number(feed.average) ? 1 : 0,
	dp:       isFinite(Number(feed.dp)) ? Number(feed.dp) : 1,
	plottype: String(feed.plottype || 'lines'),
	color:    String(feed.color || ''),
});

const parseFeedIds = raw => {
	const text = String(raw ?? '').trim();
	if (!text) return [];
	return text.split(',')
		.map(p => Number(p.trim()))
		.filter(id => isFinite(id) && id > 0);
};

const defaultFeedProps = () => ({
	plottype: 'lines', fill: 0, stack: 0,
	scale: '1', offset: '0',
	delta: 0, average: 1, dp: 1,
	stats: {}, data: [], autoColor: '',
});

/* ── Histogram ───────────────────────────────────────────────────────────── */

const calculateHistogramBuckets = (data, type, resolution) => {
	const buckets = {};
	let val = 0;

	for (let i = 1; i < data.length; i++) {
		if (data[i][1] !== null) val = data[i][1];
		const key = Math.round(val / resolution) * resolution;
		buckets[key] ??= 0;

		const dt = (data[i][0] - data[i - 1][0]);
		buckets[key] += type === 'kwhatpower'
			? (val * dt) / (3600 * 1000)
			: dt; // timeatvalue
	}

	return buckets;
};

/* ── Color Utilities ─────────────────────────────────────────────────────── */

const normalizeColor = color => {
	if (!color || typeof color !== 'string') return '';

	if (color.startsWith('#')) {
		if (color.length === 4) return '#' + [...color.slice(1)].map(c => c + c).join('');
		return color.length === 7 ? color : '';
	}

	const rgb = color.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
	if (rgb) {
		const clamp = n => Math.max(0, Math.min(255, parseInt(n, 10) || 0));
		const toHex = n => n.toString(16).padStart(2, '0');
		return '#' + toHex(clamp(rgb[1])) + toHex(clamp(rgb[2])) + toHex(clamp(rgb[3]));
	}

	return '';
};

/* ── Plot / Chart Helpers ────────────────────────────────────────────────── */

const buildFeedLabel = (feed, showtag) =>
	(showtag && feed.tag ? `${feed.tag}: ` : '') + feed.name;

const applyYAxisBounds = (axis, min, max) => {
	let explicit = false;
	if (min !== 'auto' && min !== '') { axis.min = parseFloat(min); explicit = true; }
	if (max !== 'auto' && max !== '') { axis.max = parseFloat(max); explicit = true; }
	if (explicit) axis.autoScale = 'none';
};

const buildFlotOptions = (startMs, endMs, state) => {
	const isLight = true; //document.documentElement.classList.contains('color-mode-light');
	const labelColor = isLight ? '#333' : '#ddd';
	const labelFont  = { color: labelColor, fill: labelColor };
	const touchPrimary = isTouchPrimaryDevice();
	const yaxes = [{ font: labelFont }, { alignTicksWithAxis: 1, position: 'right', font: labelFont }];
	applyYAxisBounds(yaxes[0], state.yaxismin,  state.yaxismax);
	applyYAxisBounds(yaxes[1], state.yaxismin2, state.yaxismax2);
	return {
		lines:     { fill: false, lineWidth: 2 },
		xaxis:     { mode: 'time', timezone: 'browser', min: startMs, max: endMs,
		             monthNames: monthNamesShort,
		             dayNames:   dayNamesShort,
		             axisPan: true,
		             plotPan: true,
		             axisZoom: true,
		             plotZoom: true,
		             font: labelFont },
		yaxis:     { axisPan: false, plotPan: false, axisZoom: false, plotZoom: false },
		yaxes,
		grid:      { hoverable: true, clickable: true, borderWidth: 0, color: labelColor },
		selection: { mode: touchPrimary ? null : 'x', color: '#e8cfac', visualization: 'fill' },
		legend:    { show: state.showlegend, position: 'nw' },
		toggle:    { scale: 'visible' },
		zoom:      { interactive: touchPrimary, enableTouch: true, amount: 1.5 },
		pan:       { interactive: touchPrimary, enableTouch: true, touchMode: 'smartLock', frameRate: 60 },
		recenter:  { interactive: touchPrimary, enableTouch: true },
	};
};

const buildFeedDataParams = (feedlist, startMs, endMs, state) => {
	const interval = state.mode !== 'interval'
		? state.mode
		: (parseInt(state.interval, 10) || 60);
	return new URLSearchParams({
		ids:           feedlist.map(f => f.id).join(','),
		start:         String(startMs),
		end:           String(endMs),
		interval:      String(interval),
		skipmissing:   state.showmissing   ? '0' : '1',
		limitinterval: state.limitinterval ? '1' : '0',
		average:       feedlist.map(f => f.average || 0).join(','),
		delta:         feedlist.map(f => f.delta   || 0).join(','),
		timeformat:    'unix',
	});
};

const deriveProcessingParams = state => {
	const maxDuration     = Math.max(0, parseFloat(state.removeNullMaxDuration)) || 900;
	const intervalSeconds = Math.max(0, parseFloat(state.interval))              || 60;
	return {
		maxDuration,
		intervalSeconds,
		removeNull: !!state.removeNull && state.mode === 'interval' && intervalSeconds < maxDuration,
	};
};

const suggestHistogramResolution = diff =>
	diff < 100 ? 0.1 : diff < 5000 ? 10 : 100;

/* ── Saved Graph Payload Helpers ─────────────────────────────────────────── */

const normalizeSavedGraphPayload = (graph = {}) => ({
	id:       graph.id !== undefined ? String(graph.id) : '',
	name:     parseSavedGraphName(graph.name),
	start:    isFinite(Number(graph.start)) ? Number(graph.start) : 0,
	end:      isFinite(Number(graph.end))   ? Number(graph.end)   : 0,
	...normalizeGraphState(graph),
	feedlist: (Array.isArray(graph.feedlist) ? graph.feedlist : []).map(normalizeSavedFeed),
});

const buildStateFeedFromSaved = feed => {
	const normalized = normalizeSavedFeed(feed);
	const numericId = Number(normalized.id);
	return {
		...defaultFeedProps(),
		...normalized,
		id: isFinite(numericId) && numericId > 0 ? numericId : normalized.id,
		autoColor: '',
		stats: {},
		data: []
	};
};

/* ── Public API ──────────────────────────────────────────────────────────── */

window.GraphHelpers = {
	INTERVAL_LADDER,
	GRAPH_CLEAR_EXTRA_DEFAULTS,
	normalizeGraphState,
	applyGraphState,
	createDefaultGraphState,
	tr: graphTranslation,
	msToDatetimeLocal,
	toMsFromPlotValue,
	pickIntervalForWindow,
	fillShortNullGaps,
	applyScaleOffset,
	buildProcessedDataForStats,
	calculateFeedStats,
	buildCsvText,
	formatCsvTimestamp,
	parseSavedGraphName,
	sortSavedGraphs,
	normalizeSavedFeed,
	parseFeedIds,
	defaultFeedProps,
	calculateHistogramBuckets,
	normalizeColor,
	buildFeedLabel,
	applyYAxisBounds,
	buildFlotOptions,
	buildFeedDataParams,
	deriveProcessingParams,
	suggestHistogramResolution,
	formatGraphWindowTime,
	formatGraphTooltipTime,
	normalizeSavedGraphPayload,
	buildStateFeedFromSaved,
};