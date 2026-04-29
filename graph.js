//----------------------------------------------------------------------------------------
// graph.js used by both view.php and embed.php
//----------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------
// Shared reactive state - readable and writable by both Vue components and non-Vue code.
// Vue.observable() ensures mutations trigger component re-renders (Phase 3 Vue components).
//
// GRAPH_STATE_DEFAULTS contains the canonical "blank graph" values for all user-controlled
// settings. resetGraphState() uses this to reset without touching derived/output properties
// (showStats, time_in_window, num_left, num_right) or the feed lists.
//----------------------------------------------------------------------------------------
const GRAPH_STATE_DEFAULTS = {
    showmissing: false,
    showtag: true,
    showlegend: true,
    showcsv: 0,
    floatingtime: 1,
    yaxismin: 'auto',
    yaxismax: 'auto',
    yaxismin2: 'auto',
    yaxismax2: 'auto',
    csvtimeformat: 'datestr',
    csvnullvalues: 'show',
    csvheaders: 'showNameTag',
    current_graph_id: '',
    current_graph_name: '',
    skipmissing: 0,
    active_histogram_feed: 0,
    removeNull: false,
    removeNullMaxDuration: 900,
};

const graphState = Vue.observable({
    ...GRAPH_STATE_DEFAULTS,
    feeds: [],
    feedlist: [],
    // Derived/output state — recalculated by graph_draw(), not reset by resetGraphState().
    showStats: false,
    time_in_window: 0,
    num_left: 0,
    num_right: 0,
});

// Resets all user-controlled settings to their blank-graph defaults.
// Does NOT clear feeds/feedlist (managed by feedSelectorApp) or derived state.
function resetGraphState() {
    Object.assign(graphState, GRAPH_STATE_DEFAULTS);
}

// Make the view object reactive so Vue watchers can track mutations.
// vis.helper.js defines view as a plain object before Vue loads, so we wrap it here.
view = Vue.observable(view);

//----------------------------------------------------------------------------------------
// initViewWatcher - sets up Vue watchers on view properties to automatically sync to DOM.
// Replaces the manual DOM push calls that were previously scattered in graph_reload() and
// load_saved_graph(). Must be called after datetimepickerInit() so the pickers exist.
//----------------------------------------------------------------------------------------
function initViewWatcher() {
    const watcher = new Vue();

    // Shared helper: refreshes both datetime pickers whenever start or end changes.
    function syncDatetimePickers() {
        if (datetimepicker1) {
            datetimepicker1.setLocalDate(new Date(view.start));
            datetimepicker1.setEndDate(new Date(view.end));
        }
        if (datetimepicker2) {
            datetimepicker2.setLocalDate(new Date(view.end));
            datetimepicker2.setStartDate(new Date(view.start));
        }
    }

    watcher.$watch(() => view.start, syncDatetimePickers);
    watcher.$watch(() => view.end,   syncDatetimePickers);

    watcher.$watch(() => view.interval, function(val) {
        $('#request-interval').val(val);
    });

    watcher.$watch(() => view.limitinterval, function(val) {
        const el = document.getElementById('request-limitinterval');
        if (el) el.checked = !!val;
    });

    // Show/hide left and right y-axis control rows based on whether any feed uses each axis.
    watcher.$watch(() => graphState.num_left, function(n) {
        if (n > 0) { $('#yaxis_left').show(); } else { $('#yaxis_left').hide(); }
    }, { immediate: true });

    watcher.$watch(() => graphState.num_right, function(n) {
        if (n > 0) { $('#yaxis_right').show(); } else { $('#yaxis_right').hide(); }
    }, { immediate: true });

    // Show/hide the "Feeds in view" panel when the feedlist is populated.
    watcher.$watch(() => graphState.feedlist.length, function(len) {
        if (len > 0) { $('.feed-options').show(); } else { $('.feed-options').hide(); }
    }, { immediate: true });

    // Toggle the Show options / Show statistics buttons without touching other DOM state.
    watcher.$watch(() => graphState.showStats, function(showStats) {
        if (showStats) {
            $('.feed-options-show-options').removeClass('hide');
            $('.feed-options-show-stats').addClass('hide');
        } else {
            $('.feed-options-show-options').addClass('hide');
            $('.feed-options-show-stats').removeClass('hide');
        }
    }, { immediate: true });
}

// Non-reactive module-level variables (transient state, jQuery instances, config flags)
var plotdata = [];
var datetimepicker1;
var datetimepicker2;
var embed = false;
var requesttype = 'interval';
var saveGraphsApp = false;
var panning = false;
var previousPoint = 0;

