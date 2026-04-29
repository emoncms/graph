//----------------------------------------------------------------------------------------
// graph.editor.js - Editor UI: feed selector sidebar and view-mode controls
// Only loaded by view.php (not embed.php)
//----------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------
// buildFeedSelectorHTML - builds the HTML for the sidebar feed selector table
// Returns { html, feedsbytag, numberoftags }
//----------------------------------------------------------------------------------------
function buildFeedSelectorHTML(feeds) {
    const feedsbytag = {};
    let numberoftags = 0;
    for (const feed of feeds) {
        if (feedsbytag[feed.tag] === undefined) {
            feedsbytag[feed.tag] = [];
            numberoftags++;
        }
        feedsbytag[feed.tag].push(feed);
    }

    let out = `<colgroup>
        <col span='1' style='width: 70%;'>
        <col span='1' style='width: 15%;'>
        <col span='1' style='width: 15%;'>
    </colgroup>`;

    for (const tag in feedsbytag) {
        const tagname = tag || 'undefined';
        out += `<thead>
            <tr class='tagheading' data-tag='${tagname}' tabindex='0'>
                <th colspan='3'><span class='caret'></span>${tagname}</th>
            </tr>
        </thead>
        <tbody class='tagbody' data-tag='${tagname}'>`;
        for (const feed of feedsbytag[tag]) {
            let name = feed.name;
            if (name && name.length > 20) name = name.substr(0, 20) + '..';
            out += `<tr style='color:#666'>
                <th class='feed-title' title='${name}' data-feedid='${feed.id}' tabindex='0'><span class='text-truncate d-inline-block'>${name}</span></th>
                <td><input class='feed-select-left' data-feedid='${feed.id}' type='checkbox'></td>
                <td><input class='feed-select-right' data-feedid='${feed.id}' type='checkbox'></td>
            </tr>`;
        }
        out += '</tbody>';
    }
    return { html: out, feedsbytag, numberoftags };
}

