//----------------------------------------------------------------------------------------
// graph.editor.js - Editor UI: feed selector sidebar and view-mode controls
// Only loaded by view.php (not embed.php)
//----------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------
// initFeedSelectorApp - mounts a Vue root instance on #feed-selector-app in the sidebar.
// Must be called after the sidebar HTML has been moved into the live DOM.
// Returns the Vue instance and reassigns graphState.feedlist to Vue's reactive copy.
//----------------------------------------------------------------------------------------
var feedSelectorApp = null;

function initFeedSelectorApp(feeds, feedlist) {
    // Compute initial per-tag collapsed state: collapse all tags when there are many
    // feeds and many tags, but keep expanded any tag that already has a selected feed.
    const tagMap = {};
    for (const feed of feeds) {
        const tag = feed.tag || 'undefined';
        if (!tagMap[tag]) tagMap[tag] = [];
        tagMap[tag].push(feed);
    }
    const numberoftags = Object.keys(tagMap).length;
    const collapsedTags = {};
    if (feeds.length > 12 && numberoftags > 2) {
        const selectedTags = new Set(feedlist.map(f => f.tag || 'undefined'));
        for (const tag in tagMap) {
            collapsedTags[tag] = !selectedTags.has(tag);
        }
    }

    feedSelectorApp = new Vue({
        el: '#feed-selector-app',
        data: {
            feeds: feeds,
            feedlist: feedlist,
            collapsedTags: collapsedTags
        },
        computed: {
            feedsByTag() {
                const result = {};
                for (const feed of this.feeds) {
                    const tag = feed.tag || 'undefined';
                    if (!result[tag]) result[tag] = [];
                    result[tag].push(feed);
                }
                return result;
            },
            leftChecked() {
                return new Set(this.feedlist.filter(f => f.yaxis == 1).map(f => f.id));
            },
            rightChecked() {
                return new Set(this.feedlist.filter(f => f.yaxis == 2).map(f => f.id));
            }
        },
        methods: {
            truncateName(name) {
                if (name && name.length > 20) return name.substr(0, 20) + '..';
                return name;
            },
            toggleTag(tag) {
                this.$set(this.collapsedTags, tag, !this.collapsedTags[tag]);
            },
            onFeedTitleClick(feedid) {
                // clicking the feed title toggles the left (primary) axis checkbox
                this.onLeftChange(feedid, !this.leftChecked.has(feedid));
            },
            onLeftChange(feedid, checked) {
                let loaded = false;
                for (let z = this.feedlist.length - 1; z >= 0; z--) {
                    if (this.feedlist[z].id == feedid) {
                        if (!checked) {
                            this.feedlist.splice(z, 1);
                        } else {
                            this.$set(this.feedlist[z], 'yaxis', 1);
                            loaded = true;
                        }
                    }
                }
                if (!loaded && checked) pushfeedlist(feedid, 1);
                graph_reload();
            },
            onRightChange(feedid, checked) {
                let loaded = false;
                for (let z = this.feedlist.length - 1; z >= 0; z--) {
                    if (this.feedlist[z].id == feedid) {
                        if (!checked) {
                            this.feedlist.splice(z, 1);
                        } else {
                            this.$set(this.feedlist[z], 'yaxis', 2);
                            loaded = true;
                        }
                    }
                }
                if (!loaded && checked) pushfeedlist(feedid, 2);
                graph_reload();
            }
        },
        template: '#feed-selector-template'
    });
    return feedSelectorApp;
}

