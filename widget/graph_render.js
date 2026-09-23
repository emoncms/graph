/*
   All emon_widgets code is released under the GNU General Public License v3.
   See COPYRIGHT.txt and LICENSE.txt.

   Part of the OpenEnergyMonitor project:
   http://openenergymonitor.org

   Author: Trystan Lea: trystan.lea@googlemail.com
   If you have any questions please get in touch, try the forums here:
   http://openenergymonitor.org/emon/forum
 */

/*
   The graph widget draws in the dashboard page with GraphChart from
   graph.render.js. It used to load Modules/graph/embed in an iframe, which
   meant a second document and a second copy of flot per widget.

   The chart is held in the dashboard document as the widget config. A saved
   graph from the graph module is a starting point the designer copies into
   the form, and nothing is written back to it.

   graph_widget.php loads flot, graph.lib.js and graph.render.js.
 */

// How far the bar of buttons sits inside the plot area, in pixels.
var GRAPH_BAR_INSET = 5;

// How often a floating window chart moves its window up to now, in seconds.
var graph_refresh_interval = 60;

// The lengths the bar offers, in hours, as the embedded graph page did.
var graph_time_ranges = [
    [1, "1 hour"], [6, "6 hours"], [12, "12 hours"], [24, "24 hours"],
    [168, "1 Week"], [336, "2 Weeks"], [720, "Month"], [8760, "Year"]
];

function graph_widgetlist(){
    var widgets = {
        "graph":
    {
        "offsetx":0,"offsety":0,"width":400,"height":300,
        "menu":"Visualisations",
        "title":_Tr("Graph"),
        "description":_Tr("Draws a chart set up below. A saved graph from the graph module can be loaded as a starting point."),
        "options":["toolbar","colourbg","colouraxis"],
        "optionstype":["boolean","colour_picker","colour_picker"],
        "optionsname":[_Tr("Buttons"),_Tr("Background"),_Tr("Axis colour")],
        "optionshint":[_Tr("Refresh, time range, zoom, pan and full screen, shown over the chart on hover"),_Tr("Background colour in hex. Blank shows the dashboard behind the chart."),_Tr("Axis, label and legend colour in hex. Blank is use default.")],
        // The buttons are on unless a dashboard turns them off, which the
        // designer reads here so its select opens on the same answer.
        "optionsdata":["1","ffffff"],
        "html":"",
        // The chart is held in the dashboard document, see the inline config
        // section of the dashboard module's SCHEMA.md. This is the validation
        // contract for it, read the same way options are. It follows the state
        // schema in graph.lib.js and the feed fields normalizeSavedFeed reads.
        "config": {
            "state": {
                "mode":          { "type": "dropbox", "values": ["interval","daily","weekly","monthly","annual"] },
                "interval":      { "type": "value" },
                "limitinterval": { "type": "boolean" },
                "fixinterval":   { "type": "boolean" },
                "floatingtime":  { "type": "boolean" },
                "start":         { "type": "value" },
                "end":           { "type": "value" },
                "yaxismin":      { "type": "value" },
                "yaxismax":      { "type": "value" },
                "yaxismin2":     { "type": "value" },
                "yaxismax2":     { "type": "value" },
                "showmissing":   { "type": "boolean" },
                "showtag":       { "type": "boolean" },
                "showlegend":    { "type": "boolean" },
                "removeNull":    { "type": "boolean" },
                "removeNullMaxDuration": { "type": "value" }
            },
            "feedlist": {
                "id":       { "type": "feedid" },
                "name":     { "type": "value" },
                "tag":      { "type": "value" },
                "unit":     { "type": "value" },
                "yaxis":    { "type": "dropbox", "values": ["1","2"] },
                "plottype": { "type": "dropbox", "values": ["lines","bars","points","steps"] },
                "color":    { "type": "colour_picker" },
                "fill":     { "type": "boolean" },
                "stack":    { "type": "boolean" },
                "delta":    { "type": "boolean" },
                "average":  { "type": "boolean" },
                "scale":    { "type": "value" },
                "offset":   { "type": "value" },
                "dp":       { "type": "value" }
            }
        }
    }
    };

    return widgets;
}

var graph_widget = {
    mount: function(el, config, ctx){
    // The chart, as the dashboard document holds it.
        var inline = config.config || "";
        // On unless a dashboard turns it off, which is how the widget drew when it
        // was an iframe of the graph page.
        var toolbar = config.toolbar !== "0";

        // The box paints its own background when the dashboard gives it a colour
        // and shows the dashboard behind it when it does not.
        graph_background(el, config.colourbg);
        var axis = graph_hex(config.colouraxis);
        el.style.color = axis;

        var held = graph_build(el, inline, toolbar, axis);

        return {
            update: function(){ graph_refresh(held); },
            // GraphChart observes its own element and draws again on a change of
            // size, see graph.render.js.
            resize: function(){},
            destroy: function(){ graph_destroy(held); }
        };
    }
};

// One widget. Returns { chart, refreshed, live }, where live is cleared by
// destroy.
function graph_build(element, config, toolbar, axis){
    if (typeof GraphChart !== "function") {
        return { chart: null, refreshed: Date.now(), live: false };
    }

    var chart = new GraphChart();
    chart.axisColor = axis;
    var held = { chart: chart, refreshed: Date.now(), live: true };

    if (config === "") {
        graph_message(element, _Tr("No chart set up"));
        return held;
    }

    try {
        var frame = graph_frame(element, chart, toolbar);
        chart.render(frame.plot, JSON.parse(config));
        if (frame.sync) frame.sync();
    } catch (err) {
        graph_message(element, _Tr("Graph") + ": " + err.message);
    }
    return held;
}

