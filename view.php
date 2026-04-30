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

    global $path, $embed, $session, $settings;
    $userid = 0;
    $v = 30;
    
    $feedidsLH = "";
    if (isset($_GET['feedidsLH'])) $feedidsLH = $_GET['feedidsLH'];

    $feedidsRH = "";
    if (isset($_GET['feedidsRH'])) $feedidsRH = $_GET['feedidsRH'];

    $load_saved = "";
    if (isset($_GET['load'])) $load_saved = $_GET['load'];
    
    $apikey = "";
    if (isset($_GET['apikey'])) $apikey = $_GET['apikey'];
    
    $min_feed_interval = 10;
    if (isset($settings['feed']['min_feed_interval'])) {
         $min_feed_interval = (int) $settings['feed']['min_feed_interval'];
    }
    
?>

<!--[if IE]><script src="<?php echo $path;?>Lib/flot/excanvas.min.js"></script><![endif]-->

<style>
    [v-cloak] {
        visibility: hidden
    }
    #tables {
        overflow: hidden;
        max-height: 2000px;
        transition: max-height 0.25s ease-in-out;
    }
    .tables-collapsed #tables {
        max-height: 0;
    }
    .collapse-icon {
        display: inline-block;
        transition: transform 0.2s ease;
    }
    .tables-collapsed .collapse-icon {
        transform: rotate(-90deg);
    }
    #feed-options-table input {
        margin-bottom: 0;
    }
    #feed-options-table select {
        margin-bottom: 0;
    }
</style>
<?php
load_css("Lib/bootstrap-datetimepicker-0.0.11/css/bootstrap-datetimepicker.min.css");
load_css("Modules/graph/graph.css");
load_js("Lib/flot-5.1.0.min.js");
load_js("Lib/misc/clipboard.js");
load_js("Lib/bootstrap-datetimepicker-0.0.11/js/bootstrap-datetimepicker.min.js");
load_js("Lib/moment.min.js");
load_js("Lib/user_locale.js");
load_js("Lib/misc/gettext.js");
load_js("Lib/vue.min.js");
?>

<h3><?php echo tr('Data viewer'); ?></h3>
<div id="error" style="display:none"></div>

<div id="navigation" style="padding-bottom:5px;">

    <div class="input-prepend input-append" style="margin-bottom:0 !important">
        <button class='app-btn graph_time_refresh' title="<?php echo tr('Refresh') ?>"><i class="icon-repeat"></i></button>
        <select class='app-btn graph_time' style="width:110px; padding-left:5px">
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
    <button class='app-btn graph_time' type='button' data-time='1' title="<?php echo tr('Day') ?>"><?php echo tr('D') ?></button>
    <button class='app-btn graph_time' type='button' data-time='7' title="<?php echo tr('Week') ?>"><?php echo tr('W') ?></button>
    <button class='app-btn graph_time' type='button' data-time='30' title="<?php echo tr('Month') ?>"><?php echo tr('M') ?></button>
    <button class='app-btn graph_time' type='button' data-time='365' title="<?php echo tr('Year') ?>"><?php echo tr('Y') ?></button>
    -->
    
    <button id='graph_zoomin' class='app-btn' title="<?php echo tr('Zoom In') ?>">+</button>
    <button id='graph_zoomout' class='app-btn' title="<?php echo tr('Zoom Out') ?>">-</button>
    <button id='graph_left' class='app-btn' title="<?php echo tr('Earlier') ?>"><</button>
    <button id='graph_right' class='app-btn' title="<?php echo tr('Later') ?>">></button>
    
    <div id="showcontrols" class="input-prepend input-append">
    <span class="add-on"><?php echo tr('Show') ?></span>
    <span class="add-on"><?php echo tr('missing data') ?>: <input type="checkbox" id="showmissing" style="margin-top:1px" /></span>
    <span class="add-on"><?php echo tr('legend') ?>: <input type="checkbox" id="showlegend" style="margin-top:1px" /></span>
    <span class="add-on"><?php echo tr('feed tag') ?>: <input type="checkbox" id="showtag" style="margin-top:1px" /></span>
    </div>
    
    <div style="clear:both"></div>
</div>

<div id="histogram-controls" style="padding-bottom:5px; display:none;">
    <div class="input-prepend input-append">
        <span class="add-on" style="width:100px"><b><?php echo tr('Histogram') ?></b></span>
        <span class="add-on" style="width:75px"><?php echo tr('Type') ?></span>
        <select id="histogram-type" style="width:150px">
            <option value="timeatvalue" ><?php echo tr('Time at value') ?></option>
            <option value="kwhatpower" ><?php echo tr('kWh at Power') ?></option>
        </select>
        <span class="add-on" style="width:75px"><?php echo tr('Resolution') ?></span>
        <input id="histogram-resolution" type="text" style="width:60px"/>
    </div>
    
    <button id="histogram-back" class="app-btn" style="float:right"><?php echo tr('Back to main view') ?></button>
