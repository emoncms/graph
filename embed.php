<?php
defined('EMONCMS_EXEC') or die('Restricted access');
    /*
    All Emoncms code is released under the GNU Affero General Public License.
    See COPYRIGHT.txt and LICENSE.txt.

    ---------------------------------------------------------------------
    Emoncms - open source energy visualisation
    Part of the OpenEnergyMonitor project:
    http://openenergymonitor.org
    */

    global $path, $embed, $settings;
    global $fullwidth;
    $fullwidth = true;
    
    $graphid = get("graphid");
    
    $apikey = "";
    if (isset($_GET['apikey'])) $apikey = $_GET['apikey'];
    
    $min_feed_interval = 10;
    if (isset($settings['feed']['min_feed_interval'])) {
         $min_feed_interval = (int) $settings['feed']['min_feed_interval'];
    }

    $js_css_version = 6;
?>

<!--[if IE]><script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/excanvas.min.js"></script><![endif]-->
<script>var min_feed_interval = <?php echo $min_feed_interval; ?>;</script>

<?php
load_css("Lib/bootstrap-datetimepicker-0.0.11/css/bootstrap-datetimepicker.min.css");
load_css("Modules/graph/graph.css");
load_js("Lib/flot-5.1.0.min.js");
load_js("Lib/bootstrap-datetimepicker-0.0.11/js/bootstrap-datetimepicker.min.js");
load_js("Lib/moment.min.js");
load_js("Lib/user_locale.js");
load_js("Lib/misc/gettext.js");
load_js("Lib/vue.min.js");
?>

<div id='navigation-timemanual' style='right:1px; display: none;'>
    <div class='input-prepend input-append' style='margin-bottom:5px' >
        <span class='add-on'>Select time window</span>

        <span class='add-on'>Start:</span>
        <span id='datetimepicker1'>
            <input id='request-start' data-format='dd/MM/yyyy hh:mm:ss' type='text' style='width:140px'/>
            <span class='add-on'><i data-time-icon='icon-time' data-date-icon='icon-calendar'></i></span>
        </span>

        <span class='add-on'>End:</span>
        <span id='datetimepicker2'>
            <input id='request-end' data-format='dd/MM/yyyy hh:mm:ss' type='text' style='width:140px'/>
            <span class='add-on'><i data-time-icon='icon-time' data-date-icon='icon-calendar'></i></span>
        </span>

        <button class='btn navigation-timewindow-set' type='button'><i class='icon-ok'></i></button>
    </div>
</div>

<div id="navigation" style="padding-bottom:2px;" >
    <div class="input-prepend input-append" style="margin-bottom:0 !important; margin-left:2px;">
        <button class='btn graph_time_refresh' title="<?php echo tr('Refresh') ?>"><i class="icon-repeat"></i></button>
        <select class='btn graph_time' style="width:90px; padding-left:5px">
            <option value='1'><?php echo tr('1 hour') ?></option>
            <option value='6'><?php echo tr('6 hours') ?></option>
            <option value='12'><?php echo tr('12 hours') ?></option>
            <option value='24'><?php echo tr('24 hours') ?></option>
            <option value='168' selected><?php echo tr('1 Week') ?></option>
            <option value='336'><?php echo tr('2 Weeks') ?></option>        
            <option value='720'><?php echo tr('Month') ?></option>
            <option value='8760'><?php echo tr('Year') ?></option>
        </select>
    </div>
    <!--
    <button class='btn graph_time' type='button' data-time='1'>D</button>
    <button class='btn graph_time' type='button' data-time='7'>W</button>
    <button class='btn graph_time' type='button' data-time='30'>M</button>
    <button class='btn graph_time' type='button' data-time='365'>Y</button>-->
<button class='btn navigation-timewindow' type='button'><i class='icon-resize-horizontal'></i></button>
    <button id='graph_zoomin' class='btn'>+</button>
    <button id='graph_zoomout' class='btn'>-</button>
    <button id='graph_left' class='btn'><</button>
    <button id='graph_right' class='btn'>></button>
</div>

<div id="legend"></div>
<div id="placeholder_bound" style="width:100%; height:100%">
    <div id="placeholder"></div>
</div>

<script>
    var apikey = "<?php echo $apikey; ?>";
    var apikeystr = "";
    if (apikey!="") apikeystr = "&apikey="+apikey;
</script>

<?php
js_import_map('Modules/graph/', [
    'graph.state.js',
    'graph.api.js',
    'graph.chart.js',
    'graph.csv.js',
    'graph.editor.js',
    'graph.utils.js',
    'graph.feedcontrols.js',
    'graph.histogram.js',
    'graph.saved.js',
    'graph.legend.js',
]);
load_js("Modules/graph/graph.js", true, true);
?>

<script>
    var embed = true;
    var graphid = "<?php echo $graphid; ?>";

    var _lang = <?php
        $lang['Select a feed'] = tr('Select a feed');
        $lang['Please select a feed from the Feeds List'] = tr('Please select a feed from the Feeds List');
        $lang['Select graph'] = tr('Select graph');
        $lang['Show CSV Output'] = tr('Show CSV Output');
        $lang['Hide CSV Output'] = tr('Hide CSV Output');
        $lang['Lines'] = tr('Lines');
        $lang['Bars'] = tr('Bars');
        $lang['Points'] = tr('Points');
        $lang['Steps'] = tr('Steps');
        $lang['Histogram'] = tr('Histogram');
        $lang['Move up'] = tr('Move up');
        $lang['Move down'] = tr('Move down');
        $lang['Window'] = tr('Window');
        $lang['Length'] = tr('Length');
        echo json_encode($lang) . ';';
        echo "\n";
    ?>

</script>
