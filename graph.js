var savedgraphs = [];
var feeds = []; // session user's feeds
var feedlist = []; // feeds to be shown in the data viewer
var groups = []; // groups the session user belongs to. If his/her role is administrator or subadministrator, each group will contain all its users and their feeds
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
    if ((typeof feeds[id] !== 'undefined') && feeds[id].unit) return feeds[id].unit;

    for (let gid = 0; gid < groups.length; gid++) {
        for (let uid = 0; uid < groups[gid].users.length; uid++) {
            let feed = groups[gid].users[uid].feedslist.find(function(item) { return item.id == this; }, id);
            if (feed) {
                return feed.unit;
            }
        }
    }

    return '';
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

    populate_feed_table();

    datetimepickerInit();

    //-------------------------------------------------
    // Populate editor: groups, users and their feeds
    //-------------------------------------------------
    if (group_support === true) {
        groups.forEach(function (group, index) {
            $('#select-group').append('<option value=' + index + '>' + group.name + '</option>');
        });
        if (groups.length == 1) {
            $('#select-group').hide();
            $('#groups-heading').html(groups[0].name);
            $('#groups-heading').css('font-size', 17.5);
        } else {
            $('#select-group').show();
        }
        populate_group_table(0);
        if (!groups[0] || (groups[0].role != 1 && groups[0].role != 2)) {
            $('#graph-save').hide();
            $('#graph-delete').hide();
        }
        else {
            $('#graph-save').show();
            $('#graph-delete').show();
        }

        if (!feeds.length && groups.totalfeeds) {
            $("[name='vis-mode-toggle']").bootstrapSwitch('state', false);
            vis_mode = 'groups';
            $('#vis-mode-groups').show();
            $('#vis-mode-user').hide();
            $('#vis-mode-toggle').hide();
        }
    }

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

    //******************************************
    // Actions ticking checkboxes in editor
    // ******************************************/
    $("body").on("click",".feed-select-left",function(e){
        var feedid = $(this).attr("feedid");
        var checked = $(this)[0].checked;
        var feed_from_group = false;

        if (group_support) {
            e.stopPropagation();
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
        }

        var loaded = false;
        for (var z in feedlist) {
           if (feedlist[z].id == feedid) {
               if (!checked) {
                   feedlist.splice(z,1);
               } else {
                   feedlist[z].yaxis = 1;
                   loaded = true;
                   $(".feed-select-right[feedid="+feedid+"]")[0].checked = false;
               }
           }
        }

        if (loaded == false && checked)
            pushfeedlist(feedid, 1, feed_from_group);
        graph_reloaddraw();

        // set state of "check all" checkbox
        if (group_support && (source == 'group')) {
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

    $("body").on("click",".feed-select-right",function(e){
        var feedid = $(this).attr("feedid");
        var checked = $(this)[0].checked;
        var feed_from_group = false;

        if (group_support) {
            e.stopPropagation();

            // Check if the feed belongs to a user in a group
            var source = $(this).attr('source');
            if (source == 'group')
                feed_from_group = true;
        }

        var loaded = false;
        for (var z in feedlist) {
           if (feedlist[z].id == feedid) {
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
        if (loaded == false && checked)
            pushfeedlist(feedid, 2, feed_from_group);
        graph_reloaddraw();

        if (group_support && (source == 'group')) {
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

    if (group_support) {
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
    }
    $('body').on('click', '#feeds div.feed-tag', function (e) {
        var tag = $(this).attr('tag');
        $('#feeds div.feed[tag="' + tag + '"]').toggle();
    });

    //******************************************
    // Actions editor displaying groups
    // ******************************************/
    if (group_support) {
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
        $('body').on('click', '.feed-tag', function (e) {
            if (e.target.className != "tag-name") return; // only collapse list on tag name
            var user = $(this).attr('user');
            var tag = $(this).attr('tag');
            $('.feed[user="' + user + '"][tag="' + tag + '"]').toggle();
        });
    }

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

/******************************************
 Functions
 ******************************************/

function pushfeedlist(feedid, yaxis, feed_from_group) {
    feed_from_group = (typeof feed_from_group !== 'undefined' ? feed_from_group : false);
    if (feed_from_group === false) {
        var f = getfeed(feedid);
        var dp=0;

        if (f == false)
            f = getfeedpublic(feedid);
        if (f != false) {
            if (f.datatype==2 || f.value % 1 !== 0 ) {
                dp=1;
            }
            feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:yaxis, fill:0, scale: 1.0, delta:false, getaverage:false, dp:dp, plottype:'lines'});
        }
    }
    else {
        var feed = getfeedfromgroups(feedid);
        feedlist.push({id: feed.id, source: 'group', name: feed.name, tag: feed.tag, yaxis: yaxis, fill: 0, scale: 1.0, delta: false, getaverage: false, dp: 1, plottype: 'lines'});
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

    var group_ids = [];
    var group_average_ids = [];

    // create array of selected feed ids
    for (var z in feedlist) {
        if (feedlist[z].getaverage) {
            if (group_support && (feedlist[z].source == 'group'))
                group_average_ids.push(feedlist[z].id);
            else
                average_ids.push(feedlist[z].id);
        } else {
            if (group_support && (feedlist[z].source == 'group'))
                group_ids.push(feedlist[z].id);
            else
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

    if (requesttype != "interval") {
        data.mode = requesttype;
    }

    if (ids.length + average_ids.length + group_ids.length + group_average_ids.length === 0) {
        var title = _lang['Select a feed'];
        var message = _lang['Please select a feed from the Feeds List'];
        $('#error')
        .show()
        .html('<div class="alert alert-info"><strong>' + title + '</strong> ' + message + '</div>');
        graph_draw();
        return false;
    }
    if (ids.length > 0) {
        // get feedlist data
        $.getJSON(path+"feed/data.json", data, addFeedlistData)
        .error(handleFeedlistDataError)
        .always(checkFeedlistData);
    }

    if (group_ids.length > 0) {
        var group_data = {
            id: 0,
            start: view.start,
            end: view.end,
            interval: view.interval,
            skipmissing: skipmissing,
            limitinterval: view.limitinterval,
            apikey: apikey
        }
        // get feedlist data
        group_ids.forEach(function(id) {
            group_data.id = id;
            $.getJSON(path+"group/getfeed/data.json", group_data, function(feed_data) {
                var response = [{ feedid: id, data: feed_data }];
                addFeedlistData(response);
            })
            .error(handleFeedlistDataError)
            .always(function (feed_data) {
                var response = [{ feedid: id, data: feed_data }];
                checkFeedlistData(response);
            });
        })
    }
    if (average_ids.length > 0) {
        // get feedlist average data
        var average_ajax_data = $.extend({}, data, {ids: average_ids.join(',')});
        $.getJSON(path+"feed/average.json", average_ajax_data, addFeedlistData)
        .error(handleFeedlistDataError)
        .always(checkFeedlistData);
    }

    if (group_average_ids.length > 0) {
        var group_data = {
            id: 0,
            start: view.start,
            end: view.end,
            interval: view.interval,
            skipmissing: skipmissing,
            limitinterval: view.limitinterval,
            apikey: apikey
        }
        // get feed data from groups
        group_average_ids.forEach(function(id) {
            group_data.id = id;
            $.getJSON(path+"group/getfeed/average.json", group_data, function(feed_data) {
                var response = [{ feedid: id, data: feed_data }];
                addFeedlistData(response);
            })
            .error(handleFeedlistDataError)
            .always(function (feed_data) {
                var response = [{ feedid: id, data: feed_data }];
                checkFeedlistData(response);
            });
        })
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
    console.log("API error: " + error + message);
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
    if (!groups[groupindex] || groups[groupindex].users.success == false) { // when user role is "member"
        void(0); // do nothing
    }
    else {
        var users = groups[groupindex].users;
        users.forEach(function (user, index) {
            var out = '';
            // Add tags
            var tags_list = [];
            user.feedslist.sort(function(a, b) { let ret = a.tag.localeCompare(b.tag); if (ret != 0) return ret; return a.name.localeCompare(b.name); });
            user.feedslist.forEach(function (feed) {
                if (tags_list.indexOf(feed.tag) == -1) {
                    tags_list.push(feed.tag);
                    out += "<div class='feed-tag hide' tag='" + feed.tag + "' user='" + user.username + "'>";
                    out += "<input class='feed-tag-checkbox-right' type='checkbox' tag='" + feed.tag + "' uid='" + user.userid + "' />" + "<input class='feed-tag-checkbox-left' type='checkbox' tag='" + feed.tag + "' uid='" + user.userid + "' />" + "<div class='tag-name'>" + feed.tag + "</div>";
                    // Add feed tag have the current tag
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
            $('#group-table').append((out.length ? '<div class="user-name" user="' + user.username + '">' + user.username + '</div>' + out : ''));
        });
    }
}

function populate_feed_table() {
    var out = "";
    var tags_list = [];
    feeds.sort(function(a, b) { let ret = a.tag.localeCompare(b.tag); if (ret != 0) return ret; return a.name.localeCompare(b.name); });
    for (var feedid in feeds) {
        if (!feeds[feedid].name) continue;
        if (tags_list.indexOf(feeds[feedid].tag) == -1) {
            tags_list.push(feeds[feedid].tag);
            out += "<div class='feed-tag' tag='" + feeds[feedid].tag + "'>" + feeds[feedid].tag + "</div>";
            for (var fid in feeds) {
                if (feeds[fid].tag == feeds[feedid].tag) {
                    // Add feed tag have the current tag
                    out += "<div class='feed user-feed' tag='" + feeds[fid].tag + "'>";
                    out += "<div class='feed-select'><input class='feed-select-right' tag='" + feeds[fid].tag + "' feedid='" + feeds[fid].id + "' type='checkbox' /></div>";
                    out += "<div class='feed-select'><input class='feed-select-left' tag='" + feeds[fid].tag + "' feedid='" + feeds[fid].id + "' type='checkbox' /></div>";
                    out += "<div class='feed-name' title='" + feeds[fid].name + "'>" + feeds[fid].name + "</div>";
                    out += "</div>"; // feed
                }
            }
        }
    }
    $('#feeds').html(out);
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
    console.log(name);
    $("#graph-name").val(name);
    $("#graph-delete").show();
    var graph = (group_support ? graph_from_name(name) : savedgraphs[graph_index_from_name(name)]);
    if (!graph) return;
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

    // CSV display settings
    csvtimeformat = (typeof(graph.csvtimeformat)==="undefined" ? "datestr" : graph.csvtimeformat);
    csvnullvalues = (typeof(graph.csvnullvalues)==="undefined" ? "show" : graph.csvnullvalues);
    csvheaders = (typeof(graph.csvheaders)==="undefined" ? "showNameTag" : graph.csvheaders);
    var tmpCsv = (typeof(graph.showcsv)==="undefined" ? "0" : graph.showcsv.toString());

    // show settings
    showmissing = graph.showmissing;
    showtag = graph.showtag;
    showlegend = graph.showlegend;

    if (group_support) {
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
    if (group_support) {
        var graph = graph_from_name(name);
        var id = (graph != null ? graph.id : -1);
    } else {
        var updateindex = graph_index_from_name(name);
        var id = (updateindex != -1 ? savedgraphs[updateindex].id : -1);
    }
    if (id != -1) {
        graph_delete(id);
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

    if (!group_support) {
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
    } else {
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
    }

    $("#graph-select").val(name);
});

function graph_exists(name) {
    if (!group_support) {
        if (graph_index_from_name(name)!=-1) return true;
        return false;
    }
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

function graph_index_from_name(name) {
    var index = -1;
    for (var z in savedgraphs) {
        if (savedgraphs[z].name==name) index = z;
    }
    return index;
}

function graph_load_savedgraphs(fn=false)
{
    if (!group_support) {
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
                if (typeof fn === 'function') fn();
            }
        });
    } else {
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
                        out += "<optgroup label='Group: " + group_name + " '>";
                        for (var z in savedgraphs.groups[group_name])
                            out += "<option>" + savedgraphs.groups[group_name][z].name + "</option>";
                        out += "</optgroup>";
                    }
                }
                $("#graph-select").html(out);
                if (typeof fn === 'function') fn();
            }
        });
    }
}
function graph_create(data) {
    // Clean feedlist of data and stats that dont need to be saved
    for (var i in data.feedlist) {
        delete data.feedlist[i].data
        delete data.feedlist[i].stats;
    }
    // Group graph
    if (group_support && (data.source == 'groups')) {
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
        success: function(result) {
            if (result.success) {
                $("#graph-delete").show();
            } else {
                $("#graph-delete").hide();
                alert("ERROR: "+result.message);
            }
        },
        complete: graph_load_savedgraphs
    });
}

function graph_update(data) {
    // Clean feedlist of data and stats that dont need to be saved
    for (var i in data.feedlist) {
        delete data.feedlist[i].data
        delete data.feedlist[i].stats;
    }

    // Group graph
    if (group_support && (data.source == 'groups')) {
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
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        },
        complete: graph_load_savedgraphs
    });
}

function graph_delete(id) {
    if (group_support && is_group_graph(id))
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
        },
        complete: graph_load_savedgraphs
    });
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
        if (feedlist[z].yaxis == 1) {
            $(".feed-select-left[feedid="+feedid+"]").prop('checked','checked');
            $(".tagbody[tag='"+tag+"']").show();
        }
        if (feedlist[z].yaxis == 2) {
            $(".feed-select-right[feedid="+feedid+"]").prop('checked','checked');
            $(".tagbody[tag='"+tag+"']").show();
        }
        if (group_support) {
            $(".feed-select-right[feedid=" + feedid + "]").each(function (index) { // We only need to use on e column, the aim is to reach the parent elements
                if ($(this).attr('user') != undefined) {
                    $('.user-feed[user="' + $(this).attr('user') + '"][tag="' + tag + '"]').show();
                    $('.feed-tag[user="' + $(this).attr('user') + '"]').show();
                }
            });
        }
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