</div>
<div id="legend"></div>
<div id="placeholder_bound" style="width:100%; height:400px;">
    <div id="placeholder"></div>
</div>

<div id="info">
    
    <div class="input-prepend input-append" style="padding-right:5px">
        <span class="add-on" style="width:50px"><?php echo tr('Start') ?></span>
        <span id="datetimepicker1">
            <input id="request-start" data-format="dd/MM/yyyy hh:mm:ss" type="text" style="width:140px" />
            <span class="add-on"><i data-time-icon="icon-time" data-date-icon="icon-calendar"></i></span>
        </span>
    </div>
    
    <div class="input-prepend input-append" style="padding-right:5px">
        <span class="add-on" style="width:50px"><?php echo tr('End') ?></span>
        <span id="datetimepicker2">
            <input id="request-end" data-format="dd/MM/yyyy hh:mm:ss" type="text" style="width:140px" />
            <span class="add-on"><i data-time-icon="icon-time" data-date-icon="icon-calendar"></i></span>
        </span>
    </div>
    
    <div class="input-prepend input-append" style="padding-right:5px">
        <span class="add-on" style="width:50px"><?php echo tr('Type') ?></span>
        <select id="request-type" style="width:130px">
            <option value="interval"><?php echo tr('Fixed Interval') ?></option>
            <option value="daily"><?php echo tr('Daily') ?></option>
            <option value="weekly"><?php echo tr('Weekly') ?></option>
            <option value="monthly"><?php echo tr('Monthly') ?></option>
            <option value="annual"><?php echo tr('Annual') ?></option>
        </select>
        
    </div>
    <div class="input-prepend input-append" style="padding-right:5px">
        
        <span class="fixed-interval-options">
            <input id="request-interval" type="text" style="width:60px" />
            <span class="add-on"><?php echo tr('Fix') ?> <input id="request-fixinterval" type="checkbox" style="margin-top:1px" /></span>
            <span class="add-on"><?php echo tr('Limit to data interval') ?> <input id="request-limitinterval" type="checkbox" style="margin-top:1px" checked></span>
        </span>
    </div>
    <div>
        <div id="yaxis_left" class="input-append input-prepend">
            <span id="yaxis-left" class="add-on"><?php echo tr('Y-axis').' ('.tr('Left').')' ?>:</span>
            <span class="yaxis-minmax-label add-on"><?php echo tr('min') ?></span>
            <input class="yaxis-minmax" id="yaxis-min" type="text" value="auto">
            <span class="yaxis-minmax-label add-on"><?php echo tr('max') ?></span>
            <input class="yaxis-minmax" id="yaxis-max" type="text" value="auto">
            <button class="app-btn reset-yaxis"><?php echo tr('Reset') ?></button>
        </div>
        <div id="yaxis_right" class="input-append input-prepend">
            <span id="yaxis-right" class="add-on"><?php echo tr('Y-axis').' ('.tr('Right').')' ?>:</span>
            <span class="yaxis-minmax-label add-on"><?php echo tr('min') ?></span>
            <input class="yaxis-minmax" id="yaxis-min2" type="text" value="auto">
            <span class="yaxis-minmax-label add-on"><?php echo tr('max') ?></span>
            <input class="yaxis-minmax" id="yaxis-max2" type="text" value="auto">
            <button class="app-btn reset-yaxis"><?php echo tr('Reset') ?></button>
        </div>
        <button id="reload" class="app-btn" style="vertical-align:top"><?php echo tr('Reload') ?></button>
        <button id="clear" class="app-btn" style="vertical-align:top"><?php echo tr('Clear All') ?></button>
    </div>

    <!-- 
        var remove_null = $(".remove-null")[0].checked;
    var remove_null_max_duration = $(".remove-null-max-duration").val();
