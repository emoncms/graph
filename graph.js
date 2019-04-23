var savedgraphs = [];
var feeds = [];
feedlist = [];
var plotdata = [];
var datetimepicker1;
var datetimepicker2;

var embed = false;

var sidebarwidth = 250;

var skipmissing = 0;
var requesttype = "interval";
var showcsv = 0;

var showmissing = false;
var showtag = true;
var showlegend = true;

var floatingtime=1;
var yaxismin="auto";
var yaxismax="auto";

var csvtimeformat="datestr";
var csvnullvalues="show";
var csvheaders="showNameTag";

var previousPoint = 0;

var active_histogram_feed = 0;

var _TIMEZONE = null;

$("#info").show();
if ($("#showmissing")[0]!=undefined) $("#showmissing")[0].checked = showmissing;
if ($("#showtag")[0]!=undefined) $("#showtag")[0].checked = showtag;
if ($("#showlegend")[0]!=undefined) $("#showlegend")[0].checked = showlegend;

$("#graph_zoomout").click(function () {floatingtime=0; view.zoomout(); graph_reloaddraw();});
$("#graph_zoomin").click(function () {floatingtime=0; view.zoomin(); graph_reloaddraw();});
$('#graph_right').click(function () {floatingtime=0; view.panright(); graph_reloaddraw();});
$('#graph_left').click(function () {floatingtime=0; view.panleft(); graph_reloaddraw();});
$('.graph_time').click(function () {
    floatingtime=1; 
    view.timewindow($(this).attr("time")); 
    graph_reloaddraw();
});

$('#placeholder').bind("plotselected", function (event, ranges)
{
    floatingtime=0; 
    view.start = ranges.xaxis.from;
    view.end = ranges.xaxis.to;
    view.calc_interval();
    
    graph_reloaddraw();
});
function getFeedUnit(id){
    let unit = ''
    for(let key in feeds) {
        if (feeds[key].id == id){
            unit = feeds[key].unit || ''
        }
    }
    return unit
}
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

$(window).resize(function(){
    if (!embed) sidebar_resize();
    graph_resize();
    graph_draw();
});

function graph_resize() {
    var top_offset = 0;
    if (embed) top_offset = 35;
    var placeholder_bound = $('#placeholder_bound');
    var placeholder = $('#placeholder');

    var width = placeholder_bound.width();
    var height = width * 0.5;
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

    $('.navigation-timewindow').click(function () {
        $("#navigation-timemanual").show();
        $("#navigation").hide();
    });

    $('.navigation-timewindow-set').click(function () {
        var timewindow_start = parseTimepickerTime($("#request-start").val());
        var timewindow_end = parseTimepickerTime($("#request-end").val());
        if (!timewindow_start) {alert("Please enter a valid start date."); return false; }
        if (!timewindow_end) {alert("Please enter a valid end date."); return false; }
        if (timewindow_start>=timewindow_end) {alert("Start date must be further back in time than end date."); return false; }

        $("#navigation-timemanual").hide();
        $("#navigation").show();
        view.start = timewindow_start * 1000;
        view.end = timewindow_end *1000;

        reloadDatetimePrep();
        graph_reloaddraw();
    });

    $('#datetimepicker1').on("changeDate", function (e) {
        if (view.datetimepicker_previous == null) view.datetimepicker_previous = view.start;
        if (Math.abs(view.datetimepicker_previous - e.date.getTime()) > 1000*60*60*24)
        {
            var d = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate());
            d.setTime( d.getTime() - e.date.getTimezoneOffset()*60*1000 );
            var out = d;
            $('#datetimepicker1').data("datetimepicker").setDate(out);
        } else {
            var out = e.date;
        }
        view.datetimepicker_previous = e.date.getTime();

        $('#datetimepicker2').data("datetimepicker").setStartDate(out);
    });

    $('#datetimepicker2').on("changeDate", function (e) {
        if (view.datetimepicker_previous == null) view.datetimepicker_previous = view.end;
        if (Math.abs(view.datetimepicker_previous - e.date.getTime()) > 1000*60*60*24)
        {
            var d = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate());
            d.setTime( d.getTime() - e.date.getTimezoneOffset()*60*1000 );
            var out = d;
            $('#datetimepicker2').data("datetimepicker").setDate(out);
        } else {
            var out = e.date;
        }
        view.datetimepicker_previous = e.date.getTime();

        $('#datetimepicker1').data("datetimepicker").setEndDate(out);
    });

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

