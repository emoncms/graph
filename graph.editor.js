//----------------------------------------------------------------------------------------
// graph.editor.js - Editor UI: feed selector sidebar and view-mode controls
// Only loaded by view.php (not embed.php)
//----------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------
// Side bar feed selector and events associated with editor only, not loaded in embed mode
//----------------------------------------------------------------------------------------
function graph_init_editor()
{
    if (!feeds) feeds = feedlist;

    var numberoftags = 0;
    feedsbytag = {};
    for (var z in feeds) {
        if (feedsbytag[feeds[z].tag]==undefined) {
            feedsbytag[feeds[z].tag] = [];
            numberoftags++;
        }
        feedsbytag[feeds[z].tag].push(feeds[z]);
    }

    // Draw sidebar feed selector -------------------------------------------

    var out = "";
    out += "<colgroup>";
    out += "<col span='1' style='width: 70%;'>";
    out += "<col span='1' style='width: 15%;'>";
    out += "<col span='1' style='width: 15%;'>";
    out += "</colgroup>";

    for (var tag in feedsbytag) {
       tagname = tag;
       if (tag=="") tagname = "undefined";
       out += "<thead>";
       out += "<tr class='tagheading' data-tag='"+tagname+"' tabindex='0'>";
       out += "<th colspan='3'><span class='caret'></span>"+tagname+"</th>";
       out += "</tr>";
       out += "</thead>";
       out += "<tbody class='tagbody' data-tag='"+tagname+"'>";
       for (var z in feedsbytag[tag])
       {
           out += "<tr style='color:#666'>";
           var name = feedsbytag[tag][z].name;
           if (name && name.length>20) {
               name = name.substr(0,20)+"..";
           }
           out += "<th class='feed-title' title='"+name+"' data-feedid='"+feedsbytag[tag][z].id+"' tabindex='0'><span class='text-truncate d-inline-block'>"+name+"</span></th>";
           out += "<td><input class='feed-select-left' data-feedid='"+feedsbytag[tag][z].id+"' type='checkbox'></td>";
           out += "<td><input class='feed-select-right' data-feedid='"+feedsbytag[tag][z].id+"' type='checkbox'></td>";
           out += "</tr>";
       }
       out += "</tbody>";
    }

    // ---------------------------------------------------------------
    // Writting direct to the menu system here
    // ---------------------------------------------------------------
    // 1. Populate custom l3 menu from sidebar html placed in hidden element
    $(".menu-l3").html($("#sidebar_html").html());
    // 2. Clear original hidden element
    $("#sidebar_html").html("");
    // 3. Populate with feed list selector
    $("#feeds").html(out);
    // 4. Show l3 menu
    if (menu.width>=576) menu.show_l3();
    // 5. Enable l3 menu so that collapsing and re-expanding works
    if (menu.obj.setup!=undefined) {
        if (menu.obj.setup.l2!=undefined) {
            if (menu.obj.setup.l2.graph!=undefined) {
                menu.obj.setup.l2.graph.l3 = []
                menu.active_l3 = true;
            }
        }
    }
    if (session_write) load_saved_graphs_menu();
    // ---------------------------------------------------------------

    if (feeds.length>12 && numberoftags>2) {
        $(".tagbody").hide();
    }

    $("#info").show();
    if ($("#showmissing")[0]!=undefined) $("#showmissing")[0].checked = showmissing;
    if ($("#showtag")[0]!=undefined) $("#showtag")[0].checked = showtag;
    if ($("#showlegend")[0]!=undefined) $("#showlegend")[0].checked = showlegend;

    datetimepickerInit();

    // Events start here -------------------------------------------

    $("#reload").click(function(){
        reloadDatetimePrep();
        view.interval = $("#request-interval").val();
        view.limitinterval = $("#request-limitinterval")[0].checked*1;
        graph_reload();
    });

    $("#clear").click(function(){

        feedlist = [];
        plotdata = [];
        skipmissing = 0;
        requesttype = "interval";
        showcsv = 0;
        showmissing = false;
        showtag = true;
        showlegend = true;
        floatingtime=1;
        yaxismin="auto";
        yaxismax="auto";
        yaxismin2="auto";
        yaxismax2="auto";
        csvtimeformat="datestr";
        csvnullvalues="show";
        csvheaders="showNameTag";
        current_graph_id = "";
        current_graph_name = "";
        previousPoint = 0;
        active_histogram_feed = 0;

        var timeWindow = 3600000*24.0*7;
        var now = Math.round(+new Date * 0.001)*1000;
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

    $("body").on("click",".average",function(){
        var feedid = $(this).attr("feedid");

        for (var z in feedlist) {
            if (feedlist[z].id==feedid) {
                if ($(this)[0].checked) {
                    feedlist[z].average = 1;
                } else {
                    feedlist[z].average = 0;
                }
                break;
            }
        }
        graph_draw();
    });

    $("body").on("click", ".move-feed", function(){
        var feedid = $(this).attr("feedid")*1;
        var curpos = parseInt(feedid);
        var moveby = parseInt($(this).attr("moveby"));
        var newpos = curpos + moveby;
        if (newpos>=0 && newpos<feedlist.length){
            newfeedlist = arrayMove(feedlist,curpos,newpos);
            graph_draw();
        }
    });

    $("body").on("click",".delta",function(){
        var feedid = $(this).attr("feedid");

        for (var z in feedlist) {
            if (feedlist[z].id==feedid) {
                if ($(this)[0].checked) {
                    feedlist[z].delta = 1;
                } else {
                    feedlist[z].delta = 0;
                }
                break;
            }
        }
        graph_draw();
    });

    $("body").on("change",".linecolor",function(){
        var feedid = $(this).attr("feedid");

        for (var z in feedlist) {
            if (feedlist[z].id==feedid) {
                feedlist[z].color = $(this).val();
                break;
            }
        }
        graph_draw();
    });

    $("body").on("change",".fill",function(){
        var feedid = $(this).attr("feedid");

        for (var z in feedlist) {
            if (feedlist[z].id==feedid) {
                feedlist[z].fill = $(this)[0].checked;
                break;
            }
        }
        graph_draw();
    });

    $("body").on("change",".stack",function(){
        var feedid = $(this).attr("feedid");

        for (var z in feedlist) {
            if (feedlist[z].id==feedid) {
                feedlist[z].stack = $(this)[0].checked;
                break;
            }
        }
        graph_draw();
    });

    $("body").on("click keyup",".feed-title", function(event){
        let enterKey = 13;
        if((event.type === 'keyup' && event.which === enterKey) || event.type === 'click') {
            var feedid = $(this).data("feedid");
            $('.feed-select-left[data-feedid="' + feedid + '"]').click();
            event.preventDefault();
        }
    });

    $("body").on("click",".feed-select-left",function(){
        var feedid = $(this).data("feedid");
        var checked = $(this)[0].checked;

        var loaded = false;
        for (var z in feedlist) {
           if (feedlist[z].id==feedid) {
               if (!checked) {
                   feedlist.splice(z,1);
               } else {
                   feedlist[z].yaxis = 1;
                   loaded = true;
                   $(".feed-select-right[data-feedid="+feedid+"]")[0].checked = false;
               }
           }
        }
        if (loaded==false && checked) pushfeedlist(feedid, 1);
        graph_reload();
    });

    $("body").on("click",".feed-select-right",function(){
        var feedid = $(this).data("feedid");
        var checked = $(this)[0].checked;

        var loaded = false;
        for (var z in feedlist) {
           if (feedlist[z].id==feedid) {
               if (!checked) {
                   feedlist.splice(z,1);
               } else {
                   feedlist[z].yaxis = 2;
                   loaded = true;
                   $(".feed-select-left[data-feedid="+feedid+"]")[0].checked = false;
               }
           }
        }
        if (loaded==false && checked) pushfeedlist(feedid, 2);
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
        if ($("#showmissing")[0].checked) showmissing = true; else showmissing = false;
        graph_draw();
    });

    $("#showlegend").click(function(){
        if ($("#showlegend")[0].checked) showlegend = true; else showlegend = false;
        graph_draw();
    });

    $("#showtag").click(function(){
        if ($("#showtag")[0].checked) showtag = true; else showtag = false;
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

    $("body").on("change",".decimalpoints",function(){
        var feedid = $(this).attr("feedid");
        var dp = $(this).val();

        for (var z in feedlist) {
            if (feedlist[z].id == feedid) {
                feedlist[z].dp = dp;

                graph_draw();
                break;
            }
        }
    });

    $("body").on("change",".plottype",function(){
        var feedid = $(this).attr("feedid");
        var plottype = $(this).val();

        for (var z in feedlist) {
            if (feedlist[z].id == feedid) {
                feedlist[z].plottype = plottype;

                graph_draw();
                break;
            }
        }
    });
    // left axis
    $("body").on("change","#yaxis-min",function(){
        yaxismin = $(this).val();
        graph_draw();
    });

    $("body").on("change","#yaxis-max",function(){
        yaxismax = $(this).val();
        graph_draw();
    });
    // right axis
    $("body").on("change","#yaxis-min2",function(){
        yaxismin2 = $(this).val();
        graph_draw();
    });
    $("body").on("change","#yaxis-max2",function(){
        yaxismax2 = $(this).val();
        graph_draw();
    });
    $("body").on("click",".reset-yaxis",function(){
        $(this).parent().find('input').val('auto');
    })

    $("#csvtimeformat").change(function(){
        csvtimeformat=$(this).val();
        printcsv();
    });

    $("#csvnullvalues").change(function(){
        csvnullvalues=$(this).val();
        printcsv();
    });

    $("#csvheaders").change(function(){
        csvheaders=$(this).val();
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
        $("#feed-options-table").hide();
        $("#feed-stats-table").show();
        $(".feed-options-show-options").removeClass('hide');
        $(".feed-options-show-stats").addClass('hide');
        event.preventDefault();
    });

    $(".feed-options-show-options").click(function(event){
        $("#feed-options-table").show();
        $("#feed-stats-table").hide();
        $(".feed-options-show-options").addClass('hide');
        $(".feed-options-show-stats").removeClass('hide');
        event.preventDefault();
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
    for (var z in feeds) {
        var feedid = feeds[z].id;
        $(".feed-select-left[data-feedid="+feedid+"]")[0].checked = false;
        $(".feed-select-right[data-feedid="+feedid+"]")[0].checked = false;
    }

    for (var z=0; z<feedlist.length; z++) {
        var feedid = feedlist[z].id;
        var tag = feedlist[z].tag;
        if (tag=="") tag = "undefined";

        if (feedlist[z].yaxis==1) {
            if ($(".feed-select-left[data-feedid="+feedid+"]")[0])
                $(".feed-select-left[data-feedid="+feedid+"]")[0].checked = true; $(".tagbody[data-tag='"+tag+"']").show();
        }
        if (feedlist[z].yaxis==2) {
            if ($(".feed-select-left[data-feedid="+feedid+"]")[0])
                $(".feed-select-right[data-feedid="+feedid+"]")[0].checked = true; $(".tagbody[data-tag='"+tag+"']").show();
        }
    }
}