-->
    <div class="input-prepend input-append">
        <span class="add-on"><?php echo tr('Remove null values') ?>:</span>
        <span class="add-on"><input type="checkbox" class="remove-null" style="margin-top:3px" /></span>
        <span class="add-on"><?php echo tr('Max fill length') ?>:</span>
        <input type="text" class="remove-null-max-duration" value="900" style="width:60px"/>
        <span class="add-on"><?php echo tr('s') ?></span>
    </div>
    
    <div id="window-info" style=""></div><br>
    
    <div class="feed-options hide">
        <div class="group-card">
            <div class="group-card-header feed-options-header">
                <span class="group-name feed-options-title"><?php echo tr('Feeds in view') ?></span>
                <div class="feed-options-show-options app-btn app-btn-sm hide"><?php echo tr('Show options') ?></div>
                <div class="feed-options-show-stats app-btn app-btn-sm"><?php echo tr('Show statistics') ?></div>
                <i class="collapse-icon icon-chevron-down"></i>
            </div>

            <div id="tables">
                <div id="feed-controls-app" v-cloak>
                    <table id="feed-options-table" v-show="!showStats">
                        <colgroup>
                            <col style="width:40px">
                            <col>
                            <col style="width:100px">
                            <col style="width:65px">
                            <col style="width:55px">
                            <col style="width:65px">
                            <col style="width:72px">
                            <col style="width:72px">
                            <col style="width:70px">
                            <col style="width:100px">
                            <col style="width:50px">
                            <col style="width:130px">
                        </colgroup>
                        <thead>
                            <tr>
                                <th></th>
                                <th><?php echo tr('Feed') ?></th>
                                <th><?php echo tr('Type') ?></th>
                                <th><?php echo tr('Color') ?></th>
                                <th><?php echo tr('Fill') ?></th>
                                <th><?php echo tr('Stack') ?></th>
                                <th style="text-align:center"><?php echo tr('Scale') ?></th>
                                <th style="text-align:center"><?php echo tr('Offset') ?></th>
                                <th style="text-align:center"><?php echo tr('Delta') ?></th>
                                <th style="text-align:center"><?php echo tr('Average') ?></th>
                                <th><?php echo tr('DP') ?></th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(feed, z) in feedlist" :key="feed.id">
                                <td>
                                    <a v-if="z > 0"
                                       @click="moveFeed(z, -1)"
                                       title="<?php echo tr('Move up') ?>"
                                       style="cursor:pointer"><i class="icon-arrow-up"></i></a>
                                    <a v-if="z < feedlist.length - 1"
                                       @click="moveFeed(z, 1)"
                                       title="<?php echo tr('Move down') ?>"
                                       style="cursor:pointer"><i class="icon-arrow-down"></i></a>
                                </td>
                                <td class="col-primary" v-html="feedName(feed)"></td>
                                <td>
                                    <select style="width:80px"
                                            :value="feed.plottype"
                                            @change="setPlottype(feed, $event)">
                                        <option value="lines"><?php echo tr('Lines') ?></option>
                                        <option value="bars"><?php echo tr('Bars') ?></option>
                                        <option value="points"><?php echo tr('Points') ?></option>
                                        <option value="steps"><?php echo tr('Steps') ?></option>
                                    </select>
                                </td>
                                <td>
                                    <input type="color"
                                           style="width:46px"
                                           :value="feedColor(feed)"
                                           @input="setColor(feed, $event)">
                                </td>
                                <td style="text-align:center">
                                    <input type="checkbox"
                                           :checked="!!feed.fill"
                                           @change="setFill(feed, $event)">
                                </td>
                                <td style="text-align:center">
                                    <input type="checkbox"
                                           :checked="!!feed.stack"
                                           @change="setStack(feed, $event)">
                                </td>
                                <td style="text-align:center">
                                    <input type="text"
                                           style="width:50px"
                                           :value="feed.scale"
                                           @change="setScale(feed, $event)">
                                </td>
                                <td style="text-align:center">
                                    <input type="text"
                                           style="width:50px"
                                           :value="feed.offset"
                                           @change="setOffset(feed, $event)">
                                </td>
                                <td style="text-align:center">
                                    <input type="checkbox"
                                           :checked="!!feed.delta"
                                           @change="setDelta(feed, $event)">
                                </td>
                                <td style="text-align:center">
                                    <input type="checkbox"
                                           :checked="!!feed.average"
                                           @change="setAverage(feed, $event)">
                                </td>
                                <td>
                                    <select style="width:50px"
                                            :value="feed.dp"
                                            @change="setDp(feed, $event)">
                                        <option>0</option>
                                        <option>1</option>
                                        <option>2</option>
                                        <option>3</option>
                                    </select>
                                </td>
                                <td style="text-align:center">
                                    <button :feedid="feed.id" class="histogram app-btn">
                                        <?php echo tr('Histogram') ?>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table id="feed-stats-table" v-show="showStats">
                        <colgroup>
                            <col style="width:40px">
                            <col>
                            <col style="width:155px">
                            <col style="width:72px">
                            <col style="width:72px">
                            <col style="width:65px">
                            <col style="width:65px">
                            <col style="width:75px">
                            <col style="width:65px">
                        </colgroup>
                        <thead>
                            <tr>
                                <th></th>
                                <th><?php echo tr('Feed') ?></th>
                                <th><?php echo tr('Quality') ?></th>
                                <th><?php echo tr('Min') ?></th>
                                <th><?php echo tr('Max') ?></th>
                                <th><?php echo tr('Diff') ?></th>
                                <th><?php echo tr('Mean') ?></th>
                                <th><?php echo tr('Stdev') ?></th>
                                <th><?php echo tr('Wh') ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="feed in feedlist" v-if="feed.stats" :key="feed.id">
                                <td></td>
                                <td class="col-primary" v-html="feedName(feed)"></td>
                                <td>{{ feedQuality(feed) }}% ({{ feed.stats.npoints - feed.stats.npointsnull }}/{{ feed.stats.npoints }})</td>
                                <td>{{ !isNaN(Number(feed.stats.minval)) ? feed.stats.minval.toFixed(feed.dp) : '' }}</td>
                                <td>{{ !isNaN(Number(feed.stats.maxval)) ? feed.stats.maxval.toFixed(feed.dp) : '' }}</td>
                                <td>{{ feed.stats.diff.toFixed(feed.dp) }}</td>
                                <td>{{ feed.stats.mean.toFixed(feed.dp) }}</td>
                                <td>{{ feed.stats.stdev.toFixed(feed.dp) }}</td>
                                <td>{{ feedWh(feed) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    <br>
    
    <div class="input-prepend input-append">
        <button class="app-btn" id="showcsv" ><?php echo tr('Show CSV Output') ?></button>
        <span class="add-on csvoptions"><?php echo tr('Time format') ?>:</span>
        <select id="csvtimeformat" class="csvoptions">
            <option value="unix"><?php echo tr('Unix timestamp') ?></option>
            <option value="seconds"><?php echo tr('Seconds since start') ?></option>
            <option value="datestr"><?php echo tr('Date-time string') ?></option>
        </select>
        <span class="add-on csvoptions"><?php echo tr('Null values') ?>:</span>
        <select id="csvnullvalues" class="csvoptions">
            <option value="show"><?php echo tr('Show') ?></option>
            <option value="lastvalue"><?php echo tr('Replace with last value') ?></option>
            <option value="remove"><?php echo tr('Remove whole line') ?></option>
        </select>
        <span class="add-on csvoptions"><?php echo tr('Headers') ?>:</span>
        <select id="csvheaders" class="csvoptions">
            <option value="showNameTag"><?php echo tr('Show name and tag') ?></option>
            <option value="showName"><?php echo tr('Show name') ?></option>
            <option value="hide"><?php echo tr('Hide') ?></option>
        </select>
    </div>

    <div class="input-prepend">
    <button id="download-csv" class="csvoptions btn "><?php echo tr('Download') ?></button>
    </div>
    <div class="input-append"><!-- just to match the styling of the other items -->
        <button onclick="copyToClipboardCustomMsg(document.getElementById('csv'), 'copy-csv-feedback','<?php echo tr('Copied') ?>')" class="csvoptions btn hidden" id="copy-csv" type="button"><?php echo tr('Copy') ?> <i class="icon-share-alt"></i></button>
    </div>

    <span id="copy-csv-feedback" class="csvoptions"></span>
    
    <textarea id="csv" style="width:98%; height:500px; display:none; margin-top:10px"></textarea>
    
    <!-- Graph sidebar hidden element: moved to actual sidebar by javascript -->
    <div id="sidebar_html" class="hide"><?php echo view("Modules/graph/Views/sidebar.php",array()); ?></div>
</div>

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
    'graph.saved.js'
]);
load_js("Modules/graph/graph.js", true, true);
?>

