<?php
defined('EMONCMS_EXEC') or die('Restricted access');

global $session, $mysqli, $settings, $path;

// Check if group module is installed
$group = false;
if (file_exists("Modules/group/group_model.php")) {
    require_once "Modules/group/group_model.php";
    $group = new Group($mysqli, null, null, null, null);
}

require_once "Modules/graph/graph_model.php";
$graph = new Graph($mysqli, $group);
$savedgraphs = $graph->getall($session['userid']);

// Saved graphs the designer offers as starting points for a chart.
$savedgraphsnamelist = array();
foreach ($savedgraphs['user'] as $savedgraph) {
    $savedgraphsnamelist[] = array($savedgraph->id, $savedgraph->name);
}

if ($group) {
    foreach ($savedgraphs['groups'] as $group_graphs) {
        foreach ($group_graphs as $savedgraph) {
            $savedgraphsnamelist[] = array($savedgraph->id, $savedgraph->name);
        }
    }
}

// The graph widget draws in the dashboard page rather than in an iframe, so the
// chart engine loads with the page. Flot 5.1 defines only the Flot global and
// does not touch jQuery, so it sits beside the flot 0.8 plugin the other
// widgets use.
$min_feed_interval = 10;
if (isset($settings['feed']['min_feed_interval'])) {
    $min_feed_interval = (int) $settings['feed']['min_feed_interval'];
}

// Versioned by the time the file was last changed, so an edit reaches a browser
// that has the old one without anybody having to remember to bump a number.
$graph_scripts = array(
    "Lib/js/flot-5.1.0.mod.min.js",
    "Modules/graph/graph.lib.js",
    "Modules/graph/graph.render.js"
);

?>
<script>
var savedgraphsnamelist = <?php echo json_encode($savedgraphsnamelist); ?>;
var min_feed_interval = <?php echo $min_feed_interval; ?>;
</script>
<style>
/* Config form in the options modal of the designer, see graph_config_editor.
   The preview, then the window, type and interval on the left with the axis
   bounds on the right, the fill nulls, gaps and feed tag toggles, the
   feeds as a table with the add button and the saved graph to load under
   it, laid out as the options card of the graph page. */
