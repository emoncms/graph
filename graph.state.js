// graph.state.js
// Single source of truth for all graph state.
// Merges the old `view` time-window object (vis.helper.js) and
// `graphState` Vue.observable (graph.js) into one plain object.
//
// This module is state-only — no DOM, no fetch, no jQuery.
// graph.js (the entry point) will wrap this with Vue.observable()
// so that Vue components and watchers stay reactive.

// ---------------------------------------------------------------------------
// Interval ladder — the set of valid auto-computed data intervals (seconds).
// Extracted here so calcInterval() and any future code can share it.
// ---------------------------------------------------------------------------
const INTERVAL_LADDER = [
    1, 5, 10, 15, 20, 30, 60, 120, 180, 300, 600, 900, 1200, 1800,
    3600, 7200, 10800, 14400, 18000, 21600, 43200, 86400
];

// ---------------------------------------------------------------------------
// Default values for every user-controlled setting.
// resetState() uses these; they should never include derived or feed data.
// ---------------------------------------------------------------------------
export const STATE_DEFAULTS = {
    // ---- Time window (was `view` object in vis.helper.js) ----
    start:         0,
    end:           0,
    mode:          'interval',   // 'interval' | 'daily' | 'weekly' | 'monthly' | 'annual'
    interval:      10,           // seconds
    fixinterval:   false,
    limitinterval: 1,
    floatingtime:  1,            // 1 = keep end pinned to "now" when reloading

    // ---- Display options ----
    showmissing:  false,
    showlegend:   true,
    showtag:      true,
    showcsv:      0,
    showStats:    false,         // toggle between options table and stats table

    // ---- Y-axis bounds ----
    yaxismin:  'auto',
    yaxismax:  'auto',
    yaxismin2: 'auto',
    yaxismax2: 'auto',

    // ---- CSV export options ----
    csvtimeformat: 'datestr',    // 'unix' | 'seconds' | 'datestr'
    csvnullvalues: 'show',       // 'show' | 'lastvalue' | 'remove'
    csvheaders:    'showNameTag',// 'showNameTag' | 'showName' | 'hide'

    // ---- Saved-graph identity ----
    current_graph_id:   '',
    current_graph_name: '',

    // ---- Post-processing ----
    skipmissing:          0,
    removeNull:           false,
    removeNullMaxDuration: 900,  // seconds — max gap to fill when removeNull is on
};

// ---------------------------------------------------------------------------
// state — the single reactive graph state object.
// Wrapping with Vue.observable() happens in the entry-point (graph.js) once
// Vue is available; until then it is a plain object.
//
// Separation of concerns:
//   STATE_DEFAULTS  — user-controlled, serialisable, resettable
//   feeds/feedlist  — managed by the feed-selector component
//   derived fields  — written by graph_draw(), never reset by resetState()
// ---------------------------------------------------------------------------
export const state = {
    ...STATE_DEFAULTS,

    // Full list of the user's feeds fetched from the server.
    feeds: [],

    // Feeds currently plotted on the graph.
    feedlist: [],

    // ---- Derived / output fields — recalculated on each draw, not reset ----
    active_histogram_feed: 0,
    time_in_window: 0,   // seconds
    num_left:  0,        // count of feeds on left y-axis
    num_right: 0,        // count of feeds on right y-axis
};

// ---------------------------------------------------------------------------
// resetState() — restore all user-controlled settings to blank-graph defaults.
// Does NOT clear feeds, feedlist, or derived fields.
// ---------------------------------------------------------------------------
export function resetState() {
    Object.assign(state, STATE_DEFAULTS);
}

// ---------------------------------------------------------------------------
// Time-window helpers (migrated from the `view` object in vis.helper.js).
// Each function mutates `state` directly, then returns it so callers can
// chain or ignore the return value as they prefer.
//
// All timestamps are in milliseconds (matching Date.getTime()).
// ---------------------------------------------------------------------------

/** Double the time window, keeping the same midpoint. */
export function zoomOut() {
    const half = (state.end - state.start);
    const mid  = state.start + half / 2;
    state.start = mid - half;
    state.end   = mid + half;
    calcInterval();
}

/** Halve the time window, keeping the same midpoint. */
export function zoomIn() {
    const half = (state.end - state.start) / 4;
    const mid  = state.start + (state.end - state.start) / 2;
    state.start = mid - half;
    state.end   = mid + half;
    calcInterval();
}

/** Shift the window 20% forward in time. */
export function panRight() {
    const shift = (state.end - state.start) * 0.2;
    state.start += shift;
    state.end   += shift;
    calcInterval();
}

/** Shift the window 20% back in time. */
export function panLeft() {
    const shift = (state.end - state.start) * 0.2;
    state.start -= shift;
    state.end   -= shift;
    calcInterval();
}

/**
 * Set the window to the most recent `days` worth of data ending now.
 * @param {number} days — floating-point days (e.g. 0.5 = 12 hours)
 */
export function setTimeWindow(days) {
    state.end   = Math.round(Date.now() / 1000) * 1000;
    state.start = state.end - days * 86400 * 1000;
    calcInterval();
}