// The chart fills the box and the bar of buttons sits over the top right
// corner of it, out of sight until the pointer is over the box. The multigraph
// visualisation this replaces drew its buttons the same way.
function graph_frame(element, chart, toolbar){
    var plot = $('<div class="graph-widget-plot"></div>');
    $(element).empty().append(plot);

    var sync = null;
    if (toolbar) {
        var built = graph_toolbar(element, chart);
        sync = built.sync;
        $(element).append(built.bar);
    }
    return { plot: plot.get(0), sync: sync };
}

// The buttons, in joined groups: refresh, the length of the window, the window
// itself, and what the chart shows. The bar holds two rows and shows one of
// them, the buttons and the start and end of the window for typing in.
function graph_toolbar(element, chart){
    var bar = $('<div class="graph-widget-bar"></div>');
    var buttons = $('<div class="graph-widget-buttons"></div>');
    var window_row = $('<div class="graph-widget-window" hidden></div>');

    // Every control sits in one joined group, so the bar reads as one piece.
    var controls = $('<div class="btn-group"></div>');
    buttons.append(controls);

    var button = function(row, label, title, handler){
        var el = $('<button type="button" class="btn btn-small"></button>').attr("title", title).html(label);
        el.click(handler);
        row.append(el);
        return el;
    };

    button(controls, '<i class="icon-repeat"></i>', _Tr("Refresh"), function(){ chart.refresh(); });

    var hours = $('<select class="btn btn-small graph-widget-range"></select>').attr("title", _Tr("Time range"));
    for (var i = 0; i < graph_time_ranges.length; i++){
        hours.append($("<option></option>")
            .attr("value", graph_time_ranges[i][0])
            .text(_Tr(graph_time_ranges[i][1])));
    }
    hours.change(function(){
        var length = parseFloat($(this).val()) * 3600000;
        if (!isFinite(length) || length <= 0) return;
        var end = Math.round(Date.now() / 1000) * 1000;
        // Chosen from a list of lengths ending now, so it follows the clock until
        // the window is moved by hand.
        chart.setWindow(end - length, end, true);
    });
    controls.append(hours);

    var start = $('<input type="datetime-local" class="graph-widget-time">');
    var end = $('<input type="datetime-local" class="graph-widget-time">');

    button(controls, '<i class="icon-resize-horizontal"></i>', _Tr("Select time window"), function(){
        var window = chart.getWindow();
        start.val(GraphHelpers.msToDatetimeLocal(window.startMs));
        end.val(GraphHelpers.msToDatetimeLocal(window.endMs));
        buttons.get(0).hidden = true;
        window_row.get(0).hidden = false;
    });

    button(controls, "+", _Tr("Zoom In"), function(){ graph_zoom(chart, 0.5); });
    button(controls, "-", _Tr("Zoom Out"), function(){ graph_zoom(chart, 2); });
    button(controls, "&lt;", _Tr("Earlier"), function(){ graph_pan(chart, -1); });
    button(controls, "&gt;", _Tr("Later"), function(){ graph_pan(chart, 1); });

    var legend = button(controls, '<i class="icon-list"></i>', _Tr("Legend"), function(){
        if (!chart.state) return;
        chart.setLegend(!chart.state.showlegend);
        legend.toggleClass("active", !!chart.state.showlegend);
    });

    var expand = button(controls, '<i class="icon-resize-full"></i>', _Tr("Expand"), function(){
        graph_fullscreen(element);
    });

    // The button says what it will do next, so it follows the box in and out of
    // full screen however that happened, including by the escape key.
    $(element).off("fullscreenchange.graph").on("fullscreenchange.graph", function(){
        var full = document.fullscreenElement === element;
        expand.attr("title", full ? _Tr("Restore") : _Tr("Expand"))
            .html(full ? '<i class="icon-resize-small"></i>' : '<i class="icon-resize-full"></i>');
    });

    var apply = function(){
        var from = graph_parse_time(start.val());
        var to = graph_parse_time(end.val());
        if (from === null || to === null || to <= from) return;
        chart.setWindow(from, to, false);
    };
    start.change(apply);
    end.change(apply);

    window_row.append($('<span class="graph-widget-label"></span>').text(_Tr("Start")));
    window_row.append(start);
    window_row.append($('<span class="graph-widget-label"></span>').text(_Tr("End")));
    window_row.append(end);
    button(window_row, '<i class="icon-ok"></i>', _Tr("Done"), function(){
        apply();
        window_row.get(0).hidden = true;
        buttons.get(0).hidden = false;
    });

    bar.append(buttons).append(window_row);

    // The bar sits inside the plot area rather than in the corner of the box, so
    // it keeps off the border and the axis labels. Where the plot area starts is
    // only known once the chart has been drawn, and it moves when the labels
    // change width, so it is read again after each draw.
    var place = function(){
        var offset = chart.plotOffset();
        if (!offset) return;
        bar.css({
            top:   (offset.top + GRAPH_BAR_INSET) + "px",
            right: (offset.right + GRAPH_BAR_INSET) + "px"
        });
    };
    chart.onDraw = place;

    // The legend button is drawn before the chart has read its config, so what
    // it shows is set again once the chart has one.
    return {
        bar: bar,
        sync: function(){
            legend.toggleClass("active", !!(chart.state && chart.state.showlegend));
            place();
        }
    };
}