//----------------------------------------------------------------------------------------
// Events shared by both view and embed mode
//----------------------------------------------------------------------------------------
$("#graph_zoomout").click(function () {graphState.floatingtime=0; view.zoomout(); graph_reload();});
$("#graph_zoomin").click(function () {graphState.floatingtime=0; view.zoomin(); graph_reload();});
$('#graph_right').click(function () {graphState.floatingtime=0; view.panright(); graph_reload();});
$('#graph_left').click(function () {graphState.floatingtime=0; view.panleft(); graph_reload();});
$('.graph_time').change(function () {
    graphState.floatingtime=1;
    view.timewindow($(this).val()/24.0);
    view.calc_interval();
    graph_reload();
});
$('.graph_time_refresh').click(function () {
    graphState.floatingtime=1;
    view.timewindow($('.graph_time').val()/24.0);
    view.calc_interval();
    graph_reload();
});
// Graph zooming
$('#placeholder').bind("plotselected", function (event, ranges) {
    graphState.floatingtime=0;
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
            var dp=graphState.feedlist[item.seriesIndex].dp;
            var feedid = graphState.feedlist[item.seriesIndex].id;
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

function pushfeedlist(feedid, yaxis) {
    let f = getfeed(feedid);
    let dp = 0;

    if (f === false) f = getfeedpublic(feedid);
    if (f !== false) {
        if (f.value % 1 !== 0) dp = 1;
        graphState.feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:yaxis, fill:0, scale:1.0, offset:0.0, delta:0, average:0, dp:dp, plottype:'lines'});
    }
}

function graph_reload()
{
    const ds = new Date(view.start);
    const de = new Date(view.end);
    
    // Round start and end time
    if (view.mode=="daily" || view.mode=="weekly") {
        view.start = (new Date(ds.getFullYear(), ds.getMonth(), ds.getDate(), 0,0,0,0)).getTime();
        view.end = (new Date(de.getFullYear(), de.getMonth(), de.getDate(), 0,0,0,0)).getTime();
    } else if (view.mode=="monthly") {
        let month_offset = 0;
        if (ds.getMonth()==de.getMonth()) month_offset = 1; 
        view.start = (new Date(ds.getFullYear(), ds.getMonth(), 1, 0,0,0,0)).getTime();
        view.end = (new Date(de.getFullYear(), de.getMonth()+month_offset, 1, 0,0,0,0)).getTime();
    } else if (view.mode=="annual") {
        let year_offset = 0;
        if (ds.getFullYear()==de.getFullYear()) year_offset = 1; 
        view.start = (new Date(ds.getFullYear(), 0, 1, 0,0,0,0)).getTime();
        view.end = (new Date(de.getFullYear()+1, 0, 1, 0,0,0,0)).getTime();
    } else {
        view.start = Math.floor((view.start*0.001) / view.interval) * view.interval * 1000;
        view.end = Math.ceil((view.end*0.001) / view.interval) * view.interval * 1000;
    }

    // Convert feedlist into csv properties
    const ids = [];
    const averages = [];
    const deltas = [];
    for (const z in graphState.feedlist) {
        ids.push(graphState.feedlist[z].id);
        if (graphState.feedlist[z].average==false) graphState.feedlist[z].average = 0;
        averages.push(graphState.feedlist[z].average);
        if (graphState.feedlist[z].delta==false) graphState.feedlist[z].delta = 0;
        deltas.push(graphState.feedlist[z].delta);
    }
    
    const data = {
        ids: ids.join(','),
        start: view.start,
        end: view.end,
        skipmissing: graphState.skipmissing,
        limitinterval: view.limitinterval,
        apikey: apikey,
        average: averages.join(','),
        delta: deltas.join(',')
    }
    if (view.mode!="interval") {
        data.interval = view.mode;
    } else {
        data.interval = view.interval;
    }

    if (ids.length === 0) {
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

        // get feedlist data
        $.getJSON(path + "feed/data.json", data, addFeedlistData)
        .fail(handleFeedlistDataError)
        .done(checkFeedlistData);
    }
}

function addFeedlistData(response){
    // loop through feedlist and add response data to data property
    let valid = false;
    for (const i in graphState.feedlist) {
        const feed = graphState.feedlist[i];
        for (const j in response) {
            const item = response[j];
            if (parseInt(feed.id) === parseInt(item.feedid) && item.data!=undefined) {
                feed.postprocessed = false;
                feed.data = item.data;
            }
            if (!item || !item.data || typeof item.data.success === 'undefined') {
                valid = true;
            }
        }
    }
    
    if (valid) processFeedlistData();
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
                graphState.feedlist = graphState.feedlist.filter((feed)=>!badfeeds.find((id)=>feed.id === id));
                graph_reload();
            });
    } else {
        $('#error').hide();
    }
}