/**
 * Auto-select the best data interval for the current window, honouring
 * fixinterval and the server's min_feed_interval constraint.
 * Snaps start/end to the interval boundary in 'interval' mode.
 *
 * @param {number} [minFeedInterval=10] — server minimum, seconds
 */
export function calcInterval(minFeedInterval = 10) {
    if (state.mode !== 'interval') return;

    const windowSecs = (state.end - state.start) / 1000;
    const raw = windowSecs / 600;  // target ~600 data points

    // Find the smallest ladder value that is >= raw and >= minFeedInterval.
    let chosen = INTERVAL_LADDER[INTERVAL_LADDER.length - 1];
    for (const step of INTERVAL_LADDER) {
        if (step >= raw && step >= minFeedInterval) {
            chosen = step;
            break;
        }
    }

    if (!state.fixinterval) {
        state.interval = chosen;
    }

    // Snap to interval boundary
    state.start = Math.floor((state.start / 1000) / state.interval) * state.interval * 1000;
    state.end   = Math.ceil ((state.end   / 1000) / state.interval) * state.interval * 1000;
}

/**
 * Snap start/end to clean day/week/month/year boundaries for bar-chart modes.
 * Call this at the top of graph_reload() before building the API request.
 */
export function snapToBoundary() {
    const ds = new Date(state.start);
    const de = new Date(state.end);

    switch (state.mode) {
        case 'daily':
        case 'weekly':
            state.start = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate()).getTime();
            state.end   = new Date(de.getFullYear(), de.getMonth(), de.getDate()).getTime();
            break;

        case 'monthly': {
            const sameMonth = ds.getMonth() === de.getMonth();
            state.start = new Date(ds.getFullYear(), ds.getMonth(), 1).getTime();
            state.end   = new Date(de.getFullYear(), de.getMonth() + (sameMonth ? 1 : 0), 1).getTime();
            break;
        }

        case 'annual': {
            const sameYear = ds.getFullYear() === de.getFullYear();
            state.start = new Date(ds.getFullYear(), 0, 1).getTime();
            state.end   = new Date(de.getFullYear() + (sameYear ? 1 : 0), 0, 1).getTime();
            break;
        }

        default:
            // 'interval' mode — snap is handled inside calcInterval()
            break;
    }
}

/**
 * Serialise the current state into the shape expected by the graph save/load API.
 * Strips transient fields (data, stats) from feedlist before serialising.
 * @returns {Object}
 */
export function toSavePayload() {
    // Snapshot now so floatingtime is set correctly before serialising.
    const now = Math.round(Date.now() / 1000) * 1000;
    if (Math.abs(now - state.end) < 120000) {
        state.floatingtime = 1;
    }

    return {
        name:          state.current_graph_name,
        start:         state.start,
        end:           state.end,
        interval:      state.interval,
        mode:          state.mode,
        limitinterval: state.limitinterval,
        fixinterval:   state.fixinterval,
        floatingtime:  state.floatingtime,
        yaxismin:      state.yaxismin,
        yaxismax:      state.yaxismax,
        yaxismin2:     state.yaxismin2,
        yaxismax2:     state.yaxismax2,
        showmissing:   state.showmissing,
        showtag:       state.showtag,
        showlegend:    state.showlegend,
        showcsv:       state.showcsv,
        csvtimeformat: state.csvtimeformat,
        csvnullvalues: state.csvnullvalues,
        csvheaders:    state.csvheaders,
        feedlist:      state.feedlist.map(f => {
            const { data: _d, stats: _s, ...rest } = f;
            return rest;
        }),
        id: state.current_graph_id,
    };
}

/**
 * Apply a saved graph payload back onto state.
 * Handles missing fields from older saved graphs gracefully.
 * @param {Object} graph — payload as returned by the API
 */
export function fromSavePayload(graph) {
    if (!graph) return;

    state.start        = graph.start;
    state.end          = graph.end;
    state.interval     = graph.interval;
    state.mode         = graph.mode         ?? 'interval';
    state.limitinterval= graph.limitinterval;
    state.fixinterval  = graph.fixinterval;
    state.floatingtime = graph.floatingtime;

    state.yaxismin     = graph.yaxismin;
    state.yaxismax     = graph.yaxismax;
    state.yaxismin2    = graph.yaxismin2    ?? 'auto';
    state.yaxismax2    = graph.yaxismax2    ?? 'auto';

    state.showmissing  = graph.showmissing;
    state.showtag      = graph.showtag;
    state.showlegend   = graph.showlegend;

    state.csvtimeformat= graph.csvtimeformat ?? 'datestr';
    state.csvnullvalues= graph.csvnullvalues ?? 'show';
    state.csvheaders   = graph.csvheaders    ?? 'showNameTag';

    state.showcsv      = graph.showcsv !== undefined ? Number(graph.showcsv) : 0;

    state.current_graph_id   = graph.id;
    state.current_graph_name = graph.name;

    state.feedlist = graph.feedlist ?? [];

    // If the saved view was "floating" (pinned to now), re-anchor the window.
    if (state.floatingtime) {
        const windowMs = state.end - state.start;
        state.end   = Math.round(Date.now() / 1000) * 1000;
        state.start = state.end - windowMs;
    }
}
