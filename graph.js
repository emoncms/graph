//----------------------------------------------------------------------------------------
// graph.js used by both view.php and embed.php
//----------------------------------------------------------------------------------------
var feeds = [];
feedlist = [];
var plotdata = [];
var datetimepicker1;
var datetimepicker2;

var embed = false;

var skipmissing = 0;
var requesttype = "interval";
var showcsv = 0;

var showmissing = false;
var showtag = true;
var showlegend = true;

var floatingtime=1;
var yaxismin="auto";
var yaxismax="auto";
var yaxismin2="auto";
var yaxismax2="auto";

var csvtimeformat="datestr";
var csvnullvalues="show";
var csvheaders="showNameTag";

var current_graph_id = "";
var current_graph_name = "";

var previousPoint = 0;
var active_histogram_feed = 0;

var saveGraphsApp = false;
var panning = false;

//----------------------------------------------------------------------------------------
// Events shared by both view and embed mode
//----------------------------------------------------------------------------------------
$("#graph_zoomout").click(function () {floatingtime=0; view.zoomout(); graph_reload();});
$("#graph_zoomin").click(function () {floatingtime=0; view.zoomin(); graph_reload();});
$('#graph_right').click(function () {floatingtime=0; view.panright(); graph_reload();});
$('#graph_left').click(function () {floatingtime=0; view.panleft(); graph_reload();});
$('.graph_time').change(function () {
    floatingtime=1;
    view.timewindow($(this).val()/24.0);
    view.calc_interval();
    graph_reload();
});
$('.graph_time_refresh').click(function () {
    floatingtime=1;
    view.timewindow($('.graph_time').val()/24.0);
    view.calc_interval();
    graph_reload();
});
// Graph zooming
$('#placeholder').bind("plotselected", function (event, ranges) {
    floatingtime=0;
    view.start = ranges.xaxis.from;
    view.end = ranges.xaxis.to;
    view.calc_interval();
    timeWindowChanged = 1;
    graph_reload();
    panning = true; setTimeout(function() {panning = false; }, 100);
});
$('#placeholder').bind("plothover", function (event, pos, item) {
    var item_value;
    if (item) {
        var z = item.dataIndex;
        if (previousPoint != item.datapoint) {
            var dp=feedlist[item.seriesIndex].dp;
            var feedid = feedlist[item.seriesIndex].id;
            previousPoint = item.datapoint;

            $("#tooltip").remove();
            var item_time = item.datapoint[0];
            if (typeof(item.datapoint[2])==="undefined") {
                item_value=item.datapoint[1].toFixed(dp);
            } else {
                item_value=(item.datapoint[1]-item.datapoint[2]).toFixed(dp);
            }
            item_value+=' '+getFeedUnit(feedid);
            var date = moment(item_time).format('llll')
            tooltip(item.pageX, item.pageY, "<span style='font-size:11px'>"+item.series.label+"</span>"+
            "<br>"+item_value +
            "<br><span style='font-size:11px'>"+date+"</span>"+
            "<br><span style='font-size:11px'>("+(item_time/1000)+")</span>", "#fff");
        }
    } else $("#tooltip").remove();
});

// Graph click
//$("#placeholder").bind("touchstarted", function (event, pos) {
//    $("#legend").hide();
//    showlegend = false;
//});

$("#placeholder").bind("touchended", function (event, ranges) {
    if (ranges.xaxis.from!=undefined) {
        view.start = ranges.xaxis.from;
        view.end = ranges.xaxis.to;
        view.calc_interval();
        timeWindowChanged = 1;
        graph_reload();
        panning = true; setTimeout(function() {panning = false; }, 100);
    }
});

// on finish sidebar hide/show
$(document).on('window.resized hidden.sidebar.collapse shown.sidebar.collapse', function() {
    graph_resize();
    graph_draw();
})

function graph_resize() 
{
    var top_offset = 0;
    if (embed) top_offset = 35;
    var placeholder_bound = $('#placeholder_bound');
    var placeholder = $('#placeholder');

    var width = placeholder_bound.width();
    var height = width * 0.5;
    if (height<300) height = 300;
    if (embed) height = $(window).height();

    placeholder.width(width);
    placeholder_bound.height(height-top_offset);
    placeholder.height(height-top_offset);
}

function datetimepickerInit()
{
    $("#datetimepicker1").datetimepicker({
        language: 'en-EN'
    });

    $("#datetimepicker2").datetimepicker({
        language: 'en-EN'
    });

    // only used in embed mode
    $('.navigation-timewindow').click(function () {
        $("#navigation-timemanual").show();
        $("#navigation").hide();
    });

    // only used in embed mode
    $('.navigation-timewindow-set').click(function () {
        $("#navigation-timemanual").hide();
        $("#navigation").show();
        reloadDatetimePrep();
        graph_reload();
    });

    // $('#datetimepicker1').on("changeDate", function (e) { }); // Could use for rounding on selection
    // $('#datetimepicker2').on("changeDate", function (e) { }); // Could use for rounding on selection

    datetimepicker1 = $('#datetimepicker1').data('datetimepicker');
    datetimepicker2 = $('#datetimepicker2').data('datetimepicker');
}

function reloadDatetimePrep()
{
    var timewindowStart = parseTimepickerTime($("#request-start").val());
    var timewindowEnd = parseTimepickerTime($("#request-end").val());
    if (!timewindowStart) { alert("Please enter a valid start date."); return false; }
    if (!timewindowEnd) { alert("Please enter a valid end date."); return false; }
    if (timewindowStart>=timewindowEnd) { alert("Start date must be further back in time than end date."); return false; }

    view.start = timewindowStart*1000;
    view.end = timewindowEnd*1000;
}

