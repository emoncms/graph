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
    
    $userid = 0;
    if (isset($_GET['userid'])) $userid = (int) $_GET['userid'];
    
    $feedidsLH = "";
    if (isset($_GET['feedidsLH'])) $feedidsLH = $_GET['feedidsLH'];

    $feedidsRH = "";
    if (isset($_GET['feedidsRH'])) $feedidsRH = $_GET['feedidsRH'];    
?>

<!--[if IE]><script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/excanvas.min.js"></script><![endif]-->


<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.time.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.selection.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.touch.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.togglelegend.min.js"></script>
<!--
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/flot.min.js"></script>
-->
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Modules/graph/vis.helper.js"></script>

<!-- toggle button to choose User or Group. Documentation: http://bootstrapswitch.com/options.html -->
<link href="<?php echo $path; ?>Modules/graph/Lib/bootstrap-switch.css" rel="stylesheet">
<script src="<?php echo $path; ?>Modules/graph/Lib/bootstrap-switch.js"></script>
<link href="<?php echo $path; ?>Modules/graph/graph.css" rel="stylesheet">

<div id="wrapper">
    <div id="sidebar-wrapper">
        <div style="padding-left:10px;">
            <div id="sidebar-close" style="float:right; cursor:pointer; padding:10px;"><i class="icon-remove"></i></div>
            <div id="vis-mode-toggle" class="hide">
                <input type="checkbox" name="vis-mode-toggle" data-on-text="User" data-off-text="Groups" data-label-text="Mode" data-inverse="true" data-on-color="default" data-off-color="default" checked>
            </div>
        </div>
        <div id='vis-mode-user' style="padding-left:10px;">            
            <h3>Feeds</h3>
            <div style="overflow-x: hidden; background-color:#f3f3f3; width:100%">
                <table class="table" id="feeds">
                </table>
            </div>
        </div>
        <div id='vis-mode-groups' class='hide' style="padding-left:10px;">            
            <h3>Groups</h3>
            <select id='select-group'></select>
            <div style="overflow-x: hidden; background-color:#f3f3f3; width:100%">
                <div id='group-table' class='table'></div>
            </div>
        </div>

        <div id="mygraphs" style="padding:10px;">
            <h4>My Graphs</h4>

            <select id="graph-select" style="width:215px">
            </select>

            <br><br>
            <b>Graph Name:</b><br>
            <input id="graph-name" type="text" style="width:200px" />
            <div id="selected-graph-id" style="font-size:10px">Selected graph id: <span id="graph-id">None selected</span></div>
            <button id="graph-delete" class="btn" style="display:none">Delete</button>
            <button id="graph-save" class="btn">Save</button>
        </div>
    </div>

    <div id="page-content-wrapper" style="max-width:1280px">
        
        <h3>Data viewer</h3> 

        <div id="error" style="display:none"></div>

        <div id="navigation" style="padding-bottom:5px;">
            <button class="btn" id="sidebar-open"><i class="icon-list"></i></button>
            <button class='btn graph_time' type='button' time='1'>D</button>
            <button class='btn graph_time' type='button' time='7'>W</button>
            <button class='btn graph_time' type='button' time='30'>M</button>
            <button class='btn graph_time' type='button' time='365'>Y</button>
            <button id='graph_zoomin' class='btn'>+</button>
            <button id='graph_zoomout' class='btn'>-</button>
            <button id='graph_left' class='btn'><</button>
            <button id='graph_right' class='btn'>></button>
            
            <div class="input-prepend input-append" style="float:right; margin-right:22px">
            <span class="add-on">Show</span>
            <span class="add-on">missing data: <input type="checkbox" id="showmissing" style="margin-top:1px" /></span>
            <span class="add-on">legend: <input type="checkbox" id="showlegend" style="margin-top:1px" /></span>
            <span class="add-on">feed tag: <input type="checkbox" id="showtag" style="margin-top:1px" /></span>
            </div>
            
            <div style="clear:both"></div>
        </div>

        <div id="histogram-controls" style="padding-bottom:5px; display:none;">
            <div class="input-prepend input-append">
                <span class="add-on" style="width:75px"><b>Histogram</b></span>
                <span class="add-on" style="width:75px">Type</span>
                <select id="histogram-type" style="width:150px">
                    <option value="timeatvalue" >Time at value</option>
                    <option value="kwhatpower" >kWh at Power</option>
                </select>
                <span class="add-on" style="width:75px">Resolution</span>
                <input id="histogram-resolution" type="text" style="width:60px"/>
            </div>
            
            <button id="histogram-back" class="btn" style="float:right">Back to main view</button>
        </div>

        <div id="placeholder_bound" style="width:100%; height:400px;">
            <div id="placeholder"></div>
        </div>

        <div id="info" style="padding-top:20px; display:none">
            
            <div class="input-prepend" style="padding-right:5px">
                <span class="add-on" style="width:50px">Start</span>
                <input id="request-start" type="text" style="width:80px" />
            </div>
            
            <div class="input-prepend" style="padding-right:5px">
                <span class="add-on" style="width:50px">End</span>
                <input id="request-end" type="text" style="width:80px" />
            </div>
            
            <div class="input-prepend input-append" style="padding-right:5px">
                <span class="add-on" style="width:50px">Type</span>
                <select id="request-type" style="width:120px">
                    <option value="interval">Fixed Interval</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                    <option>Annual</option>
                </select>
                
            </div>
            <div class="input-prepend input-append" style="padding-right:5px">
                
                <span class="fixed-interval-options">
                    <input id="request-interval" type="text" style="width:60px" />
                    <span class="add-on">Fix <input id="request-fixinterval" type="checkbox" style="margin-top:1px" /></span>
                    <span class="add-on">Limit to data interval <input id="request-limitinterval" type="checkbox" style="margin-top:1px" /></span>
                </span>
            </div>
            
            <div class="input-prepend input-append">
                <span class="add-on" style="width:50px">Y-axis:</span>
                <span class="add-on" style="width:30px">min</span>
                <input id="yaxis-min" type="text" style="width:50px" value="auto"/>

                <span class="add-on" style="width:30px">max</span>
                <input id="yaxis-max" type="text" style="width:50px" value="auto"/>
                
                <button id="reload" class="btn">Reload</button>
            </div>
            
            <div id="window-info" style=""></div><br>
            
            <div class="feed-options hide">
                <div class="feed-options-header">
                    <div class="feed-options-title">Feeds in view</div>
                    <div class="feed-options-show-options hide">Show options</div>
                    <div class="feed-options-show-stats">Show statistics</div>
                </div>

                
                <table id="feed-options-table" class="table">
                    <tr><th>Feed</th><th>Type</th><th>Color</th><th>Fill</th><th style='text-align:center'>Scale</th><th style='text-align:center'>Delta</th><th style='text-align:center'>Average</th><th>DP</th><th style="width:120px"></th></tr>
                    <tbody id="feed-controls"></tbody>
                </table>
                
                <table id="feed-stats-table" class="table hide">
                    <tr><th>Feed</th><th>Quality</th><th>Min</th><th>Max</th><th>Diff</th><th>Mean</th><th>Stdev</th><th>Wh</th></tr>
                    <tbody id="feed-stats"></tbody>
                </table>
            </div>
            <br>
            
            <div class="input-prepend input-append">
                <button class="btn" id="showcsv" >Show CSV Output</button>
                <span class="add-on csvoptions">Time format:</span>
                <select id="csvtimeformat" class="csvoptions">
                    <option value="unix">Unix timestamp</option>
                    <option value="seconds">Seconds since start</option>
                    <option value="datestr">Date-time string</option>
                </select>
                <span class="add-on csvoptions">Null values:</span>
                <select id="csvnullvalues" class="csvoptions">
                    <option value="show">Show</option>
                    <option value="lastvalue">Replace with last value</option>
                    <option value="remove">Remove whole line</option>
                </select>
            </div> 
            
            
            <textarea id="csv" style="width:98%; height:500px; display:none; margin-top:10px"></textarea>
        </div>
    </div>
