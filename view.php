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
    global $fullwidth;
    $fullwidth = true;
    $v = 2; // force js & css cache reload

    if (!isset($group_support))
        $group_support = 0;

    $userid = 0;
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

<!--[if IE]><script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/excanvas.min.js"></script><![endif]-->


<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.time.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.selection.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.touch.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.togglelegend.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.togglelegend.min.js"></script>
<!--
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/flot.min.js"></script>
-->
<script language="javascript" type="text/javascript" src="<?php echo $path; ?>Lib/flot/jquery.flot.stack.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Modules/graph/vis.helper.js?v=<?php echo $v; ?>"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/misc/clipboard.js?v=<?php echo $v; ?>"></script>
<?php if ($group_support) { ?>
<link href="<?php echo $path; ?>Modules/graph/Lib/bootstrap-switch.css" rel="stylesheet">
<script src="<?php echo $path; ?>Modules/graph/Lib/bootstrap-switch.js"></script>
<?php } ?>
<link href="<?php echo $path; ?>Lib/bootstrap-datetimepicker-0.0.11/css/bootstrap-datetimepicker.min.css" rel="stylesheet">
<script language="javascript" type="text/javascript" src="<?php echo $path; ?>Lib/bootstrap-datetimepicker-0.0.11/js/bootstrap-datetimepicker.min.js"></script>
<link href="<?php echo $path; ?>Modules/graph/graph.css?v=<?php echo $v; ?>" rel="stylesheet">

<script language="javascript" type="text/javascript" src="<?php echo $path; ?>Modules/graph/Lib/date.js"></script>
<script>
        var timezones_ready = false;
        timezoneJS.timezone.zoneFileBasePath = '<?php echo $path; ?>Modules/graph/Lib/tz';
        timezoneJS.timezone.defaultZoneFile = ['europe'];
        timezoneJS.timezone.init({callback: function() {
            timezones_ready = true;
        }});
</script>

