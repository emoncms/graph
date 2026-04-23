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

function pushfeedlist(feedid, yaxis) {
    let f = getfeed(feedid);
    let dp = 0;

    if (f === false) f = getfeedpublic(feedid);
    if (f !== false) {
        if (f.value % 1 !== 0) dp = 1;
        feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:yaxis, fill:0, scale:1.0, offset:0.0, delta:0, average:0, dp:dp, plottype:'lines'});
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

    // Convert feedlist into csv properties
    const ids = [];
    const averages = [];
    const deltas = [];
    for (const z in feedlist) {
        ids.push(feedlist[z].id);
        if (feedlist[z].average==false) feedlist[z].average = 0;
        averages.push(feedlist[z].average);
        if (feedlist[z].delta==false) feedlist[z].delta = 0;
        deltas.push(feedlist[z].delta);
    }
    
    const data = {
        ids: ids.join(','),
        start: view.start,
        end: view.end,
        skipmissing: skipmissing,
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
    for (const i in feedlist) {
        const feed = feedlist[i];
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
                feedlist = feedlist.filter((feed)=>!badfeeds.find((id)=>feed.id === id));
                graph_reload();
            });
    } else {
        $('#error').hide();
    }
}

function processFeedlistData() {

    const remove_null = embed ? false : $(".remove-null")[0].checked;
    const remove_null_max_duration = embed ? 900 : $(".remove-null-max-duration").val();

    for (const z in feedlist) {
        const scale = $(".scale[feedid="+feedlist[z].id+"]").val();
        if (scale !== undefined) feedlist[z].scale = scale;

        const offset = $(".offset[feedid="+feedlist[z].id+"]").val();
        if (offset !== undefined) feedlist[z].offset = offset;
        
        // check to ensure feed scaling and data are only applied once
        if (feedlist[z].postprocessed === false) {
            feedlist[z].postprocessed = true;
            console.log("postprocessing feed "+feedlist[z].id+" "+feedlist[z].name);

            // Remove null values
            if (remove_null) {
                feedlist[z].data = remove_null_values(feedlist[z].data, view.interval, remove_null_max_duration);
            }

            // Apply a scale to feed values
            feedlist[z].data = scale_values(feedlist[z].data, feedlist[z].scale);
            
            // Apply an offset to feed values
            feedlist[z].data = offset_values(feedlist[z].data, feedlist[z].offset);
        }
    }
    // call graph_draw() once feedlist is altered
    graph_draw();
}

//----------------------------------------------------------------------------------------
// buildFeedControlsHTML - builds the HTML for the feed options control table rows
//----------------------------------------------------------------------------------------
function buildFeedControlsHTML(feedlist) {
    const defaultLinecolor = '000';
    let out = '';
    for (let z = 0; z < feedlist.length; z++) {
        const feed = feedlist[z];
        const plotTypes = ['lines', 'bars', 'points', 'steps'];
        const plotTypeLabels = [_lang['Lines'], _lang['Bars'], _lang['Points'], _lang['Steps']];
        const plottypeOptions = plotTypes.map((type, i) =>
            `<option value='${type}'${feed.plottype === type ? ' selected' : ''}>${plotTypeLabels[i]}</option>`
        ).join('');
        out += `<tr>
            <td>
                ${z > 0 ? `<a class='move-feed' title='${_lang['Move up']}' feedid=${z} moveby=-1><i class='icon-arrow-up'></i></a>` : ''}
                ${z < feedlist.length - 1 ? `<a class='move-feed' title='${_lang['Move down']}' feedid=${z} moveby=1><i class='icon-arrow-down'></i></a>` : ''}
            </td>
            <td>${getFeedName(feed)}</td>
            <td><select class='plottype' feedid=${feed.id} style='width:80px'>${plottypeOptions}</select></td>
            <td><input class='linecolor' feedid=${feed.id} style='width:50px' type='color' value='#${defaultLinecolor}'></td>
            <td><input class='fill' type='checkbox' feedid=${feed.id}></td>
            <td><input class='stack' type='checkbox' feedid=${feed.id}></td>
            <td style='text-align:center'><input class='scale' feedid=${feed.id} type='text' style='width:50px' value='1.0'></td>
            <td style='text-align:center'><input class='offset' feedid=${feed.id} type='text' style='width:50px' value='0.0'></td>
            <td style='text-align:center'><input class='delta' feedid=${feed.id} type='checkbox'></td>
            <td style='text-align:center'><input class='average' feedid=${feed.id} type='checkbox'></td>
            <td><select feedid=${feed.id} class='decimalpoints' style='width:50px'><option>0</option><option>1</option><option>2</option><option>3</option></select></td>
            <td><button feedid=${feed.id} class='histogram'>${_lang['Histogram']} <i class='icon-signal'></i></button></td>
        </tr>`;
    }
    return out;
}