//----------------------------------------------------------------------------------------
// Side bar feed selector and events associated with editor only, not loaded in embed mode
//----------------------------------------------------------------------------------------
function graph_init_editor()
{
    if (!graphState.feeds) graphState.feeds = graphState.feedlist;

    // ---------------------------------------------------------------
    // Writting direct to the menu system here
    // ---------------------------------------------------------------
    // 1. Populate custom l3 menu from sidebar html placed in hidden element
    $(".menu-l3").html($("#sidebar_html").html());
    // 2. Clear original hidden element
    $("#sidebar_html").html("");
    // 3. Mount Vue feed selector on #feed-selector-app (now in the live DOM)
    feedSelectorApp = initFeedSelectorApp(graphState.feeds, graphState.feedlist);
    graphState.feedlist = feedSelectorApp.feedlist;
    // 4. Show l3 menu
    if (menu.width >= 576) menu.show_l3();
    // 5. Enable l3 menu so that collapsing and re-expanding works
    if (menu.obj.setup != undefined) {
        if (menu.obj.setup.l2 != undefined) {
            if (menu.obj.setup.l2.graph != undefined) {
                menu.obj.setup.l2.graph.l3 = [];
                menu.active_l3 = true;
            }
        }
    }
    if (session_write) load_saved_graphs_menu();
    // ---------------------------------------------------------------

    $("#info").show();
    if ($("#showmissing")[0]!=undefined) $("#showmissing")[0].checked = graphState.showmissing;
    if ($("#showtag")[0]!=undefined) $("#showtag")[0].checked = graphState.showtag;
    if ($("#showlegend")[0]!=undefined) $("#showlegend")[0].checked = graphState.showlegend;

    datetimepickerInit();
    // Activate Vue watchers that sync view.start/end/interval/limitinterval → DOM controls.
    // Must be called after datetimepickerInit() so the pickers are ready.
    initViewWatcher();

    // Events start here -------------------------------------------

    $("#reload").click(function(){
        reloadDatetimePrep();
        view.interval = $("#request-interval").val();
        view.limitinterval = $("#request-limitinterval")[0].checked*1;
        graph_reload();
    });

    $("#clear").click(function(){

        feedSelectorApp.feedlist.splice(0);
        graphState.feedlist = feedSelectorApp.feedlist;
        plotdata = [];
        requesttype = "interval";
        previousPoint = 0;
        resetGraphState();

        const timeWindow = 3600000 * 24.0 * 7;
        const now = Math.round(+new Date() * 0.001) * 1000;
        view.start = now - timeWindow;
        view.end = now;
        view.calc_interval();

        graph_reload();
    });

    $("#showcsv").click(function(){
        csvShowHide("swap");
    });
    $(".csvoptions").hide();

    $("#showmissing").click(function(){
        graphState.showmissing = $("#showmissing")[0].checked;
        graph_draw();
    });

    $("#showlegend").click(function(){
        graphState.showlegend = $("#showlegend")[0].checked;
        graph_draw();
    });

    $("#showtag").click(function(){
        graphState.showtag = $("#showtag")[0].checked;
        graph_draw();
    });

    $("#request-fixinterval").click(function(){
        if ($("#request-fixinterval")[0].checked) view.fixinterval = true; else view.fixinterval = false;
        if (view.fixinterval) {
            $("#request-interval").prop('disabled', true);
        } else {
            $("#request-interval").prop('disabled', false);
        }
    });

    $("#request-type").val("interval");
    $("#request-type").change(function() {
        var mode = $(this).val();

        if (mode!="interval") {
            $(".fixed-interval-options").hide();
            view.fixinterval = true;
        } else {
            $(".fixed-interval-options").show();
            view.fixinterval = false;
        }
        view.mode = mode

        // Intervals are set here for bar graph bar width sizing
        // and for changing between interval and daily, weekly, monthly, annual modes
        if (mode=="daily") view.interval = 86400;
        if (mode=="weekly") view.interval = 86400*7;
        if (mode=="monthly") view.interval = 86400*30;
        if (mode=="annual") view.interval = 86400*365;
        // view.interval watcher syncs the new value to #request-interval automatically.
        graph_reload();
    });

    // left axis
    $("body").on("change","#yaxis-min",function(){
        graphState.yaxismin = $(this).val();
        graph_draw();
    });

    $('body').on("change","#yaxis-max",function(){
        graphState.yaxismax = $(this).val();
        graph_draw();
    });
    // right axis
    $('body').on("change","#yaxis-min2",function(){
        graphState.yaxismin2 = $(this).val();
        graph_draw();
    });
    $('body').on("change","#yaxis-max2",function(){
        graphState.yaxismax2 = $(this).val();
        graph_draw();
    });

    $("#csvtimeformat").change(function(){
        graphState.csvtimeformat = $(this).val();
        printcsv();
    });

    $("#csvnullvalues").change(function(){
        graphState.csvnullvalues = $(this).val();
        printcsv();
    });

    $("#csvheaders").change(function(){
        graphState.csvheaders = $(this).val();
        printcsv();
    });

    $("#download-csv").click(function(){
        download_data("graph.csv", $("#csv").val())
    });

    $('body').on("click",".legendColorBox",function(d){
          var country = $(this).html().toLowerCase();
        //   console.log(country);
    });

    $(".feed-options-show-stats").click(function(event){
        graphState.showStats = true;
        // initViewWatcher() handles the button visibility DOM updates.
        event.preventDefault();
        event.stopPropagation();
    });

    $(".feed-options-show-options").click(function(event){
        graphState.showStats = false;
        event.preventDefault();
        event.stopPropagation();
    });

    // Reload feeds if remove-null is changed or remove-null-max-duration is changed
    $(".remove-null").change(function(){
        graphState.removeNull = $(".remove-null")[0].checked;
        graph_reload();
    });

    $(".remove-null-max-duration").change(function(){
        graphState.removeNullMaxDuration = parseFloat($(".remove-null-max-duration").val()) || 900;
        graph_reload();
    });

    // Fix: reset-yaxis must also update graphState so the next graph_draw uses the reset value.
    $("body").on("click",".reset-yaxis",function(){
        $(this).parent().find('input').each(function() {
            $(this).val('auto');
            const key = $(this).attr('id').replace(/-/g, ''); // e.g. "yaxis-min" -> "yaxismin"
            graphState[key] = 'auto';
        });
        graph_draw();
    });

    /**
     * show sidebar if mobile view hiding sidebar
     */
    $(document).on('click', '.alert a.open-sidebar', function(event) {
        if (typeof show_sidebar !== 'undefined') {
            show_sidebar();
            // @todo: ensure the 3rd level graph menu is open
        }
        return false;
    });
}

function load_feed_selector() {
    // Checkbox state is driven by Vue reactivity via feedSelectorApp.feedlist.
    // Ensure tag sections containing selected feeds are expanded.
    if (!feedSelectorApp) return;
    for (const feed of graphState.feedlist) {
        const tag = feed.tag || 'undefined';
        feedSelectorApp.$set(feedSelectorApp.collapsedTags, tag, false);
    }
}