function processFeedlistData() {

    // In embed mode, graphState defaults (false / 900) are used since those controls
    // don't exist in embed.php. In view.php the reactive graphState values are kept
    // in sync by the jQuery change handlers in graph.editor.js.
    const remove_null = graphState.removeNull;
    const remove_null_max_duration = graphState.removeNullMaxDuration;

    for (const z in graphState.feedlist) {
        // check to ensure feed scaling and data are only applied once
        if (graphState.feedlist[z].postprocessed === false) {
            graphState.feedlist[z].postprocessed = true;
            console.log("postprocessing feed "+graphState.feedlist[z].id+" "+graphState.feedlist[z].name);

            // Remove null values
            if (remove_null) {
                graphState.feedlist[z].data = remove_null_values(graphState.feedlist[z].data, view.interval, remove_null_max_duration);
            }

            // Apply a scale to feed values
            graphState.feedlist[z].data = scale_values(graphState.feedlist[z].data, graphState.feedlist[z].scale);
            
            // Apply an offset to feed values
            graphState.feedlist[z].data = offset_values(graphState.feedlist[z].data, graphState.feedlist[z].offset);
        }
    }
    // call graph_draw() once feedlist is altered
    graph_draw();
}

function graph_draw()
{
    const options = {
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

    if (graphState.showlegend) options.legend.show = true;
    
    if (graphState.yaxismin!='auto' && graphState.yaxismin!='') { options.yaxes[0].min = graphState.yaxismin; }
    if (graphState.yaxismin2!='auto' && graphState.yaxismin2!='') { options.yaxes[1].min = graphState.yaxismin2; }

    if (graphState.yaxismax!='auto' && graphState.yaxismax!='') { options.yaxes[0].max = graphState.yaxismax; }
    if (graphState.yaxismax2!='auto' && graphState.yaxismax2!='') { options.yaxes[1].max = graphState.yaxismax2; }
    
    const time_in_window = (view.end - view.start) / 1000;
    graphState.time_in_window = time_in_window;
    const hours = Math.floor(time_in_window / 3600);
    let mins = Math.round(((time_in_window / 3600) - hours) * 60);
    if (mins !== 0) {
        if (mins < 10) mins = "0" + mins;
    } else {
        mins = "";
    }

    if (!embed) $("#window-info").html(`<b>${_lang['Window']}:</b> ${moment(view.start).format('D/MMM/YYYY HH:mm:ss')} <b>→</b> ${moment(view.end).format('D/MMM/YYYY HH:mm:ss')}<br><b>${_lang['Length']}:</b> ${hours}h${mins} (${time_in_window} seconds)`);

    plotdata = [];
    let num_left = 0;
    let num_right = 0;
    for (const z in graphState.feedlist) {

        let data = graphState.feedlist[z].data;
        // Hide missing data (only affects the plot view)
        if (!graphState.showmissing) {
            const tmp = [];
            for (const n in data) {
                if (data[n][1] !== null) tmp.push(data[n]);
            }
            data = tmp;
        }
        // Add series to plot
        let label = "";
        if (graphState.showtag) label += graphState.feedlist[z].tag + ": ";
        label += graphState.feedlist[z].name;
        const stacked = (typeof graphState.feedlist[z].stack !== "undefined" && graphState.feedlist[z].stack);
        const plot = {label:label, data:data, yaxis:graphState.feedlist[z].yaxis, color:graphState.feedlist[z].color, stack:stacked};

        if (graphState.feedlist[z].plottype=="lines") { plot.lines = { show: true, fill: (graphState.feedlist[z].fill ? (stacked ? 1.0 : 0.5) : 0.0), fill: graphState.feedlist[z].fill } };
        if (graphState.feedlist[z].plottype=="bars") { plot.bars = { align: "center", fill: (graphState.feedlist[z].fill ? (stacked ? 1.0 : 0.5) : 0.0), show: true, barWidth: view.interval * 1000 * 0.75 } };
        if (graphState.feedlist[z].plottype == 'points') plot.points = {show: true, radius: 3};
        if (graphState.feedlist[z].plottype=="steps") { plot.lines = { steps: true, show: true, fill: (graphState.feedlist[z].fill ? (stacked ? 1.0 : 0.5) : 0.0), fill: graphState.feedlist[z].fill } };
        plot.isRight = graphState.feedlist[z].yaxis === 2;
        plot.id = graphState.feedlist[z].id;
        plot.index = z;
        plotdata.push(plot);

        if (graphState.feedlist[z].yaxis == 1) {
            num_left++;
        } else if (graphState.feedlist[z].yaxis == 2) {
            num_right++;
        }
    }

    // Write to graphState — watchers in initViewWatcher() handle the DOM show/hide.
    graphState.num_left = num_left;
    graphState.num_right = num_right;

    plot_statistics = $.plot($('#placeholder'), plotdata, options);

    if (!embed) {

        for (const z in graphState.feedlist) {
            Vue.set(graphState.feedlist[z], 'stats', stats(graphState.feedlist[z].data));
        }

        if (graphState.showcsv) printcsv();
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
    for (const z in graphState.feeds) {
        if (graphState.feeds[z].id == id) {
            return graphState.feeds[z];
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
    for (const z in graphState.feeds) {
        if (graphState.feeds[z].id == id) {
            return z;
        }
    }
    return false;
}

function getFeedUnit(id) {
    for (const key in graphState.feeds) {
        if (graphState.feeds[key].id == id) return graphState.feeds[key].unit || '';
    }
    return '';
}
