//----------------------------------------------------------------------------------------
// graph.legend.js - Custom legend rendering and interaction
//----------------------------------------------------------------------------------------

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
        case 'steps': current_data[index].steps.show = !current_data[index].steps.show; break;
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