// The box on its own, filling the screen. The chart follows, redrawn by the
// size observer in graph.render.js.
function graph_fullscreen(element){
    if (document.fullscreenElement === element) {
        if (document.exitFullscreen) document.exitFullscreen();
        return;
    }
    if (!element.requestFullscreen) return;
    var request = element.requestFullscreen();
    // A browser refuses full screen when the click did not reach it as a
    // gesture. Nothing to do about it, and an unanswered rejection is logged as
    // an error by itself.
    if (request && typeof request.catch === "function") request.catch(function(){});
}

// A colour option as a hex colour, with the hash the designer strips put
// back, or an empty string when it is empty or not a colour.
function graph_hex(colour){
    var hex = String(colour === undefined || colour === null ? "" : colour).trim();
    if (hex !== "" && hex.charAt(0) !== "#") hex = "#" + hex;
    return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex) ? hex : "";
}

// The background of one box, from a hex colour written with or without the
// hash. none is no colour at all. The legend follows it: flot fills the panel
// behind the legend from the background of the page, which on a dashboard is
// whatever colour the author chose, so the box hands the colour to the
// stylesheet in graph_widget.php.
function graph_background(element, colour){
    var hex = graph_hex(colour);

    element.style.backgroundColor = hex;
    // An empty custom property is not the same as one that is not set: it leaves
    // the fill with no value at all rather than falling back to the default.
    if (hex === "") element.style.removeProperty("--graph-background");
    else element.style.setProperty("--graph-background", hex);
}

// The value of a datetime-local input, as milliseconds. The browser writes it
// without a timezone, so it is read as local time, which is what was typed.
function graph_parse_time(value){
    var ms = Date.parse(String(value || "").replace(" ", "T"));
    return isFinite(ms) ? ms : null;
}

function graph_zoom(chart, by){
    var window = chart.getWindow();
    var middle = (window.startMs + window.endMs) / 2;
    var half = (window.endMs - window.startMs) * by / 2;
    chart.setWindow(middle - half, middle + half, false);
}

function graph_pan(chart, direction){
    var window = chart.getWindow();
    var shift = (window.endMs - window.startMs) * 0.2 * direction;
    chart.setWindow(window.startMs + shift, window.endMs + shift, false);
}

// A saved graph from the graph module, for the editor to load.
function graph_saved(graphid){
    var url = path + "graph/get?id=" + encodeURIComponent(graphid);
    if (apikey) url += "&apikey=" + encodeURIComponent(apikey);

    return fetch(url).then(function(response){
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
    }).then(function(saved){
        if (!saved || typeof saved !== "object") throw new Error(_Tr("not found"));
        // The model answers with success false rather than an error status when a
        // graph is missing or is not public.
        if (saved.success === false) throw new Error(saved.message || _Tr("not found"));
        return saved;
    });
}

// Text in the box, for an empty option or a failed request. Set as text so a
// message never reaches the page as markup.
function graph_message(element, message){
    $(element).empty().append($('<div class="graph-widget-message"></div>').text(message));
}

// Called after each poll. A fixed window shows the same data however long the
// page is open. Only a floating window has anything to fetch, and it is moved
// up to now once graph_refresh_interval has passed.
function graph_refresh(held){
    if (!held.chart || !held.chart.state || !held.chart.state.floatingtime) return;
    var now = Date.now();
    if (now - held.refreshed < graph_refresh_interval * 1000) return;
    held.refreshed = now;
    held.chart.refresh();
}

function graph_destroy(held){
    held.live = false;
    if (held.chart) held.chart.destroy();
    held.chart = null;
}

/* ── The config editor in the designer ──────────────────────────────────── */

// Drawn into the options modal by designer.draw_options, for the hidden input
// that carries the config.
//
// The chart a widget draws is its config, held in the dashboard document. A
// saved graph is a starting point: picking one copies its chart into the
// form, and from then on the two are not connected. The form writes the
// config on every change.
function graph_config_editor(container, input){
    var editing = graph_config_parse(input.val()) || { state: {}, feedlist: [] };
    if (!editing.state) editing.state = {};
    if (!editing.feedlist) editing.feedlist = [];

    var status = $('<div class="graph-config-status"></div>');
    var fail = function(err){ status.text(err && err.message ? err.message : String(err)); };

    var write = function(){
        input.val(JSON.stringify({ state: editing.state, feedlist: editing.feedlist })).trigger("change");
        preview(editing);
    };

    // A window chosen in the preview is the window of the chart. Zoomed or
    // panned to, it is held as fixed. Picked as a length, it floats.
    var form = null;
    var on_window = function(start, end, floating){
        editing.state.start = String(start);
        editing.state.end = String(end);
        editing.state.floatingtime = floating ? "1" : "0";
        if (form) form.sync();
        write();
    };

    var preview = typeof GraphChart === "function" ? graph_config_preview(container, on_window) : function(){};

    // A saved graph picked in the form. Its chart is copied into the form, and
    // the form is drawn again from it. A form that holds feeds asks first,
    // since they are replaced.
    var load = function(id){
        if (editing.feedlist.length && !window.confirm(_Tr("Replace the chart with saved graph") + " " + graph_saved_name(id) + "?")) {
            return Promise.resolve();
        }
        status.text("");
        return graph_saved(id).then(function(saved){
            var loaded = graph_config_from_saved(saved);
            editing.state = loaded.state || {};
            editing.feedlist = loaded.feedlist || [];
            draw_form();
            write();
        }).catch(fail);
    };

    var draw_form = function(){
        var fresh = graph_config_form(editing, write, load);
        if (form) form.replaceWith(fresh); else container.append(fresh);
        form = fresh;
    };

    draw_form();
    container.append(status);
    preview(editing);
}

