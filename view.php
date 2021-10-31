<?php
    /*
    All Emoncms code is released under the GNU Affero General Public License.
    See COPYRIGHT.txt and LICENSE.txt.

    ---------------------------------------------------------------------
    Emoncms - open source energy visualisation
    Part of the OpenEnergyMonitor project:
    http://openenergymonitor.org
    */

    global $path, $embed;
    $userid = 0;
    $v = 14;
    
    if (isset($_GET['userid'])) $userid = (int) $_GET['userid'];
    
    $feedidsLH = "";
    if (isset($_GET['feedidsLH'])) $feedidsLH = $_GET['feedidsLH'];

    $feedidsRH = "";
    if (isset($_GET['feedidsRH'])) $feedidsRH = $_GET['feedidsRH'];

    $load_saved = "";
    if (isset($_GET['load'])) $load_saved = $_GET['load'];
    
    $apikey = "";
    if (isset($_GET['apikey'])) $apikey = $_GET['apikey'];
?>

<!--[if IE]><script src="<?php echo $path;?>Lib/flot/excanvas.min.js"></script><![endif]-->

<style>
    [v-cloak] {
        visibility: hidden
    }
</style>
<link href="<?php echo $path; ?>Lib/bootstrap-datetimepicker-0.0.11/css/bootstrap-datetimepicker.min.css" rel="stylesheet">
<link href="<?php echo $path; ?>Modules/graph/graph.css?v=<?php echo $v; ?>" rel="stylesheet">

<script src="<?php echo $path;?>Lib/flot/jquery.flot.merged.js"></script>
<!-- <script src="<?php echo $path;?>Lib/flot/jquery.flot.min.js"></script>
<script src="<?php echo $path;?>Lib/flot/jquery.flot.time.min.js"></script>
<script src="<?php echo $path;?>Lib/flot/jquery.flot.selection.min.js"></script>
<script src="<?php echo $path;?>Lib/flot/jquery.flot.touch.min.js"></script>
<script src="<?php echo $path;?>Lib/flot/jquery.flot.togglelegend.min.js"></script>
<script src="<?php echo $path;?>Lib/flot/jquery.flot.resize.min.js"></script>
<script src="<?php echo $path; ?>Lib/flot/jquery.flot.stack.min.js"></script>
-->
<script src="<?php echo $path; ?>Lib/flot/jquery.flot.stack.min.js"></script>
<script src="<?php echo $path;?>Modules/graph/vis.helper.js?v=<?php echo $v; ?>"></script>
<script src="<?php echo $path;?>Lib/misc/clipboard.js?v=<?php echo $v; ?>"></script>
<script src="<?php echo $path; ?>Lib/bootstrap-datetimepicker-0.0.11/js/bootstrap-datetimepicker.min.js"></script>
<script src="<?php echo $path; ?>Lib/vue.min.js?v=<?php echo $v; ?>"></script>

<h3><?php echo _('Data viewer'); ?></h3>
<div id="error" style="display:none"></div>

<div id="navigation" style="padding-bottom:5px;">

    <div class="input-prepend input-append" style="margin-bottom:0 !important">
        <button class='btn graph_time_refresh' title="<?php echo _('Refresh') ?>"><i class="icon-repeat"></i></button>
        <select class='btn graph_time' style="width:110px; padding-left:5px">
            <option value='1'><?php echo _('1 hour') ?></option>
            <option value='6'><?php echo _('6 hours') ?></option>
            <option value='12'><?php echo _('12 hours') ?></option>
            <option value='24'><?php echo _('24 hours') ?></option>
            <option value='168' selected><?php echo _('1 Week') ?></option>
            <option value='336'><?php echo _('2 Weeks') ?></option>        
            <option value='720'><?php echo _('Month') ?></option>
            <option value='8760'><?php echo _('Year') ?></option>
        </select>
    </div>
    <!--
    <button class='btn graph_time' type='button' data-time='1' title="<?php echo _('Day') ?>"><?php echo _('D') ?></button>
    <button class='btn graph_time' type='button' data-time='7' title="<?php echo _('Week') ?>"><?php echo _('W') ?></button>
    <button class='btn graph_time' type='button' data-time='30' title="<?php echo _('Month') ?>"><?php echo _('M') ?></button>
    <button class='btn graph_time' type='button' data-time='365' title="<?php echo _('Year') ?>"><?php echo _('Y') ?></button>
    -->
    
    <button id='graph_zoomin' class='btn' title="<?php echo _('Zoom In') ?>">+</button>
    <button id='graph_zoomout' class='btn' title="<?php echo _('Zoom Out') ?>">-</button>
    <button id='graph_left' class='btn' title="<?php echo _('Earlier') ?>"><</button>
    <button id='graph_right' class='btn' title="<?php echo _('Later') ?>">></button>
    
    <div id="showcontrols" class="input-prepend input-append">
    <span class="add-on"><?php echo _('Show') ?></span>
    <span class="add-on"><?php echo _('missing data') ?>: <input type="checkbox" id="showmissing" style="margin-top:1px" /></span>
    <span class="add-on"><?php echo _('legend') ?>: <input type="checkbox" id="showlegend" style="margin-top:1px" /></span>
    <span class="add-on"><?php echo _('feed tag') ?>: <input type="checkbox" id="showtag" style="margin-top:1px" /></span>
    </div>
    
    <div style="clear:both"></div>
