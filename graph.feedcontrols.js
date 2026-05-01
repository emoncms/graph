// graph.feedcontrols.js
// Vue 3 component: feed options table and feed statistics table.
// Only mounted by view.php (not embed.php).

import { state }                    from './graph.state.js';
import { arrayMove, getFeedName }   from './graph.utils.js';
import { graphDraw, graphReload }   from './graph.chart.js';

/**
 * Mount the Vue instance on #feed-controls-app.
 * Must be called after Vue and _lang are available (from the init script).
 */
export function initFeedControlsApp() {
    Vue.createApp({
        data() { return { state }; },
        computed: {
            feedlist()       { return this.state.feedlist; },
            showStats()      { return this.state.showStats; },
            time_in_window() { return this.state.time_in_window; },
        },
        methods: {
            feedName(feed) { return getFeedName(feed); },

            // Normalise stored color for <input type="color"> which requires '#rrggbb'.
            feedColor(feed) {
                const c = feed.color;
                if (!c) return '#000000';
                return c.startsWith('#') ? c : '#' + c;
            },

            moveFeed(index, by) {
                const dest = index + by;
                if (dest >= 0 && dest < this.state.feedlist.length) {
                    this.state.feedlist = arrayMove(this.state.feedlist, index, dest);
                    graphDraw();
                }
            },

            // Render-only changes: redraw immediately.
            setPlottype(feed, e) { feed.plottype = e.target.value;         graphDraw(); },
            setColor(feed, e)    { feed.color    = e.target.value;         graphDraw(); },
            setFill(feed, e)     { feed.fill     = e.target.checked;       graphDraw(); },
            setStack(feed, e)    { feed.stack    = e.target.checked;       graphDraw(); },
            setDelta(feed, e)    { feed.delta    = e.target.checked ? 1:0; graphDraw(); },
            setAverage(feed, e)  { feed.average  = e.target.checked ? 1:0; graphDraw(); },
            setDp(feed, e)       { feed.dp       = e.target.value;         graphDraw(); },

            // Scale/offset are applied in post-processing during graphReload();
            // changing them here only marks the feed dirty — no immediate redraw.
            setScale(feed, e)  { feed.scale  = e.target.value; },
            setOffset(feed, e) { feed.offset = e.target.value; },

            feedQuality(feed) {
                const { npoints, npointsnull } = feed.stats;
                return Math.round(100 * (1 - npointsnull / npoints));
            },
            feedWh(feed) {
                return Math.round((feed.stats.mean * this.time_in_window) / 3600);
            },
        },
    }).mount('#feed-controls-app');
}