// The chart drawn in the modal from the form as it stands. One for the modal,
// let go of when it closes.
var graph_config_preview_chart = null;
var graph_config_preview_timeout = 0;

// A preview of the chart the form describes, drawn with the same engine the
// dashboard draws it with. Answers with a function that draws the config
// given, a short while after the last call.
//
// on_window is called with (startMs, endMs, floating) when the window is
// changed in the preview. A zoom, a pan or a selection gives a fixed window,
// a length picked from the range select a floating one.
function graph_config_preview(container, on_window){
    graph_config_preview_drop();

    var box = $('<div class="graph-config-preview"></div>');
    var plot = $('<div class="graph-config-preview-plot"></div>');
    var message = $('<div class="graph-config-preview-message"></div>');
    box.append(plot).append(message);
    container.append(box);

    $("#widget_options").off("hidden.graphpreview").on("hidden.graphpreview", graph_config_preview_drop);

    var chart = new GraphChart();
    graph_config_preview_chart = chart;
    chart.onError = function(err){
        message.text(_Tr("Graph") + ": " + (err && err.message ? err.message : err)).show();
    };

    // The same bar of buttons the widget has on the dashboard, so the preview
    // can be zoomed and panned while the chart is set up.
    var toolbar = graph_toolbar(box.get(0), chart);
    box.append(toolbar.bar);

    // The window settings of the last draw, and the config it drew. A window
    // changed in the preview is written to the form, which draws again with
    // the same window, so that draw is skipped.
    var window_key = null;
    var drawn = null;
    var drawn_config = null;
    var window_of = function(start, end, floating){
        return [String(start), String(end), floating ? "1" : "0"].join("|");
    };

    // The bar calls setWindow, and a pan, zoom or selection on the plot
    // reports through onWindowChange. Both reach the form from here.
    var report = function(start, end, floating){
        window_key = window_of(start, end, floating);
        // The form writes this window and draws again. That draw would fetch
        // what the chart has just fetched, so it is marked as drawn already.
        if (drawn_config) {
            var state = $.extend({}, drawn_config.state, {
                start: String(start), end: String(end), floatingtime: floating ? "1" : "0"
            });
            drawn = JSON.stringify({ state: state, feedlist: drawn_config.feedlist });
        }
        if (typeof on_window === "function") on_window(start, end, floating);
    };
    // The engine calls setWindow itself, on a resize and after a pan or zoom
    // on the plot, with no floating flag. The bar always passes one.
    var set_window = chart.setWindow;
    chart.setWindow = function(start, end, floating){
        set_window.call(chart, start, end, floating);
        if (floating !== undefined) report(chart.startMs, chart.endMs, !!floating);
    };
    chart.onWindowChange = function(start, end){ report(start, end, false); };

    var draw = function(config){
        if (graph_config_preview_chart !== chart) return;
        // A feed with no feed chosen yet has nothing to fetch.
        var feeds = [];
        for (var i = 0; i < config.feedlist.length; i++) {
            if (config.feedlist[i].id !== undefined && String(config.feedlist[i].id) !== "") feeds.push(config.feedlist[i]);
        }
        if (!feeds.length) {
            chart.destroy();
            window_key = null;
            drawn = null;
            drawn_config = null;
            message.text(_Tr("Add a feed to see a preview")).show();
            return;
        }
        message.hide();

        var state = $.extend({}, config.state);
        var key = window_of(state.start, state.end, Number(state.floatingtime));
        if (window_key === key && chart.element) {
            var viewed = chart.getWindow();
            state.start = String(viewed.startMs);
            state.end = String(viewed.endMs);
            state.floatingtime = chart.state && chart.state.floatingtime ? "1" : "0";
        }
        window_key = key;

        var next = JSON.stringify({ state: state, feedlist: feeds });
        if (next === drawn) return;
        drawn = next;
        drawn_config = { state: state, feedlist: feeds };

        chart.render(plot.get(0), { state: state, feedlist: feeds });
        toolbar.sync();
    };

    return function(config){
        clearTimeout(graph_config_preview_timeout);
        graph_config_preview_timeout = setTimeout(function(){ draw(config); }, 300);
    };
}

function graph_config_preview_drop(){
    clearTimeout(graph_config_preview_timeout);
    if (graph_config_preview_chart) graph_config_preview_chart.destroy();
    graph_config_preview_chart = null;
}

// Name of a saved graph from the list the widget was given, or its id.
function graph_saved_name(id){
    var list = (typeof savedgraphsnamelist !== "undefined" && Array.isArray(savedgraphsnamelist)) ? savedgraphsnamelist : [];
    for (var i = 0; i < list.length; i++) {
        if (String(list[i][0]) === String(id)) return list[i][1];
    }
    return String(id);
}

// A config as the hidden input holds it, or null if it is not one.
function graph_config_parse(text){
    try {
        var config = JSON.parse(text);
        if (!config || typeof config !== "object") return null;
        if (!config.state || typeof config.state !== "object") config.state = {};
        if (!Array.isArray(config.feedlist)) config.feedlist = [];
        return config;
    } catch (err) {
        return null;
    }
}

// Window lengths the form offers, in hours. Zero keeps the fixed start and end
// the config holds.
var GRAPH_CONFIG_ZOOMS = [
    [1, "1 hour"], [6, "6 hours"], [12, "12 hours"], [24, "24 hours"],
    [168, "1 week"], [336, "2 weeks"], [720, "1 month"], [8760, "1 year"]
];