//----------------------------------------------------------------------------------------
// Side bar feed selector and events associated with editor only, not loaded in embed mode
//----------------------------------------------------------------------------------------
function graph_init_editor()
{
    if (!graphState.feeds) graphState.feeds = graphState.feedlist;

    // Draw sidebar feed selector -------------------------------------------
    const { html, feedsbytag, numberoftags } = buildFeedSelectorHTML(graphState.feeds);

    // ---------------------------------------------------------------
    // Writting direct to the menu system here
    // ---------------------------------------------------------------
    // 1. Populate custom l3 menu from sidebar html placed in hidden element
    $(".menu-l3").html($("#sidebar_html").html());
    // 2. Clear original hidden element
    $("#sidebar_html").html("");
    // 3. Populate with feed list selector
    $("#feeds").html(html);
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

    if (graphState.feeds.length > 12 && numberoftags > 2) {
        $(".tagbody").hide();
    }

    $("#info").show();
    if ($("#showmissing")[0]!=undefined) $("#showmissing")[0].checked = graphState.showmissing;
    if ($("#showtag")[0]!=undefined) $("#showtag")[0].checked = graphState.showtag;
    if ($("#showlegend")[0]!=undefined) $("#showlegend")[0].checked = graphState.showlegend;

    datetimepickerInit();

    // Events start here -------------------------------------------

    $("#reload").click(function(){
        reloadDatetimePrep();
        view.interval = $("#request-interval").val();
        view.limitinterval = $("#request-limitinterval")[0].checked*1;
        graph_reload();
    });

    $("#clear").click(function(){

        graphState.feedlist = [];
        plotdata = [];
        graphState.skipmissing = 0;
        requesttype = "interval";
        graphState.showcsv = 0;
        graphState.showmissing = false;
        graphState.showtag = true;
        graphState.showlegend = true;
        graphState.floatingtime = 1;
        graphState.yaxismin = "auto";
        graphState.yaxismax = "auto";
        graphState.yaxismin2 = "auto";
        graphState.yaxismax2 = "auto";
        graphState.csvtimeformat = "datestr";
        graphState.csvnullvalues = "show";
        graphState.csvheaders = "showNameTag";
        graphState.current_graph_id = "";
        graphState.current_graph_name = "";
        previousPoint = 0;
        graphState.active_histogram_feed = 0;

        const timeWindow = 3600000 * 24.0 * 7;
        const now = Math.round(+new Date() * 0.001) * 1000;
        view.start = now - timeWindow;
        view.end = now;
        view.calc_interval();

        load_feed_selector();
        graph_reload();
    });

    $("#showcsv").click(function(){
        csvShowHide("swap");
    });
    $(".csvoptions").hide();

    $("body").on("click keyup",".feed-title", function(event){
        let enterKey = 13;
        if((event.type === 'keyup' && event.which === enterKey) || event.type === 'click') {
            var feedid = $(this).data("feedid");
            $('.feed-select-left[data-feedid="' + feedid + '"]').click();
            event.preventDefault();
        }
    });

    $("body").on("click",".feed-select-left",function(){
        const feedid = $(this).data("feedid");
        const checked = $(this)[0].checked;

        let loaded = false;
        for (const z in graphState.feedlist) {
            if (graphState.feedlist[z].id == feedid) {
                if (!checked) {
                    graphState.feedlist.splice(z, 1);
                } else {
                    graphState.feedlist[z].yaxis = 1;
                    loaded = true;
                    $(".feed-select-right[data-feedid="+feedid+"]")[0].checked = false;
                }
            }
        }
        if (!loaded && checked) pushfeedlist(feedid, 1);
        graph_reload();
    });

    $("body").on("click",".feed-select-right",function(){
        const feedid = $(this).data("feedid");
        const checked = $(this)[0].checked;

        let loaded = false;
        for (const z in graphState.feedlist) {
            if (graphState.feedlist[z].id == feedid) {
                if (!checked) {
                    graphState.feedlist.splice(z, 1);
                } else {
                    graphState.feedlist[z].yaxis = 2;
                    loaded = true;
                    $(".feed-select-left[data-feedid="+feedid+"]")[0].checked = false;
                }
            }
        }
        if (!loaded && checked) pushfeedlist(feedid, 2);
        graph_reload();
    });

    $("body").on("click keyup",".tagheading",function(event){
        let enterKey = 13;

        if((event.type === 'keyup' && event.which === enterKey) || event.type === 'click') {
            var tag = $(this).data("tag");
            var e = $(".tagbody[data-tag='"+tag+"']");
            if (e.is(":visible")) e.hide(); else e.show();
            event.preventDefault();
        }
    });

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

        $("#request-interval").val(view.interval);
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
    $("body").on("click",".reset-yaxis",function(){
        $(this).parent().find('input').val('auto');
    })

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
        $(".feed-options-show-options").removeClass('hide');
        $(".feed-options-show-stats").addClass('hide');
        event.preventDefault();
        event.stopPropagation();
    });

    $(".feed-options-show-options").click(function(event){
        graphState.showStats = false;
        $(".feed-options-show-options").addClass('hide');
        $(".feed-options-show-stats").removeClass('hide');
        event.preventDefault();
        event.stopPropagation();
    });

    // Reload feeds if remove-null is changed or remove-null-max-duration is changed
    $(".remove-null").change(function(){
        graph_reload();
    });

    $(".remove-null-max-duration").change(function(){
        graph_reload();
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
    for (const z in graphState.feeds) {
        const feedid = graphState.feeds[z].id;
        $(".feed-select-left[data-feedid="+feedid+"]")[0].checked = false;
        $(".feed-select-right[data-feedid="+feedid+"]")[0].checked = false;
    }

    for (let z=0; z<graphState.feedlist.length; z++) {
        const feedid = graphState.feedlist[z].id;
        let tag = graphState.feedlist[z].tag;
        if (tag=="") tag = "undefined";

        if (graphState.feedlist[z].yaxis==1) {
            if ($(".feed-select-left[data-feedid="+feedid+"]")[0])
                $(".feed-select-left[data-feedid="+feedid+"]")[0].checked = true; $(".tagbody[data-tag='"+tag+"']").show();
        }
        if (graphState.feedlist[z].yaxis==2) {
            if ($(".feed-select-left[data-feedid="+feedid+"]")[0])
                $(".feed-select-right[data-feedid="+feedid+"]")[0].checked = true; $(".tagbody[data-tag='"+tag+"']").show();
        }
    }
}
