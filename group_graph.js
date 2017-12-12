var savedgraphs = [];
var feeds = []; // session user's feeds
feedlist = []; // feeds to be shown in the data viewer
var groups = []; // groups the session user belongs to. If his/her role is administrator or subadministrator, each group will contain all its users and their feeds
var plotdata = [];

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
var showtag = true;

var previousPoint = 0;

var active_histogram_feed = 0;

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

$('#placeholder').bind("legendclick", function (event, ranges) {
  console.log(event);
});

$('#placeholder').bind("plotselected", function (event, ranges)
{
    floatingtime=0; 
    view.start = ranges.xaxis.from;
    view.end = ranges.xaxis.to;
    view.calc_interval();
    
    graph_reloaddraw();
});

$('#placeholder').bind("plothover", function (event, pos, item) {
    if (item) {
        var z = item.dataIndex;
        if (previousPoint != item.datapoint) {
            previousPoint = item.datapoint;

            $("#tooltip").remove();
            var item_time = item.datapoint[0];
            var item_value = item.datapoint[1];

            var d = new Date(item_time);
            var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
            var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            var minutes = d.getMinutes();
            if (minutes<10) minutes = "0"+minutes;
            var date = d.getHours()+":"+minutes+" "+days[d.getDay()]+", "+months[d.getMonth()]+" "+d.getDate();
            tooltip(item.pageX, item.pageY, "<span style='font-size:11px'>"+item.series.label+"</span><br>"+item_value+"<br><span style='font-size:11px'>"+date+"</span>", "#fff");
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

function graph_init_editor()
{

    if (session) graph_load_savedgraphs();
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

    //-------------------------------------------------
    // Populate editor: groups, users and their feeds
    //-------------------------------------------------
    if (group_support === true) {
        groups.forEach(function (group, index) {
            $('#select-group').append('<option value=' + index + '>' + group.name + '</option>');
        });
        populate_group_table(0);
        if (groups[0].role != 1&&groups[0].role != 2) {
            $('#graph-save').hide();
            $('#graph-delete').hide();
        }
        else {
            $('#graph-save').show();
            $('#graph-delete').show();
        }
    }

    //******************************************
    // Actions data viewer
    // ******************************************/
    $("#reload").click(function(){
        view.start = $("#request-start").val()*1000;
        view.end = $("#request-end").val()*1000;
        view.interval = $("#request-interval").val();
        view.limitinterval = $("#request-limitinterval")[0].checked*1;
        
        graph_reloaddraw();
    });

    $("#showcsv").click(function(){
        if ($("#showcsv").html()=="Show CSV Output") {
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
        printcsv();
    });

    $("#csvnullvalues").change(function(){
        printcsv();
    });
    
    $('body').on("click",".legendColorBox",function(d){
          var country = $(this).html().toLowerCase();
          console.log(country);
    }); 

    $(".feed-options-show-stats").click(function(){
        $("#feed-options-table").hide();
        $("#feed-stats-table").show();
        $(".feed-options-show-options").show();
        $(".feed-options-show-stats").hide();
    });    
    
    $(".feed-options-show-options").click(function(){
        $("#feed-options-table").show();
        $("#feed-stats-table").hide();
        $(".feed-options-show-options").hide();
        $(".feed-options-show-stats").show();
    });

    //******************************************
    // Actions ticking checkboxes in editor
    // ******************************************/
    $("body").on("click", ".feed-select-left", function (e) {
        e.stopPropagation();
        var feedid = $(this).attr("feedid");
        var checked = $(this)[0].checked;
        var feed_from_group = false;

        // Check if the feed belongs to a user in a group
        var source = $(this).attr('source');
        if (source == 'group') {
            feed_from_group = true;
            // set state of "check all" checkbox
            var userid = $(this).attr('userid');
            var tag = $(this).attr('tag');
            var any_checked = false
            var any_unchecked = false;
            $(".feed-select-left[tag='" + tag + "'][userid='" + userid + "']").each(function () {
                if ($(this)[0].checked == false)
                    any_unchecked = true;
                else
                    any_checked = true;
            });
            if (any_checked == true && any_unchecked == false) // all checked
                $('.feed-tag-checkbox-left[tag="' + tag + '"][uid="' + userid + '"]').prop('checked', 'checked').prop("indeterminate", false);
            else if (any_checked == false && any_unchecked == true) // none checked
                $('.feed-tag-checkbox-left[tag="' + tag + '"][uid="' + userid + '"]').prop('checked', '').prop("indeterminate", false);
            else // some are checked and some are unchecked
                $('.feed-tag-checkbox-left[tag="' + tag + '"][uid="' + userid + '"]').prop("indeterminate", true);
        }

        // Add/remove the feeds to the feedlist
        var loaded = false;
        for (var z in feedlist) {
            if (feedlist[z].id == feedid) {
                if (!checked) {
                    feedlist.splice(z, 1);  // Remove from graph the feeds that are not checked and are in the graph
                } else {
                    feedlist[z].yaxis = 1;
                    loaded = true;
                    $(".feed-select-right[feedid=" + feedid + "]").each(function () { // Ensure that feeds are only ticked the appropiate column
                        $(this)[0].checked = false;
                    });
                }
            }
        }
        if (loaded == false && checked) // When both sides where unticked and one has been ticked now we add it to the graph
            pushfeedlist(feedid, 1, feed_from_group);

        graph_reloaddraw();

        // set state of "check all" checkbox
        if (source == 'group') {
            var userid = $(this).attr('userid');
            var tag = $(this).attr('tag');
            var any_checked = false
            var any_unchecked = false;
            $(".feed-select-left[tag='" + tag + "'][userid='" + userid + "']").each(function () {
                if ($(this)[0].checked == false)
                    any_unchecked = true;
                else
                    any_checked = true;
            });
            if (any_checked == true && any_unchecked == false) { // all checked
                $('.feed-tag-checkbox-left[tag="' + tag + '"][uid="' + userid + '"]').prop('checked', 'checked').prop("indeterminate", false);
                $('.feed-tag-checkbox-right[tag="' + tag + '"][uid="' + userid + '"]').prop('checked', '').prop("indeterminate", false);
                $('.feed-select-right[tag="' + tag + '"][userid="' + userid + '"]').prop('checked', '');
            }
            else if (any_checked == false && any_unchecked == true) { // none checked
                $('.feed-tag-checkbox-left[tag="' + tag + '"][uid="' + userid + '"]').prop('checked', '').prop("indeterminate", false);
            }
            else { // some are checked and some are unchecked
                $('.feed-tag-checkbox-left[tag="' + tag + '"][uid="' + userid + '"]').prop("indeterminate", true);
                // the other column
                var any_checked = false
                var any_unchecked = false;
                $(".feed-select-right[tag='" + tag + "'][userid='" + userid + "']").each(function () {
                    if ($(this)[0].checked == false)
                        any_unchecked = true;
                    else
                        any_checked = true;

                    if (any_checked == false && any_unchecked == true) { // none checked
                        $('.feed-tag-checkbox-right[tag="' + tag + '"][uid="' + userid + '"]').prop('checked', '').prop("indeterminate", false);
                    }
                    else { // some are checked and some are unchecked
                        $('.feed-tag-checkbox-right[tag="' + tag + '"][uid="' + userid + '"]').prop("indeterminate", true);
                    }
                });
            }
        }

    });
    $("body").on("click", ".feed-select-right", function (e) {
        e.stopPropagation();
        var feedid = $(this).attr("feedid");
        var checked = $(this)[0].checked;
        var feed_from_group = false;

        // Check if the feed belongs to a user in a group
        var source = $(this).attr('source');
        if (source == 'group')
            feed_from_group = true;

        // Add/remove the feeds to the feedlist
        var loaded = false;
        for (var z in feedlist) {
            if (feedlist[z].id == feedid) {
                if (!checked) {
                    feedlist.splice(z, 1);  // Remove from graph the feeds that are not checked and are in the graph
                } else {
                    feedlist[z].yaxis = 2;
                    loaded = true;
                    $(".feed-select-left[feedid=" + feedid + "]").each(function () { // Ensure that feeds are only ticked the appropiate column
                        $(this)[0].checked = false;
                    });
                }
            }
        }
        if (loaded == false && checked) // When both sides where unticked and one has been ticked now we add it to the graph
            pushfeedlist(feedid, 2, feed_from_group);

        graph_reloaddraw();

        // set state of "check all" checkbox
        if (source == 'group') {
            var userid = $(this).attr('userid');
            var tag = $(this).attr('tag');
            var any_checked = false
            var any_unchecked = false;
            $(".feed-select-right[tag='" + tag + "'][userid='" + userid + "']").each(function () {
                if ($(this)[0].checked == false)
                    any_unchecked = true;
                else
                    any_checked = true;
            });
            if (any_checked == true && any_unchecked == false) { // all checked
                $('.feed-tag-checkbox-right[tag="' + tag + '"][uid="' + userid + '"]').prop('checked', 'checked').prop("indeterminate", false);
                $('.feed-tag-checkbox-left[tag="' + tag + '"][uid="' + userid + '"]').prop('checked', '').prop("indeterminate", false);
                $('.feed-select-left[tag="' + tag + '"][userid="' + userid + '"]').prop('checked', '');
            }
            else if (any_checked == false && any_unchecked == true) { // none checked
                $('.feed-tag-checkbox-right[tag="' + tag + '"][uid="' + userid + '"]').prop('checked', '').prop("indeterminate", false);
            }
            else { // some are checked and some are unchecked
                $('.feed-tag-checkbox-right[tag="' + tag + '"][uid="' + userid + '"]').prop("indeterminate", true);
                // the other column
                var any_checked = false
                var any_unchecked = false;
                $(".feed-select-left[tag='" + tag + "'][userid='" + userid + "']").each(function () {
                    if ($(this)[0].checked == false)
                        any_unchecked = true;
                    else
                        any_checked = true;

                    if (any_checked == false && any_unchecked == true) { // none checked
                        $('.feed-tag-checkbox-left[tag="' + tag + '"][uid="' + userid + '"]').prop('checked', '').prop("indeterminate", false);
                    }
                    else { // some are checked and some are unchecked
                        $('.feed-tag-checkbox-left[tag="' + tag + '"][uid="' + userid + '"]').prop("indeterminate", true);
                    }
                });
            }
        }
    });
    $("body").on("click", ".feed-tag-checkbox-right", function (e) {
        e.stopPropagation();
        var tag = $(this).attr("tag");
        var userid = $(this).attr("uid");
        var checked = $(this)[0].checked;
        var feed_from_group = true;

        // Tick/untick the feeds
        if (checked)
            $('.feed-select-right[tag="' + tag + '"][userid="' + userid + '"]').prop('checked', 'checked');
        else
            $('.feed-select-right[tag="' + tag + '"][userid="' + userid + '"]').prop('checked', '');

        // Ensure only this checkbox is ticked
        if (checked)
            $(".feed-tag-checkbox-left").prop('checked', '').prop("indeterminate", false);

        // Add/remove the feeds to the feedlist
        $('.feed-select-right[tag="' + tag + '"][userid="' + userid + '"]').each(function () {
            var feedid = $(this).attr('feedid');
            var loaded = false;
            for (var z in feedlist) {
                if (feedlist[z].id == feedid) {
                    if (!checked) {
                        feedlist.splice(z, 1); // Remove from graph the feeds that are not checked and are in the graph
                    } else {
                        feedlist[z].yaxis = 2;
                        loaded = true;
                        $(".feed-select-left[feedid=" + feedid + "]").each(function () {  // Ensure that feeds are only ticked the appropiate column
                            $(this)[0].checked = false;
                        });
                    }
                }
            }
            if (loaded == false && checked) // When both sides where unticked and one has been ticked now we add it to the graph
                pushfeedlist(feedid, 2, feed_from_group);
        });

        // Draw graph
        graph_reloaddraw();
    });
    $("body").on("click", ".feed-tag-checkbox-left", function (e) {
        e.stopPropagation();
        var tag = $(this).attr("tag");
        var userid = $(this).attr("uid");
        var checked = $(this)[0].checked;
        var feed_from_group = true;

        // Tick/untick the feeds
        if (checked)
            $('.feed-select-left[tag="' + tag + '"][userid="' + userid + '"]').prop('checked', 'checked');
        else
            $('.feed-select-left[tag="' + tag + '"][userid="' + userid + '"]').prop('checked', '');

        // Ensure only this checkbox is ticked
        if (checked)
            $(".feed-tag-checkbox-right").prop('checked', '').prop("indeterminate", false);

        // Add/remove the feeds to the feedlist
        $('.feed-select-left[tag="' + tag + '"][userid="' + userid + '"]').each(function () {
            var feedid = $(this).attr('feedid');
            var loaded = false;
            for (var z in feedlist) {
                if (feedlist[z].id == feedid) {
                    if (!checked) {
                        feedlist.splice(z, 1); // Remove from graph the feeds that are not checked and are in the graph
                    } else {
                        feedlist[z].yaxis = 1;
                        loaded = true;
                        $(".feed-select-right[feedid=" + feedid + "]").each(function () { // Ensure that feeds are only ticked the appropiate column
                            $(this)[0].checked = false;
                        });
                    }
                }
            }
            if (loaded == false && checked) // When both sides where unticked and one has been ticked now we add it to the graph
                pushfeedlist(feedid, 1, feed_from_group);
        });

        // Draw graph
        graph_reloaddraw();
    });

    //******************************************
    // Actions editor user's feeds
    // ******************************************/
    $("body").on("click", ".tagheading", function () {
        var tag = $(this).attr("tag");
        var e = $(".tagbody[tag='" + tag + "']");
        if (e.is(":visible"))
            e.hide();
        else
            e.show();
    });

    //******************************************
    // Actions editor displaying groups
    // ******************************************/
    $('#select-group').on('change', function () {
        var groupindex = $(this).val();
        populate_group_table(groupindex);
        load_feed_selector();
        if (groups[groupindex].role != 1&&groups[groupindex].role != 2) {
            $('#graph-save').hide();
            $('#graph-delete').hide();
        }
        else {
            $('#graph-save').show();
            $('#graph-delete').show();
        }
    });
    $('body').on('click', '.user-name', function () {
        var user = $(this).attr('user');
        $('.feed-tag[user="' + user + '"]').toggle();
    });
    $('body').on('click', '.feed-tag', function () {
        var user = $(this).attr('user');
        var tag = $(this).attr('tag');
        $('.feed[user="' + user + '"][tag="' + tag + '"]').toggle();
    });

}

/******************************************
 Functions
 ******************************************/

function pushfeedlist(feedid, yaxis, feed_from_group) {
    if (feed_from_group === false) {
        var index = getfeedindex(feedid);
        feedlist.push({id: feedid, name: feeds[index].name, tag: feeds[index].tag, yaxis: yaxis, fill: 0, scale: 1.0, delta: false, getaverage: false, dp: 1, plottype: 'lines'});
    }
    else {
        var feed = getfeedfromgroups(feedid);
        feedlist.push({id: feed.id, source: 'group', name: feed.name, tag: feed.tag, yaxis: yaxis, fill: 0, scale: 1.0, delta: false, getaverage: false, dp: 1, plottype: 'lines'});
    }
}

function graph_reloaddraw() {
    graph_reload();
    graph_draw();
}

function graph_reload()
{
    var intervalms = view.interval * 1000;
    view.start = Math.round(view.start / intervalms) * intervalms;
    view.end = Math.round(view.end / intervalms) * intervalms;
    
    $("#request-start").val(view.start*0.001);
    $("#request-end").val(view.end*0.001);
    $("#request-interval").val(view.interval);
    $("#request-limitinterval").attr("checked",view.limitinterval);
    
    var errorstr = "";    
    
    for (var z in feedlist)
    {
        var mode = "&interval="+view.interval+"&skipmissing="+skipmissing+"&limitinterval="+view.limitinterval;
        if (requesttype!="interval") mode = "&mode="+requesttype;

        var action = "feed/";
        if (feedlist[z].source == 'group') action = "group/getfeed/";
        var method = "data";
        if (feedlist[z].getaverage) method = "average";
        var request = path+action+method+".json?id="+feedlist[z].id+"&start="+view.start+"&end="+view.end + mode;
        
        $.ajax({                                      
            url: request,
            async: false,
            dataType: "text",
            success: function(data_in) {
            
                // 1) Check validity of json data, or show error
                var valid = true;
                try {
                    feedlist[z].data = JSON.parse(data_in);
                    if (feedlist[z].data.success!=undefined) valid = false;
                } catch (e) {
                    valid = false;
                }
                
                if (!valid) errorstr += "<div class='alert alert-danger'><b>Request error</b> "+data_in+"</div>";
            }
        });
        
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
        var scale = $(".scale[feedid="+feedlist[z].id+"]").val();
        if (scale!=undefined) feedlist[z].scale = scale;
        
        if (feedlist[z].scale!=undefined && feedlist[z].scale!=1.0) {
            for (var i=0; i<feedlist[z].data.length; i++) {
                if (feedlist[z].data[i][1]!=null) {
                    feedlist[z].data[i][1] = feedlist[z].data[i][1] * feedlist[z].scale;
                }
            }
        }
    }
    
    if (errorstr!="") {
        $("#error").html(errorstr).show();
    } else {
        $("#error").hide();
    }
}

function graph_draw()
{
    var options = {
        lines: { fill: false },
        xaxis: { 
            mode: "time", timezone: "browser", 
            min: view.start, max: view.end
        },
	      yaxes: [ { }, {
			      // align if we are to the right
			      alignTicksWithAxis: 1,
			      position: "right"
			      //tickFormatter: euroFormatter
		    } ],
        grid: {hoverable: true, clickable: true},
        selection: { mode: "x" },
        legend: { show: false, position: "nw", toggle: true },
        toggle: { scale: "visible" },
        touch: { pan: "x", scale: "x" }
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
        if (feedlist[z].data.success == undefined) {
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
            if (typeof (vis_mode) == 'string' && vis_mode == 'groups' && embed != true) {
                var user = feed_belongs_to(feedlist[z].id);
                label += user.username + ': '; // 
            }
            if (showtag) label += feedlist[z].tag + ": ";
            label += feedlist[z].name;

            var plot = {label: label, data: data, yaxis: feedlist[z].yaxis, color: feedlist[z].color};
            if (feedlist[z].plottype == 'lines') plot.lines = {show: true, fill: feedlist[z].fill};
            if (feedlist[z].plottype == 'bars') plot.bars = {show: true, barWidth: view.interval * 1000 * 0.75};
            plotdata.push(plot);
        }
    }
    $.plot($('#placeholder'), plotdata, options);
    
    if (!embed) {
        
        for (var z in feedlist) {
            feedlist[z].stats = stats(feedlist[z].data);
        }
        
        var default_linecolor = "000";
        var out = "";
        for (var z in feedlist) {
            var dp = feedlist[z].dp;
        
            var apiurl = path+"feed/data.json?id="+feedlist[z].id+"&start="+view.start+"&end="+view.end+"&interval="+view.interval+"&skipmissing="+skipmissing+"&limitinterval="+view.limitinterval;
         
         
            out += "<tr>";
            out += "<td>"+feedlist[z].id+":"+feedlist[z].tag+":"+feedlist[z].name+"</td>";
            out += "<td><select class='plottype' feedid="+feedlist[z].id+" style='width:80px'>";
            
            var selected = "";
            if (feedlist[z].plottype == "lines") selected = "selected"; else selected = "";
            out += "<option value='lines' "+selected+">Lines</option>";
            if (feedlist[z].plottype == "bars") selected = "selected"; else selected = "";
            out += "<option value='bars' "+selected+">Bars</option>";
            out += "</select></td>";
            out += "<td><input class='linecolor' feedid="+feedlist[z].id+" style='width:50px' type='color' value='#"+default_linecolor+"'></td>";
            out += "<td><input class='fill' type='checkbox' feedid="+feedlist[z].id+"></td>";

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
            out += "<td>"+feedlist[z].id+":"+feedlist[z].tag+": "+feedlist[z].name+"</td>";
            var quality = Math.round(100 * (1-(feedlist[z].stats.npointsnull/feedlist[z].stats.npoints)));
            out += "<td>"+quality+"% ("+(feedlist[z].stats.npoints-feedlist[z].stats.npointsnull)+"/"+feedlist[z].stats.npoints+")</td>";
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
        }
        
        if (showcsv) printcsv();
    }
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
        url: path+"feed/aget.json?id="+feedid,
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

function getfeedfromgroups(feedid) {
    var feed_to_return = {};
    groups.forEach(function (group) {
        group.users.forEach(function (user) {
            user.feedslist.forEach(function (feed) {
                if (feedid == feed.id)
                    feed_to_return = JSON.parse(JSON.stringify(feed));
            });
        });
    });
    return feed_to_return;
}

function populate_group_table(groupindex) {
    $('#group-table').html('');
    if (groups[groupindex].users.success == false) { // when user role is "member"
        void(0); // do nothing
    }
    else {
        var users = groups[groupindex].users;
        users.forEach(function (user, index) {
            $('#group-table').append('<div class="user-name" user="' + user.username + '">' + user.username + '</div>');
            var out = '';
            // Add tags
            var tags_list = [];
            user.feedslist.forEach(function (feed) {
                if (tags_list.indexOf(feed.tag) == -1) {
                    tags_list.push(feed.tag);
                    out += "<div class='feed-tag hide' tag='" + feed.tag + "' user='" + user.username + "'>";
                    out += feed.tag + "<input class='feed-tag-checkbox-right' type='checkbox' tag='" + feed.tag + "' uid='" + user.userid + "' />" + "<input class='feed-tag-checkbox-left' type='checkbox' tag='" + feed.tag + "' uid='" + user.userid + "' />";
                    // Add feed tah have the current tag
                    user.feedslist.forEach(function (feed_again) {
                        if (feed_again.tag == feed.tag) {
                            out += "<div class='feed user-feed  hide' user='" + user.username + "' tag='" + feed_again.tag + "' uid='" + user.userid + "'>";
                            out += "<div class='feed-select'><input class='feed-select-right' source='group' userid='" + user.userid + "' user='" + user.username + "' tag='" + feed_again.tag + "' groupid='" + groups[groupindex].groupid + "' feedid='" + feed_again.id + "' type='checkbox' /></div>";
                            out += "<div class='feed-select'><input class='feed-select-left' source='group' userid='" + user.userid + "' user='" + user.username + "' tag='" + feed_again.tag + "' groupid='" + groups[groupindex].groupid + "' feedid='" + feed_again.id + "' type='checkbox' /></div>";
                            out += "<div class='feed-name' title='" + feed_again.name + "'>" + feed_again.name + "</div>";
                            out += "</div>"; // feed
                        }
                    });
                    out += "</div>";
                }
            });
            $('#group-table').append(out);
        });
    }
}

function get_group_index(groupid) {
    for (var index in groups) {
        if (groups[index].groupid == groupid)
            return index;
    }
}

function feed_belongs_to(feedid) {
    for (var group in groups) {
        for (var user in groups[group].users) {
            for (var feed in groups[group].users[user].feedslist) {
                if (groups[group].users[user].feedslist[feed].id == feedid)
                    return groups[group].users[user];
            }
        }
    }
}

//----------------------------------------------------------------------------------------
// Print CSV
//----------------------------------------------------------------------------------------
function printcsv()
{
    var timeformat = $("#csvtimeformat").val();
    var nullvalues = $("#csvnullvalues").val();
    
    var csvout = "";

    var value = [];
    var lastvalue = [];
    var start_time = feedlist[0].data[0][0];
    for (var z in feedlist[0].data) {
        var line = [];
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
    $("#graph-name").val(name);
    $("#graph-delete").show();
    var graph = graph_from_name(name);
    $("#graph-id").html(graph.id);
    // view settings
    view.start = graph.start;
    view.end = graph.end;
    view.interval = graph.interval;
    view.limitinterval = graph.limitinterval;
    view.fixinterval = graph.fixinterval;
    floatingtime = graph.floatingtime;
    yaxismin = graph.yaxismin;
    yaxismax = graph.yaxismax;
    // show settings
    showmissing = graph.showmissing;
    showtag = graph.showtag;
    showlegend = graph.showlegend;
    // visualization mode
    if (graph.source == 'groups') {
        $("[name='vis-mode-toggle']").bootstrapSwitch('state', false);
        $('#vis-mode-groups').show();
        $('#vis-mode-user').hide();
        $('#select-group').val(get_group_index(graph.groupid)).trigger('change');
    } else {
        $("[name='vis-mode-toggle']").bootstrapSwitch('state', true);
        $('#vis-mode-groups').hide();
        $('#vis-mode-user').show();
    }

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
    $("#request-fixinterval")[0].checked = view.fixinterval;
    $("#request-limitinterval")[0].checked = view.limitinterval;
    $("#showmissing")[0].checked = showmissing;
    $("#showtag")[0].checked = showtag;
    $("#showlegend")[0].checked = showlegend;
    
    load_feed_selector();

    graph_reloaddraw();
});

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
    var graph = graph_from_name(name);
    if (graph != null) {
        graph_delete(graph.id);
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
        feedlist: JSON.parse(JSON.stringify(feedlist))
    };
    if (vis_mode == 'groups') {
        graph_to_save.source = 'groups';
        var group_index = $('#select-group').val();
        graph_to_save.groupid = groups[group_index].groupid;
    }

    var graph = graph_from_name(name);
    // Update or append
    if (graph == null) {
        graph_create(graph_to_save);
    } else {
        graph_to_save.id = graph.id;
        graph_update(graph_to_save);
    }
    savedgraphs = graph_load_savedgraphs();

    $("#graph-select").val(name);
});

function graph_exists(name) {
    if (graph_from_name(name) != null)
        return true;
    return false;
}

function graph_from_name(name) {
    // Search in user's graphs
    for (var z in savedgraphs.user) {
        if (savedgraphs.user[z].name == name)
            return savedgraphs.user[z];
    }
    // Search in groups graphs
    if (savedgraphs.groups != undefined) {
        for (var groupname in savedgraphs.groups) {
            for (var z in savedgraphs.groups[groupname])
                if (savedgraphs.groups[groupname][z].name == name)
                    return savedgraphs.groups[groupname][z];
        }
    }
    return null;
}

function graph_load_savedgraphs()
{
    $.ajax({                                      
        url: path+"/graph/getall",
        async: true,
        dataType: "json",
        success: function(result) {
            savedgraphs = result;
            
            var out = "<option>Select graph:</option>";
            // User's graphs
            if (savedgraphs.user.length > 0) {
                out += "<optgroup label='Your graphs'>";
                for (var z in savedgraphs.user) {
                    var name = savedgraphs.user[z].name;
                    out += "<option>" + name + "</option>";
                }
                out += '</optgroup>';
            }
            // Group graphs
            if (savedgraphs.groups != undefined) {
                for (var group_name in savedgraphs.groups) {
                    out += "<optgroup label='Group:" + group_name + " '>";
                    for (var z in savedgraphs.groups[group_name])
                        out += "<option>" + savedgraphs.groups[group_name][z].name + "</option>";
                    out += "</optgroup>";
                }
            }
            $("#graph-select").html(out);
        }
    });
}
function graph_create(data) {

    // Clean feedlist of data and stats that dont need to be saved
    for (var i in data.feedlist) {
        delete data.feedlist[i].data
        delete data.feedlist[i].stats;
    }

    // Group graph
    if (data.source == 'groups') {
        var url = path + "/graph/creategroupgraph";
        var data = "data=" + JSON.stringify(data) + "&groupid=" + data.groupid;
    }
    else {
        var url = path + "/graph/create";
        var data = "data=" + JSON.stringify(data);
    }
    // Save 
    $.ajax({
        method: "POST",
        url: url,
        data: data,
        async: true,
        dataType: "json",
        success: function (result) {
            if (!result.success)
                alert("ERROR: " + result.message);
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

    // Group graph
    if (data.source == 'groups') {
        var url = path + "/graph/updategroupgraph";
        var data_string = "id=" + data.id + "&data=" + JSON.stringify(data) + "&groupid=" + data.groupid;
    }
    else {
        var url = path + "/graph/update";
        var data_string = "id=" + data.id + "&data=" + JSON.stringify(data);
    }
    // Save 
    $.ajax({
        method: "POST",
        url: url,
        data: data_string,
        async: true,
        dataType: "json",
        success: function (result) {
            console.log(result);
            if (!result.success)
                alert("ERROR: " + result.message);
        }
    });
}

function graph_delete(id) {
    if (is_group_graph(id))
        var url = path + "/graph/deletegroupgraph";
    else
        var url = path + "/graph/delete";

    $.ajax({
        method: "POST",
        url: url,
        data: "id="+id,
        async: true,
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        }
    });
    
    graph_load_savedgraphs();
}

function is_group_graph(id) {
    if (savedgraphs.groups != undefined) {
        for (var group in savedgraphs.groups)
            for (var z in savedgraphs.groups[group])
                if (savedgraphs.groups[group][z].id == id)
                    return true;
    }
    return false;
}
// ----------------------------------------------------------------------------------------
// Sidebar
// ----------------------------------------------------------------------------------------
$("#sidebar-open").click(function(){
    $("#sidebar-wrapper").css("left","250px");
    $("#sidebar-close").show();
});

$("#sidebar-close").click(function(){
    $("#sidebar-wrapper").css("left","0");
    $("#sidebar-close").hide();
});

function sidebar_resize() {
    var width = $(window).width();
    var height = $(window).height();
    $("#sidebar-wrapper").height(height-41);
    
    if (width<1024) {
        $("#sidebar-wrapper").css("left","0");
        $("#wrapper").css("padding-left","0");
        $("#sidebar-open").show();
    } else {
        $("#sidebar-wrapper").css("left","250px");
        $("#wrapper").css("padding-left","250px");
        $("#sidebar-open").hide();
        $("#sidebar-close").hide();
    }
}

// ----------------------------------------------------------------------------------------
function load_feed_selector() {
    $(".feed-select-left").prop('checked','');
    $(".feed-select-right").prop('checked','');
    for (var z=0; z<feedlist.length; z++) {
        var feedid = feedlist[z].id;
        var tag = feedlist[z].tag;
        if (tag=="") tag = "undefined";
        if (feedlist[z].yaxis==1) {
            $(".feed-select-left[feedid="+feedid+"]").prop('checked','checked');
            $(".tagbody[tag='"+tag+"']").show();
        }
        if (feedlist[z].yaxis==2) {
            $(".feed-select-right[feedid="+feedid+"]").prop('checked','checked');
            $(".tagbody[tag='"+tag+"']").show();
        }

        $(".feed-select-right[feedid=" + feedid + "]").each(function (index) { // We only need to use on e column, the aim is to reach the parent elements
            if ($(this).attr('user') != undefined) {
                $('.user-feed[user=' + $(this).attr('user') + '][tag="' + tag + '"]').show();
                $('.feed-tag[user=' + $(this).attr('user') + ']').show();
            }
        });
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