<div id="wrapper">
    <div id="sidebar-wrapper">
        <div style="padding-left:10px;">
            <div id="sidebar-close" style="float:right; cursor:pointer; padding:10px;"><i class="icon-remove"></i></div>
            <?php if ($group_support) { ?>
            <div id="vis-mode-toggle" class="hide">
                <input type="checkbox" name="vis-mode-toggle" data-on-text="User" data-off-text="Groups" data-label-text="Mode" data-inverse="true" data-on-color="default" data-off-color="default" checked>
            </div>
            <?php } ?>
        </div>
        <div id='vis-mode-user' style="padding-left:10px;">
            <h3><?php echo _('Feeds') ?></h3>
            <div style="overflow-x: hidden; background-color:#f3f3f3; width:100%">
                <div class="table" id="feeds">
                </div>
            </div>
        </div>

        <?php if ($group_support) { ?>
        <div id='vis-mode-groups' class='hide' style="padding-left:10px;">
            <h3 id="groups-heading"><?php echo _('Groups') ?></h3>
            <select id='select-group'></select>
            <div style="overflow-x: hidden; background-color:#f3f3f3; width:100%">
                <div id='group-table' class='table'></div>
            </div>
        </div>
        <?php } ?>

        <div id="mygraphs" style="padding:10px;">
            <h4><?php echo _('My Graphs') ?></h4>

            <select id="graph-select" style="width:215px">
            </select>

            <br><br>
            <b><?php echo _('Graph Name') ?>:</b><br>
            <input id="graph-name" type="text" style="width:200px" />
            <div id="selected-graph-id" style="font-size:10px"><?php echo _('Selected graph id') ?>: <span id="graph-id"><?php echo _('None selected') ?></span></div>
            <button id="graph-delete" class="btn" style="display:none"><?php echo _('Delete') ?></button>
            <button id="graph-save" class="btn"><?php echo _('Save') ?></button>
        </div>
    </div>

    <div id="page-content-wrapper" style="max-width:1280px">

        <h3><?php echo _('Data viewer') ?></h3>

        <div id="error" style="display:none"></div>

        <div id="navigation" style="padding-bottom:5px;">
            <button class="btn" id="sidebar-open"><i class="icon-list"></i></button>
            <button class='btn graph_time' type='button' time='1' title="<?php echo _('Day') ?>"><?php echo _('D') ?></button>
            <button class='btn graph_time' type='button' time='7' title="<?php echo _('Week') ?>"><?php echo _('W') ?></button>
            <button class='btn graph_time' type='button' time='30' title="<?php echo _('Month') ?>"><?php echo _('M') ?></button>
            <button class='btn graph_time' type='button' time='365' title="<?php echo _('Year') ?>"><?php echo _('Y') ?></button>
            <button id='graph_zoomin' class='btn' title="<?php echo _('Zoom In') ?>">+</button>
            <button id='graph_zoomout' class='btn' title="<?php echo _('Zoom Out') ?>">-</button>
            <button id='graph_left' class='btn' title="<?php echo _('Earlier') ?>"><</button>
            <button id='graph_right' class='btn' title="<?php echo _('Later') ?>">></button>

            <div class="input-prepend input-append" style="float:right; margin-right:22px">
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

        <div id="info" style="padding-top:20px; display:none">

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
                    <option><?php echo _('Daily') ?></option>
                    <option><?php echo _('Weekly') ?></option>
                    <option><?php echo _('Monthly') ?></option>
                    <option><?php echo _('Annual') ?></option>
                </select>

            </div>
            <div class="input-prepend input-append" style="padding-right:5px">

                <span class="fixed-interval-options">
                    <input id="request-interval" type="text" style="width:60px" />
                    <span class="add-on"><?php echo _('Fix') ?> <input id="request-fixinterval" type="checkbox" style="margin-top:1px" /></span>
                    <span class="add-on"><?php echo _('Limit to data interval') ?> <input id="request-limitinterval" type="checkbox" style="margin-top:1px" /></span>
                </span>
            </div>
            <div class="input-prepend input-append" style="padding-right:5px">
                <span class="add-on"><?php echo _('Timezone') ?></span>
                <span class="timezone-options">
                    <select id="timezone">
                        <optgroup label="<?php echo _('System') ?>">
                            <option id="browser_timezone"></option>
                            <option id="user_timezone"></option>
                        </optgroup>
                        <optgroup label="<?php echo _('World Timezones') ?>" id="all_timezones">
                        </optgroup>
                    </select>
                </span>
            </div>
            <div class="input-prepend input-append">
                <span class="add-on" style="width:50px"><?php echo _('Y-axis') ?>:</span>
                <span class="add-on" style="width:30px"><?php echo _('min') ?></span>
                <input id="yaxis-min" type="text" style="width:50px" value="auto"/>

                <span class="add-on" style="width:30px"><?php echo _('max') ?></span>
                <input id="yaxis-max" type="text" style="width:50px" value="auto"/>

                <button id="reload" class="btn"><?php echo _('Reload') ?></button>
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

                <div id="tables" class="collapse">
                    <table id="feed-options-table" class="table">
                        <tr>
                            <th></th>
                            <th><?php echo _('Feed') ?></th>
                            <th><?php echo _('Type') ?></th>
                            <th><?php echo _('Color') ?></th>
                            <th><?php echo _('Fill') ?></th>
                            <th><?php echo _('Stack') ?></th>
                            <th style='text-align:center'><?php echo _('Scale') ?></th>
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

            <div id="download-buttons" class="csvoptions btn-group input-prepend">
                <a class="btn dropdown-toggle" data-toggle="dropdown">
                    <?php echo _('Download') ?>
                    <span class="caret" style="border-top-color:black!important"></span>
                </a>
                <ul class="dropdown-menu">
                    <li>
                        <form id="download_csv" data-download>
                            <input type="hidden" data-format value="csv">
                            <input type="hidden" data-path value="<?php echo $path ?>">
                            <input type="hidden" data-action value="graph/download">
                            <input type="hidden" name="ids">
                            <input type="hidden" name="start">
                            <input type="hidden" name="end">
                            <input type="hidden" name="headers">
                            <input type="hidden" name="timeformat">
                            <input type="hidden" name="interval">
                            <input type="hidden" name="nullvalues">
                            <button class="btn btn-link csvoptions">CSV</button>
                        </form>
                    </li>
                    <li>
                        <form id="download_json" data-download>
                            <input type="hidden" data-format value="json">
                            <input type="hidden" data-path value="<?php echo $path ?>">
                            <input type="hidden" data-action value="graph/download">
                            <input type="hidden" name="ids">
                            <input type="hidden" name="start">
                            <input type="hidden" name="end">
                            <input type="hidden" name="headers">
                            <input type="hidden" name="timeformat">
                            <input type="hidden" name="interval">
                            <input type="hidden" name="nullvalues">
                            <button class="btn btn-link csvoptions">JSON</button>
                        </form>
                    </li>
                </ul>
            </div>

            <div class="input-append"><!-- just to match the styling of the other items -->
                <button onclick="copyToClipboardCustomMsg(document.getElementById('csv'), 'copy-csv-feedback','Copied')" class="csvoptions btn hidden" id="copy-csv" type="button"><?php echo _('Copy') ?> <i class="icon-share-alt"></i></button>
            </div>

            <span id="copy-csv-feedback" class="csvoptions"></span>

            <textarea id="csv" style="width:98%; height:500px; display:none; margin-top:10px"></textarea>
        </div>
    </div>