function csvShowHide(set)
{
    var action="hide";

    if (set==="swap") {
        if ($("#showcsv").html()=="Show CSV Output") {
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
        $("#showcsv").html("Hide CSV Output");
    } else {
        showcsv = 0;
        $("#csv").hide();
        $(".csvoptions").hide();
        $("#showcsv").html("Show CSV Output");
    }
}


function arrayMove(array,old_index, new_index){
    array.splice(new_index, 0, array.splice(old_index, 1)[0]);
    return array;
}

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
    
    var out = "";
    out += "<colgroup>";
    out += "<col span='1' style='width: 70%;'>";
    out += "<col span='1' style='width: 15%;'>";
    out += "<col span='1' style='width: 15%;'>";
    out += "</colgroup>";
    
    for (var tag in feedsbytag) {
       tagname = tag;
       if (tag=="") tagname = "undefined";
       out += "<tr class='tagheading' tag='"+tagname+"' style='background-color:#aaa; cursor:pointer'><td style='font-size:12px; padding:4px; padding-left:8px; font-weight:bold'>"+tagname+"</td><td></td><td></td></tr>";
       out += "<tbody class='tagbody' tag='"+tagname+"'>";
       for (var z in feedsbytag[tag]) 
       {
           out += "<tr>";
           var name = feedsbytag[tag][z].name;
           if (name.length>20) {
               name = name.substr(0,20)+"..";
           }
           out += "<td>"+name+"</td>";
           out += "<td><input class='feed-select-left' feedid="+feedsbytag[tag][z].id+" type='checkbox'></td>";
           out += "<td><input class='feed-select-right' feedid="+feedsbytag[tag][z].id+" type='checkbox'></td>";
           out += "</tr>";
       }
       out += "</tbody>";
    }
    $("#feeds").html(out);
    
    if (feeds.length>12 && numberoftags>2) {
        $(".tagbody").hide();
    }
    
    datetimepickerInit();

    $("#reload").click(function(){
        reloadDatetimePrep();

        view.interval = $("#request-interval").val();
        view.limitinterval = $("#request-limitinterval")[0].checked*1;

        graph_reloaddraw();
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

    $("body").on("click",".feed-select-left",function(){
        var feedid = $(this).attr("feedid");
        var checked = $(this)[0].checked;
        
        var loaded = false;
        for (var z in feedlist) {
           if (feedlist[z].id==feedid) {
               if (!checked) {
                   feedlist.splice(z,1);
               } else {
                   feedlist[z].yaxis = 1;
                   loaded = true;
                   $(".feed-select-right[feedid="+feedid+"]")[0].checked = false;
               }
           }
        }
        
        //if (loaded==false && checked) {
        //    var index = getfeedindex(feedid);
        //    feedlist.push({id:feedid, name:feeds[index].name, tag:feeds[index].tag, yaxis:1, fill:0, scale: 1.0, delta:false, getaverage:false, dp:1, plottype:'lines'});
        //}
        if (loaded==false && checked) pushfeedlist(feedid, 1);
        graph_reloaddraw();
    });

    $("body").on("click",".feed-select-right",function(){
        var feedid = $(this).attr("feedid");
        var checked = $(this)[0].checked;
        
        var loaded = false;
        for (var z in feedlist) {
           if (feedlist[z].id==feedid) {
               if (!checked) {
                   feedlist.splice(z,1);
               } else {
                   feedlist[z].yaxis = 2;
                   loaded = true;
                   $(".feed-select-left[feedid="+feedid+"]")[0].checked = false;
               }
           }
        }
        
        // if (loaded==false && checked) feedlist.push({id:feedid, yaxis:2, fill:0, scale: 1.0, delta:false, getaverage:false, dp:1, plottype:'lines'});
        if (loaded==false && checked) pushfeedlist(feedid, 2);
        graph_reloaddraw();
    });
    
    $("body").on("click",".tagheading",function(){
        var tag = $(this).attr("tag");
        var e = $(".tagbody[tag='"+tag+"']");
        if (e.is(":visible")) e.hide(); else e.show();
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
        var type = $(this).val();
        type = type.toLowerCase();
        
        if (type!="interval") {
            $(".fixed-interval-options").hide();
            view.fixinterval = true;
        } else { 
            $(".fixed-interval-options").show();
            view.fixinterval = false;
        }
        
        requesttype = type;
        
        // Intervals are set here for bar graph bar width sizing
        if (type=="daily") view.interval = 86400;
        if (type=="weekly") view.interval = 86400*7;
        if (type=="monthly") view.interval = 86400*30;
        if (type=="annual") view.interval = 86400*365;
        
        $("#request-interval").val(view.interval);
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
    
    $("body").on("change","#yaxis-min",function(){
        yaxismin = $(this).val();
        graph_draw();
    });
    
    $("body").on("change","#yaxis-max",function(){
        yaxismax = $(this).val();
        graph_draw();
    });

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
}

function pushfeedlist(feedid, yaxis) {
    var f = getfeed(feedid);
    var dp=0;

    if (f==false) f = getfeedpublic(feedid);
    if (f!=false) {
        if (f.datatype==2 || f.value % 1 !== 0 ) {
            dp=1;
        }
        feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:yaxis, fill:0, scale: 1.0, delta:false, getaverage:false, dp:dp, plottype:'lines'});
    }
}

function graph_reloaddraw() {
    graph_reload();
}

function graph_changeTimezone(tz) {
    _TIMEZONE = tz;
    graph_draw();
}

function graph_reload()
{
    var intervalms = view.interval * 1000;
    view.start = Math.round(view.start / intervalms) * intervalms;
    view.end = Math.round(view.end / intervalms) * intervalms;

    datetimepicker1.setLocalDate(new Date(view.start));
    datetimepicker2.setLocalDate(new Date(view.end));
    datetimepicker1.setEndDate(new Date(view.end));
    datetimepicker2.setStartDate(new Date(view.start));

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
        interval: view.interval,
        skipmissing: skipmissing,
        limitinterval: view.limitinterval,
        apikey: apikey
    }
    if (requesttype!="interval") {
        data.mode = requesttype;
    }
   
    if (ids.length + average_ids.length === 0) {
        var title = _lang['Select a feed'];
        var message = _lang['Please select a feed from the Feeds List'];
        $('#error')
        .show()
        .html('<div class="alert alert-info"><strong>' + title + '</strong> ' + message + '</div>');
        return false;
    }
    if (ids.length > 0) {
        // get feedlist data
        $.getJSON(path+"feed/data.json", data, addFeedlistData)
        .error(handleFeedlistDataError)
        .always(checkFeedlistData);
    }
    if (average_ids.length > 0) {
        // get feedlist average data
        var average_ajax_data = $.extend({}, data, {ids: average_ids.join(',')});
        $.getJSON(path+"feed/average.json", average_ajax_data, addFeedlistData)
        .error(handleFeedlistDataError)
        .always(checkFeedlistData);
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
            if (typeof item.data.success === 'undefined') {
                valid = true;
            }
        }
    }
    // alter feedlist base on user selection
    if (valid) set_feedlist();
}
function handleFeedlistDataError(jqXHR, error, message){
    // @todo: notify the user that the the data api was unreachable;
}
function checkFeedlistData(response){
    // display message to user if response not valid
    var message = '';
    var messages = [];

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
        errorstr = '<div class="alert alert-danger"><strong>Request error</strong> ' + message + '</div>';
        $('#error').html(errorstr).show();
    } else {
        $('#error').hide();
    }
}

