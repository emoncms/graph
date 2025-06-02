<?php
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
    $lookahead = get("lookahead");
    
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
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.time.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.selection.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.touch.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.togglelegend.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path; ?>Lib/flot/jquery.flot.stack.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Modules/graph/vis.helper.js?v=<?php echo $js_css_version; ?>"></script>
<link href="<?php echo $path; ?>Lib/bootstrap-datetimepicker-0.0.11/css/bootstrap-datetimepicker.min.css" rel="stylesheet">
<script language="javascript" type="text/javascript" src="<?php echo $path; ?>Lib/bootstrap-datetimepicker-0.0.11/js/bootstrap-datetimepicker.min.js"></script>
<link href="<?php echo $path; ?>Modules/graph/graph.css?v=<?php echo $js_css_version; ?>" rel="stylesheet">
<script src="<?php echo $path; ?>Lib/vue.min.js?v=<?php echo $js_css_version; ?>"></script>

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
        <button class='btn graph_time_refresh' title="<?php echo _('Refresh') ?>"><i class="icon-repeat"></i></button>
        <select class='btn graph_time' style="width:90px; padding-left:5px">
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

<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/moment.min.js?v=<?php echo $js_css_version; ?>"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Modules/graph/graph.js?v=<?php echo $js_css_version; ?>"></script>

<script>
    $("body").css("background","none");
    embed = true;
    
    var graphid = "<?php echo $graphid; ?>";
    var lookahead = "<?php echo $lookahead; ?>";

    var _lang = <?php
        $lang['Select a feed'] = _('Select a feed');
        $lang['Please select a feed from the Feeds List'] = _('Please select a feed from the Feeds List');
        $lang['Select graph'] = _('Select graph');
        $lang['Show CSV Output'] = _('Show CSV Output');
        $lang['Hide CSV Output'] = _('Hide CSV Output');
        $lang['Lines'] = _('Lines');
        $lang['Bars'] = _('Bars');
        $lang['Points'] = _('Points');
        $lang['Steps'] = _('Steps');
        $lang['Histogram'] = _('Histogram');
        $lang['Move up'] = _('Move up');
        $lang['Move down'] = _('Move down');
        $lang['Window'] = _('Window');
        $lang['Length'] = _('Length');
        echo json_encode($lang) . ';';
        echo "\n";
    ?>
    
    $.ajax({
        url: path+"/graph/get?id="+graphid,
        async: true,
        dataType: "json",
        success: function(result) {
            
            if (result.mode==undefined) result.mode = 'interval';
            
            view.start = result.start;
            view.end = result.end;
            view.mode = result.mode;
            view.interval = result.interval;
            view.limitinterval = result.limitinterval;
            view.fixinterval = result.fixinterval;
            floatingtime = result.floatingtime,
            yaxismin = result.yaxismin;
            yaxismax = result.yaxismax;
            yaxismin2 = result.yaxismin2;
            yaxismax2 = result.yaxismax2;
            feedlist = result.feedlist;
            
            // attempt to update time selector to match the view
            var hours = Math.floor((view.end - view.start) / 3600 / 1000);
            dropdown = $('.graph_time').children()
            for (var i = dropdown.length - 1; i > 0; i--) {
                if (hours >= dropdown[i].value) {
                    $('.graph_time').val(dropdown[i].value);
                    break;
                }
            }

            // show settings
            showmissing = result.showmissing;
            showtag = result.showtag;
            showlegend = result.showlegend;
            
            if (floatingtime) {
                var timewindow = view.end - view.start;
                var now = Math.round(+new Date * 0.001)*1000;
                view.end = now + lookahead * 3600 * 1000;
                view.start = view.end - timewindow;
            }

            if (result.source != undefined && result.source == 'groups'){
                vis_mode = 'groups';
                 $.ajax({url: path + "/group/mygroups.json", async: false, dataType: "json", success: function (data_in) {
                    groups = data_in;
                }});                
            }
            else
                vis_mode = 'user';

            datetimepickerInit();
            graph_resize();
            graph_reload();

            // automatic refresh every 60s < interval / 5 < 1 hour
            var refresh = Math.min(Math.max(60, view.interval / 5), 3600);
            window.setInterval(function() {
              if (floatingtime) {
                var timewindow = view.end - view.start;
                var now = Math.round(+new Date * 0.001)*1000;
                view.end = now + lookahead * 3600 * 1000;
                view.start = view.end - timewindow;
              }
              graph_reload();
            }, refresh * 1000); // ms
        }
    });
    

</script>