</div>

<script language="javascript" type="text/javascript" src="<?php echo $path;?>Modules/graph/graph.js?v=<?php echo $v; ?>"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/moment.min.js"></script>
<script>
    var path = "<?php echo $path; ?>";
    var user = {
        lang : "<?php if (isset($_SESSION['lang'])) echo $_SESSION['lang']; ?>"
    }
    _locale_loaded = function (event){
        // callback when locale file loaded
        graph_reloaddraw(); // redraw xaxis with correct monthNames and dayNames
    }
</script>
<script src="<?php echo $path; ?>Lib/user_locale.js"></script>

<script>
    var group_support = <?php echo $group_support === 0 ? 'false' : 'true'; ?>;
    var vis_mode = 'user';
    var path = "<?php echo $path; ?>";
    var session = <?php echo $session; ?>;
    var userid = <?php echo $userid; ?>;
    var feedidsLH = "<?php echo $feedidsLH; ?>";
    var feedidsRH = "<?php echo $feedidsRH; ?>";
    var load_saved = "<?php echo $load_saved; ?>";
    var apikey = "<?php echo $apikey; ?>";
    var _lang = <?php
        $lang['Select a feed'] = _('Select a feed');
        $lang['Please select a feed from the Feeds List'] = _('Please select a feed from the Feeds List');
        $lang['Select graph'] = _('Select graph');
        echo json_encode($lang) . ';';
        echo "\n";
    ?>

    var apikeystr = "";
    if (apikey!="") apikeystr = "&apikey="+apikey;

    /*********************************************
     Load user feeds and groups (users and feeds)
     *********************************************/
    if (session) {
        // Load user feeds
        $.ajax({
            url: path + "/feed/list.json",
            async: false,
            dataType: "json",
            success: function (data_in) {
                feeds = data_in;
            }
        });

        // Only show visualization mode switcher if groups module is installed and the user is member of a group (different than "passive member")
        if (group_support === true) {
            // Load user groups
            $.ajax({url: path + "/group/mygroups.json", async: false, dataType: "json", success: function (data_in) {
                    groups = data_in;
                }});
            if (groups.length === 0)
                group_support = false; // Disable group support
            else {
                $('#vis-mode-toggle').show();
                groups.totalfeeds = groups.reduce(function(acc, cur) { return acc + cur.users.reduce(function(acc, cur) { return acc + cur.totalfeeds; }, 0) }, 0);
            }
        }
    } else if (userid) {
        $.ajax({
            url: path+"feed/list.json?userid="+userid,
            async: false,
            dataType: "json",
            success: function(data_in) {
                feeds = data_in;
            }
        });
    }

    // stops a part upgrade error - this change requires emoncms/emoncms repo to also be updated
    // keep button hidden if new version of clipboard.js is not available
    if (typeof copyToClipboardCustomMsg === 'function') {
        document.getElementById('copy-csv').classList.remove('hidden');
    } else {
        copyToClipboardCustomMsg = function () {}
    }


    /*********************************************
     Assign active feedid from URL
     *********************************************/
    if (load_saved == "") {
        var urlparts = window.location.pathname.split("graph/");
        if (urlparts.length==2) {
        var feedids = urlparts[1].split(",");
        for (var z in feedids) {
            var feedid = parseInt(feedids[z]);

            if (feedid) {
                var f = getfeed(feedid);
                if (f == false)
                    f = getfeedpublic(feedid);
                if (f != false)
                    feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:1, fill:0, scale: 1.0, delta:false, dp:1, plottype:'lines'});
            }
        }
        }

        // Left hand feed ids property
        if (feedidsLH != "") {
            var feedids = feedidsLH.split(",");
            for (var z in feedids) {
                var feedid = parseInt(feedids[z]);

                if (feedid) {
                    var f = getfeed(feedid);
                    if (f == false)
                        f = getfeedpublic(feedid);
                    if (f != false)
                        feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:1, fill:0, scale: 1.0, delta:false, dp:1, plottype:'lines'});
                }
            }
        }

        // Right hand feed ids property
        if (feedidsRH != "") {
            var feedids = feedidsRH.split(",");
            for (var z in feedids) {
                var feedid = parseInt(feedids[z]);

                if (feedid) {
                    var f = getfeed(feedid);
                    if (f == false)
                        f = getfeedpublic(feedid);
                    if (f != false)
                        feedlist.push({id:feedid, name:f.name, tag:f.tag, yaxis:2, fill:0, scale: 1.0, delta:false, dp:1, plottype:'lines'});
                }
            }
        }

        if (group_support && (urlparts.length > 2)) {
            // get data from URL
            var groupid = urlparts[2].slice(0, urlparts[2].indexOf(','));
            var feeds_string = urlparts[2].slice(urlparts[2].indexOf(',') + 1);
            var feedids = feeds_string.split(",");

            // Display groups mode and select the right group
            $("[name='vis-mode-toggle']").bootstrapSwitch('state', false);
            vis_mode = 'groups';
            $('#vis-mode-groups').show();
            $('#vis-mode-user').hide();
            $('#select-group').val(get_group_index(groupid));
            populate_group_table(get_group_index(groupid));

            // fetch feeds to display
            for (var z in feedids) {
                var feedid = parseInt(feedids[z]);

                if (feedid) {
                    if (session) {
                        f = getfeedfromgroups(feedid);
                        feedlist.push({id: feedid, name: f.name, tag: f.tag, yaxis: 1, fill: 0, scale: 1.0, delta: false, dp: 1, plottype: 'lines', source: 'group'});
                    } else {
                        feedlist.push({id: feedid, name: "undefined", tag: "undefined", yaxis: 1, fill: 0, scale: 1.0, delta: false, dp: 1, plottype: 'lines'});
                    }
                }
            }
        }
    }

    /*********************************************
     Initialitation
     *********************************************/
    sidebar_resize();
    graph_init_editor();

    load_feed_selector();
    if (!session) {
        $("#mygraphs").hide();
    } else {
        if (load_saved!="") {
            graph_load_savedgraphs(function(){
                load_saved_graph(load_saved);
            });
        } else {
            graph_load_savedgraphs();
        }
    }
    graph_resize();

    var timeWindow = 3600000 * 24.0 * 7;
    var now = Math.round(+new Date * 0.001) * 1000;
    view.start = now - timeWindow;
    view.end = now;
    view.calc_interval();

    graph_reloaddraw();

    if (group_support) {
        /******************************************
        Visualization mode switcher
        ******************************************/
        $("[name='vis-mode-toggle']").bootstrapSwitch();
        $("[name='vis-mode-toggle']").on('switchChange.bootstrapSwitch', function (event, state) {
            // Clear data viewer
            $('.feed-select-right').prop('checked', '');
            $('.feed-select-left').prop('checked', '');
            feedlist = [];
            graph_reloaddraw();

            //show the relevant info in editor
            if (vis_mode == 'user') {
                vis_mode = 'groups';
                $('#vis-mode-groups').show();
                $('#vis-mode-user').hide();
            }
            else {
                vis_mode = 'user';
                $('#vis-mode-groups').hide();
                $('#vis-mode-user').show();
            }
        });
    }

    /******************************************
     Functions
     ******************************************/
    function get_group_index(groupid) {
        for (z in groups)
            if (groups[z].groupid == groupid)
                return z;
    }

    $(function(){
        // manually add hide/show
        $('#tables').collapse()

        // trigger hide/show
        $('.feed-options-title').on('click', function (event) {
            event.preventDefault();
            event.target.querySelector('.caret').classList.toggle('open');
            $('#tables').collapse('toggle');
            console.log(event.type)
        })
    });
</script>


<script>
    $(function () {
        var user = {};
        var timezones = [];
        var $timezone = $('#timezone');
        var $all_timezones = $('#all_timezones');
        var $user_timezone = $('#user_timezone');
        var $browser_timezone = $('#browser_timezone');

        $.getJSON(path + 'user/gettimezones.json')
        .done( function(result) {
            var out = '';
            for (t in result) {
                var tz = result[t];
                out += '<option value="' + tz.id + '">' + tz.id + ' (' + tz.gmt_offset_text + ')</option>';
                timezones[tz.id] = {
                    label: tz.gmt_offset_text,
                    value: tz.gmt_offset_secs
                }
            }
            $all_timezones.html(out);
        }).then( function() {
            $.getJSON(path + 'user/get.json')
            .done( function(user) {
                $user_timezone.val(user.timezone).text('User: ' + user.timezone +' (' + timezones[user.timezone].label + ')');
            })
            .then (function() {
                let browser_tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                $browser_timezone.val(browser_tz).text('Browser: ' + browser_tz + (timezones[browser_tz] ? ' ('+ timezones[browser_tz].label + ')' : ''));
            })
        })

        $timezone.on('change', function(event) {
            graph_changeTimezone($(event.target).val());
        });

    })
</script>