//----------------------------------------------------------------------------------------
// Side bar feed selector and events associated with editor only, not loaded in embed mode
//----------------------------------------------------------------------------------------
function graph_init_editor()
{
    if (!session && !userid) feeds = feedlist;

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
        menu.obj.setup.l2.graph.l3 = []
        menu.active_l3 = true;
    }
    load_saved_graphs_menu();
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

    $("body").on("click",".getaverage",function(){
        var feedid = $(this).attr("feedid");

        for (var z in feedlist) {
            if (feedlist[z].id==feedid) {
                feedlist[z].getaverage = $(this)[0].checked;
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
                feedlist[z].delta = $(this)[0].checked;
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

function pushfeedlist(feedid, yaxis) {
    var f = getfeed(feedid);
    var dp=0;

    if (f==false) f = getfeedpublic(feedid);
    if (f!=false) {
        if (f.value % 1 !== 0 ) dp=1;
        feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:yaxis, fill:0, scale: 1.0, offset: 0.0, delta:false, getaverage:false, dp:dp, plottype:'lines'});
    }
}

function graph_reload()
{
    var ds = new Date(view.start);
    var de = new Date(view.end);
    
    // Round start and end time
    if (view.mode=="daily" || view.mode=="weekly") {
        view.start = (new Date(ds.getFullYear(), ds.getMonth(), ds.getDate(), 0,0,0,0)).getTime();
        view.end = (new Date(de.getFullYear(), de.getMonth(), de.getDate(), 0,0,0,0)).getTime();
    } else if (view.mode=="monthly") {
        var month_offset = 0;
        if (ds.getMonth()==de.getMonth()) month_offset = 1; 
        view.start = (new Date(ds.getFullYear(), ds.getMonth(), 1, 0,0,0,0)).getTime();
        view.end = (new Date(de.getFullYear(), de.getMonth()+month_offset, 1, 0,0,0,0)).getTime();
    } else if (view.mode=="annual") {
        var year_offset = 0;
        if (ds.getFullYear()==de.getFullYear()) year_offset = 1; 
        view.start = (new Date(ds.getFullYear(), 0, 1, 0,0,0,0)).getTime();
        view.end = (new Date(de.getFullYear()+1, 0, 1, 0,0,0,0)).getTime();
    } else {
        view.start = Math.floor((view.start*0.001) / view.interval) * view.interval * 1000;
        view.end = Math.ceil((view.end*0.001) / view.interval) * view.interval * 1000;
    }

    if(datetimepicker1) {
        datetimepicker1.setLocalDate(new Date(view.start));
        datetimepicker1.setEndDate(new Date(view.end));
    }
    if(datetimepicker2) {
        datetimepicker2.setLocalDate(new Date(view.end));
        datetimepicker2.setStartDate(new Date(view.start));
    }

    $("#request-interval").val(view.interval);
    $("#request-limitinterval").attr("checked",view.limitinterval);

    var ids = [];
    var average_ids = [];

    // create array of selected feed ids
    for (var z in feedlist) {
        if (feedlist[z].getaverage) {
            average_ids.push(feedlist[z].id);
        } else {
            ids.push(feedlist[z].id);
        }
    }
    var data = {
        ids: ids.join(','),
        start: view.start,
        end: view.end,
        skipmissing: skipmissing,
        limitinterval: view.limitinterval,
        apikey: apikey
    }
    if (view.mode!="interval") {
        data.interval = view.mode;
    } else {
        data.interval = view.interval;
    }

    if (ids.length + average_ids.length === 0) {
        graph_resize();
        graph_draw();
        var title = _lang['Select a feed'] + '.';
        var message = _lang['Please select a feed from the Feeds List'];
        var icon = '<svg class="icon show_chart"><use xlink:href="#icon-show_chart"></use></svg>';
        var markup = ['<div class="alert alert-info"><a href="#" class="open-sidebar"><strong>',icon,title,'</strong>',message,'</a></div>'].join(' ');
        $('#error').show()
        .html(markup);
        return false;
    } else {
        $('#graph-wrapper').removeClass('empty');
        $('#cloned_toggle').remove();
    }
    if (ids.length > 0) {
        // get feedlist data
        $.getJSON(path+"feed/data.json", data, addFeedlistData)
        .fail(handleFeedlistDataError)
        .done(checkFeedlistData);
    }
    if (average_ids.length > 0) {
        // get feedlist average data
        var average_ajax_data = $.extend({}, data, {ids: average_ids.join(','), average:1});
        $.getJSON(path+"feed/data.json", average_ajax_data, addFeedlistData)
        .fail(handleFeedlistDataError)
        .done(checkFeedlistData);
    }
}

function addFeedlistData(response){
    // loop through feedlist and add response data to data property
    var valid = false;
    for (i in feedlist) {
        let feed = feedlist[i];
        for (j in response) {
            let item = response[j];
            if (parseInt(feed.id) === parseInt(item.feedid) && item.data!=undefined) {
                feed.postprocessed = false;
                feed.data = item.data;
            }
            if (!item || !item.data || typeof item.data.success === 'undefined') {
                valid = true;
            }
        }
    }
    // alter feedlist base on user selection
    if (valid) set_feedlist();
}
function handleFeedlistDataError(jqXHR, error, message){
    error = error === 'parsererror' ? _('Received data not in correct format. Check the logs for more details'): error;
    var errorstr = '<div class="alert alert-danger" title="'+message+'"><strong>'+_('Request error')+':</strong> ' + error + '</div>';
    $('#error').html(errorstr).show();
}
function checkFeedlistData(response){
    // display message to user if response not valid
    var message = '';
    var messages = [];
    var badfeeds = [];
    if (typeof(response) === 'object' && response.message) {
        if (response.success === false && response.feeds ) badfeeds = badfeeds.concat(response.feeds);
        messages.push(response.message);
    } else
    for (i in response) {
        var item = response[i];
        if (typeof item.data !== 'undefined') {
            if (typeof item.data.success !== 'undefined' && !item.data.success) {
                messages.push(item.data.message);
            }
        } else {
            // response is jqXHR object
            messages.push(response.responseText);
        }
    }
    message = messages.join(', ');
    var errorstr = '';
    if (messages.length > 0) {
        errorstr = '<div class="alert alert-danger"><strong>'+_('Request error')+':</strong> ' + message;
        if( badfeeds.length )
            errorstr += '<button id="remove_missing" type="button" class="btn">'+_('Remove missing') + '</button>';
        errorstr += '</div>'
        $('#error').html(errorstr).show();
        if( badfeeds.length )
            $('#remove_missing').click(() => {
                feedlist = feedlist.filter((feed)=>!badfeeds.find((id)=>feed.id === id));
                graph_reload();
            });
    } else {
        $('#error').hide();
    }
}

function set_feedlist() {
    for (var z in feedlist)
    {
        var scale = $(".scale[feedid="+feedlist[z].id+"]").val();
        if (scale!=undefined) feedlist[z].scale = scale;
        var offset = $(".offset[feedid="+feedlist[z].id+"]").val();
        if (offset!=undefined) feedlist[z].offset = offset;
        
        // check to ensure feed scaling and data are only applied once
        if (feedlist[z].postprocessed==false) {
            feedlist[z].postprocessed = true;
            console.log("postprocessing feed "+feedlist[z].id+" "+feedlist[z].name);

            // Apply delta adjustement to feed values
            if (feedlist[z].delta) {
                for (var i=1; i<feedlist[z].data.length; i++) {
                    // compute feedlist[z].data[i-1]
                    if (feedlist[z].data[i-1][1] == null || feedlist[z].data[i][1] == null) {
                        feedlist[z].data[i-1][1] = null;
                    }
                    else {
                        feedlist[z].data[i-1][1] = feedlist[z].data[i][1] - feedlist[z].data[i-1][1];
                    }
                }
                feedlist[z].data[feedlist[z].data.length-1][1] = null;
            }

            // Apply a scale to feed values
            if (feedlist[z].scale!=undefined && feedlist[z].scale!=1.0) {
                for (var i=0; i<feedlist[z].data.length; i++) {
                    if (feedlist[z].data[i][1]!=null) {
                        feedlist[z].data[i][1] = feedlist[z].data[i][1] * feedlist[z].scale;
                    }
                }
            }
            
            // Apply a offset to feed values
            if (feedlist[z].offset!=undefined && feedlist[z].offset!=0.0) {
                for (var i=0; i<feedlist[z].data.length; i++) {
                    if (feedlist[z].data[i][1]!=null) {
                        feedlist[z].data[i][1] = feedlist[z].data[i][1] + 1*feedlist[z].offset;
                    }
                }
            } 
        }
    }
    // call graph_draw() once feedlist is altered
    graph_draw();
}

function group_legend_values(_flot, placeholder) {
    var legend = document.getElementById('legend');
    var current_legend = placeholder[0].nextSibling;
    if (!current_legend) {
        legend.innerHTML = '';
        return;
    }
    var current_legend_labels = current_legend.querySelector('table tbody');
    var rows = Object.values(current_legend_labels.childNodes);
    var left = [];
    var right = [];
    var output = "";

    for (n in rows){
        var row = rows[n];
        var isRight = row.querySelector('.label-right');
        if (isRight){
            right.push(row);
        } else {
            left.push(row);
        }
    }

    output += '<div class="grid-container">';
    output += '    <div class="col left">';
    output += '      <ul class="unstyled">';
    output += build_rows(left);
    output += '      </ul>';
    output += '    </div>';
    output += '    <div class="col right">';
    output += '      <ul class="unstyled">';
    output += build_rows(right);
    output += '      </ul>';
    output += '    </div>';
    output += '</div>';
    // populate new legend with html
    legend.innerHTML = output;
    // hide old legend
    current_legend.style.display = 'none';
    // add onclick events to links within legend
    var items = legend.querySelectorAll('[data-legend-series]');
    for(i = 0; i < items.length; i++) {
        var item = items[i];
        var link = item.querySelector('a');
        // handle click of legend link
        if (!link) continue;
        link.addEventListener('click', onClickLegendLink)
    }
}
function onClickLegendLink(event) {
    event.preventDefault();
    var link = event.currentTarget;
    // toggle opacity of the link
    link.classList.toggle('faded');
    // re-draw the chart with the plot lines hidden/shown
    var index = link.dataset.index;
    var current_data = plot_statistics.getData()
    var feed = feedlist.find(function(item) { return item.id == this; }, current_data[index].id);
    if (feed == undefined) return;
    switch (feed.plottype) {
        case 'lines': current_data[index].lines.show = !current_data[index].lines.show; break;
        case 'bars': current_data[index].bars.show = !current_data[index].bars.show; break;
        case 'points': current_data[index].points.show = !current_data[index].points.show; break;
    }
    plot_statistics.setData(current_data);
    // re-draw
    plot_statistics.draw();
}
function build_rows(rows) {
    var output = "";
    for (x in rows) {
        var row = rows[x];
        var label = row.querySelector('.legendLabel')
        var span = label.querySelector('span');
        var index = span.dataset.index;
        var id = span.dataset.id;
        var colour = '<div class="legendColorBox">' + row.querySelector('.legendColorBox').innerHTML + '</div>'
        // add <li> to the html
        output += '      <li data-legend-series><a href="' + path + 'graph/' + id + '" data-index="' + index + '" data-id="' + id + '">' + colour + label.innerText + '</a></li>';
    }
    return output;
}

function graph_draw()
{
    var options = {
        lines: { fill: false },
        xaxis: {
            mode: "time",
            timezone: "browser",
            min: view.start,
            max: view.end,
            monthNames: moment ? moment.monthsShort() : null,
            dayNames: moment ? moment.weekdaysMin() : null
        },
        yaxes: [ { }, {
            // align if we are to the right
            alignTicksWithAxis: 1,
            position: "right"
            //tickFormatter: euroFormatter
        } ],
        grid: {hoverable: true, clickable: true},
        selection: { mode: "x" },
        legend: {
            show: false,
            position: "nw",
            toggle: true,
            labelFormatter: function(label, item){
                text = label;
                cssClass = 'label-left';
                title = 'Left Axis';
                if (item.isRight) {
                    cssClass = 'label-right';
                    title = 'Right Axis';
                }
                data_attr = ' data-id="' + item.id + '" data-index="' + item.index + '"';
                return '<span' + data_attr + ' class="' + cssClass + '" title="'+title+'">' + text +'</span>'
            },
        },
        toggle: { scale: "visible" },
        touch: { pan: "x", scale: "x" },
        hooks: {
//            bindEvents: [group_legend_values]  // CHAVEIRO: this is breaking the touch function with the label overlapping the default flot one. Maybe a flot bug, maybe my lack of knowledge
        }
    }

    if (showlegend) options.legend.show = true;
    
    if (yaxismin!='auto' && yaxismin!='') { options.yaxes[0].min = yaxismin; }
    if (yaxismin2!='auto' && yaxismin2!='') {  options.yaxes[1].min = yaxismin2; }

    if (yaxismax!='auto' && yaxismax!='') { options.yaxes[0].max = yaxismax; }
    if (yaxismax2!='auto' && yaxismax2!='') { options.yaxes[1].max = yaxismax2; }
    
    var time_in_window = (view.end - view.start) / 1000;
    var hours = Math.floor(time_in_window / 3600);
    var mins = Math.round(((time_in_window / 3600) - hours)*60);
    if (mins!=0) {
        if (mins<10) mins = "0"+mins;
    } else {
        mins = "";
    }

    if (!embed) $("#window-info").html("<b>"+_lang['Window']+":</b> "+printdate(view.start)+" <b>→</b> "+printdate(view.end)+"<br><b>"+_lang['Length']+":</b> "+hours+"h"+mins+" ("+time_in_window+" seconds)");

    plotdata = [];
    for (var z in feedlist) {

        var data = feedlist[z].data;
        // Hide missing data (only affects the plot view)
        if (!showmissing) {
            var tmp = [];
            for (var n in data) {
                if (data[n][1]!=null) tmp.push(data[n]);
            }
            data = tmp;
        }
        // Add series to plot
        var label = "";
        if (showtag) label += feedlist[z].tag+": ";
        label += feedlist[z].name;
        // label += ' '+getFeedUnit(feedlist[z].id);
        var stacked = (typeof(feedlist[z].stack) !== "undefined" && feedlist[z].stack);
        var plot = {label:label, data:data, yaxis:feedlist[z].yaxis, color: feedlist[z].color, stack: stacked};

        if (feedlist[z].plottype=="lines") { plot.lines = { show: true, fill: (feedlist[z].fill ? (stacked ? 1.0 : 0.5) : 0.0), fill: feedlist[z].fill } };
        if (feedlist[z].plottype=="bars") { plot.bars = { align: "center", fill: (feedlist[z].fill ? (stacked ? 1.0 : 0.5) : 0.0), show: true, barWidth: view.interval * 1000 * 0.75 } };
        if (feedlist[z].plottype == 'points') plot.points = {show: true, radius: 3};
        plot.isRight = feedlist[z].yaxis === 2;
        plot.id = feedlist[z].id;
        plot.index = z;
        plotdata.push(plot);
    }
    if (plotdata.length > 1) {
        // show right yaxis options if required
        $('#yaxis_right').show()
    } else {
        $('#yaxis_right').hide()
    }
    plot_statistics = $.plot($('#placeholder'), plotdata, options);

    if (!embed) {

        for (var z in feedlist) {
            feedlist[z].stats = stats(feedlist[z].data);
        }

        var default_linecolor = "000";
        var out = "";
        for (var z in feedlist) {
            var dp = feedlist[z].dp;

            out += "<tr>";
            out += "<td>";
            if (z > 0) {
                out += "<a class='move-feed' title='"+_lang['Move up']+"' feedid="+z+" moveby=-1 ><i class='icon-arrow-up'></i></a>";
            }
            if (z < feedlist.length-1) {
                out += "<a class='move-feed' title='"+_lang['Move down']+"' feedid="+z+" moveby=1 ><i class='icon-arrow-down'></i></a>";
            }
            out += "</td>";

            out += "<td>"+getFeedName(feedlist[z])+"</td>";
            out += "<td><select class='plottype' feedid="+feedlist[z].id+" style='width:80px'>";

            var selected = "";
            if (feedlist[z].plottype == "lines") selected = "selected"; else selected = "";
            out += "<option value='lines' "+selected+">"+_lang['Lines']+"</option>";
            if (feedlist[z].plottype == "bars") selected = "selected"; else selected = "";
            out += "<option value='bars' "+selected+">"+_lang['Bars']+"</option>";
            if (feedlist[z].plottype == "points") selected = "selected"; else selected = "";
            out += "<option value='points' "+selected+">"+_lang['Points']+"</option>";
            out += "</select></td>";
            out += "<td><input class='linecolor' feedid="+feedlist[z].id+" style='width:50px' type='color' value='#"+default_linecolor+"'></td>";
            out += "<td><input class='fill' type='checkbox' feedid="+feedlist[z].id+"></td>";
            out += "<td><input class='stack' type='checkbox' feedid="+feedlist[z].id+"></td>";

            for (var i=0; i<11; i++) out += "<option>"+i+"</option>";
            out += "</select></td>";
            out += "<td style='text-align:center'><input class='scale' feedid="+feedlist[z].id+" type='text' style='width:50px' value='1.0' /></td>";
            out += "<td style='text-align:center'><input class='offset' feedid="+feedlist[z].id+" type='text' style='width:50px' value='0.0' /></td>";
            out += "<td style='text-align:center'><input class='delta' feedid="+feedlist[z].id+" type='checkbox'/></td>";
            out += "<td style='text-align:center'><input class='getaverage' feedid="+feedlist[z].id+" type='checkbox'/></td>";
            out += "<td><select feedid="+feedlist[z].id+" class='decimalpoints' style='width:50px'><option>0</option><option>1</option><option>2</option><option>3</option></select></td>";
            out += "<td><button feedid="+feedlist[z].id+" class='histogram'>"+_lang['Histogram']+" <i class='icon-signal'></i></button></td>";
            // out += "<td><a href='"+apiurl+"'><button class='btn btn-link'>API REF</button></a></td>";
            out += "</tr>";
        }
        $("#feed-controls").html(out);

        var out = "";
        for (var z in feedlist) {
            out += "<tr>";
            out += "<td></td>";
            out += "<td>"+getFeedName(feedlist[z])+"</td>";
            var quality = Math.round(100 * (1-(feedlist[z].stats.npointsnull/feedlist[z].stats.npoints)));
            out += "<td>"+quality+"% ("+(feedlist[z].stats.npoints-feedlist[z].stats.npointsnull)+"/"+feedlist[z].stats.npoints+")</td>";
            var dp = feedlist[z].dp;
            if(!isNaN(Number(feedlist[z].stats.minval))) out += "<td>"+feedlist[z].stats.minval.toFixed(dp)+"</td>";
            if(!isNaN(Number(feedlist[z].stats.maxval))) out += "<td>"+feedlist[z].stats.maxval.toFixed(dp)+"</td>";
            out += "<td>"+feedlist[z].stats.diff.toFixed(dp)+"</td>";
            out += "<td>"+feedlist[z].stats.mean.toFixed(dp)+"</td>";
            out += "<td>"+feedlist[z].stats.stdev.toFixed(dp)+"</td>";
            out += "<td>"+Math.round((feedlist[z].stats.mean*time_in_window)/3600)+"</td>";
            out += "</tr>";
        }
        $("#feed-stats").html(out);

        if (feedlist.length) $(".feed-options").show(); else $(".feed-options").hide();

        for (var z in feedlist) {
            $(".decimalpoints[feedid="+feedlist[z].id+"]").val(feedlist[z].dp);
            if ($(".getaverage[feedid="+feedlist[z].id+"]")[0]!=undefined)
                $(".getaverage[feedid="+feedlist[z].id+"]")[0].checked = feedlist[z].getaverage;
            if ($(".delta[feedid="+feedlist[z].id+"]")[0]!=undefined)
                $(".delta[feedid="+feedlist[z].id+"]")[0].checked = feedlist[z].delta;
            $(".scale[feedid="+feedlist[z].id+"]").val(feedlist[z].scale);
            $(".offset[feedid="+feedlist[z].id+"]").val(feedlist[z].offset);   
            $(".linecolor[feedid="+feedlist[z].id+"]").val(feedlist[z].color);
            if ($(".fill[feedid="+feedlist[z].id+"]")[0]!=undefined)
                $(".fill[feedid="+feedlist[z].id+"]")[0].checked = feedlist[z].fill;
            if ($(".stack[feedid="+feedlist[z].id+"]")[0]!=undefined)
                $(".stack[feedid="+feedlist[z].id+"]")[0].checked = feedlist[z].stack;
        }

        if (showcsv) printcsv();
    }
}
function getFeedName(item) {
    var values = [];
    if (typeof item !== 'object') {
        return item;
    }
    if(item.hasOwnProperty('id') && item.hasOwnProperty('tag') && item.hasOwnProperty('name')) {
        values.push(item.id);
        values.push(item.tag);
        values.push(item.name);
    }
    var name = values.join(':');

    name += ' (' + getFeedUnit(item.id) + ')';

    return name;
}
function getfeed(id)
{
    for (var z in feeds) {
        if (feeds[z].id == id) {
            return feeds[z];
        }
    }
    return false;
}

function getfeedpublic(feedid) {
    var f = {};
    $.ajax({
        url: path+"feed/aget.json?id="+feedid+apikeystr,
        async: false,
        dataType: "json",
        success: function(result) {
            f=result;
            if (f.id==undefined) f = false;
        }
    });
    return f;
}

function getfeedindex(id)
{
    for (var z in feeds) {
        if (feeds[z].id == id) {
            return z;
        }
    }
    return false;
}

function getFeedUnit(id){
    let unit = ''
    for(let key in feeds) {
        if (feeds[key].id == id){
            unit = feeds[key].unit || ''
        }
    }
    return unit
}

//----------------------------------------------------------------------------------------
// Print CSV
//----------------------------------------------------------------------------------------
function printcsv()
{
    if (typeof(feedlist[0]) === "undefined" ) {return};

    var timeformat = $("#csvtimeformat").val();
    var nullvalues = $("#csvnullvalues").val();
    var headers = $("#csvheaders").val();

    var csvout = "";

    var value = [];
    var line = [];
    var lastvalue = [];
    var start_time = feedlist[0].data[0][0];
    var end_time = feedlist[feedlist.length-1].data[feedlist[feedlist.length-1].data.length-1][0];
    var showName=false;
    var showTag=false;

    switch (headers) {
        case "showNameTag":
            showName=true;
            showTag=true;
            break;
        case "showName":
            showName=true;
            break;
    }

    if (showName || showTag ) {
        switch (timeformat) {
            case "unix":
                line = ["Unix timestamp"];
                break;
            case "seconds":
                line = ["Seconds since start"];
                break;
            case "datestr":
                line = ["Date-time string"];
                break;
        }

        for (var f in feedlist) {
            line.push((showTag ? feedlist[f].tag : "")+(showTag && showName ? ":" : "")+(showName ? feedlist[f].name : ""));
        }
        csvout = "\"" + line.join("\", \"")+"\"\n";
    }

    for (var z in feedlist[0].data) {
        line = [];
        // Different time format options for csv output
        if (timeformat=="unix") {
            line.push(Math.round(feedlist[0].data[z][0] / 1000));
        } else if (timeformat=="seconds") {
            line.push(Math.round((feedlist[0].data[z][0]-start_time)/1000));
        } else if (timeformat=="datestr") {
            // Create date time string
            var t = new Date(feedlist[0].data[z][0]);
            var year = t.getFullYear();
            var month = t.getMonth()+1;
            if (month<10) month = "0"+month;
            var day = t.getDate();
            if (day<10) day = "0"+day;
            var hours = t.getHours();
            if (hours<10) hours = "0"+hours;
            var minutes = t.getMinutes();
            if (minutes<10) minutes = "0"+minutes;
            var seconds = t.getSeconds();
            if (seconds<10) seconds = "0"+seconds;

            var formatted = year+"-"+month+"-"+day+" "+hours+":"+minutes+":"+seconds;
            line.push(formatted);
        }

        var nullfound = false;
        for (var f in feedlist) {
            if (value[f]==undefined) value[f] = null;
            lastvalue[f] = value[f];
            if (feedlist[f].data[z]!=undefined) {
            if (feedlist[f].data[z][1]==null) nullfound = true;
            if (feedlist[f].data[z][1]!=null || nullvalues=="show") value[f] = feedlist[f].data[z][1];
            if (value[f]!=null) value[f] = (value[f]*1.0).toFixed(feedlist[f].dp);
            line.push(value[f]+"");
            }
        }

        if (nullvalues=="remove" && nullfound) {
            // pass
        } else {
            csvout += line.join(", ")+"\n";
        }
    }
    $("#csv").val(csvout);
}

function csvShowHide(set)
{
    var action="hide";

    if (set==="swap") {
        if ($("#showcsv").html()==_lang["Show CSV Output"]) {
            action="show";
        } else {
            action="hide";
        }
    } else {
        action = (set==="1" ? "show" : "hide");
    }

    if (action==="show") {
        printcsv()
        showcsv = 1;
        $("#csv").show();
        $(".csvoptions").show();
        $("#showcsv").html(_lang["Hide CSV Output"]);
    } else {
        showcsv = 0;
        $("#csv").hide();
        $(".csvoptions").hide();
        $("#showcsv").html(_lang["Show CSV Output"]);
    }
}
// ----------------------------------------------------------------------
// Histogram feature
// ----------------------------------------------------------------------

// Launch histogram mode for a given feed
$("body").on("click",".histogram",function(){
    $("#navigation").hide();
    $("#histogram-controls").show();
    var feedid = $(this).attr("feedid");
    active_histogram_feed = feedid;
    var type = $("#histogram-type").val();
    var resolution = 1;

    var index = 0;
    for (var z in feedlist) {
      if (feedlist[z].id==feedid) {
        index = z;
        break;
      }
    }

    if (feedlist[index].stats.diff<5000) resolution = 10;
    if (feedlist[index].stats.diff<100) resolution = 0.1;
    $("#histogram-resolution").val(resolution);

    histogram(feedid,type,resolution);
});

// Chage the histogram resolution
$("#histogram-resolution").change(function(){
    var type = $("#histogram-type").val();
    var resolution = $("#histogram-resolution").val();
    histogram(active_histogram_feed,type,resolution);
});

// time at value or power to kwh
$("#histogram-type").change(function(){
    var type = $("#histogram-type").val();
    var resolution = $("#histogram-resolution").val();
    histogram(active_histogram_feed,type,resolution);
});

// return to power graph
$("#histogram-back").click(function(){
    $("#navigation").show();
    $("#histogram-controls").hide();
    graph_draw();
});

// Draw the histogram
function histogram(feedid,type,resolution)
{
    var histogram = {};
    var total_histogram = 0;
    var val = 0;

    // Get the feedlist index of the feedid
    var index = -1;
    for (var z in feedlist)
      if (feedlist[z].id==feedid) index = z;
    if (index==-1) return false;

    // Load data from feedlist object
    var data = feedlist[index].data;

    for (var i=1; i<data.length; i++) {
      if (data[i][1]!=null) {
        val = data[i][1];
      }
      var key = Math.round(val/resolution)*resolution;
      if (histogram[key]==undefined) histogram[key] = 0;

      var t = (data[i][0] - data[i-1][0])*0.001;

      var inc = 0;
      if (type=="kwhatpower") inc = (val * t)/(3600.0*1000.0);
      if (type=="timeatvalue") inc = t;
      histogram[key] += inc;
      total_histogram += inc;
    }

    // Sort and convert to 2d array
    var tmp = [];
    for (var z in histogram) tmp.push([z*1,histogram[z]]);
    tmp.sort(function(a,b){if (a[0]>b[0]) return 1; else return -1;});
    histogram = tmp;

    var options = {
        series: { bars: { show: true, barWidth:resolution*0.8 } },
        grid: {hoverable: true}
    };

    var label = "";
    if (showtag) label += feedlist[index].tag+": ";
    label += feedlist[index].name;

    $.plot("#placeholder",[{label:label, data:histogram}], options);
}

function load_saved_graphs_menu()
{    
    saveGraphsApp = new Vue({
        el: '#my_graphs',
        data: {
            selected: -1,
            collapsed: false,
            messages: {
                none: 'None selected',
                deleted: 'Deleted',
                saved: 'Saved',
                select: _lang['Select graph']
            },
            original: '',
            graphs: {},
            apikeystr: apikeystr,
            timeout: false,
            delay: 1500,
            status: '',
            graphName: ''
        },
        methods: {
            /**
             * update or create saved graph
             */
            saveGraph: function(){
                var vm = this
                var data = get_graph_data()
                // @todo : check for duplicate name
                // @todo : check for new name - if new create, else update
                data.name = this.graphName

                if (this.graphsChanged && !this.nameChanged) {
                    // UPDATE
                    graph_update(data)
                    .done(function(response) {
                        if(typeof response.success == 'undefined' || response.success) {
                            vm.status = response.message || vm.messages.saved
                        } else {
                            vm.status = "error 322"
                        }
                        window.setTimeout(function() {
                            vm.status = ""
                        }, vm.delay)
                    })
                } else {
                    // CREATE
                    graph_create(data)
                    .done(function(response) {
                        var newId = response.message.replace('graph saved id:','')
                        vm.selected = -1
                        vm.status = response.message || vm.messages.saved
                        window.setTimeout(function() {
                            vm.status = ''
                        }, vm.delay)

                        // get new data once saved.
                        vm.getGraphs()
                        .done(function(){
                            // pre-select the new item
                            vm.selected = vm.findGraphIndexById(newId)
                            // add new graph to browser history
                            vm.updateHashState(newId)
                        })
                    })
                }

            },
            deleteGraph: function(){
                var vm = this
                if(window.confirm('Delete ' + this.graphs[this.selected].name + ' (#' + this.graphs[this.selected].id + ') ?')) {
                    graph_delete(this.graphs[this.selected].id)
                    .done(function(response) {
                        vm.selected = -1
                        vm.getGraphs()
                        vm.status = response.message || vm.messages.deleted
                        window.setTimeout(function() {
                            vm.status = ''
                            vm.emptyHashState()
                        }, vm.delay)
                    })
                }
            },
            /**
             * load data from graph/getall
             */
            getGraphs: function () {
                var vm = this
                return $.getJSON(path+"/graph/getall"+this.apikeystr)
                .done(function(response){
                    if (!response.success && response.success !== false) {
                        // @todo : work with response.groups
                        // save sorted list to vue data
                        vm.graphs = response.user.sort( compare_name )
                        vm.original = JSON.stringify(vm.graphs)
                        // if view called with graph/#Saved/[id]
                        // find the relevant graph in the list
                        var hashId = vm.getHashState()
                        if (hashId !== '') {
                            var index = vm.findGraphIndexById(hashId)
                            if(index > -1) {
                                vm.selected = vm.graphs[index].name
                            }
                        }
                    } else {
                        vm.message = response.messsage
                    }
                })
            },
            /**
             * get graphs[] index that stores graph with matching id
             * @param {String} id taken from api response
             * @return {Number} array index of match, else -1
             */
            findGraphIndexById: function(id) {
                return this.findGraph('id', id)
            },
            /**
             * get graphs[] index that stores graph with matching id
             * @param {String} name taken from form selections
             * @return {Number} array index of match, else -1
             */
            findGraphIndexByName: function(name) {
                return this.findGraph('name', name)
            },
            /**
             * search loaded graphs by property and value
             * @return first index of matched value
             */
            findGraph: function(property, value) {
                return this.find(this.graphs, property, value)
            },
            /**
             * Return object key if property value matches 
             * @param {Object} list Enumerable Object to search
             * @param {String} property Object property to compare
             * @param {*} value Object property value to compare
             * @return {Number} first matching index, else -1
             */
            find: function (list, property, value) {
                if (typeof list === 'undefined' || typeof property === 'undefined' || typeof value === 'undefined') {
                    return -1
                }
                for (n in list) {
                    var item = list[n]
                    if (item.hasOwnProperty(property)) {
                        if (item[property] === value) {
                            return n
                        }
                    }
                }
                return -1
            },
            getHashState: function() {
                // get the id of the saved graph from the url
                return window.location.hash.replace('#/Saved/','')
            },
            updateHashState: function(id){
                // add the '#/Saved/[id]' symbol to the url
                var hashId = this.getHashState()
                if (hashId === "" || id !== hashId) {
                    window.location.hash = '/Saved/' + id
                }
            },
            emptyHashState: function(){
                // remove the '#' symbol from url
                history.replaceState(null, null, ' ')
            }
        },
        computed: {
            graphsChanged: function() {
                return JSON.stringify(this.graphs).length !== this.original.length
            },
            saveButtonDisabled: function() {
                var empty = this.graphName === ''
                var changed = this.graphsChanged
                var selected = this.selected > -1

                if ( selected && !changed ) {
                    return true
                }
                if ( empty && !selected) {
                    return true
                }
                return false
            },
            /**
             * return true if new or saved graph name changed
             */
            nameChanged: function() {
                var empty = this.graphName === ''
                var selected = this.selected > -1
                var downloaded = this.original !== ''

                if (!downloaded || empty) {
                    return false
                } else {
                    var originalSelected = {}
                    try {
                        originalSelected = JSON.parse(this.original)[this.selected]
                    } catch (error) {}
                    if(originalSelected && this.graphName === originalSelected.name) {
                        return false
                    }
                }
                return true
            }
        },
        watch: {
            /**
             * `selected` is array index of currently selected graph
             */
            selected: function (newVal) {
                // change the name of the selected graph to display
                // change global id of selected item
                var graph = this.graphs[newVal]
                if (graph) {
                    this.graphName = graph.name
                    if (graph.id !== this.getHashState()) {
                        this.updateHashState(graph.id)
                    }
                    // use function outside of vuejs to update the graph and menu
                    load_saved_graph(this.graphs[newVal])
                } else {
                    this.graphName =  ''
                    this.emptyHashState()
                }
            },
            graphName: function (newVal) {
                if (newVal !== "" && this.selected > -1) {
                    this.graphs[this.selected].name = newVal
                } else {
                    graphsChanged = true
                }
            }
        },
        created: function () {
            var vm = this
            this.getGraphs()
            .done(function(){
                var newId = vm.getHashState()
                // pre-select the item
                vm.selected = vm.findGraphIndexById(newId)
            })
            window.addEventListener('hashchange', function(event) {
                var hashId = vm.getHashState()
                if (hashId !== '') {
                    vm.selected = vm.findGraphIndexById(hashId)
                }
            });
        }
    })
}

$(function(){
    // when the form changes send the new data into the "saved list" vue app (if available)
    $('#info').on('change', function(event) {
        if (saveGraphsApp) {
            if(saveGraphsApp.selected > -1) {
                Vue.set(saveGraphsApp.graphs, saveGraphsApp.selected, get_graph_data())
            }
        }
    })
})

// place data into view (not vue.js)
function load_saved_graph(graph) {
    // @todo: unload_saved_graph()
    
    if(typeof graph === 'undefined') return;
    if (graph.mode==undefined) graph.mode = 'interval';
    
    // view settings
    view.start = graph.start;
    view.end = graph.end;
    view.interval = graph.interval;
    view.mode = graph.mode;
    view.limitinterval = graph.limitinterval;
    view.fixinterval = graph.fixinterval;
    floatingtime = graph.floatingtime,
    yaxismin = graph.yaxismin;
    yaxismin2 = graph.yaxismin2 || 'auto';
    yaxismax = graph.yaxismax;
    yaxismax2 = graph.yaxismax2 || 'auto';

    // CSV display settings
    csvtimeformat = (typeof(graph.csvtimeformat)==="undefined" ? "datestr" : graph.csvtimeformat);
    csvnullvalues = (typeof(graph.csvnullvalues)==="undefined" ? "show" : graph.csvnullvalues);
    csvheaders = (typeof(graph.csvheaders)==="undefined" ? "showNameTag" : graph.csvheaders);
    var tmpCsv = (typeof(graph.showcsv)==="undefined" ? "0" : graph.showcsv.toString());

    // show settings
    showmissing = graph.showmissing;
    showtag = graph.showtag;
    showlegend = graph.showlegend;

    // graph details
    current_graph_id = graph.id
    current_graph_name = graph.name

    // feedlist
    feedlist = graph.feedlist;

    if (floatingtime) {
        var timewindow = view.end - view.start;
        var now = Math.round(+new Date * 0.001)*1000;
        view.end = now;
        view.start = view.end - timewindow;
    }

    $("#yaxis-min").val(yaxismin);
    $("#yaxis-max").val(yaxismax);
    $("#yaxis-min2").val(yaxismin2);
    $("#yaxis-max2").val(yaxismax2);
    $("#request-fixinterval")[0].checked = view.fixinterval;
    $("#request-limitinterval")[0].checked = view.limitinterval;
    $("#showmissing")[0].checked = showmissing;
    $("#showtag")[0].checked = showtag;
    $("#showlegend")[0].checked = showlegend;
    
    $("#request-type").val(view.mode);
    if (view.mode!="interval") {
        $(".fixed-interval-options").hide();
    } else {
        $(".fixed-interval-options").show();
    }
    
    // draw graph
    graph_reload();
    load_feed_selector();
    // Placed after graph load as values only available after the graph is redrawn
    $("#csvtimeformat").val(csvtimeformat);
    $("#csvnullvalues").val(csvnullvalues);
    $("#csvheaders").val(csvheaders);
    csvShowHide(tmpCsv);

}

function get_graph_data () {

    var now = Math.round(+new Date * 0.001)*1000;
    if (Math.abs(now - view.end)<120000) {
        floatingtime = 1;
    }

    var graph_to_save = {
        name: current_graph_name,
        start: view.start,
        end: view.end,
        interval: view.interval,
        mode: view.mode,
        limitinterval: view.limitinterval,
        fixinterval: view.fixinterval,
        floatingtime: floatingtime,
        yaxismin: yaxismin,
        yaxismax: yaxismax,
        yaxismin2: yaxismin2,
        yaxismax2: yaxismax2,
        showmissing: showmissing,
        showtag: showtag,
        showlegend: showlegend,
        showcsv: showcsv,
        csvtimeformat: csvtimeformat,
        csvnullvalues: csvnullvalues,
        csvheaders: csvheaders,
        feedlist: JSON.parse(JSON.stringify(feedlist)),
        id: current_graph_id,
    };
    return graph_to_save
}

function graph_update(data) {
    // Clean feedlist of data and stats that dont need to be saved
    for (var i in data.feedlist) {
        delete data.feedlist[i].data
        delete data.feedlist[i].stats;
    }

    // Save 
    return $.ajax({
        method: "POST",
        url: path+"/graph/update",
        data: "id="+data.id+"&data="+JSON.stringify(data),
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        },
        error: function(xhr,type,message) {
            alert("ERROR: "+type+":"+message);
        }
    });
}
function graph_create(data) {
    // Clean feedlist of data and stats that dont need to be saved
    for (var i in data.feedlist) {
        delete data.feedlist[i].data
        delete data.feedlist[i].stats;
    }
    data.name = encodeURIComponent(data.name)
    // Save
    var ajax = $.ajax({
        method: "POST",
        url: path+"/graph/create",
        data: "data="+JSON.stringify(data),
        async: true,
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        }
    });
    return ajax
}