// Form for a chart, laid out as the options card of the graph page: type and
// interval on the left, axis bounds on the right, then the fill nulls, gaps
// and feed tag toggles, then the feeds as a table. Window sits with type and
// interval. Legend goes under the options of the widget, beside the buttons
// and colours it sits with on the dashboard.
//
// The config is edited in place and write is called after every change. A
// saved graph picked is given to load, which answers with a promise.
function graph_config_form(config, write, load){
    var form = $('<div class="graph-config-form"></div>');
    var state = config.state;
    var feeds = config.feedlist;

    // Parts of the form that follow the state are set again after each change.
    var sync = function(){};
    var changed = function(){ write(); sync(); };

    // Type and interval with the window on the left, axis bounds on the right
    var top = $('<div class="graph-config-top"></div>');
    var lead = $('<div class="graph-config-lead"></div>');

    // Window. A floating window is stored as a start and an end whose length is
    // what matters, see applyWindow in graph.render.js. Zero is a fixed window.
    var window_hours = function(){
        var floating = Number(state.floatingtime) ? true : false;
        var length = Number(state.end) - Number(state.start);
        return floating && isFinite(length) && length > 0 ? Math.round(length / 3600000) : 0;
    };
    var pairs = [["0", _Tr("Fixed, as saved")]];
    for (var z = 0; z < GRAPH_CONFIG_ZOOMS.length; z++) {
        pairs.push([String(GRAPH_CONFIG_ZOOMS[z][0]), _Tr(GRAPH_CONFIG_ZOOMS[z][1])]);
    }
    var zoom = graph_config_select(pairs, "0");
    // A length not in the list is added to it, so the select can show it.
    var zoom_sync = function(){
        var hours = window_hours();
        if (hours && !zoom.find('option[value="' + hours + '"]').length) {
            zoom.append($("<option></option>").attr("value", String(hours)).text(hours + " " + _Tr("hours")));
        }
        zoom.val(String(hours));
    };
    zoom_sync();
    zoom.change(function(){
        var h = Number($(this).val());
        if (h > 0) {
            var now = Date.now();
            state.floatingtime = "1";
            state.start = String(now - h * 3600000);
            state.end = String(now);
        } else {
            state.floatingtime = "0";
        }
        changed();
    });
    var window_group = $('<div class="input-prepend graph-config-group"></div>');
    window_group.append($('<span class="add-on"></span>').text(_Tr("Window"))).append(zoom);
    lead.append(window_group);

    var legend = graph_config_flag(state.showlegend, "1");
    legend.change(function(){ state.showlegend = $(this).val(); changed(); });
    var legend_row = graph_config_row(_Tr("Legend"), legend, _Tr("Legend drawn over the chart"));
    var options = $("#widget-config-options");
    if (options.length) {
    // Drawn as the designer draws an option row.
        legend_row.find(".add-on").css({ width: "100px", "text-align": "right", "font-size": "12px" });
        options.empty().append(legend_row);
    } else {
        form.append(legend_row);
    }

    var interval_group = $('<div class="input-prepend input-append graph-config-group"></div>');
    interval_group.append($('<span class="add-on"></span>').text(_Tr("Type")));
    var mode = graph_config_select([
        ["interval", _Tr("Fixed Interval")], ["daily", _Tr("Daily")], ["weekly", _Tr("Weekly")],
        ["monthly", _Tr("Monthly")], ["annual", _Tr("Annual")]
    ], state.mode || "interval");
    mode.change(function(){ state.mode = $(this).val(); changed(); });
    interval_group.append(mode);

    // Auto until clicked, then the number of seconds is typed in and fixed.
    var interval = $('<input type="text" class="graph-config-interval">');
    interval.click(function(){
        if (Number(state.fixinterval)) return;
        state.fixinterval = "1";
        if (!(parseInt(state.interval, 10) > 0)) state.interval = "60";
        changed();
        interval.focus().select();
    });
    interval.keydown(graph_config_integer_keys);
    interval.change(function(){
        var val = parseInt($(this).val(), 10);
        if (!isNaN(val) && val > 0) state.interval = String(val);
        changed();
    });
    interval_group.append(interval);
    var interval_reset = $('<button type="button" class="btn add-on">&#x2715;</button>')
        .attr("title", _Tr("Return to auto interval"));
    interval_reset.click(function(){ state.fixinterval = "0"; changed(); });
    interval_group.append(interval_reset);
    lead.append(interval_group);
    top.append(lead);

    var axes = $('<div class="graph-config-axes"></div>');
    var left = graph_config_axis(state, "L", "yaxismin", "yaxismax", changed);
    var right = graph_config_axis(state, "R", "yaxismin2", "yaxismax2", changed);
    axes.append(left.group).append(right.group);
    top.append(axes);
    form.append(top);

    // Toggles that apply to a fixed interval
    var toggles = $('<div class="graph-config-toggles"></div>');

    var fill_item = $('<div class="graph-config-toggle graph-config-toggle-fill"></div>');
    var fill_nulls = graph_config_check(state.removeNull);
    fill_nulls.change(function(){ state.removeNull = this.checked ? "1" : "0"; changed(); });
    fill_item.append(graph_config_label(fill_nulls, _Tr("Fill nulls with last value")));
    var max_fill = $('<span class="input-prepend input-append graph-config-group graph-config-maxfill"></span>');
    max_fill.append($('<span class="add-on"></span>').text(_Tr("Max fill")));
    var max_fill_input = $('<input type="text" class="graph-config-maxfill-input">')
        .val(state.removeNullMaxDuration !== undefined && state.removeNullMaxDuration !== "" ? state.removeNullMaxDuration : "900");
    max_fill_input.keydown(graph_config_integer_keys);
    max_fill_input.change(function(){
        var val = parseFloat($(this).val());
        if (!isFinite(val) || val <= 0) val = 900;
        state.removeNullMaxDuration = String(val);
        $(this).val(String(val));
        changed();
    });
    max_fill.append(max_fill_input).append($('<span class="add-on"></span>').text(_Tr("seconds")));
    fill_item.append(max_fill);
    toggles.append(fill_item);

    // Delta sums values across each period, and dropping missing points loses
    // the current incomplete period, so gaps stay on while a feed uses delta.
    var gaps = graph_config_check(state.showmissing === undefined || state.showmissing === "" ? "1" : state.showmissing);
    gaps.change(function(){ state.showmissing = this.checked ? "1" : "0"; changed(); });
    var gaps_item = graph_config_label(gaps, _Tr("Show gaps")).addClass("graph-config-toggle graph-config-toggle-end");
    toggles.append(gaps_item);

    var tag = graph_config_check(state.showtag);
    tag.change(function(){ state.showtag = this.checked ? "1" : "0"; changed(); });
    toggles.append(graph_config_label(tag, _Tr("Feed tag")).addClass("graph-config-toggle"));

    form.append(toggles);

    // Feeds
    var table = $('<table class="graph-config-feeds"></table>');
    var head = $("<tr></tr>");
    var columns = [
        ["", ""], [_Tr("Feed"), ""], [_Tr("Axis"), ""], [_Tr("Type"), ""], [_Tr("Color"), ""],
        [_Tr("Fill"), "center"], [_Tr("Stack"), "center"], [_Tr("Scale"), "center"], [_Tr("Offset"), "center"],
        [_Tr("Delta"), "center"], [_Tr("Average"), "center"], [_Tr("DP"), ""], ["", ""]
    ];
    for (var c = 0; c < columns.length; c++) {
        head.append($("<th></th>").text(columns[c][0]).addClass(columns[c][1]));
    }
    table.append($("<thead></thead>").append(head));
    var body = $("<tbody></tbody>");
    table.append(body);

    var draw_feeds = function(){
        body.empty();
        for (var i = 0; i < feeds.length; i++) {
            body.append(graph_config_feed(feeds, i, changed, draw_feeds));
        }
        table.toggle(feeds.length > 0);
        sync();
    };
    form.append(table);

    var add = $('<button type="button" class="btn btn-small"></button>').text(_Tr("Add feed"));
    add.click(function(){
        feeds.push({ id: "", name: "", tag: "", unit: "", yaxis: "1", plottype: "lines",
            color: "", fill: "0", stack: "0", delta: "0", average: "0", scale: "1", offset: "0", dp: "1" });
        changed();
        draw_feeds();
    });

    // Saved graph to load into the form, beside the add button
    var select = $("<select></select>").attr("title", _Tr("Copies the chart of a saved graph into the form"));
    select.append($('<option value=""></option>').text(_Tr("Load...")));
    var list = (typeof savedgraphsnamelist !== "undefined" && Array.isArray(savedgraphsnamelist)) ? savedgraphsnamelist : [];
    for (var i = 0; i < list.length; i++) {
        select.append($("<option></option>").attr("value", String(list[i][0])).text(list[i][1]));
    }
    select.change(function(){
        var id = $(this).val();
        if (id === "") return;
        select.prop("disabled", true);
        load(id).then(function(){ select.prop("disabled", false).val(""); });
    });
    var source = $('<div class="input-prepend graph-config-group graph-config-source"></div>');
    source.append($('<span class="add-on"></span>').text(_Tr("Saved graph"))).append(select);

    form.append($('<div class="graph-config-actions"></div>').append(add).append(source));

    sync = function(){
        zoom_sync();
        var fixed = state.mode === "interval" || !state.mode;
        var held = !!Number(state.fixinterval);
        interval.toggle(fixed);
        interval.prop("readonly", !held).toggleClass("graph-config-auto", !held)
            .val(held ? String(state.interval || "") : _Tr("auto"))
            .attr("title", held ? "" : _Tr("Click to edit and fix interval"));
        interval_reset.toggle(fixed && held);

        var on_left = 0, on_right = 0;
        var any_delta = false;
        for (var i = 0; i < feeds.length; i++) {
            if (String(feeds[i].yaxis) === "2") on_right++; else on_left++;
            if (Number(feeds[i].delta)) any_delta = true;
        }
        left.group.toggle(on_left > 0);
        right.group.toggle(on_right > 0);
        left.sync();
        right.sync();

        toggles.toggle(fixed);
        max_fill.toggle(!!Number(state.removeNull));
        if (any_delta && !Number(state.showmissing)) { state.showmissing = "1"; write(); }
        gaps.prop("checked", !!Number(state.showmissing)).prop("disabled", any_delta);
        gaps_item.attr("title", any_delta ? _Tr("Required while delta is enabled") : "");
    };

    draw_feeds();
    // For the editor, when the window is changed in the preview.
    form.sync = sync;
    return form;
}