//----------------------------------------------------------------------------------------
// buildFeedStatsHTML - builds the HTML for the feed statistics table rows
//----------------------------------------------------------------------------------------
function buildFeedStatsHTML(feedlist, time_in_window) {
    let out = '';
    for (const feed of feedlist) {
        const quality = Math.round(100 * (1 - (feed.stats.npointsnull / feed.stats.npoints)));
        const dp = feed.dp;
        out += `<tr>
            <td></td>
            <td>${getFeedName(feed)}</td>
            <td>${quality}% (${feed.stats.npoints - feed.stats.npointsnull}/${feed.stats.npoints})</td>
            <td>${!isNaN(Number(feed.stats.minval)) ? feed.stats.minval.toFixed(dp) : ''}</td>
            <td>${!isNaN(Number(feed.stats.maxval)) ? feed.stats.maxval.toFixed(dp) : ''}</td>
            <td>${feed.stats.diff.toFixed(dp)}</td>
            <td>${feed.stats.mean.toFixed(dp)}</td>
            <td>${feed.stats.stdev.toFixed(dp)}</td>
            <td>${Math.round((feed.stats.mean * time_in_window) / 3600)}</td>
        </tr>`;
    }
    return out;
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

    if (showlegend) options.legend.show = true;
    
    if (yaxismin!='auto' && yaxismin!='') { options.yaxes[0].min = yaxismin; }
    if (yaxismin2!='auto' && yaxismin2!='') {  options.yaxes[1].min = yaxismin2; }

    if (yaxismax!='auto' && yaxismax!='') { options.yaxes[0].max = yaxismax; }
    if (yaxismax2!='auto' && yaxismax2!='') { options.yaxes[1].max = yaxismax2; }
    
    const time_in_window = (view.end - view.start) / 1000;
    const hours = Math.floor(time_in_window / 3600);
    let mins = Math.round(((time_in_window / 3600) - hours) * 60);
    if (mins !== 0) {
        if (mins < 10) mins = "0" + mins;
    } else {
        mins = "";
    }

    if (!embed) $("#window-info").html(`<b>${_lang['Window']}:</b> ${printdate(view.start)} <b>→</b> ${printdate(view.end)}<br><b>${_lang['Length']}:</b> ${hours}h${mins} (${time_in_window} seconds)`);

    plotdata = [];
    let num_left = 0;
    let num_right = 0;
    for (const z in feedlist) {

        let data = feedlist[z].data;
        // Hide missing data (only affects the plot view)
        if (!showmissing) {
            const tmp = [];
            for (const n in data) {
                if (data[n][1] !== null) tmp.push(data[n]);
            }
            data = tmp;
        }
        // Add series to plot
        let label = "";
        if (showtag) label += feedlist[z].tag + ": ";
        label += feedlist[z].name;
        const stacked = (typeof feedlist[z].stack !== "undefined" && feedlist[z].stack);
        const plot = {label:label, data:data, yaxis:feedlist[z].yaxis, color:feedlist[z].color, stack:stacked};

        if (feedlist[z].plottype=="lines") { plot.lines = { show: true, fill: (feedlist[z].fill ? (stacked ? 1.0 : 0.5) : 0.0), fill: feedlist[z].fill } };
        if (feedlist[z].plottype=="bars") { plot.bars = { align: "center", fill: (feedlist[z].fill ? (stacked ? 1.0 : 0.5) : 0.0), show: true, barWidth: view.interval * 1000 * 0.75 } };
        if (feedlist[z].plottype == 'points') plot.points = {show: true, radius: 3};
        if (feedlist[z].plottype=="steps") { plot.lines = { steps: true, show: true, fill: (feedlist[z].fill ? (stacked ? 1.0 : 0.5) : 0.0), fill: feedlist[z].fill } };
        plot.isRight = feedlist[z].yaxis === 2;
        plot.id = feedlist[z].id;
        plot.index = z;
        plotdata.push(plot);

        if (feedlist[z].yaxis == 1) {
            num_left++;
        } else if (feedlist[z].yaxis == 2) {
            num_right++;
        }
    }

    if (num_left > 0) {
        $('#yaxis_left').show()
    } else {
        $('#yaxis_left').hide();
    }

    if (num_right > 0) {
        $('#yaxis_right').show()
    } else {
        $('#yaxis_right').hide();
    }

    plot_statistics = $.plot($('#placeholder'), plotdata, options);

    if (!embed) {

        for (const z in feedlist) {
            feedlist[z].stats = stats(feedlist[z].data);
        }

        $("#feed-controls").html(buildFeedControlsHTML(feedlist));
        $("#feed-stats").html(buildFeedStatsHTML(feedlist, time_in_window));

        if (feedlist.length) $(".feed-options").show(); else $(".feed-options").hide();

        for (const z in feedlist) {
            $(".decimalpoints[feedid="+feedlist[z].id+"]").val(feedlist[z].dp);
            if ($(".average[feedid="+feedlist[z].id+"]")[0] !== undefined)
                $(".average[feedid="+feedlist[z].id+"]")[0].checked = feedlist[z].average;
            if ($(".delta[feedid="+feedlist[z].id+"]")[0] !== undefined)
                $(".delta[feedid="+feedlist[z].id+"]")[0].checked = feedlist[z].delta;
            $(".scale[feedid="+feedlist[z].id+"]").val(feedlist[z].scale);
            $(".offset[feedid="+feedlist[z].id+"]").val(feedlist[z].offset);
            $(".linecolor[feedid="+feedlist[z].id+"]").val(feedlist[z].color);
            if ($(".fill[feedid="+feedlist[z].id+"]")[0] !== undefined)
                $(".fill[feedid="+feedlist[z].id+"]")[0].checked = feedlist[z].fill;
            if ($(".stack[feedid="+feedlist[z].id+"]")[0] !== undefined)
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

function getFeedUnit(id) {
    for (const key in feeds) {
        if (feeds[key].id == id) return feeds[key].unit || '';
    }
    return '';
}