</div>

<div id="histogram-controls" style="padding-bottom:5px; display:none;">
    <div class="input-prepend input-append">
        <span class="add-on" style="width:100px"><b><?php echo _('Histogram') ?></b></span>
        <span class="add-on" style="width:75px"><?php echo _('Type') ?></span>
        <select id="histogram-type" style="width:150px">
            <option value="timeatvalue" ><?php echo _('Time at value') ?></option>
            <option value="kwhatpower" ><?php echo _('kWh at Power') ?></option>
        </select>
        <span class="add-on" style="width:75px"><?php echo _('Resolution') ?></span>
        <input id="histogram-resolution" type="text" style="width:60px"/>
    </div>
    
    <button id="histogram-back" class="btn" style="float:right"><?php echo _('Back to main view') ?></button>
</div>
<div id="legend"></div>
<div id="placeholder_bound" style="width:100%; height:400px;">
    <div id="placeholder"></div>
</div>

<div id="info">
    
    <div class="input-prepend input-append" style="padding-right:5px">
        <span class="add-on" style="width:50px"><?php echo _('Start') ?></span>
        <span id="datetimepicker1">
            <input id="request-start" data-format="dd/MM/yyyy hh:mm:ss" type="text" style="width:140px" />
            <span class="add-on"><i data-time-icon="icon-time" data-date-icon="icon-calendar"></i></span>
        </span>
    </div>
    
    <div class="input-prepend input-append" style="padding-right:5px">
        <span class="add-on" style="width:50px"><?php echo _('End') ?></span>
        <span id="datetimepicker2">
            <input id="request-end" data-format="dd/MM/yyyy hh:mm:ss" type="text" style="width:140px" />
            <span class="add-on"><i data-time-icon="icon-time" data-date-icon="icon-calendar"></i></span>
        </span>
    </div>
    
    <div class="input-prepend input-append" style="padding-right:5px">
        <span class="add-on" style="width:50px"><?php echo _('Type') ?></span>
        <select id="request-type" style="width:130px">
            <option value="interval"><?php echo _('Fixed Interval') ?></option>
            <option value="daily"><?php echo _('Daily') ?></option>
            <option value="weekly"><?php echo _('Weekly') ?></option>
            <option value="monthly"><?php echo _('Monthly') ?></option>
            <option value="annual"><?php echo _('Annual') ?></option>
        </select>
        
    </div>
    <div class="input-prepend input-append" style="padding-right:5px">
        
        <span class="fixed-interval-options">
            <input id="request-interval" type="text" style="width:60px" />
            <span class="add-on"><?php echo _('Fix') ?> <input id="request-fixinterval" type="checkbox" style="margin-top:1px" /></span>
            <span class="add-on"><?php echo _('Limit to data interval') ?> <input id="request-limitinterval" type="checkbox" style="margin-top:1px" checked></span>
        </span>
    </div>
    <div>
        <div id="yaxis_left" class="input-append input-prepend">
            <span id="yaxis-left" class="add-on"><?php echo _('Y-axis').' ('._('Left').')' ?>:</span>
            <span class="yaxis-minmax-label add-on"><?php echo _('min') ?></span>
            <input class="yaxis-minmax" id="yaxis-min" type="text" value="auto">
            <span class="yaxis-minmax-label add-on"><?php echo _('max') ?></span>
            <input class="yaxis-minmax" id="yaxis-max" type="text" value="auto">
            <button class="btn reset-yaxis"><?php echo _('Reset') ?></button>
        </div>
        <div id="yaxis_right" class="input-append input-prepend">
            <span id="yaxis-right" class="add-on"><?php echo _('Y-axis').' ('._('Right').')' ?>:</span>
            <span class="yaxis-minmax-label add-on"><?php echo _('min') ?></span>
            <input class="yaxis-minmax" id="yaxis-min2" type="text" value="auto">
            <span class="yaxis-minmax-label add-on"><?php echo _('max') ?></span>
            <input class="yaxis-minmax" id="yaxis-max2" type="text" value="auto">
            <button class="btn reset-yaxis"><?php echo _('Reset') ?></button>
        </div>
        <button id="reload" class="btn" style="vertical-align:top"><?php echo _('Reload') ?></button>
        <button id="clear" class="btn" style="vertical-align:top"><?php echo _('Clear All') ?></button>
    </div>
    
    <div id="window-info" style=""></div><br>
    
    <div class="feed-options hide">
        <div class="feed-options-header">
            <div class="feed-options-show-options btn btn-default hide"><?php echo _('Show options') ?></div>
            <div class="feed-options-show-stats btn btn-default"><?php echo _('Show statistics') ?></div>
            <a href="#tables" class="feed-options-title">
                <span class="caret pull-left"></span>
                <?php echo _('Feeds in view') ?>
            </a>
        </div>

        <div id="tables">
            <table id="feed-options-table" class="table">
                <tr>
                    <th></th>
                    <th><?php echo _('Feed') ?></th>
                    <th><?php echo _('Type') ?></th>
                    <th><?php echo _('Color') ?></th>
                    <th><?php echo _('Fill') ?></th>
                    <th><?php echo _('Stack') ?></th>
                    <th style='text-align:center'><?php echo _('Scale') ?></th>
                    <th style='text-align:center'><?php echo _('Offset') ?></th>
                    <th style='text-align:center'><?php echo _('Delta') ?></th>
                    <th style='text-align:center'><?php echo _('Average') ?></th>
                    <th><?php echo _('DP') ?></th><th style="width:120px"></th>
                </tr>
                <tbody id="feed-controls"></tbody>
            </table>
            
            <table id="feed-stats-table" class="table hide">
                <tr>
                    <th></th>
                    <th><?php echo _('Feed') ?></th>
                    <th><?php echo _('Quality') ?></th>
                    <th><?php echo _('Min') ?></th>
                    <th><?php echo _('Max') ?></th>
                    <th><?php echo _('Diff') ?></th>
                    <th><?php echo _('Mean') ?></th>
                    <th><?php echo _('Stdev') ?></th>
                    <th><?php echo _('Wh') ?></th>
                </tr>
                <tbody id="feed-stats"></tbody>
            </table>
        </div>
    </div>
    <br>
    
    <div class="input-prepend input-append">
        <button class="btn" id="showcsv" ><?php echo _('Show CSV Output') ?></button>
        <span class="add-on csvoptions"><?php echo _('Time format') ?>:</span>
        <select id="csvtimeformat" class="csvoptions">
            <option value="unix"><?php echo _('Unix timestamp') ?></option>
            <option value="seconds"><?php echo _('Seconds since start') ?></option>
            <option value="datestr"><?php echo _('Date-time string') ?></option>
        </select>
        <span class="add-on csvoptions"><?php echo _('Null values') ?>:</span>
        <select id="csvnullvalues" class="csvoptions">
            <option value="show"><?php echo _('Show') ?></option>
            <option value="lastvalue"><?php echo _('Replace with last value') ?></option>
            <option value="remove"><?php echo _('Remove whole line') ?></option>
        </select>
        <span class="add-on csvoptions"><?php echo _('Headers') ?>:</span>
        <select id="csvheaders" class="csvoptions">
            <option value="showNameTag"><?php echo _('Show name and tag') ?></option>
            <option value="showName"><?php echo _('Show name') ?></option>
            <option value="hide"><?php echo _('Hide') ?></option>
        </select>
    </div>

    <div class="input-prepend">
    <button id="download-csv" class="csvoptions btn "><?php echo _('Download') ?></button>
    </div>
    <div class="input-append"><!-- just to match the styling of the other items -->
        <button onclick="copyToClipboardCustomMsg(document.getElementById('csv'), 'copy-csv-feedback','<?php echo _('Copied') ?>')" class="csvoptions btn hidden" id="copy-csv" type="button"><?php echo _('Copy') ?> <i class="icon-share-alt"></i></button>
    </div>

    <span id="copy-csv-feedback" class="csvoptions"></span>
    
    <textarea id="csv" style="width:98%; height:500px; display:none; margin-top:10px"></textarea>
    
    <!-- Graph sidebar hidden element: moved to actual sidebar by javascript -->
    <div id="sidebar_html" class="hide"><?php echo view("Modules/graph/Views/sidebar.php",array()); ?></div>