// Min and max of one axis, as the graph page draws them: auto until clicked,
// then typed in, with a reset once either is set.
function graph_config_axis(state, label, min_key, max_key, changed){
    var group = $('<div class="input-prepend input-append graph-config-group"></div>');
    group.append($('<span class="add-on"></span>').text(label));

    var bound = function(key, hint){
        var input = $('<input type="text" class="graph-config-bound">');
        input.click(function(){
            if (graph_config_axis_auto(state[key]) === false) return;
            state[key] = "";
            changed();
            input.focus();
        });
        input.keydown(graph_config_decimal_keys);
        input.change(function(){
            var val = $.trim($(this).val());
            state[key] = (val === "" || val.toLowerCase() === "auto") ? "auto" : val;
            changed();
        });
        input.sync = function(){
            var auto = graph_config_axis_auto(state[key]);
            input.prop("readonly", auto).toggleClass("graph-config-auto", auto)
                .val(auto ? "auto" : String(state[key])).attr("title", auto ? hint : "");
        };
        return input;
    };
    var min = bound(min_key, _Tr("Click to set min"));
    var max = bound(max_key, _Tr("Click to set max"));
    group.append(min).append(max);

    var reset = $('<button type="button" class="btn add-on">&#x2715;</button>');
    reset.click(function(){ state[min_key] = "auto"; state[max_key] = "auto"; changed(); });
    group.append(reset);

    return {
        group: group,
        sync: function(){
            min.sync();
            max.sync();
            reset.toggle(!(graph_config_axis_auto(state[min_key]) && graph_config_axis_auto(state[max_key])));
        }
    };
}