</div>

<script language="javascript" type="text/javascript" src="<?php echo $path;?>Modules/graph/group_graph.js?v=1"></script>

<script>
    var path = "<?php echo $path; ?>";
    var session = <?php echo $session; ?>;
    var group_support = <?php echo $group_support === 0 ? 'false' : 'true'; ?>;
    var vis_mode = 'user';

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
            }});

        // Only show visualization mode switcher if groups module is installed and the user is member of a group (different than "passive member")
        if (group_support === true) {
            // Load user groups
            $.ajax({url: path + "/group/mygroups.json", async: false, dataType: "json", success: function (data_in) {
                    groups = data_in;
                }});
            if (groups.length === 0)
                group_support = false; // Disable group support
            else
                $('#vis-mode-toggle').show();
        }
    }

    /*********************************************
     Init editor
     *********************************************/
    graph_init_editor();

    /*********************************************
     Assign active feedid from URL
     *********************************************/
    var urlparts = window.location.pathname.split("graph/");
    if (urlparts.length == 2) {
        var feedids = urlparts[1].split(",");
        for (var z in feedids) {
            var feedid = parseInt(feedids[z]);

            if (feedid) {
                if (session) {
                    f = getfeed(feedid);
                    feedlist.push({id: feedid, name: f.name, tag: f.tag, yaxis: 1, fill: 0, scale: 1.0, delta: false, dp: 1, plottype: 'lines'});
                } else {
                    feedlist.push({id: feedid, name: "undefined", tag: "undefined", yaxis: 1, fill: 0, scale: 1.0, delta: false, dp: 1, plottype: 'lines'});
                }
            }
        }
    }
    if (urlparts.length > 2) {
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

    /*********************************************
     Other initialitation
     *********************************************/
    sidebar_resize();

    load_feed_selector();
    if (!session)
        $("#mygraphs").hide();
    graph_resize();

    var timeWindow = 3600000 * 24.0 * 7;
    var now = Math.round(+new Date * 0.001) * 1000;
    view.start = now - timeWindow;
    view.end = now;
    view.calc_interval();

    graph_reloaddraw();

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

    /******************************************
     Functions
     ******************************************/
    function get_group_index(groupid) {
        for (z in groups)
            if (groups[z].groupid == groupid)
                return z;
    }
</script>