</div>


<script>
    var apikey = "<?php echo $apikey; ?>";
    var apikeystr = "";
    if (apikey!="") apikeystr = "&apikey="+apikey;
</script>

<script src="<?php echo $path;?>Modules/graph/graph.js?v=<?php echo $v; ?>"></script>
<script src="<?php echo $path;?>Lib/moment.min.js"></script>
<script>
    var _user = {
        lang : "<?php if (isset($_SESSION['lang'])) echo $_SESSION['lang']; ?>"
    }
    _locale_loaded = function (event){
        // callback when locale file loaded
        graph_reload(); // redraw xaxis with correct monthNames and dayNames
    }
</script>
<script src="<?php echo $path; ?>Lib/user_locale.js"></script>
<script src="<?php echo $path; ?>Lib/misc/gettext.js"></script>

<script>
    var session = <?php echo $session; ?>;
    var userid = <?php echo $userid; ?>;
    var feedidsLH = "<?php echo $feedidsLH; ?>";
    var feedidsRH = "<?php echo $feedidsRH; ?>";
    var load_savegraphs = "<?php echo $load_saved; ?>";

    var _lang = <?php
        $lang['Select a feed'] = _('Select a feed');
        $lang['Please select a feed from the Feeds List'] = _('Please select a feed from the Feeds List');
        $lang['Select graph'] = _('Select graph');
        $lang['Show CSV Output'] = _('Show CSV Output');
        $lang['Hide CSV Output'] = _('Hide CSV Output');
        $lang['Lines'] = _('Lines');
        $lang['Bars'] = _('Bars');
        $lang['Points'] = _('Points');
        $lang['Histogram'] = _('Histogram');
        $lang['Move up'] = _('Move up');
        $lang['Move down'] = _('Move down');
        $lang['Window'] = _('Window');
        $lang['Length'] = _('Length');
        echo json_encode($lang) . ';';
        echo "\n";
    ?>
    
    // Load user feeds
    if (session) {
        $.ajax({
            url: path+"feed/list.json"+apikeystr, async: false, dataType: "json",
            success: function(data_in) { feeds = data_in; }
        });
    // Load public feeds for a particular user
    } else if (userid) {
        $.ajax({
            url: path+"feed/list.json?userid="+userid, async: false, dataType: "json",
            success: function(data_in) { feeds = data_in; }
        });
    }

    // stops a part upgrade error - this change requires emoncms/emoncms repo to also be updated
    // keep button hidden if new version of clipboard.js is not available
    if (typeof copyToClipboardCustomMsg === 'function') {
        document.getElementById('copy-csv').classList.remove('hidden');
    } else {
        copyToClipboardCustomMsg = function () {}
    }
    
    if (load_savegraphs=="") {

        // Assign active feedid from URL
        var urlparts = window.location.pathname.split("graph/");
        if (urlparts.length==2) {
            var feedids = urlparts[1].split(",");
                for (var z in feedids) {
                    var feedid = parseInt(feedids[z]);
                     
                    if (feedid) {
                        var f = getfeed(feedid);
                    if (f==false) f = getfeedpublic(feedid);
                    if (f!=false) feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:1, fill:0, scale: 1.0, delta:false, dp:1, plottype:'lines'});
                      }
                }
        }
        
        // Left hand feed ids property
        if (feedidsLH!="") {
            var feedids = feedidsLH.split(",");
                for (var z in feedids) {
                    var feedid = parseInt(feedids[z]);
                     
                    if (feedid) {
                        var f = getfeed(feedid);
                    if (f==false) f = getfeedpublic(feedid);
                    if (f!=false) feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:1, fill:0, scale: 1.0, delta:false, dp:1, plottype:'lines'});
                      }
                }
        }

        // Right hand feed ids property
        if (feedidsRH!="") {
            var feedids = feedidsRH.split(",");
                for (var z in feedids) {
                    var feedid = parseInt(feedids[z]);
                     
                    if (feedid) {
                        var f = getfeed(feedid);
                    if (f==false) f = getfeedpublic(feedid);
                    if (f!=false) feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:2, fill:0, scale: 1.0, delta:false, dp:1, plottype:'lines'});
                      }
                }
        }
    }

    graph_init_editor();
    load_feed_selector();
    
    graph_resize();
    
    var timeWindow = 3600000*24.0*7;
    var now = Math.round(+new Date * 0.001)*1000;
    view.start = now - timeWindow;
    view.end = now;
    view.calc_interval();
    
    graph_reload();

    $(function(){
        // manually add hide/show
        $('#tables').collapse()

        // trigger hide/show
        $('.feed-options-title').on('click', function (event) {
            event.preventDefault();
            event.target.querySelector('.caret').classList.toggle('open');
            $('#tables').collapse('toggle');
        })
    });

    <?php
    $translations = array(
        "Received data not in correct format. Check the logs for more details" => _("Received data not in correct format. Check the logs for more details"),
        "Request error" => _("Request error"),
        "User" => _("User"),
        "Browser" => _("Browser"),
        "Authentication Required" => _("Authentication Required")
    );
    printf("var translations = %s;\n",json_encode($translations));
    ?>

</script>