// An axis bound is auto unless it holds a value. Blank is a bound being
// typed, which is not auto.
function graph_config_axis_auto(value){
    return value === undefined || value === null || value === "auto";
}

// Keys allowed in a whole number input.
function graph_config_integer_keys(event){
    if (graph_config_navigation_key(event)) return;
    if (!/^\d$/.test(event.key)) event.preventDefault();
}

// Keys allowed in a signed decimal input.
function graph_config_decimal_keys(event){
    if (graph_config_navigation_key(event)) return;
    if (!/^[\d.\-]$/.test(event.key)) { event.preventDefault(); return; }
    var val = event.target.value;
    if (event.key === "-" && val.length !== 0) { event.preventDefault(); return; }
    if (event.key === "." && val.indexOf(".") !== -1) event.preventDefault();
}

function graph_config_navigation_key(event){
    var nav = ["Backspace","Delete","Tab","Escape","Enter","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"];
    return nav.indexOf(event.key) !== -1 || event.ctrlKey || event.metaKey;
}

// A checkbox with its caption as one label.
function graph_config_label(check, caption){
    return $('<label class="graph-config-check"></label>').append(check).append($("<span></span>").text(caption));
}

// Colours flot gives series that have none, in order. A feed with no colour
// of its own is drawn in the next of these, so the form shows the same.
var GRAPH_AUTO_COLOURS = ["#edc240", "#afd8f8", "#cb4b4b", "#4da74d", "#9440ed"];

// The colour a feed draws in: its own, or the one flot gives it by its place
// among the feeds that have none.
function graph_config_feed_colour(feeds, index){
    if (feeds[index].color && feeds[index].color !== "") return feeds[index].color;
    var uncoloured = 0;
    for (var i = 0; i < index; i++) {
        if (!feeds[i].color || feeds[i].color === "") uncoloured++;
    }
    return GRAPH_AUTO_COLOURS[uncoloured % GRAPH_AUTO_COLOURS.length];
}

// One feed of a held chart, as a table row, in the column order of the feed
// table on the graph page. The feed is chosen from a select rather than shown
// by id and name, and there is no histogram.
function graph_config_feed(feeds, index, write, redraw){
    var feed = feeds[index];
    var row = $("<tr></tr>");
    var cell = function(control){ return $("<td></td>").append(control); };
    var check = function(key, title){
        var box = graph_config_check(feed[key]);
        if (title) box.attr("title", title);
        box.change(function(){ feed[key] = this.checked ? "1" : "0"; write(); });
        return cell(box).addClass("center");
    };
    var number = function(key, fallback){
        var input = $('<input type="text" class="graph-config-short">').val(feed[key] !== undefined ? feed[key] : fallback);
        input.on("input", function(){ feed[key] = $(this).val(); write(); });
        return cell(input).addClass("center");
    };

    // Order. Swapping two feeds moves the automatic colours with them, so the
    // rows are drawn again.
    var move = $('<span class="graph-config-move"></span>');
    var arrow = function(icon, title, direction){
        var a = $('<a href="#"></a>').attr("title", title).append($("<i></i>").addClass(icon));
        a.click(function(e){
            e.preventDefault();
            var next = index + direction;
            if (next < 0 || next >= feeds.length) return;
            var held = feeds[index];
            feeds[index] = feeds[next];
            feeds[next] = held;
            write();
            redraw();
        });
        return a;
    };
    if (index > 0) move.append(arrow("icon-arrow-up", _Tr("Move up"), -1));
    if (index < feeds.length - 1) move.append(arrow("icon-arrow-down", _Tr("Move down"), 1));
    row.append(cell(move));

    // A feed carries its name, tag and unit with it, which is what a saved
    // graph holds and what the legend and tooltip show.
    var select = graph_config_feed_select(feed.id);
    select.change(function(){
        feed.id = $(this).val();
        var found = graph_config_feed_lookup(feed.id);
        feed.name = found ? String(found.name || "") : "";
        feed.tag = found ? String(found.tag || "") : "";
        feed.unit = found ? String(found.unit || "") : "";
        // Average by default for the units the graph page averages, see
        // defaultAverageForUnit in graph.lib.js.
        if (found && typeof GraphHelpers !== "undefined" && GraphHelpers.defaultAverageForUnit) {
            feed.average = GraphHelpers.defaultAverageForUnit(feed.unit) ? "1" : "0";
        }
        write();
        redraw();
    });
    row.append(cell(select));

    // The graph page puts a feed on an axis from its feed list. Here the feed
    // is picked in the row, so the axis sits beside it.
    var axis = graph_config_select([["1", _Tr("Left")], ["2", _Tr("Right")]], String(feed.yaxis || "1")).addClass("graph-config-axis");
    axis.change(function(){ feed.yaxis = $(this).val(); write(); });
    row.append(cell(axis));

    var plottype = graph_config_select([
        ["lines", _Tr("Lines")], ["bars", _Tr("Bars")], ["points", _Tr("Points")], ["steps", _Tr("Steps")]
    ], feed.plottype || "lines");
    plottype.change(function(){ feed.plottype = $(this).val(); write(); });
    row.append(cell(plottype));

    // A blank colour is left blank until the picker is used, so a feed the
    // engine colours itself keeps that colour. Setting one moves the automatic
    // colours of the feeds after it, so the rows are drawn again.
    var colour = $('<input type="color">').val(graph_config_feed_colour(feeds, index));
    colour.change(function(){ feed.color = $(this).val(); write(); redraw(); });
    row.append(cell(colour));

    row.append(check("fill"));
    row.append(check("stack"));
    row.append(number("scale", "1"));
    row.append(number("offset", "0"));
    row.append(check("delta", _Tr("Difference between points, for a cumulative feed")));
    row.append(check("average"));

    var dp = graph_config_select([["0","0"],["1","1"],["2","2"],["3","3"]], String(feed.dp !== undefined ? feed.dp : "1")).addClass("graph-config-dp");
    if (dp.val() === null) dp.val("1");
    dp.change(function(){ feed.dp = $(this).val(); write(); });
    row.append(cell(dp));

    var remove = $('<a href="#" class="graph-config-remove" title="' + _Tr("Remove feed") + '">&times;</a>');
    remove.click(function(e){
        e.preventDefault();
        feeds.splice(index, 1);
        write();
        redraw();
    });
    row.append(cell(remove).addClass("center"));

    return row;
}