function set_feedlist() {
    for (var z in feedlist)
    {
        var scale = $(".scale[feedid="+feedlist[z].id+"]").val();
        if (scale!=undefined) feedlist[z].scale = scale;
            
        // check to ensure feed scaling and data are only applied once
        if (feedlist[z].postprocessed==false) {
            feedlist[z].postprocessed = true;
            console.log("postprocessing feed "+feedlist[z].id+" "+feedlist[z].name);
            
            // Apply delta adjustement to feed values
            if (feedlist[z].delta) {
                for (var i=1; i<feedlist[z].data.length; i++) {
                    if (feedlist[z].data[i][1]!=null && feedlist[z].data[i-1][1]!=null) {
                        var delta = feedlist[z].data[i][1] - feedlist[z].data[i-1][1];
                        feedlist[z].data[i-1][1] = delta;
                    } else {
                        feedlist[z].data[i][1] = 0;
                        feedlist[z].data[i-1][1] = null;
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
    var link = event.target;
    // toggle opacity of the link
    link.classList.toggle('faded');
    // re-draw the chart with the plot lines hidden/shown
    var index = link.dataset.index;
    var current_data = plot_statistics.getData()
    current_data[index].lines.show = !current_data[index].lines.show;
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
    var timezone = _TIMEZONE || "browser";
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
            bindEvents: [group_legend_values]
        }
    }

    if (showlegend) options.legend.show = true;
    
    if (yaxismin!='auto' && yaxismin!='') { options.yaxes[0].min = yaxismin; options.yaxes[1].min = yaxismin; }
    if (yaxismax!='auto' && yaxismax!='') { options.yaxes[0].max = yaxismax; options.yaxes[1].max = yaxismax; }
    
    var time_in_window = (view.end - view.start) / 1000;
    var hours = Math.floor(time_in_window / 3600);
    var mins = Math.round(((time_in_window / 3600) - hours)*60);
    if (mins!=0) {
        if (mins<10) mins = "0"+mins;
    } else {
        mins = "";
    }
    
    if (!embed) $("#window-info").html("<b>Window:</b> "+printdate(view.start)+" > "+printdate(view.end)+", <b>Length:</b> "+hours+"h"+mins+" ("+time_in_window+" seconds)");
    
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
        label += ' '+getFeedUnit(feedlist[z].id);
        var stacked = (typeof(feedlist[z].stack) !== "undefined" && feedlist[z].stack);
        var plot = {label:label, data:data, yaxis:feedlist[z].yaxis, color: feedlist[z].color, stack: stacked};
        
        if (feedlist[z].plottype=="lines") { plot.lines = { show: true, fill: (feedlist[z].fill ? (stacked ? 1.0 : 0.5) : 0.0), fill: feedlist[z].fill } };
        if (feedlist[z].plottype=="bars") { plot.bars = { align: "center", fill: (feedlist[z].fill ? (stacked ? 1.0 : 0.5) : 0.0), show: true, barWidth: view.interval * 1000 * 0.75 } };
        plot.isRight = feedlist[z].yaxis === 2;
        plot.id = feedlist[z].id;
        plot.index = z;
        plotdata.push(plot);
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
                out += "<a class='move-feed' title='Move up' feedid="+z+" moveby=-1 ><i class='icon-arrow-up'></i></a>";
            }
            if (z < feedlist.length-1) {
                out += "<a class='move-feed' title='Move down' feedid="+z+" moveby=1 ><i class='icon-arrow-down'></i></a>";
            }
            out += "</td>";

            out += "<td>"+getFeedName(feedlist[z])+"</td>";
            out += "<td><select class='plottype' feedid="+feedlist[z].id+" style='width:80px'>";

            var selected = "";
            if (feedlist[z].plottype == "lines") selected = "selected"; else selected = "";
            out += "<option value='lines' "+selected+">Lines</option>";
            if (feedlist[z].plottype == "bars") selected = "selected"; else selected = "";
            out += "<option value='bars' "+selected+">Bars</option>";
            out += "</select></td>";
            out += "<td><input class='linecolor' feedid="+feedlist[z].id+" style='width:50px' type='color' value='#"+default_linecolor+"'></td>";
            out += "<td><input class='fill' type='checkbox' feedid="+feedlist[z].id+"></td>";
            out += "<td><input class='stack' type='checkbox' feedid="+feedlist[z].id+"></td>";

            for (var i=0; i<11; i++) out += "<option>"+i+"</option>";
            out += "</select></td>";
            out += "<td style='text-align:center'><input class='scale' feedid="+feedlist[z].id+" type='text' style='width:50px' value='1.0' /></td>";
            out += "<td style='text-align:center'><input class='delta' feedid="+feedlist[z].id+" type='checkbox'/></td>";
            out += "<td style='text-align:center'><input class='getaverage' feedid="+feedlist[z].id+" type='checkbox'/></td>";
            out += "<td><select feedid="+feedlist[z].id+" class='decimalpoints' style='width:50px'><option>0</option><option>1</option><option>2</option><option>3</option></select></td>";
            out += "<td><button feedid="+feedlist[z].id+" class='histogram'>Histogram <i class='icon-signal'></i></button></td>";
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
            out += "<td>"+feedlist[z].stats.minval.toFixed(dp)+"</td>";
            out += "<td>"+feedlist[z].stats.maxval.toFixed(dp)+"</td>";
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

    // populate download form
    for (f in feedlist) {
        var meta = feedlist[f];

        $("[data-download]").each(function(i,elem){
            $form = $(this);
            var path = $form.find('[data-path]').val();
            var action = $form.find('[data-action]').val();
            var format = $form.find('[data-format]').val();
            $form.attr('action', path + action + '.' + format);
            $form.find('[name="ids"]').val(meta.id);
            $form.find('[name="start"]').val(start_time);
            $form.find('[name="end"]').val(end_time);
            $form.find('[name="headers"]').val('names');
            $form.find('[name="timeformat"]').val(csvtimeformat);
            $form.find('[name="interval"]').val(view.interval);
            $form.find('[name="nullvalues"]').val(csvnullvalues);
        });
    }
}

//----------------------------------------------------------------------------------------
// Histogram feature
//----------------------------------------------------------------------------------------

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

//----------------------------------------------------------------------------------------
// Saved graph's feature
//----------------------------------------------------------------------------------------
$("#graph-select").change(function() {
    var name = $(this).val();
    load_saved_graph(name);
});

function load_saved_graph(name) {
    $("#graph-name").val(name);
    $("#graph-delete").show();
    var index = graph_index_from_name(name);
    
    $("#graph-id").html(savedgraphs[index].id);
    
    // view settings
    view.start = savedgraphs[index].start;
    view.end = savedgraphs[index].end;
    view.interval = savedgraphs[index].interval;
    view.limitinterval = savedgraphs[index].limitinterval;
    view.fixinterval = savedgraphs[index].fixinterval;
    floatingtime = savedgraphs[index].floatingtime,
    yaxismin = savedgraphs[index].yaxismin;
    yaxismax = savedgraphs[index].yaxismax;

    // CSV display settings
    csvtimeformat = (typeof(savedgraphs[index].csvtimeformat)==="undefined" ? "datestr" : savedgraphs[index].csvtimeformat);
    csvnullvalues = (typeof(savedgraphs[index].csvnullvalues)==="undefined" ? "show" : savedgraphs[index].csvnullvalues);
    csvheaders = (typeof(savedgraphs[index].csvheaders)==="undefined" ? "showNameTag" : savedgraphs[index].csvheaders);
    var tmpCsv = (typeof(savedgraphs[index].showcsv)==="undefined" ? "0" : savedgraphs[index].showcsv.toString());

    // show settings
    showmissing = savedgraphs[index].showmissing;
    showtag = savedgraphs[index].showtag;
    showlegend = savedgraphs[index].showlegend;
    
    // feedlist
    feedlist = savedgraphs[index].feedlist;
    
    if (floatingtime) {
        var timewindow = view.end - view.start;
        var now = Math.round(+new Date * 0.001)*1000;
        view.end = now;
        view.start = view.end - timewindow;
    }

    $("#yaxis-min").val(yaxismin);
    $("#yaxis-max").val(yaxismax);
    $("#request-fixinterval")[0].checked = view.fixinterval;
    $("#request-limitinterval")[0].checked = view.limitinterval;
    $("#showmissing")[0].checked = showmissing;
    $("#showtag")[0].checked = showtag;
    $("#showlegend")[0].checked = showlegend;

    load_feed_selector();

    graph_reloaddraw();

    // Placed after graph load as values only available after the graph is redrawn
    $("#csvtimeformat").val(csvtimeformat);
    $("#csvnullvalues").val(csvnullvalues);
    $("#csvheaders").val(csvheaders);
    csvShowHide(tmpCsv);
}

$("#graph-name").keyup(function(){
    var name = $(this).val();
    
    if (graph_exists(name)) {
        $("#graph-delete").show(); 
    } else { 
        $("#graph-delete").hide();
    }
});

$("#graph-delete").click(function() {
    var name = $("#graph-name").val();
    var updateindex = graph_index_from_name(name);
    if (updateindex!=-1) {
        graph_delete(savedgraphs[updateindex].id);
        feedlist = [];
        graph_reloaddraw();
        $("#graph-name").val("");
        load_feed_selector();
    }
});

$("#graph-save").click(function() {
    var name = $("#graph-name").val();
    
    if (name==undefined || name=="") {
        alert("Please enter a name for the graph you wish to save");
        return false;
    }
    
    var now = Math.round(+new Date * 0.001)*1000;
    if (Math.abs(now - view.end)<120000) {
        floatingtime = 1;
    }
    
    var graph_to_save = {
        name: name,
        start: view.start,
        end: view.end,
        interval: view.interval,
        limitinterval: view.limitinterval,
        fixinterval: view.fixinterval,
        floatingtime: floatingtime,
        yaxismin: yaxismin,
        yaxismax: yaxismax,
        showmissing: showmissing,
        showtag: showtag,
        showlegend: showlegend,
        showcsv: showcsv,
        csvtimeformat: csvtimeformat,
        csvnullvalues: csvnullvalues,
        csvheaders: csvheaders,
        feedlist: JSON.parse(JSON.stringify(feedlist))
    };
    
    var updateindex = graph_index_from_name(name);
    
    // Update or append
    if (updateindex==-1) {
        savedgraphs.push(graph_to_save);
        graph_create(graph_to_save);
    } else {
        graph_to_save.id = savedgraphs[updateindex].id;
        savedgraphs[updateindex] = graph_to_save;
        graph_update(graph_to_save);
    }
    
    $("#graph-select").val(name);
});

function graph_exists(name) {
    if (graph_index_from_name(name)!=-1) return true;
    return false;
}

function graph_index_from_name(name) {
    var index = -1;
    for (var z in savedgraphs) {
        if (savedgraphs[z].name==name) index = z;
    }
    return index;
}

function graph_load_savedgraphs(fn=false)
{
    $.ajax({                                      
        url: path+"/graph/getall"+apikeystr,
        async: true,
        dataType: "json",
        success: function(result) {
            savedgraphs = result.user;
            
            var out = "<option>" + _lang['Select graph'] + ":</option>";
            for (var z in savedgraphs) {
               var name = savedgraphs[z].name;
               out += "<option>"+name+"</option>";
            }
            $("#graph-select").html(out);
            if (fn) fn();
        }
    });
}
function graph_create(data) {

    // Clean feedlist of data and stats that dont need to be saved
    for (var i in data.feedlist) {
        delete data.feedlist[i].data
        delete data.feedlist[i].stats;
    }
    
    // Save 
    $.ajax({         
        method: "POST",                             
        url: path+"/graph/create",
        data: "data="+JSON.stringify(data),
        async: true,
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        }
    });
    
    graph_load_savedgraphs();
}

function graph_update(data) {
    // Clean feedlist of data and stats that dont need to be saved
    for (var i in data.feedlist) {
        delete data.feedlist[i].data
        delete data.feedlist[i].stats;
    }

    // Save 
    $.ajax({         
        method: "POST",                             
        url: path+"/graph/update",
        data: "id="+data.id+"&data="+JSON.stringify(data),
        async: true,
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        }
    });
}

