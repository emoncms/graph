//----------------------------------------------------------------------------------------
// graph.histogram.js - Histogram feature
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

// Change the histogram resolution
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
