//----------------------------------------------------------------------------------------
// graph.histogram.js - Histogram feature
//----------------------------------------------------------------------------------------

// Launch histogram mode for a given feed
$('body').on('click', '.histogram', function() {
    $('#navigation').hide();
    $('#histogram-controls').show();
    const feedid = $(this).attr('feedid');
    graphState.active_histogram_feed = feedid;
    const type = $('#histogram-type').val();
    let resolution = 1;

    let index = 0;
    for (const z in graphState.feedlist) {
        if (graphState.feedlist[z].id == feedid) { index = z; break; }
    }

    if (graphState.feedlist[index].stats.diff < 5000) resolution = 10;
    if (graphState.feedlist[index].stats.diff < 100) resolution = 0.1;
    $('#histogram-resolution').val(resolution);

    histogram(feedid, type, resolution);
});

// Change the histogram resolution
$('#histogram-resolution').change(function() {
    const type = $('#histogram-type').val();
    const resolution = $('#histogram-resolution').val();
    histogram(graphState.active_histogram_feed, type, resolution);
});

// Time at value or power to kWh
$('#histogram-type').change(function() {
    const type = $('#histogram-type').val();
    const resolution = $('#histogram-resolution').val();
    histogram(graphState.active_histogram_feed, type, resolution);
});

// Return to power graph
$('#histogram-back').click(function() {
    $('#navigation').show();
    $('#histogram-controls').hide();
    graph_draw();
});

// Draw the histogram
function histogram(feedid, type, resolution)
{
    const histData = {};
    let val = 0;

    // Get the feedlist index of the feedid
    let index = -1;
    for (const z in graphState.feedlist) {
        if (graphState.feedlist[z].id == feedid) { index = z; }
    }
    if (index === -1) return false;

    // Load data from feedlist object
    const data = graphState.feedlist[index].data;

    for (let i = 1; i < data.length; i++) {
        if (data[i][1] !== null) val = data[i][1];
        const key = Math.round(val / resolution) * resolution;
        if (histData[key] === undefined) histData[key] = 0;

        const t = (data[i][0] - data[i - 1][0]) * 0.001;
        let inc = 0;
        if (type === 'kwhatpower') inc = (val * t) / (3600.0 * 1000.0);
        if (type === 'timeatvalue') inc = t;
        histData[key] += inc;
    }

    // Sort and convert to 2d array
    const tmp = [];
    for (const z in histData) tmp.push([z * 1, histData[z]]);
    tmp.sort(function(a, b) { return a[0] > b[0] ? 1 : -1; });

    const options = {
        series: { bars: { show: true, barWidth: resolution * 0.8 } },
        grid: { hoverable: true }
    };

    let label = '';
    if (graphState.showtag) label += graphState.feedlist[index].tag + ': ';
    label += graphState.feedlist[index].name;

    $.plot('#placeholder', [{label: label, data: tmp}], options);
}