<script>
    // PHP-injected configuration
    var min_feed_interval = <?php echo $min_feed_interval; ?>;
    var apikey = "<?php echo $apikey; ?>";
    var apikeystr = apikey !== "" ? "&apikey=" + apikey : "";

    var session_write = <?php echo $session["write"]; ?>;
    var userid = <?php echo $userid; ?>;
    var feedidsLH = "<?php echo $feedidsLH; ?>";
    var feedidsRH = "<?php echo $feedidsRH; ?>";
    var load_savegraphs = "<?php echo $load_saved; ?>";

    var _user = {
        lang: "<?php if (isset($_SESSION['lang'])) echo $_SESSION['lang']; ?>"
    };
    _locale_loaded = function(event) {
        // callback when locale file loaded
        graph_reload(); // redraw xaxis with correct monthNames and dayNames
    };

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
    ?>;

    // keep button hidden if new version of clipboard.js is not available
    if (typeof copyToClipboardCustomMsg === 'function') {
        document.getElementById('copy-csv').classList.remove('hidden');
    } else {
        copyToClipboardCustomMsg = function() {};
    }

    <?php
    $translations = array(
        "Received data not in correct format. Check the logs for more details" => tr("Received data not in correct format. Check the logs for more details"),
        "Request error" => tr("Request error"),
        "User" => tr("User"),
        "Browser" => tr("Browser"),
        "Authentication Required" => tr("Authentication Required")
    );
    printf("var translations = %s;\n", json_encode($translations));
    ?>

</script>