// One row in the style of the options table of the designer.
function graph_config_row(label, control, hint){
    var row = $('<div class="control-group"><div class="controls"><div class="input-prepend" style="margin-bottom:0px;"></div></div></div>');
    row.find(".input-prepend")
        .append($('<span class="add-on"></span>').text(label))
        .append(control);
    if (hint) row.find(".controls").append($('<span class="help-inline"><small class="muted"></small></span>').find("small").text(hint).end());
    return row;
}

function graph_config_select(pairs, value){
    var select = $("<select></select>");
    for (var i = 0; i < pairs.length; i++) {
        select.append($("<option></option>").attr("value", pairs[i][0]).text(pairs[i][1]));
    }
    select.val(value);
    return select;
}

// On or off, for a boolean entry held as 1 or 0.
function graph_config_flag(value, fallback){
    var current = (value === undefined || value === "") ? fallback : (Number(value) ? "1" : "0");
    return graph_config_select([["1", _Tr("On")], ["0", _Tr("Off")]], current);
}

function graph_config_check(value){
    return $('<input type="checkbox">').prop("checked", !!Number(value));
}

// Feed select by numeric id. The chart engine reads feeds by id, so the
// tag:name form the designer offers for options is not used here.
function graph_config_feed_select(current){
    var groups = {};
    var feeds = (typeof feedlist !== "undefined" && Array.isArray(feedlist)) ? feedlist : [];
    for (var i = 0; i < feeds.length; i++) {
        var tag = feeds[i].tag === null || feeds[i].tag === undefined ? "NoGroup" : feeds[i].tag;
        if (tag === "Deleted") continue;
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(feeds[i]);
    }
    var select = $('<select class="graph-config-feed"></select>');
    select.append($('<option value=""></option>').text(_Tr("Select feed")));
    for (var g in groups) {
        var optgroup = $("<optgroup></optgroup>").attr("label", g);
        for (var f = 0; f < groups[g].length; f++) {
            optgroup.append($("<option></option>").attr("value", String(groups[g][f].id)).text(groups[g][f].name));
        }
        select.append(optgroup);
    }
    select.val(String(current || ""));
    if (select.val() === null) select.val("");
    return select;
}

// The feed of the given id from the list the designer holds, or null.
function graph_config_feed_lookup(id){
    var feeds = (typeof feedlist !== "undefined" && Array.isArray(feedlist)) ? feedlist : [];
    for (var i = 0; i < feeds.length; i++) {
        if (String(feeds[i].id) === String(id)) return feeds[i];
    }
    return null;
}

// A saved graph as the dashboard document holds it. Only what the widget
// declares is copied, so the config that is written is one the document
// validation keeps whole.
function graph_config_from_saved(saved){
    var declared = widgets["graph"]["config"];
    var config = {};

    var entries = function(source, allowed){
        var kept = {};
        for (var name in allowed){
            if (source[name] === undefined || source[name] === null) continue;
            var value = source[name];
            if (typeof value === "boolean") value = value ? "1" : "0";
            if (typeof value === "object") continue;
            kept[name] = String(value);
        }
        return kept;
    };

    var state = entries(saved, declared["state"]);
    if (Object.keys(state).length) config.state = state;

    var feedlist = [];
    var source = Array.isArray(saved.feedlist) ? saved.feedlist : [];
    for (var i = 0; i < source.length; i++){
        if (!source[i] || typeof source[i] !== "object") continue;
        var feed = entries(source[i], declared["feedlist"]);
        if (Object.keys(feed).length) feedlist.push(feed);
    }
    if (feedlist.length) config.feedlist = feedlist;

    return config;
}