function graph_delete(id) {
    // Save 

    $.ajax({         
        method: "POST",                             
        url: path+"/graph/delete",
        data: "id="+id,
        async: true,
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        }
    });
    
    graph_load_savedgraphs();
}

// ----------------------------------------------------------------------------------------
// Sidebar
// ----------------------------------------------------------------------------------------
$("#sidebar-open").click(function(){
    $("#sidebar-wrapper").css("left", sidebarwidth);
    $("#sidebar-close").show();
});

$("#sidebar-close").click(function(){
    $("#sidebar-wrapper").css("left","0");
    $("#sidebar-close").hide();
});

function set_sidebar_width(width) {
    $('#wrapper').css("padding-left", width);
    $('#sidebar-wrapper').css("left", width);
    $('#sidebar-wrapper').css("width", width);
    $('#sidebar-wrapper').css("margin-left", -1*width);
    $('#sidebar-split').css("left", width);
    sidebarwidth = width;
}

$('#sidebar-split').mousedown(function (e) {
    e.preventDefault();
    $(document).mousemove(function (e) {
        e.preventDefault();
        var min = 250;
        var max = 500;
        var mainmin = 300;
        var x = e.pageX - $('#sidebar-wrapper').offset().left;
        if (x > min && x < max && e.pageX < ($(window).width() - mainmin)) {
          set_sidebar_width(x);
        }
    });

    $(document).one('mouseup', function (e) {
        $(document).unbind('mousemove');
        graph_resize();
        graph_draw();
    });
});

