// graph.utils.js
// Pure, stateless helper functions used across the graph module.
// No DOM side-effects; no imports from other graph modules.
// Also absorbs the loose helpers that lived in vis.helper.js:
//   tooltip(), stats(), parseTimepickerTime(), getFeedName().

// ---------------------------------------------------------------------------
// Date / time formatting
// ---------------------------------------------------------------------------

/**
 * Format a timestamp for display in the window-info bar.
 * Uses moment.js (loaded as global) for locale-aware month/day names.
 * @param {number} timestamp — ms
 * @returns {string}
 */
export function printdate(timestamp) {
    const m = moment(timestamp);
    const fmt = m.year() === moment().year() ? 'D/MMM HH:mm:ss' : 'D/MMM/YYYY HH:mm:ss';
    return m.format(fmt);
}

/**
 * Parse a date-time string from the bootstrap datetimepicker (dd/MM/yyyy hh:mm:ss)
 * into a Unix timestamp in seconds.  Returns false on invalid input.
 * @param {string} timestr
 * @returns {number|false}
 */
export function parseTimepickerTime(timestr) {
    const parts = timestr.split(' ');
    if (parts.length !== 2) return false;
    const date = parts[0].split('/');
    if (date.length !== 3) return false;
    const time = parts[1].split(':');
    if (time.length !== 3) return false;
    return new Date(date[2], date[1] - 1, date[0], time[0], time[1], time[2], 0).getTime() / 1000;
}

// ---------------------------------------------------------------------------
// File download
// ---------------------------------------------------------------------------

/**
 * Trigger a browser file download of a string as a CSV file.
 * @param {string} filename
 * @param {string} data
 */
export function downloadData(filename, data) {
    const blob = new Blob([data], { type: 'text/csv' });
    const elem = document.createElement('a');
    elem.href = URL.createObjectURL(blob);
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
    URL.revokeObjectURL(elem.href);
}

// ---------------------------------------------------------------------------
// Array helpers
// ---------------------------------------------------------------------------

/**
 * Move an element within an array from old_index to new_index, in place.
 * Returns the same array reference.
 * @param {Array} array
 * @param {number} oldIndex
 * @param {number} newIndex
 * @returns {Array}
 */
export function arrayMove(array, oldIndex, newIndex) {
    array.splice(newIndex, 0, array.splice(oldIndex, 1)[0]);
    return array;
}

// ---------------------------------------------------------------------------
// Feed data post-processing
// ---------------------------------------------------------------------------

/**
 * Fill short null gaps in feed data with the last known value.
 * Gaps longer than max_duration * interval seconds are left as null.
 * Mutates `data` in place and returns it.
 * @param {Array}  data         — [[timestamp, value|null], ...]
 * @param {number} interval     — data interval in seconds
 * @param {number} [max_duration=900] — max gap to fill, seconds
 * @returns {Array}
 */
export function removeNullValues(data, interval, max_duration = 900) {
    let last_valid_pos = 0;
    for (let pos = 0; pos < data.length; pos++) {
        if (data[pos][1] !== null) {
            const null_time = (pos - last_valid_pos) * interval;
            if (null_time < max_duration) {
                for (let x = last_valid_pos + 1; x < pos; x++) {
                    data[x][1] = data[last_valid_pos][1];
                }
            }
            last_valid_pos = pos;
        }
    }
    return data;
}

/**
 * Multiply all non-null values by a scalar. Mutates and returns data.
 * @param {Array}  data
 * @param {number} scale
 * @returns {Array}
 */
export function scaleValues(data, scale) {
    if (scale === undefined || scale == 1.0) return data;
    for (let i = 0; i < data.length; i++) {
        if (data[i][1] !== null) data[i][1] *= scale;
    }
    return data;
}

/**
 * Add a constant offset to all non-null values. Mutates and returns data.
 * @param {Array}  data
 * @param {number} offset
 * @returns {Array}
 */
export function offsetValues(data, offset) {
    if (offset === undefined || offset == 0.0) return data;
    for (let i = 0; i < data.length; i++) {
        if (data[i][1] !== null) data[i][1] += Number(offset);
    }
    return data;
}

// ---------------------------------------------------------------------------
// Statistics  (migrated from vis.helper.js)
// ---------------------------------------------------------------------------

/**
 * Compute summary statistics for a single feed's data array.
 * Null values are counted but excluded from numeric stats.
 * @param {Array} data — [[timestamp, value|null], ...]
 * @returns {{ minval, maxval, diff, mean, stdev, npointsnull, npoints }}
 */
export function feedStats(data) {
    let sum = 0, i = 0;
    let minval = 0, maxval = 0;
    let npoints = 0, npointsnull = 0;

    for (const point of data) {
        const val = point[1];
        if (val !== null) {
            if (i === 0) { minval = val; maxval = val; }
            if (val > maxval) maxval = val;
            if (val < minval) minval = val;
            sum += val;
            i++;
        } else {
            npointsnull++;
        }
        npoints++;
    }

    const mean = i > 0 ? sum / i : 0;
    let variance = 0;
    let j = 0;
    for (const point of data) {
        if (point[1] !== null) {
            variance += (point[1] - mean) ** 2;
            j++;
        }
    }
    const stdev = j > 0 ? Math.sqrt(variance / j) : 0;

    return { minval, maxval, diff: maxval - minval, mean, stdev, npointsnull, npoints };
}

// ---------------------------------------------------------------------------
// UI helpers  (migrated from vis.helper.js)
// ---------------------------------------------------------------------------

/**
 * Show a positioned tooltip near (x, y).  Any existing #tooltip is removed first.
 * Depends on jQuery (loaded as a global).
 * @param {number} x
 * @param {number} y
 * @param {string} contents — HTML string
 * @param {string} bgColour — CSS colour string
 */
export function tooltip(x, y, contents, bgColour) {
    const offset = 15;
    const elem = $('<div id="tooltip">' + contents + '</div>').css({
        position: 'absolute',
        display: 'none',
        'font-weight': 'bold',
        border: '1px solid rgb(255, 221, 221)',
        padding: '2px',
        'background-color': bgColour,
        opacity: '0.8'
    }).appendTo('body').fadeIn(200);

    let elemY = y - elem.height() - offset;
    let elemX = x - elem.width()  - offset;
    if (elemY < 0) elemY = 0;
    if (elemX < 0) elemX = 0;
    elem.css({ top: elemY, left: elemX });
}

/**
 * Build a display name string for a feed object (or raw value).
 * Used by the feed controls table and the tooltip.
 * @param {Object|string} item
 * @returns {string}
 */
export function getFeedName(item) {
    if (typeof item !== 'object') return String(item);
    if (item.id !== undefined && item.tag !== undefined && item.name !== undefined) {
        return `${item.id}:${item.tag}:${item.name} (${getFeedUnit(item)})`;
    }
    return '';
}

/**
 * Return the unit string for a feed.  Requires access to the feeds list in state;
 * graph.chart.js has a more efficient `getFeedUnit(id)` that searches state.feeds.
 * This variant accepts the feed object directly (no state lookup needed).
 * @param {Object} feed — feed object with a `unit` property
 * @returns {string}
 */
function getFeedUnit(feed) {
    return feed.unit || '';
}
