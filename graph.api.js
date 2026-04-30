// graph.api.js
// All network communication for the graph module in one place.
// Uses the native fetch() API — no jQuery dependency.
//
// Call configure() once at startup (from the entry-point graph.js) before
// using any other export.  Every exported function returns a Promise that
// resolves to plain data or rejects with an Error containing a human-readable
// message.

// ---------------------------------------------------------------------------
// Module-level configuration — set once via configure()
// ---------------------------------------------------------------------------
let _path   = '';   // e.g. "https://example.org/emoncms/"
let _apikey = '';   // optional read/write API key

/**
 * Initialise the API module.  Must be called before any fetch function.
 * @param {string} path   — base URL of the emoncms installation (trailing slash included)
 * @param {string} apikey — user API key (may be empty string for public access)
 */
export function configure(path, apikey = '') {
    _path   = path;
    _apikey = apikey;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a URL, appending ?apikey=... only when a key is configured. */
function url(endpoint, params = {}) {
    const u = new URL(_path + endpoint, window.location.href);
    if (_apikey) params.apikey = _apikey;
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
            u.searchParams.set(k, v);
        }
    }
    return u.toString();
}

/**
 * GET endpoint, parse JSON, throw on HTTP or API-level errors.
 * @param {string} endpoint
 * @param {Object} params
 * @returns {Promise<any>}
 */
async function getJSON(endpoint, params = {}) {
    const response = await fetch(url(endpoint, params));
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} — ${endpoint}`);
    }
    const data = await response.json();
    // emoncms wraps errors as { success: false, message: "..." }
    if (data && data.success === false) {
        throw new Error(data.message || `API error from ${endpoint}`);
    }
    return data;
}

/**
 * POST endpoint, send application/x-www-form-urlencoded, parse JSON.
 * @param {string} endpoint
 * @param {Object} body     — key/value pairs to send as form data
 * @returns {Promise<any>}
 */
async function postJSON(endpoint, body = {}) {
    const u = _apikey ? url(endpoint) : _path + endpoint;
    const response = await fetch(u, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} — ${endpoint}`);
    }
    const data = await response.json();
    if (data && data.success === false) {
        throw new Error(data.message || `API error from ${endpoint}`);
    }
    return data;
}

// ---------------------------------------------------------------------------
// Feed API
// ---------------------------------------------------------------------------

/**
 * Fetch the full list of feeds for the authenticated user.
 * @returns {Promise<Array>}
 */
export async function fetchFeedList() {
    return getJSON('feed/list.json');
}

/**
 * Fetch the feed list for a specific public user.
 * @param {string} username
 * @returns {Promise<Array>}
 */
export async function fetchPublicFeedList(username) {
    return getJSON(`${username}/feed/list.json`);
}

/**
 * Fetch metadata for a single feed by id (used when the feed belongs to
 * another user and is not in the local feed list).
 * @param {number|string} feedid
 * @returns {Promise<Object|false>} feed object, or false if not found
 */
export async function fetchFeed(feedid) {
    try {
        const result = await getJSON('feed/aget.json', { id: feedid });
        return result && result.id !== undefined ? result : false;
    } catch {
        return false;
    }
}

/**
 * Fetch time-series data for one or more feeds.
 *
 * @param {Object} params
 * @param {string}  params.ids          — comma-separated feed IDs
 * @param {number}  params.start        — start timestamp, ms
 * @param {number}  params.end          — end timestamp, ms
 * @param {number|string} params.interval — seconds, or mode string (daily/weekly/…)
 * @param {number}  params.skipmissing
 * @param {number}  params.limitinterval
 * @param {string}  params.average      — comma-separated per-feed average flags
 * @param {string}  params.delta        — comma-separated per-feed delta flags
 * @param {string}  params.timeformat   — unix, unixms, notime etc.
 * @returns {Promise<Array>}            — array of { feedid, data: [[ts,val], …] }
 */
export async function fetchFeedData({ ids, start, end, interval, skipmissing, limitinterval, average, delta, timeformat }) {
    const params = { ids, start, end, interval, skipmissing, limitinterval, average, delta, timeformat };
    return getJSON('feed/data.json', params);
}

// ---------------------------------------------------------------------------
// Saved-graph API
// ---------------------------------------------------------------------------

/**
 * Fetch all saved graphs for the authenticated user.
 * The API returns { user: [ ...graphs ] }.
 * @returns {Promise<Array>}
 */
export async function fetchSavedGraphs() {
    const result = await getJSON('graph/getall');
    // Tolerate both { user: [...] } and a bare array
    return Array.isArray(result) ? result : (result?.user ?? []);
}

/**
 * Create a new saved graph.
 * @param {Object} graphData — serialised graph payload (from state.toSavePayload())
 * @returns {Promise<Object>} — API response including the new graph id
 */
export async function createSavedGraph(graphData) {
    const payload = { ...graphData };
    payload.name = encodeURIComponent(payload.name);
    return postJSON('graph/create', { data: JSON.stringify(payload) });
}

/**
 * Update an existing saved graph.
 * @param {Object} graphData — serialised graph payload; must include `id`
 * @returns {Promise<Object>}
 */
export async function updateSavedGraph(graphData) {
    if (!graphData.id) throw new Error('updateSavedGraph: missing graph id');
    return postJSON('graph/update', {
        id:   graphData.id,
        data: JSON.stringify(graphData),
    });
}

/**
 * Delete a saved graph by id.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function deleteSavedGraph(id) {
    return postJSON('graph/delete', { id });
}