/* Controls are 26px tall, the height of a small button and of the feed table rows. */
#widget-config-editor select, #widget-config-editor input[type=text] { height: 26px; line-height: 26px; box-sizing: border-box; }
#widget-config-editor input[type=text] { line-height: 18px; padding: 3px 6px; }
.graph-config-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.graph-config-source select { width: 200px; margin: 0; font-size: 12px; }
.graph-config-preview { position: relative; height: 240px; margin-bottom: 10px; border: 1px solid #ddd; background: #fff; }
.graph-config-preview-plot { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
.graph-config-preview-message { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: #777; font-size: 13px; }
.graph-config-preview-message:empty { display: none; }
.graph-config-preview .legendLayer rect.background { fill: rgba(255, 255, 255, 0.6); }
.graph-config-status { color: #b94a48; font-size: 12px; }
.graph-config-status:empty { display: none; }
.graph-config-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.graph-config-lead { display: flex; gap: 8px; flex-wrap: wrap; }
.graph-config-axes { display: flex; gap: 8px; flex-wrap: wrap; }
.graph-config-group { display: inline-flex; align-items: center; margin: 0; white-space: nowrap; }
.graph-config-group .add-on { font-size: 12px; height: 18px; line-height: 18px; padding: 3px 6px; }
/* A button is sized border box, so it takes the full height of the row. */
.graph-config-group .btn.add-on { font-size: 12px; box-sizing: border-box; height: 26px; line-height: 18px; padding: 3px 6px; }
.graph-config-group select { width: auto; margin: 0; font-size: 12px; }
.graph-config-group input { margin: 0; font-size: 12px; text-align: center; }
.graph-config-group input.graph-config-interval { width: 70px; }
.graph-config-group input.graph-config-bound { width: 44px; }
.graph-config-group input.graph-config-maxfill-input { width: 40px; }
/* An input that reads auto until it is clicked, as on the graph page. */
.graph-config-auto { cursor: pointer; background-color: #e9ecef; color: #555; }
.graph-config-toggles { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; font-size: 12px; }
.graph-config-toggle { display: inline-flex; align-items: center; gap: 8px; }
.graph-config-toggle-fill { flex: 1 1 auto; }
.graph-config-toggle-end { margin-left: auto; }
.graph-config-check { display: inline-flex; align-items: center; gap: 5px; margin: 0; font-size: 12px; cursor: pointer; }
.graph-config-check input[type=checkbox] { margin: 0; }
.graph-config-move a { color: #555; text-decoration: none; margin-right: 2px; }
.graph-config-feeds { width: 100%; border-collapse: collapse; font-size: 12px; margin: 4px 0 8px; }
.graph-config-feeds th { text-align: left; font-weight: normal; color: #777; padding: 2px 3px; border-bottom: 1px solid #ddd; white-space: nowrap; }
.graph-config-feeds td { padding: 3px 3px; vertical-align: middle; border-bottom: 1px solid #eee; }
.graph-config-feeds th.center, .graph-config-feeds td.center { text-align: center; }
.graph-config-feeds input, .graph-config-feeds select { margin: 0; font-size: 12px; height: 26px; line-height: 26px; }
.graph-config-feeds input.graph-config-short { width: 40px; text-align: center; box-sizing: border-box; }
.graph-config-feeds select { width: 70px; }
.graph-config-feeds select.graph-config-feed { width: 170px; }
.graph-config-feeds select.graph-config-axis { width: 62px; }
.graph-config-feeds select.graph-config-dp { width: 48px; }
/* The designer sizes every colour input for Firefox from a script, which is
   an inline style, so the width here has to win over one. */
.graph-config-feeds input[type=color] { width: 32px !important; height: 26px !important; padding: 1px; }
.graph-config-feeds input[type=checkbox] { height: auto; line-height: normal; }
.graph-config-remove { font-size: 16px; color: #999; text-decoration: none; }
.graph-config-remove:hover { color: #b94a48; text-decoration: none; }

/* The chart fills the box and the bar of buttons sits over the top right of
   it. The bar is out of sight until the pointer is over the box, so a chart on
   a dashboard is just the chart until somebody wants to move it. */
.graph { position: relative; }
.graph .graph-widget-plot { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
.graph .graph-widget-bar, .graph-config-preview .graph-widget-bar {
    /* Moved inside the plot area once the chart has been drawn, see
       graph_toolbar. These are where it sits until then. */
    position: absolute; top: 5px; right: 5px; z-index: 5;
    opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
}
.graph:hover .graph-widget-bar,
.graph .graph-widget-bar:focus-within,
.graph-config-preview:hover .graph-widget-bar,
.graph-config-preview .graph-widget-bar:focus-within { opacity: 0.85; pointer-events: auto; }
/* A touch screen has no pointer to hover with, so the bar is always shown. */
@media (hover: none) {
    .graph .graph-widget-bar { opacity: 0.85; pointer-events: auto; }
}
/* Plot area too narrow for the bar: expand button only, always shown. See
   graph_toolbar. */
.graph.graph-widget-compact .graph-widget-bar,
.graph-config-preview.graph-widget-compact .graph-widget-bar { opacity: 0.85; pointer-events: auto; }
.graph-widget-compact .graph-widget-buttons .btn-group > :not(.graph-widget-expand) { display: none; }
.graph-widget-compact .graph-widget-buttons .graph-widget-expand { border-radius: 4px; }

.graph .graph-widget-buttons, .graph .graph-widget-window,
.graph-config-preview .graph-widget-buttons, .graph-config-preview .graph-widget-window {
    display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 4px;
}
.graph .graph-widget-bar .btn, .graph-config-preview .graph-widget-bar .btn { min-width: 30px; }
/* The time range sits in the joined group with the buttons, so it is given the
   box of a btn-small rather than the taller one bootstrap gives a select of its
   own. The numbers are the padding and font of .btn-small over the 20px line
   height of .btn, with the box measured the way a button measures it. The
   width is left to the browser, which takes it from the longest option. */
.graph .graph-widget-bar select.graph-widget-range,
.graph-config-preview .graph-widget-bar select.graph-widget-range {
    box-sizing: content-box;
    width: auto; margin: 0; padding: 2px 5px;
    height: 20px; line-height: 20px; font-size: 11.9px;
}
.graph .graph-widget-label, .graph-config-preview .graph-widget-label { font-size: 12px; }
.graph .graph-widget-time, .graph-config-preview .graph-widget-time { width: 165px; margin: 0; font-size: 12px; }
.graph [hidden], .graph-config-preview [hidden] { display: none !important; }
.graph-widget-message { padding: 0.5em; font-size: 13px; }

/* Full screen paints the element over a black page, so the box carries its own
   background while it is there. */
.graph:fullscreen, .graph-config-preview:fullscreen { background: #fff; width: 100% !important; height: 100% !important; }
.graph:fullscreen .graph-widget-plot,
.graph-config-preview:fullscreen .graph-config-preview-plot { top: 20px; left: 20px; right: 20px; bottom: 20px; }

/* Flot draws the legend over the plot and fills the panel behind it from the
   background of the page, which on a dashboard is whatever colour the author
   chose. Given the colour of the box, or as it is on the graph page when the
   box has none. */
.graph .legendLayer rect.background { fill: var(--graph-background, rgba(255, 255, 255, 0.6)); }
.graph .legend { font-size: 13px; }
.graph-chart-tooltip { font-size: 12px; }
</style>
<?php
// Asked for through the dashboard loader where there is one, so flot is
// written out once however many widgets on the page want it. The graph module
// is its own repository, so it may be deployed beside a dashboard module that
// does not have the loader yet.
foreach ($graph_scripts as $script) {
    if (function_exists('dashboard_widget_script')) {
        dashboard_widget_script($script);
        continue;
    }
    echo "<script type=\"text/javascript\" src=\"" . $path . $script . "?v=" . @filemtime($script) . "\"></script>";
}
?>
