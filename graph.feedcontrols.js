//----------------------------------------------------------------------------------------
// graph.feedcontrols.js - Reactive feed options table (Vue 2)
// Only loaded by view.php (not embed.php).
// Call initFeedControlsApp() after _lang is defined (from the view.php init script).
//----------------------------------------------------------------------------------------
function initFeedControlsApp() {
    new Vue({
        el: '#feed-controls-app',
        data() {
            return { state: graphState };
        },
        computed: {
            feedlist()      { return this.state.feedlist; },
            showStats()     { return this.state.showStats; },
            time_in_window(){ return this.state.time_in_window; },
        },
        methods: {
            feedName(feed) {
                return getFeedName(feed);
            },
            // Normalise stored color (may be '#rrggbb', 'rrggbb', or undefined) for
            // the <input type="color"> which requires a full 6-digit '#rrggbb' value.
            feedColor(feed) {
                const c = feed.color;
                if (!c) return '#000000';
                return c.startsWith('#') ? c : '#' + c;
            },
            moveFeed(index, by) {
                const newpos = index + by;
                if (newpos >= 0 && newpos < this.state.feedlist.length) {
                    this.state.feedlist = arrayMove(this.state.feedlist, index, newpos);
                    graph_draw();
                }
            },
            // Controls that only affect rendering — call graph_draw() immediately.
            setPlottype(feed, e) { feed.plottype = e.target.value; graph_draw(); },
            setColor(feed, e)    { feed.color    = e.target.value; graph_draw(); },
            setFill(feed, e)     { feed.fill     = e.target.checked; graph_draw(); },
            setStack(feed, e)    { feed.stack    = e.target.checked; graph_draw(); },
            setDelta(feed, e)    { feed.delta    = e.target.checked ? 1 : 0; graph_draw(); },
            setAverage(feed, e)  { feed.average  = e.target.checked ? 1 : 0; graph_draw(); },
            setDp(feed, e)       { feed.dp       = e.target.value; graph_draw(); },
            // Scale and offset are applied to data in processFeedlistData() during
            // graph_reload().  Updating graphState here is enough — no immediate redraw.
            setScale(feed, e)    { feed.scale    = e.target.value; },
            setOffset(feed, e)   { feed.offset   = e.target.value; },
            feedQuality(feed) {
                return Math.round(100 * (1 - (feed.stats.npointsnull / feed.stats.npoints)));
            },
            feedWh(feed) {
                return Math.round((feed.stats.mean * this.time_in_window) / 3600);
            },
        },
    });
}