function graph_delete(id) {
    // Save
    var ajax = $.ajax({
        method: "POST",
        url: path+"/graph/delete",
        data: "id="+id,
        async: true,
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        }
    });
    return ajax
}

// ----------------------------------------------------------------------
// Misc functions
// ----------------------------------------------------------------------

/**
 * return -1 for less than, 1 for more than, else 0
 * @param {Object} a 
 * @param {Object} b 
 * @param {String} prop property name to compare
 */
function compare_name( a, b ) {
    var prop = 'name'
    if ( a[prop] < b[prop] ){
        return -1
    }
    if ( a[prop] > b[prop] ){
        return 1
    }
    return 0
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
/**
 * @todo replace this with moment.js translated date/time strings
 * see feed and input views for example of translated dates
 * eg. moment().fromUnix(timestamp).format('ll') // format unix timestamp as per user's locale
 * @see Lib/misc/moment.min.js
 **/
function printdate(timestamp)
{
    var date = new Date();
    var thisyear = date.getFullYear();

    var date = new Date(timestamp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = date.getFullYear();
    var month = months[date.getMonth()];
    var day = date.getDate();

    var minutes = date.getMinutes();
    if (minutes<10) minutes = "0"+minutes;

    var secs = date.getSeconds();
    if (secs<10) secs = "0"+secs;

    var datestr = "";
    //	date.getHours()+":"+minutes+" "+day+" "+month;
    datestr += day+"/"+month;
    if (thisyear!=year) datestr += "/"+year;
    datestr += " " + date.getHours()+":"+minutes+":"+secs;
    return datestr;
};

// See: https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
function download_data(filename, data) {
    var blob = new Blob([data], {type: 'text/csv'});
    if(window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, filename);
    }
    else{
        var elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = filename;        
        document.body.appendChild(elem);
        elem.click();        
        document.body.removeChild(elem);
    }
}

function arrayMove(array,old_index, new_index){
    array.splice(new_index, 0, array.splice(old_index, 1)[0]);
    return array;
}