function sidebar_resize() {
    var width = $(window).width();
    var height = $(window).height();
    $("#sidebar-wrapper").height(height-41);
    
    if (width<1024) {
        $("#sidebar-wrapper").css("left","0");
        $("#wrapper").css("padding-left","0");
        $("#sidebar-open").show();
        $("#sidebar-split").hide();
    } else {
        set_sidebar_width(sidebarwidth);
        $("#sidebar-open").hide();
        $("#sidebar-close").hide();
        $("#sidebar-split").show();
    }
}

// ----------------------------------------------------------------------------------------
function load_feed_selector() {
    for (var z in feeds) {
        var feedid = feeds[z].id;
        $(".feed-select-left[feedid="+feedid+"]")[0].checked = false;
        $(".feed-select-right[feedid="+feedid+"]")[0].checked = false;
    }
    
    for (var z=0; z<feedlist.length; z++) {
        var feedid = feedlist[z].id;
        var tag = feedlist[z].tag;
        if (tag=="") tag = "undefined";
        if (feedlist[z].yaxis==1) { $(".feed-select-left[feedid="+feedid+"]")[0].checked = true; $(".tagbody[tag='"+tag+"']").show(); }
        if (feedlist[z].yaxis==2) { $(".feed-select-right[feedid="+feedid+"]")[0].checked = true; $(".tagbody[tag='"+tag+"']").show(); }
    }
}

function printdate(timestamp)
{
    var date = new Date();
    var thisyear = date.getFullYear()-2000;
    
    var date = new Date(timestamp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = date.getFullYear()-2000;
    var month = months[date.getMonth()];
    var day = date.getDate();
    
    var minutes = date.getMinutes();
    if (minutes<10) minutes = "0"+minutes;
    
    var datestr = date.getHours()+":"+minutes+" "+day+" "+month;
    if (thisyear!=year) datestr +=" "+year;
    return datestr;
};
