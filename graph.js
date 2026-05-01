// graph.js
// Entry point for the graph module — loaded as <script type="module">.
//
// Responsibilities:
//   1. Make state reactive (Vue.reactive) so Vue components track mutations.
//   2. Register cross-module callbacks that would otherwise create circular imports.
//   3. Fetch the user's feed list.
//   4. Initialise the correct startup path (view.php vs embed.php).
//
// All logic lives in the imported modules; this file just wires them together.

import { state, calcInterval, setTimeWindow } from './graph.state.js';
import { configure as apiConfigure, fetchFeedList, fetchPublicFeedList } from './graph.api.js';
import {
    graphResize, graphReload, graphDraw,
    datetimepickerInit, initViewWatcher,
    registerCsvPrinter, setEmbed,
    pushfeedlist,
} from './graph.chart.js';
import { printCsv }    from './graph.csv.js';
import { initEditor }  from './graph.editor.js';

// ---------------------------------------------------------------------------
// 1. State is made reactive at source in graph.state.js via Vue.reactive().
//    No additional wrapping is needed here.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 2. Register cross-module callbacks
// ---------------------------------------------------------------------------
registerCsvPrinter(printCsv);

// Expose a few functions on window so legacy plain-<script> callbacks
// (e.g. the _locale_loaded hook in view.php) can still call them by name.
window.graph_reload = graphReload;
window.graph_resize = graphResize;

// ---------------------------------------------------------------------------
// 3. Configure API and fetch feed list
//    PHP injects `path`, `apikey`, `apikeystr`, `public_userid`,
//    `public_username`, `feedidsLH`, `feedidsRH`, `load_savegraphs`
//    as globals in the <script> block inside view.php / embed.php.
// ---------------------------------------------------------------------------
apiConfigure(path, apikey);

async function loadFeeds() {
    if (typeof public_userid !== 'undefined' && public_userid) {
        const username = typeof public_username !== 'undefined' ? public_username + '/' : '';
        state.feeds = await fetchPublicFeedList(username);
    } else {
        state.feeds = await fetchFeedList();
    }
}

// ---------------------------------------------------------------------------
// 4a. View.php startup
// ---------------------------------------------------------------------------
async function initView() {
    await loadFeeds();

    if (typeof load_savegraphs !== 'undefined' && load_savegraphs !== '') {
        // A saved graph id was passed in the URL — editor will load it.
    } else {
        // Populate feedlist from URL path and LH/RH query params.
        const urlparts = window.location.pathname.split('graph/');
        if (urlparts.length === 2) {
            for (const id of urlparts[1].split(',').map(Number).filter(Boolean)) {
                await pushfeedlist(id, 1);
            }
        }
        if (typeof feedidsLH !== 'undefined' && feedidsLH !== '') {
            for (const id of feedidsLH.split(',').map(Number).filter(Boolean)) {
                await pushfeedlist(id, 1);
            }
        }
        if (typeof feedidsRH !== 'undefined' && feedidsRH !== '') {
            for (const id of feedidsRH.split(',').map(Number).filter(Boolean)) {
                await pushfeedlist(id, 2);
            }
        }
    }

    initEditor();   // mounts sidebar + all event handlers
    graphResize();

    state.end   = Math.round(Date.now() / 1000) * 1000;
    state.start = state.end - 3600000 * 24 * 7;
    calcInterval(min_feed_interval);

    graphReload();
}

// ---------------------------------------------------------------------------
// 4b. Embed.php startup
// ---------------------------------------------------------------------------
async function initEmbed() {
    setEmbed(true);

    const res = await fetch(path + 'graph/get?id=' + graphid + (apikey ? '&apikey=' + apikey : ''));
    const graph = await res.json();

    // fromSavePayload handles all state fields including feedlist.
    const { fromSavePayload } = await import('./graph.state.js');
    fromSavePayload(graph);

    // Feeds list only needed for unit lookups in the tooltip.
    await loadFeeds();

    datetimepickerInit();
    graphResize();
    graphReload();
}

// ---------------------------------------------------------------------------
// Boot — choose path based on which global flag embed.php sets.
// ---------------------------------------------------------------------------
if (typeof embed !== 'undefined' && embed) {
    initEmbed().catch(console.error);
} else {
    initView().catch(console.error);
}
